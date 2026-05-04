import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { PAYMENTS } from "@/lib/api-constants";
import type {
  PaginatedResponse,
  Payment,
  PaymentAllocation,
  PaymentDirection,
  PaymentMode,
  PaymentModeDetails,
  PaymentStatus,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Payments service (receipts + payments — one entity, two flows).
//
// `direction='received'`  — money in. List filter shows on /money/receipts.
// `direction='paid'`      — money out. List filter shows on /money/payments.
//
// State machine mirrors invoices: draft → posted → cancelled.
// Posting writes paired ledger entries:
//
//   Receipt (mode=cash) :
//     Dr. cash_in_hand               | Cr. party_receivable[customer]
//   Receipt (mode=bank) :
//     Dr. bank                       | Cr. party_receivable[customer]
//   Receipt (mode=cheque):
//     Dr. cheque_in_transit          | Cr. party_receivable[customer]
//   Receipt (mode=gpay, payee=company):
//     Dr. gpay                       | Cr. party_receivable[customer]
//   Receipt (mode=gpay, payee=employee):
//     Dr. employee_float[employee]   | Cr. party_receivable[customer]
//
//   Payment (mode=cash):
//     Dr. party_payable[vendor]      | Cr. cash_in_hand
//   ... etc, symmetric.
//
// `account_id` on the Payment is the side that DOESN'T point at the
// party — the cash/bank/cheque/gpay/float account.
// ═══════════════════════════════════════════════════════════════════

export interface PaymentCreate {
  payment_number?: string;            // server-allocates if omitted
  payment_date: string;               // YYYY-MM-DD
  direction: PaymentDirection;
  party_id: string;
  amount: string;
  mode: PaymentMode;
  details: PaymentModeDetails;
  account_id: string;
  /** Required when mode=gpay AND the payee was an employee. The
   *  account_id should be the matching employee_float account. */
  payee_employee_id?: string;
  remarks?: string;
}

export interface PaymentUpdate {
  payment_date?: string;
  party_id?: string;
  amount?: string;
  mode?: PaymentMode;
  details?: PaymentModeDetails;
  account_id?: string;
  payee_employee_id?: string;
  remarks?: string;
}

export interface AllocationCreate {
  invoice_id?: string;
  challan_id?: string;
  /** Phase 3.5 — vendor bill, for direction='paid' allocations. */
  bill_id?: string;
  amount: string;
}

export interface ChequeDepositRequest {
  deposited_to_account_id: string;
  deposit_date: string;               // YYYY-MM-DD
}

export const paymentService = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    direction?: PaymentDirection;
    party_id?: string;
    mode?: PaymentMode;
    status?: PaymentStatus;
    /** Convenience filter for the /money/cheques view. Backend
     *  interpretation: mode='cheque' AND details.cleared=false AND
     *  status='posted'. */
    cheque_in_transit?: boolean;
    payee_employee_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Payment[]> => {
    const res = await api.get<Payment[] | PaginatedResponse<Payment>>(
      PAYMENTS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Payment>(PAYMENTS.DETAIL(id)),

  create: (data: PaymentCreate) =>
    api.post<Payment>(PAYMENTS.LIST, data),

  update: (id: string, data: PaymentUpdate) =>
    api.patch<Payment>(PAYMENTS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(PAYMENTS.DETAIL(id)),

  /** Post (lock + write ledger). After posting, the payment can only
   *  be cancelled — never edited or deleted. */
  post: (id: string) => api.post<Payment>(PAYMENTS.POST(id)),

  /** Cancel a posted payment. Server reverses the ledger entries
   *  AND removes any allocations (so the invoices go back to open). */
  cancel: (id: string, reason?: string) =>
    api.post<Payment>(PAYMENTS.CANCEL(id), { reason }),

  // ── Allocations (which invoices this payment settles) ──────────
  listAllocations: async (paymentId: string): Promise<PaymentAllocation[]> => {
    const res = await api.get<
      PaymentAllocation[] | PaginatedResponse<PaymentAllocation>
    >(PAYMENTS.ALLOCATIONS(paymentId));
    return unwrapList(res);
  },

  createAllocation: (paymentId: string, data: AllocationCreate) =>
    api.post<PaymentAllocation>(PAYMENTS.ALLOCATIONS(paymentId), data),

  deleteAllocation: (paymentId: string, allocationId: string) =>
    api.delete<void>(PAYMENTS.ALLOCATION(paymentId, allocationId)),

  /** Cheque deposit. Posts a cheque_in_transit → bank ledger move,
   *  flips details.cleared=true and stores deposit_date +
   *  deposited_to_account_id on the cheque payment. Only valid when
   *  mode='cheque', status='posted', details.cleared=false. */
  depositCheque: (id: string, data: ChequeDepositRequest) =>
    api.post<Payment>(PAYMENTS.DEPOSIT(id), data),
};
