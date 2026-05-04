"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { salaryService } from "@/services/salary.service";
import { employeeService } from "@/services/employees.service";
import { accountService } from "@/services/accounts.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Lock, Ban, Printer } from "lucide-react";

export default function SalaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRead perm="inventory.salary.read">
      <SalaryDetail id={id} />
    </RequireRead>
  );
}

function SalaryDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const [showCancel, setShowCancel] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ["salary", id],
    queryFn: () => salaryService.getById(id),
  });
  const { data: emp } = useQuery({
    queryKey: ["employee", entry?.employee_id],
    queryFn: () => employeeService.getById(entry!.employee_id),
    enabled: !!entry?.employee_id,
  });
  const { data: acc } = useQuery({
    queryKey: ["account", entry?.paid_from_account_id],
    queryFn: () => accountService.getById(entry!.paid_from_account_id),
    enabled: !!entry?.paid_from_account_id,
  });

  const post = useMutation({
    mutationFn: () => salaryService.post(id),
    onSuccess: () => {
      toast.success("Salary posted");
      qc.invalidateQueries({ queryKey: ["salary"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not post"),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => salaryService.cancel(id, reason),
    onSuccess: () => {
      toast.success("Salary cancelled");
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ["salary"] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not cancel"),
  });

  if (isLoading || !entry) return <><TopBar /><div className="flex justify-center py-16"><Spinner /></div></>;

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title={entry.salary_number}
          description={`${emp?.name ?? entry.employee_id} · ${formatDate(entry.period_month)}`}
          actions={
            <div className="flex gap-2">
              <Badge tone={entry.status === "posted" ? "green" : entry.status === "cancelled" ? "red" : "amber"}>{entry.status}</Badge>
              {entry.status === "draft" && can("inventory.salary.post") && (
                <Button kind="primary" onClick={() => post.mutate()} disabled={post.isPending}><Lock size={13} /> Post</Button>
              )}
              {entry.status === "posted" && can("inventory.salary.cancel") && (
                <Button kind="danger" onClick={() => setShowCancel(true)}><Ban size={13} /> Cancel</Button>
              )}
              <Link href={`/money/salary/${id}/payslip`}>
                <Button kind="ghost"><Printer size={13} /> Payslip</Button>
              </Link>
            </div>
          }
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <Row label="Gross salary"   value={formatCurrency(entry.gross_salary, "INR", "en-IN")} />
          <Row label="Float held"     value={formatCurrency(entry.float_held, "INR", "en-IN")} tone={Number(entry.float_held) > 0 ? "amber" : undefined} />
          <Row label="Net paid"       value={formatCurrency(entry.net_paid, "INR", "en-IN")} bold />
          <Row label="Paid from"      value={acc?.name ?? entry.paid_from_account_id} />
          {entry.posting_date && <Row label="Posted on" value={formatDate(entry.posting_date)} />}
          {entry.cancellation_reason && <Row label="Cancelled" value={entry.cancellation_reason} />}
          {entry.remarks && <Row label="Remarks" value={entry.remarks} />}
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-3 text-[12px] text-text-tertiary">
          <p className="font-semibold text-text-secondary text-[13px] mb-2">What posting writes to the ledger</p>
          <pre className="font-mono leading-5">
{`Dr. Salary expense                      ${formatCurrency(entry.gross_salary, "INR", "en-IN")}
Cr. Float — ${emp?.name ?? "(employee)"}                    ${formatCurrency(entry.float_held, "INR", "en-IN")}   ← clears the float
Cr. ${acc?.name ?? "(paid from)"}                            ${formatCurrency(entry.net_paid, "INR", "en-IN")}   ← actual cash out`}
          </pre>
        </div>
      </div>

      {showCancel && (
        <Dialog open onClose={() => setShowCancel(false)} title="Cancel salary?" description="Reverses the three-row ledger entry. The employee's float gets restored — they'll 'owe' the company that float again.">
          <CancelBody onCancel={(r) => cancel.mutate(r)} loading={cancel.isPending} onClose={() => setShowCancel(false)} />
        </Dialog>
      )}
    </>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: React.ReactNode; bold?: boolean; tone?: "amber" }) {
  return (
    <>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className={`${bold ? "font-semibold tabular-nums" : ""} ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : ""}`}>{value}</dd>
    </>
  );
}

function CancelBody({ onCancel, loading, onClose }: { onCancel: (r: string) => void; loading: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <FormField label="Reason" required>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong period entered" autoFocus />
      </FormField>
      <div className="flex justify-end gap-2 mt-4">
        <Button kind="ghost" onClick={onClose}>Keep it</Button>
        <Button kind="danger" onClick={() => reason.trim() && onCancel(reason)} disabled={!reason.trim() || loading}>
          {loading ? <Spinner size={14} /> : "Cancel salary"}
        </Button>
      </div>
    </>
  );
}
