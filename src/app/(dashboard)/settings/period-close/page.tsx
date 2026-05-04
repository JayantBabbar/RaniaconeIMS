"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-elements";
import { Can } from "@/components/ui/can";
import { periodCloseService } from "@/services/period-close.service";
import { formatDate } from "@/lib/utils";
import { Lock, Unlock, ShieldCheck, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ═══════════════════════════════════════════════════════════
// /settings/period-close — Ledger lock
//
// Once a period is locked, the backend rejects edits to any
// document with posting_date ≤ lock_before_date with a 423
// LOCKED response. Use this AFTER a CA has signed off on the
// month — typically the day after GSTR-3B is filed.
// ═══════════════════════════════════════════════════════════

export default function PeriodClosePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["period-close"],
    queryFn: () => periodCloseService.get(),
  });

  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");

  const setMutation = useMutation({
    mutationFn: periodCloseService.set,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-close"] });
      toast.success("Period close updated");
      setNewDate("");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const lockedBefore = cfg?.lock_before_date ?? null;
  const isLocked = !!lockedBefore;

  return (
    <RequireRead perm="inventory.period_close.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-3xl mx-auto">
        <PageHeader
          title="Period close"
          description="Lock the books up to a date. After locking, no document with a posting date on or before the lock date can be edited, posted, cancelled, or deleted. Use this once your accountant has signed off on the month."
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {/* Current state */}
            <div className={`rounded-lg border-2 p-4 mb-4 ${isLocked
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
              : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"}`}>
              <div className="flex items-start gap-3">
                {isLocked ? (
                  <ShieldCheck className="text-emerald-700 dark:text-emerald-400 flex-shrink-0" size={20} />
                ) : (
                  <Unlock className="text-amber-700 dark:text-amber-400 flex-shrink-0" size={20} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {isLocked ? "Books are closed up to " : "All periods are open"}
                    {isLocked && <span className="text-emerald-700 dark:text-emerald-400">{formatDate(lockedBefore!)}</span>}
                  </p>
                  <p className="mt-1 text-[12px] text-text-secondary">
                    {isLocked
                      ? `No edits allowed on documents posted on or before ${formatDate(lockedBefore!)}.`
                      : "Anyone with the right permission can still edit historical posted documents. Lock the period after CA sign-off."}
                  </p>
                  {isLocked && cfg?.locked_at && (
                    <p className="mt-2 text-[11px] text-text-tertiary">
                      Locked on {formatDate(cfg.locked_at)}
                      {cfg.locked_by ? ` by ${cfg.locked_by}` : ""}
                      {cfg.reason ? ` — ${cfg.reason}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Lock form */}
            <Can perm="inventory.period_close.write">
              <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
                <h3 className="text-[13px] font-semibold flex items-center gap-2">
                  <Lock size={14} /> {isLocked ? "Move the lock date" : "Lock a period"}
                </h3>
                <Input
                  type="date"
                  label="Lock everything posted on or before"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  help="Pick the last day of the period you've finished filing — typically the last of last month."
                />
                <Textarea
                  label="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. GSTR-3B filed for April 2026; signed off by Mehta & Co."
                  rows={2}
                />
                <p className="text-[11px] text-text-tertiary -mt-1">
                  Recorded in the audit trail. Useful when reviewing why a date was chosen.
                </p>
                <div className="flex gap-2">
                  <Button
                    kind="primary"
                    onClick={() => setMutation.mutate({ lock_before_date: newDate, reason })}
                    disabled={!newDate || setMutation.isPending}
                  >
                    <Lock size={14} /> {isLocked ? "Update lock" : "Lock period"}
                  </Button>
                  {isLocked && (
                    <Button
                      kind="ghost"
                      onClick={() => {
                        if (confirm("Unlock all periods? Documents in formerly-locked periods will be editable again. This is rare — typically used to fix an audit-period mistake.")) {
                          setMutation.mutate({ lock_before_date: null, reason: reason || "Unlocked for correction" });
                        }
                      }}
                      disabled={setMutation.isPending}
                    >
                      <Unlock size={14} /> Unlock all
                    </Button>
                  )}
                </div>
              </div>
            </Can>

            <p className="mt-4 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <TriangleAlert size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Locking is one-directional in spirit — unlocking should be rare, and only to correct a mistake before re-locking. Every change is recorded in the audit log.
              </span>
            </p>
          </>
        )}
      </div>
    </RequireRead>
  );
}
