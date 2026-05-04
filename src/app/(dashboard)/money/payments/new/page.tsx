"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Input, FormField } from "@/components/ui/form-elements";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { accountService } from "@/services/accounts.service";
import { paymentService, type PaymentCreate } from "@/services/payments.service";
import { billService } from "@/services/bills.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Wallet, Landmark, Banknote, CircleDollarSign } from "lucide-react";
import type { PaymentMode, PaymentModeDetails, FinancialAccount, VendorBill } from "@/types";

// ═══════════════════════════════════════════════════════════
// New Payment — symmetric to /money/receipts/new but for outgoing
// money. No employee-payee branch (we don't pay vendors via the
// salesman's UPI). Phase 3.5 added bill-allocation panel — money
// going out gets applied against the vendor's open bills.
// ═══════════════════════════════════════════════════════════

const inputClass =
  "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

export default function NewPaymentPage() {
  return (
    <RequireRead perm="inventory.payments.write">
      <NewPaymentForm />
    </RequireRead>
  );
}

function NewPaymentForm() {
  const router = useRouter();
  const toast = useToast();

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("bank");
  const [accountId, setAccountId] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [counterpartyBank, setCounterpartyBank] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [gpayRef, setGpayRef] = useState("");

  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const vendors = (partiesRaw?.data ?? []).filter((p) => p.party_type === "supplier" || p.party_type === "vendor" || p.party_type === "both");

  const { data: accountsRaw } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });

  const eligibleAccounts = useMemo(() => {
    const all = accountsRaw ?? [];
    if (mode === "cash")   return all.filter((a) => a.type === "cash_in_hand" && a.is_active);
    if (mode === "bank")   return all.filter((a) => a.type === "bank" && a.is_active);
    if (mode === "cheque") return all.filter((a) => a.type === "bank" && a.is_active);  // cheques drawn FROM bank
    if (mode === "gpay")   return all.filter((a) => a.type === "gpay" && a.is_active);
    return [];
  }, [mode, accountsRaw]);

  React.useEffect(() => {
    if (eligibleAccounts.length > 0 && !eligibleAccounts.some((a) => a.id === accountId)) {
      setAccountId(eligibleAccounts[0].id);
    }
  }, [mode, eligibleAccounts, accountId]);

  // Phase 3.5: open bills for the selected vendor → allocation panel
  const { data: openBills } = useQuery({
    queryKey: ["bills", { party_id: partyId, unpaid: true }],
    queryFn: () => billService.list({ party_id: partyId, unpaid: true, limit: 200 }),
    enabled: !!partyId,
  });
  const bills = openBills ?? [];
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const allocatedSum = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations],
  );
  const amountNum = Number(amount) || 0;
  const onAccount = Math.max(0, amountNum - allocatedSum);
  const overAllocated = allocatedSum > amountNum + 0.005;

  const create = useMutation({
    mutationFn: async () => {
      let details: PaymentModeDetails;
      if (mode === "cash")   details = { mode: "cash" };
      else if (mode === "bank")   details = { mode: "bank", reference: bankRef, counterparty_bank: counterpartyBank || undefined };
      else if (mode === "cheque") details = { mode: "cheque", bank_name: chequeBank, cheque_number: chequeNumber, cheque_date: chequeDate, cleared: false };
      else                        details = { mode: "gpay", transaction_ref: gpayRef };

      const payload: PaymentCreate = {
        payment_date: paymentDate,
        direction: "paid",
        party_id: partyId,
        amount,
        mode,
        details,
        account_id: accountId,
        remarks: remarks || undefined,
      };
      const created = await paymentService.create(payload);

      // Best-effort: write allocations against open bills.
      for (const [billId, amt] of Object.entries(allocations)) {
        const v = Number(amt);
        if (v > 0) {
          await paymentService.createAllocation(created.id, { bill_id: billId, amount: amt });
        }
      }
      return created;
    },
    onSuccess: (p) => {
      toast.success(`Payment ${p.payment_number ?? "created"}`);
      router.push("/money/payments");
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not create payment"),
  });

  const canSubmit =
    !!partyId && Number(amount) > 0 && !!accountId && !overAllocated &&
    (mode !== "bank"   || bankRef.trim().length > 0) &&
    (mode !== "cheque" || (chequeBank.trim().length > 0 && chequeNumber.trim().length > 0)) &&
    (mode !== "gpay"   || gpayRef.trim().length > 0);

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-5xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2">
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title="New payment"
          description="Record money going out to a vendor. Same four modes as receipts."
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </FormField>
            <FormField label="To vendor" required>
              <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">— select vendor —</option>
                {vendors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (₹)" required>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </FormField>
            <FormField label="Remarks">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            </FormField>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary mb-2">Mode</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ModeButton active={mode === "cash"}   onClick={() => setMode("cash")}   icon={Wallet}            label="Cash" />
              <ModeButton active={mode === "bank"}   onClick={() => setMode("bank")}   icon={Landmark}          label="Bank" />
              <ModeButton active={mode === "cheque"} onClick={() => setMode("cheque")} icon={Banknote}          label="Cheque" />
              <ModeButton active={mode === "gpay"}   onClick={() => setMode("gpay")}   icon={CircleDollarSign}  label="GPay" />
            </div>
          </div>

          <div>
            <FormField label="Paid from" required>
              <AccountSelect accounts={eligibleAccounts} value={accountId} onChange={setAccountId} />
            </FormField>

            {mode === "bank" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FormField label="Reference / UTR" required>
                  <Input value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
                </FormField>
                <FormField label="Vendor's bank">
                  <Input value={counterpartyBank} onChange={(e) => setCounterpartyBank(e.target.value)} />
                </FormField>
              </div>
            )}
            {mode === "cheque" && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <FormField label="Bank" required><Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} /></FormField>
                <FormField label="Cheque #" required><Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} /></FormField>
                <FormField label="Cheque date" required><Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} /></FormField>
              </div>
            )}
            {mode === "gpay" && (
              <div className="mt-3">
                <FormField label="Transaction reference" required>
                  <Input value={gpayRef} onChange={(e) => setGpayRef(e.target.value)} />
                </FormField>
              </div>
            )}
          </div>
        </div>

        {/* Phase 3.5 — Apply against open vendor bills */}
        <div className="rounded-lg border border-border bg-bg-elevated p-4 mt-4">
          <h3 className="text-[13px] font-semibold mb-3">Apply to bills</h3>
          {!partyId ? (
            <p className="text-xs text-text-tertiary py-2">Pick a vendor to see their open bills.</p>
          ) : bills.length === 0 ? (
            <p className="text-xs text-text-tertiary py-2">No open bills for this vendor. The full amount will sit as on-account credit.</p>
          ) : (
            <div className="space-y-2">
              {bills.map((b: VendorBill) => {
                const outstanding = Number(b.grand_total) - Number(b.allocated_amount);
                return (
                  <div key={b.id} className="flex items-center gap-2 text-[12px]">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{b.bill_number}</p>
                      <p className="text-text-tertiary">{formatDate(b.bill_date)} · outstanding {formatCurrency(outstanding, "INR", "en-IN")}</p>
                    </div>
                    <input
                      className="w-24 px-2 py-1 rounded-md border border-border bg-bg text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/40"
                      type="number"
                      step="0.01"
                      min="0"
                      max={outstanding}
                      placeholder="0.00"
                      value={allocations[b.id] ?? ""}
                      onChange={(e) => setAllocations((s) => ({ ...s, [b.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border space-y-1 text-[12px]">
            <div className="flex justify-between"><span className="text-text-tertiary">Payment amount</span><span className="tabular-nums">{formatCurrency(amount || 0, "INR", "en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-text-tertiary">Allocated</span><span className="tabular-nums">{formatCurrency(allocatedSum, "INR", "en-IN")}</span></div>
            <div className={`flex justify-between font-semibold ${overAllocated ? "text-status-red-text" : ""}`}>
              <span>{overAllocated ? "Over by" : "On account"}</span>
              <span className="tabular-nums">{formatCurrency(Math.abs(overAllocated ? allocatedSum - amountNum : onAccount), "INR", "en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button kind="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button kind="primary" onClick={() => canSubmit && create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? <Spinner size={14} /> : "Save payment"}
          </Button>
        </div>
      </div>
    </>
  );
}

function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-[13px] font-medium transition-colors ${
        active ? "border-brand bg-brand/10 text-brand" : "border-border bg-bg hover:bg-bg-hover text-text-secondary"
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function AccountSelect({ accounts, value, onChange }: { accounts: FinancialAccount[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select account —</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );
}
