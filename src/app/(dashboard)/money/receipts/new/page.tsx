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
import { employeeService } from "@/services/employees.service";
import { paymentService, type PaymentCreate } from "@/services/payments.service";
import { invoiceService } from "@/services/invoices.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Wallet, Landmark, Banknote, CircleDollarSign } from "lucide-react";
import type {
  Invoice, PaymentMode, PaymentModeDetails, FinancialAccount, Employee,
} from "@/types";

// ═══════════════════════════════════════════════════════════
// New Receipt — the form that drives Phase 3.
//
// 4 modes (Cash / Bank / Cheque / GPay). Each mode shows a different
// set of detail fields and pre-selects the right kind of account:
//   cash    → cash_in_hand
//   bank    → bank
//   cheque  → cheque_in_transit (cleared via /money/cheques later)
//   gpay    → gpay (company) OR employee_float (paid to salesman)
//
// Allocation panel at the bottom lets the user split the receipt
// across the customer's open invoices. Sum of allocations cannot
// exceed amount; remainder is "on account".
// ═══════════════════════════════════════════════════════════

const inputClass =
  "w-full px-2.5 py-1.5 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";

export default function NewReceiptPage() {
  return (
    <RequireRead perm="inventory.payments.write">
      <NewReceiptForm />
    </RequireRead>
  );
}

function NewReceiptForm() {
  const router = useRouter();
  const toast = useToast();

  // ── Header
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyId, setPartyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [accountId, setAccountId] = useState<string>("");
  const [payeeEmpId, setPayeeEmpId] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  // Mode-specific
  const [bankRef, setBankRef] = useState("");
  const [counterpartyBank, setCounterpartyBank] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [gpayRef, setGpayRef] = useState("");
  const [gpayPayerUpi, setGpayPayerUpi] = useState("");

  // Data
  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const customers = (partiesRaw?.data ?? []).filter((p) => p.party_type === "customer" || p.party_type === "both");

  const { data: accountsRaw } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.list({ limit: 200 }),
  });
  const allAccounts = accountsRaw ?? [];

  const { data: empsRaw } = useQuery({
    queryKey: ["employees", { is_active: true }],
    queryFn: () => employeeService.list({ is_active: true, limit: 200 }),
  });
  const employees = (empsRaw ?? []).filter((e) => e.is_active);

  // Open invoices for allocation
  const { data: invoicesRaw } = useQuery({
    queryKey: ["invoices", { party_id: partyId, status: "posted" }],
    queryFn: () => invoiceService.list({ party_id: partyId, status: "posted", limit: 200 }),
    enabled: !!partyId,
  });
  const openInvoices = invoicesRaw ?? [];

  // Eligible accounts shrink with mode
  const eligibleAccounts = useMemo(() => {
    if (mode === "cash")   return allAccounts.filter((a) => a.type === "cash_in_hand" && a.is_active);
    if (mode === "bank")   return allAccounts.filter((a) => a.type === "bank" && a.is_active);
    if (mode === "cheque") return allAccounts.filter((a) => a.type === "cheque_in_transit" && a.is_active);
    if (mode === "gpay") {
      // Company GPay accounts only — employee-float gets picked through payeeEmpId.
      return allAccounts.filter((a) => a.type === "gpay" && a.is_active);
    }
    return [];
  }, [mode, allAccounts]);

  // Auto-select first eligible account when mode changes
  React.useEffect(() => {
    if (eligibleAccounts.length > 0 && !eligibleAccounts.some((a) => a.id === accountId)) {
      setAccountId(eligibleAccounts[0].id);
    }
    // Reset payee employee when leaving gpay
    if (mode !== "gpay") setPayeeEmpId("");
  }, [mode, eligibleAccounts, accountId]);

  // ── Allocations: invoiceId -> amount string
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
      // Build the right detail variant for the mode
      let details: PaymentModeDetails;
      if (mode === "cash") {
        details = { mode: "cash" };
      } else if (mode === "bank") {
        details = { mode: "bank", reference: bankRef, counterparty_bank: counterpartyBank || undefined };
      } else if (mode === "cheque") {
        details = { mode: "cheque", bank_name: chequeBank, cheque_number: chequeNumber, cheque_date: chequeDate, cleared: false };
      } else {
        details = { mode: "gpay", transaction_ref: gpayRef, payer_upi: gpayPayerUpi || undefined };
      }

      // GPay-to-employee: account_id becomes the employee's float
      let resolvedAccountId = accountId;
      if (mode === "gpay" && payeeEmpId) {
        const emp = employees.find((e) => e.id === payeeEmpId);
        if (!emp) throw new Error("Selected employee not found");
        resolvedAccountId = emp.float_account_id;
      }

      const payload: PaymentCreate = {
        payment_date: paymentDate,
        direction: "received",
        party_id: partyId,
        amount,
        mode,
        details,
        account_id: resolvedAccountId,
        payee_employee_id: mode === "gpay" && payeeEmpId ? payeeEmpId : undefined,
        remarks: remarks || undefined,
      };
      const created = await paymentService.create(payload);

      // Best-effort: write allocations. In demo mode the adapter
      // returns success stubs and we just navigate.
      for (const [invoiceId, amt] of Object.entries(allocations)) {
        const v = Number(amt);
        if (v > 0) {
          await paymentService.createAllocation(created.id, { invoice_id: invoiceId, amount: amt });
        }
      }
      return created;
    },
    onSuccess: (p) => {
      toast.success(`Receipt ${p.payment_number ?? "created"}`);
      router.push("/money/receipts");
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Could not create receipt"),
  });

  // Validation
  const canSubmit =
    !!partyId && amountNum > 0 && !!accountId && !overAllocated &&
    (mode !== "bank"   || (bankRef.trim().length > 0)) &&
    (mode !== "cheque" || (chequeBank.trim().length > 0 && chequeNumber.trim().length > 0)) &&
    (mode !== "gpay"   || (gpayRef.trim().length > 0));

  return (
    <>
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-5xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary mb-2"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <PageHeader
          title="New receipt"
          description="Record money coming in. Pick how the customer paid; the form will ask for the right details and route the entry to the right ledger."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* ── Left: header + mode-specific section ───────────── */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Receipt details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date" required>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </FormField>
                <FormField label="From customer" required>
                  <select className={inputClass} value={partyId} onChange={(e) => { setPartyId(e.target.value); setAllocations({}); }}>
                    <option value="">— select customer —</option>
                    {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="Amount (₹)" required>
                  <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </FormField>
                <FormField label="Remarks">
                  <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
                </FormField>
              </div>
            </Card>

            <Card title="Payment mode">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <ModeButton mode="cash"   active={mode === "cash"}   onClick={() => setMode("cash")}   icon={Wallet}            label="Cash" />
                <ModeButton mode="bank"   active={mode === "bank"}   onClick={() => setMode("bank")}   icon={Landmark}          label="Bank" />
                <ModeButton mode="cheque" active={mode === "cheque"} onClick={() => setMode("cheque")} icon={Banknote}          label="Cheque" />
                <ModeButton mode="gpay"   active={mode === "gpay"}   onClick={() => setMode("gpay")}   icon={CircleDollarSign}  label="GPay/UPI" />
              </div>

              {/* Mode-specific fields */}
              <div className="mt-4">
                {mode === "cash" && (
                  <FormField label="Lands in" required hint="Pick the cash drawer this physical cash will go into.">
                    <AccountSelect accounts={eligibleAccounts} value={accountId} onChange={setAccountId} />
                  </FormField>
                )}

                {mode === "bank" && (
                  <div className="space-y-3">
                    <FormField label="Bank account (ours)" required>
                      <AccountSelect accounts={eligibleAccounts} value={accountId} onChange={setAccountId} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Reference / UTR" required hint="NEFT / IMPS / RTGS reference number from the customer's bank">
                        <Input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="NEFT/HDFC0001/...." />
                      </FormField>
                      <FormField label="Customer's bank">
                        <Input value={counterpartyBank} onChange={(e) => setCounterpartyBank(e.target.value)} placeholder="HDFC Bank" />
                      </FormField>
                    </div>
                  </div>
                )}

                {mode === "cheque" && (
                  <div className="space-y-3">
                    <FormField label="Lands in" required hint="Cheques sit in 'Cheques in Transit' until you deposit them.">
                      <AccountSelect accounts={eligibleAccounts} value={accountId} onChange={setAccountId} />
                    </FormField>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Bank" required>
                        <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="ICICI Bank" />
                      </FormField>
                      <FormField label="Cheque #" required>
                        <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="224511" />
                      </FormField>
                      <FormField label="Cheque date" required>
                        <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                      </FormField>
                    </div>
                  </div>
                )}

                {mode === "gpay" && (
                  <div className="space-y-3">
                    <FormField
                      label="Payee"
                      required
                      hint="Did the customer pay the company UPI, or did they pay an employee personally? If an employee, the amount lands in their float and gets deducted from their salary."
                    >
                      <select
                        className={inputClass}
                        value={payeeEmpId ? `emp:${payeeEmpId}` : (accountId ? `acc:${accountId}` : "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith("emp:")) {
                            setPayeeEmpId(v.slice(4));
                            // accountId becomes the employee's float — stored on submit
                          } else if (v.startsWith("acc:")) {
                            setPayeeEmpId("");
                            setAccountId(v.slice(4));
                          }
                        }}
                      >
                        <option value="">— select payee —</option>
                        <optgroup label="Company">
                          {eligibleAccounts.map((a) => (
                            <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Employees (paid personally)">
                          {employees.map((e) => (
                            <option key={e.id} value={`emp:${e.id}`}>{e.name} — {e.role}</option>
                          ))}
                        </optgroup>
                      </select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Transaction reference" required>
                        <Input value={gpayRef} onChange={(e) => setGpayRef(e.target.value)} placeholder="UPI/881122/2026..." />
                      </FormField>
                      <FormField label="Payer's UPI ID" hint="Optional — the customer's UPI handle">
                        <Input value={gpayPayerUpi} onChange={(e) => setGpayPayerUpi(e.target.value)} placeholder="customer@axisbank" />
                      </FormField>
                    </div>
                    {payeeEmpId && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                        This amount will be added to the employee&apos;s float. It will be deducted from their next salary payout.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Right: allocation panel ────────────────────────── */}
          <div className="space-y-4">
            <Card title="Apply to invoices">
              {!partyId ? (
                <p className="text-xs text-text-tertiary py-4">Pick a customer to see their open invoices.</p>
              ) : openInvoices.length === 0 ? (
                <p className="text-xs text-text-tertiary py-4">No open invoices for this customer. The full amount will sit as &quot;on account&quot; credit.</p>
              ) : (
                <div className="space-y-2">
                  {openInvoices.map((inv) => (
                    <AllocationRow
                      key={inv.id}
                      invoice={inv}
                      value={allocations[inv.id] ?? ""}
                      onChange={(v) => setAllocations((s) => ({ ...s, [inv.id]: v }))}
                    />
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-[12px]">
                <div className="flex justify-between"><span className="text-text-tertiary">Receipt amount</span><span className="tabular-nums">{formatCurrency(amount || 0, "INR", "en-IN")}</span></div>
                <div className="flex justify-between"><span className="text-text-tertiary">Allocated</span><span className="tabular-nums">{formatCurrency(allocatedSum, "INR", "en-IN")}</span></div>
                <div className={`flex justify-between font-semibold ${overAllocated ? "text-status-red-text" : ""}`}>
                  <span>{overAllocated ? "Over by" : "On account"}</span>
                  <span className="tabular-nums">{formatCurrency(Math.abs(overAllocated ? allocatedSum - amountNum : onAccount), "INR", "en-IN")}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 sticky bottom-0 bg-bg/95 backdrop-blur py-3 border-t border-border">
          <Button kind="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button
            kind="primary"
            onClick={() => canSubmit && create.mutate()}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending ? <Spinner size={14} /> : "Save receipt"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Bits ──────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-[13px] font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface ModeButtonProps {
  mode: PaymentMode;
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function ModeButton({ active, onClick, icon: Icon, label }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-[13px] font-medium transition-colors ${
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-bg hover:bg-bg-hover text-text-secondary"
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
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

function AllocationRow({ invoice, value, onChange }: { invoice: Invoice; value: string; onChange: (v: string) => void }) {
  const total = Number(invoice.grand_total ?? 0);
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{invoice.invoice_number}</p>
        <p className="text-text-tertiary">{formatDate(invoice.invoice_date)} · {formatCurrency(total, "INR", "en-IN")} total</p>
      </div>
      <input
        className="w-24 px-2 py-1 rounded-md border border-border bg-bg text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/40"
        type="number"
        step="0.01"
        min="0"
        max={total}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
