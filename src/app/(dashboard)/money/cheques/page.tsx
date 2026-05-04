"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can, useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { paymentService } from "@/services/payments.service";
import { partyService } from "@/services/parties.service";
import { accountService } from "@/services/accounts.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Banknote, Send } from "lucide-react";
import type { Payment } from "@/types";

// ═══════════════════════════════════════════════════════════
// Cheques in transit — receipts mode='cheque' that haven't
// been deposited yet. Hitting Deposit fires the cheque_in_transit
// → bank ledger move and flips details.cleared=true.
// ═══════════════════════════════════════════════════════════

export default function ChequesPage() {
  const { can } = useCan();
  const canDeposit = can("inventory.payments.write");
  const [depositTarget, setDepositTarget] = useState<Payment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payments", { cheque_in_transit: true }],
    queryFn: () => paymentService.list({ cheque_in_transit: true, direction: "received", limit: 200 }),
  });
  const cheques = data ?? [];

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const partyById = new Map((partiesRaw?.data ?? []).map((p) => [p.id, p]));

  return (
    <RequireRead perm="inventory.payments.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Cheques pending"
          description="Cheques received from customers, sitting in 'Cheques in Transit' until you deposit them. Once deposited, the amount moves from cheque-in-transit to your bank account."
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : cheques.length === 0 ? (
          <EmptyState
            icon={<Banknote size={20} />}
            title="No cheques pending"
            description="All received cheques have been deposited. New cheques will show up here when you record a cheque receipt."
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Voucher #</th>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">From</th>
                  <th className="text-left px-3 py-2 font-medium">Bank</th>
                  <th className="text-left px-3 py-2 font-medium">Cheque #</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {cheques.map((c) => {
                  const det = c.details as { bank_name?: string; cheque_number?: string };
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-mono text-[12px]">{c.payment_number}</td>
                      <td className="px-3 py-2 text-text-tertiary">{formatDate(c.payment_date)}</td>
                      <td className="px-3 py-2">{partyById.get(c.party_id)?.name ?? c.party_id}</td>
                      <td className="px-3 py-2 text-text-tertiary">{det.bank_name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[12px]">{det.cheque_number ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(c.amount, "INR", "en-IN")}</td>
                      <td className="px-3 py-2 text-right">
                        {canDeposit && (
                          <Button kind="primary" onClick={() => setDepositTarget(c)}>
                            <Send size={12} /> Deposit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 text-[11px] text-text-tertiary">
          Total pending: {formatCurrency(cheques.reduce((s, c) => s + Number(c.amount || 0), 0), "INR", "en-IN")}
        </div>
      </div>

      {depositTarget && (
        <DepositDialog
          payment={depositTarget}
          onClose={() => setDepositTarget(null)}
        />
      )}
    </RequireRead>
  );
}

// ── Deposit dialog ─────────────────────────────────────────
function DepositDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: accountsRaw } = useQuery({
    queryKey: ["accounts", { type: "bank" }],
    queryFn: () => accountService.list({ type: "bank", is_active: true, limit: 200 }),
  });
  const banks = accountsRaw ?? [];

  React.useEffect(() => {
    if (banks.length > 0 && !accountId) setAccountId(banks[0].id);
  }, [banks, accountId]);

  const deposit = useMutation({
    mutationFn: () => paymentService.depositCheque(payment.id, { deposited_to_account_id: accountId, deposit_date: depositDate }),
    onSuccess: () => {
      toast.success("Cheque deposited");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not deposit"),
  });

  const inputClass = "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Deposit cheque ${payment.payment_number}`}
      description={`${formatCurrency(payment.amount, "INR", "en-IN")} from ${(payment.details as { bank_name?: string }).bank_name ?? "the customer's bank"}`}
    >
      <div className="space-y-3">
        <FormField label="Deposited into" required>
          <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— select bank account —</option>
            {banks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </FormField>
        <FormField label="Deposit date" required>
          <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" onClick={() => accountId && deposit.mutate()} disabled={!accountId || deposit.isPending}>
          {deposit.isPending ? <Spinner size={14} /> : "Deposit"}
        </Button>
      </div>
    </Dialog>
  );
}
