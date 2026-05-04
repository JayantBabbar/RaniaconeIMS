// ═══════════════════════════════════════════════════════════════════
// GST math utilities.
//
// India's GST has three components depending on supply geography:
//   - CGST (Central) + SGST (State)  — when seller and buyer are in
//     the same state. Each is half the total rate.
//   - IGST (Integrated)              — when they're in different
//     states. Full rate, no split.
//   - Cess                           — additional tax on select
//     goods (tobacco, automobiles). Optional, set per-line.
//
// All math is done with strings (the project convention for currency)
// to avoid float drift. We round to 2 decimals at the line level —
// matches GSTN guidance and keeps printable invoices honest.
// ═══════════════════════════════════════════════════════════════════

export interface GstLineInput {
  /** Line price × qty before discount. */
  unit_price: string | number;
  quantity: string | number;
  /** Percentage discount on the line (e.g. "5" for 5%). Defaults to 0. */
  discount_pct?: string | number;
  /** GST rate as a percentage (e.g. "18" for 18%). */
  rate_pct: string | number;
  /** Compensation cess as a percentage. Defaults to 0. */
  cess_pct?: string | number;
  /** Seller's state code (from Tenant.state_code). */
  seller_state_code: string;
  /** Buyer's state code (typically place_of_supply on the invoice). */
  place_of_supply: string;
}

export interface GstLineOutput {
  /** (unit_price × qty) − discount, rounded to 2dp. */
  taxable_value: string;
  rate_pct: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  cess_amount: string;
  /** taxable_value + cgst + sgst + igst + cess. */
  line_total: string;
}

/** Round to N decimals, returning a string. Banker's rounding is
 *  overkill for currency — half-up is what GSTN guidance assumes. */
function round(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "0.00";
  const m = Math.pow(10, dp);
  return (Math.round(n * m) / m).toFixed(dp);
}

function num(v: string | number | undefined, fallback = 0): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Compute the GST split for a single invoice line. */
export function computeGstLine(input: GstLineInput): GstLineOutput {
  const qty = num(input.quantity);
  const unitPrice = num(input.unit_price);
  const discountPct = num(input.discount_pct);
  const ratePct = num(input.rate_pct);
  const cessPct = num(input.cess_pct);

  const gross = unitPrice * qty;
  const discount = gross * (discountPct / 100);
  const taxable = gross - discount;

  const isInterState = input.seller_state_code !== input.place_of_supply;
  const taxAmount = taxable * (ratePct / 100);
  const cessAmount = taxable * (cessPct / 100);

  const cgst = isInterState ? 0 : taxAmount / 2;
  const sgst = isInterState ? 0 : taxAmount / 2;
  const igst = isInterState ? taxAmount : 0;

  const lineTotal = taxable + cgst + sgst + igst + cessAmount;

  return {
    taxable_value: round(taxable),
    rate_pct: round(ratePct, 2),
    cgst_amount: round(cgst),
    sgst_amount: round(sgst),
    igst_amount: round(igst),
    cess_amount: round(cessAmount),
    line_total: round(lineTotal),
  };
}

/** Aggregate totals for a posted/draft invoice. Sums line outputs. */
export function aggregateInvoiceTotals(lines: GstLineOutput[]): {
  subtotal: string;
  cgst_total: string;
  sgst_total: string;
  igst_total: string;
  cess_total: string;
  tax_total: string;
  grand_total: string;
} {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (const l of lines) {
    subtotal += num(l.taxable_value);
    cgst += num(l.cgst_amount);
    sgst += num(l.sgst_amount);
    igst += num(l.igst_amount);
    cess += num(l.cess_amount);
  }
  const taxTotal = cgst + sgst + igst + cess;
  return {
    subtotal: round(subtotal),
    cgst_total: round(cgst),
    sgst_total: round(sgst),
    igst_total: round(igst),
    cess_total: round(cess),
    tax_total: round(taxTotal),
    grand_total: round(subtotal + taxTotal),
  };
}

// ── Validators ─────────────────────────────────────────────────────

/** GSTIN format: 2-digit state code + 10-char PAN + 1 entity digit
 *  + Z + 1 checksum char. We validate structure only (not checksum). */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin);
}

/** HSN/SAC: 4, 6, or 8 digits per Indian GST classification. */
const HSN_REGEX = /^[0-9]{4}([0-9]{2}([0-9]{2})?)?$/;

export function isValidHsn(hsn: string): boolean {
  return HSN_REGEX.test(hsn);
}

/** Standard GST rates in India. We don't enforce these (some
 *  notifications introduce non-standard rates) but offer them for
 *  the dropdown. */
export const STANDARD_GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

// ── Indian state codes (subset — extend as needed) ────────────────

export interface StateOption {
  code: string;
  name: string;
}

export const INDIAN_STATES: StateOption[] = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman & Diu" },
  { code: "26", name: "Dadra & Nagar Haveli" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export function stateName(code?: string): string {
  if (!code) return "";
  const s = INDIAN_STATES.find((x) => x.code === code);
  return s ? s.name : code;
}

// ── Amount in words (Indian numbering: lakh, crore) ───────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = [
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen",
  "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (r > 0) parts.push(twoDigitsToWords(r));
  return parts.join(" ");
}

/** Format a positive amount in Indian numbering style with words.
 *  e.g. 12345.67 → "Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise". */
export function amountInWords(amount: string | number, currency = "Rupees"): string {
  const total = num(amount);
  if (total === 0) return `Zero ${currency}`;

  const intPart = Math.floor(total);
  const paise = Math.round((total - intPart) * 100);

  // Indian numbering: split as crore (cr), lakh (lakh), thousand, hundred-tens-ones
  const crore = Math.floor(intPart / 10_000_000);
  const lakh = Math.floor((intPart % 10_000_000) / 100_000);
  const thousand = Math.floor((intPart % 100_000) / 1_000);
  const hundredsBlock = intPart % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigitsToWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundredsBlock > 0) parts.push(threeDigitsToWords(hundredsBlock));

  let result = `${parts.join(" ")} ${currency}`.trim();
  if (paise > 0) {
    result += ` and ${twoDigitsToWords(paise)} Paise`;
  }
  return result;
}
