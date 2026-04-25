#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# smoke-test-api-spa.sh — Super-admin cross-tenant flow verification.
#
# Verifies the §4 (24-apr) backend changes that landed in commit
# cdc09a8 + 5a5357a. Specifically:
#
#   1. Super admin can log in.
#   2. Without X-Acting-Tenant-Id, tenant-scoped reads return [] (correct).
#   3. With X-Acting-Tenant-Id, tenant-scoped reads return real data.
#   4. With X-Acting-Tenant-Id, tenant-scoped writes succeed (role create).
#   5. POST /users/{id}/reset-password (§2) works for cross-tenant target.
#
# Usage:
#   AUTH_BASE=http://localhost:8000/api/v1 \
#   INV_BASE=http://localhost:8001/api/v1  \
#   EMAIL=admin@raniacone.com              \
#   PASSWORD='Admin@12345'                 \
#   ./scripts/smoke-test-api-spa.sh
#
# Requires: curl, jq.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

AUTH_BASE="${AUTH_BASE:-http://localhost:8000/api/v1}"
INV_BASE="${INV_BASE:-http://localhost:8001/api/v1}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: EMAIL=... PASSWORD=... $0" >&2
  exit 2
fi

PASS_COUNT=0
FAIL_COUNT=0
FAILURES=()

ok()    { echo "  ✓ $*"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail()  { echo "  ✗ $*" >&2; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILURES+=("$*"); }
hdr()   { echo ""; echo "── $* ──"; }

# ── 1. Login as super admin ─────────────────────────────────────────
hdr "Authenticating as super admin: $EMAIL"

LOGIN=$(curl -sS -X POST "$AUTH_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e, password:$p}')")

ACCESS=$(echo "$LOGIN" | jq -r '.access_token // empty')
IS_SA=$(echo "$LOGIN" | jq -r '.is_super_admin // false')

if [[ -z "$ACCESS" ]]; then
  echo "  ✗ login failed:" >&2
  echo "$LOGIN" | jq . >&2
  exit 1
fi
ok "logged in"

if [[ "$IS_SA" != "true" ]]; then
  fail "logged-in user is NOT a super admin (is_super_admin=$IS_SA) — these tests will not behave as expected"
else
  ok "confirmed is_super_admin=true"
fi

AUTH_H="Authorization: Bearer $ACCESS"

# ── 2. List tenants (super admin allowed) ───────────────────────────
hdr "Discovering tenants"
TENANTS=$(curl -sS "$AUTH_BASE/tenants?limit=500" -H "$AUTH_H")
TENANT_COUNT=$(echo "$TENANTS" | jq 'if type == "array" then length else (.data | length) end')

if [[ "$TENANT_COUNT" -gt 0 ]]; then
  ok "GET /tenants → $TENANT_COUNT tenants"
else
  fail "GET /tenants returned 0 — cannot continue cross-tenant tests"
  echo "Failed: $FAIL_COUNT — exiting" >&2
  exit 1
fi

# Pick a tenant that actually has users — required for §4 cross-tenant tests.
# We scan up to N tenants and stop at the first non-empty one.
TENANT_ROWS=$(echo "$TENANTS" | jq -r 'if type == "array" then . else .data end | .[] | "\(.id)\t\(.code)"')

TID=""
TCODE=""
SCANNED=0
while IFS=$'\t' read -r tid tcode; do
  SCANNED=$((SCANNED + 1))
  cnt=$(curl -sS "$AUTH_BASE/users?limit=1" \
    -H "$AUTH_H" -H "X-Acting-Tenant-Id: $tid" \
    | jq 'if type == "array" then length else (.data | length) end' 2>/dev/null || echo 0)
  if [[ "$cnt" -gt 0 ]]; then
    TID="$tid"
    TCODE="$tcode"
    break
  fi
done <<< "$TENANT_ROWS"

if [[ -z "$TID" ]]; then
  fail "scanned $SCANNED tenants — none had any users; cannot continue"
  echo "Failed: $FAIL_COUNT — exiting" >&2
  exit 1
fi

ok "scanned $SCANNED tenants; using $TCODE ($TID) — has users"

# ── 3. /users without header → must return [] for SPA ───────────────
hdr "GET /users without X-Acting-Tenant-Id (expect [])"
NO_HDR=$(curl -sS "$AUTH_BASE/users?limit=200" -H "$AUTH_H")
NO_HDR_LEN=$(echo "$NO_HDR" | jq 'if type == "array" then length else (.data | length) end')
if [[ "$NO_HDR_LEN" == "0" ]]; then
  ok "returned empty array as expected"
else
  fail "expected 0 rows for SPA without header, got $NO_HDR_LEN — backend §4 may not be deployed"
fi

# ── 4. /users WITH header → must return that tenant's users ─────────
hdr "GET /users with X-Acting-Tenant-Id: $TCODE"
WITH_HDR=$(curl -sS "$AUTH_BASE/users?limit=200" \
  -H "$AUTH_H" -H "X-Acting-Tenant-Id: $TID")
WITH_HDR_LEN=$(echo "$WITH_HDR" | jq 'if type == "array" then length else (.data | length) end')
if [[ "$WITH_HDR_LEN" -gt 0 ]]; then
  ok "returned $WITH_HDR_LEN users for tenant $TCODE"
else
  fail "expected >0 users with header, got 0 — either backend §4 not deployed, or tenant has no users"
fi

# Capture a target user id for the password-reset test
TARGET_UID=$(echo "$WITH_HDR" | jq -r '
  (if type == "array" then . else .data end)
  | map(select(.is_super_admin != true)) | .[0].id // empty')

# ── 5. /roles cross-tenant read ─────────────────────────────────────
hdr "GET /roles with X-Acting-Tenant-Id"
ROLES=$(curl -sS "$AUTH_BASE/roles?limit=200" \
  -H "$AUTH_H" -H "X-Acting-Tenant-Id: $TID")
ROLES_LEN=$(echo "$ROLES" | jq 'if type == "array" then length else (.data | length) end')
if [[ "$ROLES_LEN" -gt 0 ]]; then
  ok "returned $ROLES_LEN roles for tenant $TCODE"
else
  fail "expected >0 roles with header, got 0"
fi

# ── 6. /roles WITHOUT header → expected []
hdr "GET /roles without X-Acting-Tenant-Id (expect [])"
ROLES_NO=$(curl -sS "$AUTH_BASE/roles?limit=200" -H "$AUTH_H")
ROLES_NO_LEN=$(echo "$ROLES_NO" | jq 'if type == "array" then length else (.data | length) end')
if [[ "$ROLES_NO_LEN" == "0" ]]; then
  ok "returned empty array as expected"
else
  fail "expected 0 roles for SPA without header, got $ROLES_NO_LEN"
fi

# ── 7. POST /roles cross-tenant write ────────────────────────────────
hdr "POST /roles cross-tenant (X-Acting-Tenant-Id required)"
ROLE_CODE="smoke-spa-$(date +%Y%m%d-%H%M%S)"
NEW_ROLE=$(curl -sS -X POST "$AUTH_BASE/roles" \
  -H "$AUTH_H" -H "Content-Type: application/json" \
  -H "X-Acting-Tenant-Id: $TID" \
  -d "$(jq -n --arg c "$ROLE_CODE" '{code:$c, name:"SPA Smoke Role"}')")

NEW_ROLE_ID=$(echo "$NEW_ROLE" | jq -r '.id // empty')
if [[ -n "$NEW_ROLE_ID" ]]; then
  ok "POST /roles → created $NEW_ROLE_ID ($ROLE_CODE)"

  # Verify it appears in subsequent GET /roles
  SEEN=$(curl -sS "$AUTH_BASE/roles?limit=200" \
    -H "$AUTH_H" -H "X-Acting-Tenant-Id: $TID" | \
    jq -r --arg id "$NEW_ROLE_ID" '
      (if type == "array" then . else .data end)
      | map(select(.id == $id)) | length')
  if [[ "$SEEN" == "1" ]]; then
    ok "GET /roles → newly-created role visible"
  else
    fail "GET /roles → newly-created role NOT visible (saw $SEEN matches)"
  fi
else
  fail "POST /roles failed: $(echo "$NEW_ROLE" | jq -c .)"
fi

# ── 8. POST /roles WITHOUT header → expect 400 TENANT_REQUIRED ──────
hdr "POST /roles without X-Acting-Tenant-Id (expect 400)"
NO_HDR_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$AUTH_BASE/roles" \
  -H "$AUTH_H" -H "Content-Type: application/json" \
  -d "$(jq -n --arg c "should-fail-$(date +%s)" '{code:$c, name:"Should not exist"}')")
NO_HDR_STATUS="${NO_HDR_RESP##*$'\n'}"
NO_HDR_BODY="${NO_HDR_RESP%$'\n'*}"
NO_HDR_CODE=$(echo "$NO_HDR_BODY" | jq -r '.code // empty')

if [[ "$NO_HDR_STATUS" == "400" && "$NO_HDR_CODE" == "TENANT_REQUIRED" ]]; then
  ok "POST /roles without header → 400 TENANT_REQUIRED as expected"
elif [[ "$NO_HDR_STATUS" == "400" ]]; then
  ok "POST /roles without header → 400 (code=$NO_HDR_CODE; expected TENANT_REQUIRED)"
else
  fail "POST /roles without header → $NO_HDR_STATUS / $NO_HDR_CODE (expected 400 TENANT_REQUIRED)"
fi

# ── 9. POST /roles with INVALID UUID in header → 422 ────────────────
hdr "POST /roles with invalid header UUID (expect 422)"
BAD_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$AUTH_BASE/roles" \
  -H "$AUTH_H" -H "Content-Type: application/json" \
  -H "X-Acting-Tenant-Id: not-a-uuid" \
  -d "$(jq -n --arg c "bad-$(date +%s)" '{code:$c, name:"x"}')")
BAD_STATUS="${BAD_RESP##*$'\n'}"
if [[ "$BAD_STATUS" == "422" ]]; then
  ok "POST /roles with bad header UUID → 422 as expected"
else
  fail "POST /roles with bad header UUID → $BAD_STATUS (expected 422)"
fi

# ── 10. POST /users/{id}/reset-password (§2) ────────────────────────
hdr "POST /users/{id}/reset-password (§2 admin-initiated reset)"
if [[ -z "$TARGET_UID" ]]; then
  fail "no non-super-admin user found in tenant — skipping"
else
  TMP_PWD="SmokeReset$(date +%s)!"
  RESET_RESP=$(curl -sS -w "\n%{http_code}" -X POST \
    "$AUTH_BASE/users/$TARGET_UID/reset-password" \
    -H "$AUTH_H" -H "Content-Type: application/json" \
    -H "X-Acting-Tenant-Id: $TID" \
    -d "$(jq -n --arg p "$TMP_PWD" '{new_password:$p}')")
  RESET_STATUS="${RESET_RESP##*$'\n'}"

  if [[ "$RESET_STATUS" == "204" ]]; then
    ok "POST /users/$TARGET_UID/reset-password → 204 (password replaced)"
    # Restore tenant admin's original password to keep the demo set sane.
    # We don't know the original, so just leave the test password.
    echo "  ! note: target user's password is now '$TMP_PWD' — reset manually if needed"
  else
    fail "reset-password returned $RESET_STATUS (expected 204)"
  fi
fi

# ── 11. POST /users/{id}/reset-password without header → 400/403 ────
hdr "POST /users/{id}/reset-password without X-Acting-Tenant-Id (SPA needs it)"
if [[ -n "$TARGET_UID" ]]; then
  NO_HDR_RESET=$(curl -sS -w "\n%{http_code}" -X POST \
    "$AUTH_BASE/users/$TARGET_UID/reset-password" \
    -H "$AUTH_H" -H "Content-Type: application/json" \
    -d "$(jq -n '{new_password:"AnyValid123!"}')")
  NO_HDR_RESET_STATUS="${NO_HDR_RESET##*$'\n'}"
  if [[ "$NO_HDR_RESET_STATUS" == "400" || "$NO_HDR_RESET_STATUS" == "403" || "$NO_HDR_RESET_STATUS" == "404" ]]; then
    ok "without header → $NO_HDR_RESET_STATUS (rejected as expected)"
  else
    fail "without header → $NO_HDR_RESET_STATUS (expected 400/403/404)"
  fi
fi

# ── 12. Cleanup — delete the role we created ────────────────────────
hdr "Cleanup"
if [[ -n "${NEW_ROLE_ID:-}" ]]; then
  DEL=$(curl -sS -w "%{http_code}" -X DELETE "$AUTH_BASE/roles/$NEW_ROLE_ID" \
    -H "$AUTH_H" -H "X-Acting-Tenant-Id: $TID" -o /dev/null)
  if [[ "$DEL" == "204" || "$DEL" == "200" ]]; then
    ok "deleted smoke role $NEW_ROLE_ID"
  else
    fail "delete smoke role returned $DEL — manual cleanup needed"
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo ""
  echo "  Failures:"
  for f in "${FAILURES[@]}"; do echo "    - $f"; done
  exit 1
fi
echo "  All checks passed."
