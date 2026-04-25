#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# smoke-test-api.sh — End-to-end live-backend API check.
#
# Hits each list endpoint we care about and verifies:
#   1. HTTP 200
#   2. Response is an array (or {data: [...]} envelope) with a length
#   3. The just-created resource is visible in the subsequent GET
#
# Usage:
#   AUTH_BASE=http://localhost:8000/api/v1 \
#   INV_BASE=http://localhost:8001/api/v1  \
#   EMAIL=admin@yourtenant.com             \
#   PASSWORD='YourPassword!'               \
#   ./scripts/smoke-test-api.sh
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

# ── 1. Login ────────────────────────────────────────────────────────
hdr "Authenticating as $EMAIL"

LOGIN=$(curl -sS -X POST "$AUTH_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e, password:$p}')")

ACCESS=$(echo "$LOGIN" | jq -r '.access_token // empty')

if [[ -z "$ACCESS" ]]; then
  echo "  ✗ login failed:" >&2
  echo "$LOGIN" | jq . >&2
  exit 1
fi

ok "logged in (access token captured)"

AUTH_H="Authorization: Bearer $ACCESS"

# ── 2. Health checks ────────────────────────────────────────────────
hdr "Health"
for svc in "$AUTH_BASE/health" "$INV_BASE/health"; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" "$svc")
  if [[ "$status" == "200" ]]; then ok "$svc → 200"; else fail "$svc → $status"; fi
done

# ── 3. Generic list-endpoint probe ──────────────────────────────────
# For each endpoint, do a GET, verify 200, and count rows handling
# both envelope and plain-array shapes.
probe_list() {
  local url="$1"
  local name="$2"
  local headers=("-H" "$AUTH_H")
  if [[ -n "${3:-}" ]]; then headers+=("-H" "$3"); fi

  local resp
  resp=$(curl -sS -w "\n%{http_code}" "$url" "${headers[@]}") || {
    fail "$name → curl error"
    return
  }
  local status="${resp##*$'\n'}"
  local body="${resp%$'\n'*}"

  if [[ "$status" != "200" ]]; then
    fail "$name → HTTP $status"
    return
  fi

  # Determine shape: array or envelope
  local len
  if echo "$body" | jq -e 'type == "array"' >/dev/null 2>&1; then
    len=$(echo "$body" | jq 'length')
    ok "$name → 200, plain-array, ${len} rows"
  elif echo "$body" | jq -e 'type == "object" and has("data")' >/dev/null 2>&1; then
    len=$(echo "$body" | jq '.data | length')
    ok "$name → 200, envelope, ${len} rows"
  else
    fail "$name → 200 but unexpected shape"
  fi
}

hdr "Inventory list endpoints"
probe_list "$INV_BASE/items?limit=10"                "GET /items"
probe_list "$INV_BASE/parties?limit=10"              "GET /parties"
probe_list "$INV_BASE/inventory-locations?limit=10"  "GET /inventory-locations"
probe_list "$INV_BASE/balances?limit=10"             "GET /balances"
probe_list "$INV_BASE/movements?limit=10"            "GET /movements"
probe_list "$INV_BASE/reservations?limit=10"         "GET /reservations"
probe_list "$INV_BASE/valuation-layers?limit=10"     "GET /valuation-layers"
probe_list "$INV_BASE/documents?limit=10"            "GET /documents"
probe_list "$INV_BASE/document-types?limit=10"       "GET /document-types"
probe_list "$INV_BASE/counts?limit=10"               "GET /counts"
probe_list "$INV_BASE/workflows?limit=10"            "GET /workflows"
probe_list "$INV_BASE/integrations?limit=10"         "GET /integrations"
probe_list "$INV_BASE/webhooks?limit=10"             "GET /webhooks"
probe_list "$INV_BASE/imports?limit=10"              "GET /imports"
probe_list "$INV_BASE/tenant-config?limit=10"        "GET /tenant-config"
probe_list "$INV_BASE/module-config?limit=10"        "GET /module-config"
probe_list "$INV_BASE/attachments?limit=10"          "GET /attachments"
probe_list "$INV_BASE/custom-field-definitions?limit=10" "GET /custom-field-definitions"
probe_list "$INV_BASE/status-master?limit=10"        "GET /status-master"
probe_list "$INV_BASE/number-series?limit=10"        "GET /number-series"
probe_list "$INV_BASE/uom-categories?limit=10"       "GET /uom-categories"
probe_list "$INV_BASE/uoms?limit=10"                 "GET /uoms"
probe_list "$INV_BASE/uom-conversions?limit=10"      "GET /uom-conversions"
probe_list "$INV_BASE/item-brands?limit=10"          "GET /item-brands"
probe_list "$INV_BASE/item-categories?limit=10"      "GET /item-categories"

hdr "Auth list endpoints"
probe_list "$AUTH_BASE/tenants?limit=10"             "GET /tenants"
probe_list "$AUTH_BASE/permissions?limit=10"         "GET /permissions"
probe_list "$AUTH_BASE/modules?limit=10"             "GET /modules"
probe_list "$AUTH_BASE/users?limit=10"               "GET /users (own tenant)"
probe_list "$AUTH_BASE/roles?limit=10"               "GET /roles"
probe_list "$AUTH_BASE/currencies?limit=10"          "GET /currencies"

# ── 4. Round-trip — POST a count, GET it back ──────────────────────
hdr "POST /counts then GET /counts (regression for the original bug)"

# Need a location id to create a count against
LOC_ID=$(curl -sS "$INV_BASE/inventory-locations?limit=1" -H "$AUTH_H" \
  | jq -r '(.data[0].id // .[0].id) // empty')

if [[ -z "$LOC_ID" ]]; then
  fail "no location available — create one before running this round-trip"
else
  COUNT_NUM="SMOKE-CT-$(date +%Y%m%d-%H%M%S)"
  CREATE_BODY=$(jq -n --arg num "$COUNT_NUM" --arg loc "$LOC_ID" \
    '{count_number:$num, count_date:"2026-04-25", location_id:$loc}')
  CREATED=$(curl -sS -X POST "$INV_BASE/counts" \
    -H "$AUTH_H" -H "Content-Type: application/json" -d "$CREATE_BODY")
  CREATED_ID=$(echo "$CREATED" | jq -r '.id // empty')
  if [[ -z "$CREATED_ID" ]]; then
    fail "POST /counts failed: $(echo "$CREATED" | jq -c .)"
  else
    ok "POST /counts → created $CREATED_ID ($COUNT_NUM)"
    # Verify it appears in GET
    SEEN=$(curl -sS "$INV_BASE/counts?limit=200" -H "$AUTH_H" \
      | jq -r --arg id "$CREATED_ID" '
          (if type == "array" then . else .data end)
          | map(select(.id == $id)) | length')
    if [[ "$SEEN" == "1" ]]; then
      ok "GET /counts → new count visible"
    else
      fail "GET /counts → new count NOT visible (saw $SEEN matching rows)"
    fi
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
