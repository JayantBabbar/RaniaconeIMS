import { api } from "@/lib/api-client";
import { PERIOD_CLOSE } from "@/lib/api-constants";
import type { PeriodCloseConfig } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Period-close service — Phase 5 (REQ-9).
//
// Tenant-level "books are closed up to this date" floor. Once set,
// posting/cancel/edit/delete on any document whose posting_date is
// on or before lock_before_date is blocked with 423 LOCKED.
//
// Used by accountants right after CA hand-off to prevent late edits
// to a filed period.
// ═══════════════════════════════════════════════════════════════════

interface SetPayload {
  lock_before_date: string | null;   // null = unlock entirely
  reason?: string;
  [key: string]: unknown;
}

export const periodCloseService = {
  get: () => api.get<PeriodCloseConfig>(PERIOD_CLOSE.GET),
  set: (payload: SetPayload) =>
    api.put<PeriodCloseConfig>(PERIOD_CLOSE.SET, payload),
};
