import { describe, it, expect } from "vitest";
import {
  computeGstLine,
  aggregateInvoiceTotals,
  isValidGstin,
  isValidHsn,
  amountInWords,
  stateName,
} from "./gst";

describe("computeGstLine — same-state (CGST + SGST)", () => {
  it("splits 18% rate into 9% CGST + 9% SGST when seller and buyer are in the same state", () => {
    const out = computeGstLine({
      unit_price: 100,
      quantity: 10,
      rate_pct: 18,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    expect(out.taxable_value).toBe("1000.00");
    expect(out.cgst_amount).toBe("90.00");
    expect(out.sgst_amount).toBe("90.00");
    expect(out.igst_amount).toBe("0.00");
    expect(out.line_total).toBe("1180.00");
  });

  it("applies discount before tax", () => {
    const out = computeGstLine({
      unit_price: 100,
      quantity: 10,
      discount_pct: 10,
      rate_pct: 18,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    // taxable = 1000 - 100 = 900; tax = 900*0.18 = 162; line_total = 1062
    expect(out.taxable_value).toBe("900.00");
    expect(out.cgst_amount).toBe("81.00");
    expect(out.sgst_amount).toBe("81.00");
    expect(out.line_total).toBe("1062.00");
  });
});

describe("computeGstLine — inter-state (IGST only)", () => {
  it("applies full rate to IGST when seller and buyer are in different states", () => {
    const out = computeGstLine({
      unit_price: 200,
      quantity: 5,
      rate_pct: 18,
      seller_state_code: "27",
      place_of_supply: "29",
    });
    expect(out.taxable_value).toBe("1000.00");
    expect(out.cgst_amount).toBe("0.00");
    expect(out.sgst_amount).toBe("0.00");
    expect(out.igst_amount).toBe("180.00");
    expect(out.line_total).toBe("1180.00");
  });
});

describe("computeGstLine — cess", () => {
  it("adds compensation cess on top of GST", () => {
    const out = computeGstLine({
      unit_price: 1000,
      quantity: 1,
      rate_pct: 28,
      cess_pct: 12,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    // taxable=1000; CGST=140; SGST=140; cess=120; total=1400
    expect(out.cgst_amount).toBe("140.00");
    expect(out.sgst_amount).toBe("140.00");
    expect(out.cess_amount).toBe("120.00");
    expect(out.line_total).toBe("1400.00");
  });
});

describe("computeGstLine — edge cases", () => {
  it("returns zeros for zero rate", () => {
    const out = computeGstLine({
      unit_price: 100,
      quantity: 10,
      rate_pct: 0,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    expect(out.taxable_value).toBe("1000.00");
    expect(out.cgst_amount).toBe("0.00");
    expect(out.sgst_amount).toBe("0.00");
    expect(out.line_total).toBe("1000.00");
  });

  it("handles string inputs", () => {
    const out = computeGstLine({
      unit_price: "12.50",
      quantity: "8",
      rate_pct: "5",
      seller_state_code: "27",
      place_of_supply: "27",
    });
    expect(out.taxable_value).toBe("100.00");
    expect(out.cgst_amount).toBe("2.50");
    expect(out.sgst_amount).toBe("2.50");
  });

  it("returns zero line total for zero quantity", () => {
    const out = computeGstLine({
      unit_price: 100,
      quantity: 0,
      rate_pct: 18,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    expect(out.line_total).toBe("0.00");
  });

  it("handles non-standard rates (0.25%)", () => {
    const out = computeGstLine({
      unit_price: 1000,
      quantity: 1,
      rate_pct: 0.25,
      seller_state_code: "27",
      place_of_supply: "27",
    });
    expect(out.cgst_amount).toBe("1.25");
    expect(out.sgst_amount).toBe("1.25");
    expect(out.line_total).toBe("1002.50");
  });
});

describe("aggregateInvoiceTotals", () => {
  it("sums multiple lines correctly", () => {
    const lines = [
      computeGstLine({
        unit_price: 100,
        quantity: 10,
        rate_pct: 18,
        seller_state_code: "27",
        place_of_supply: "27",
      }),
      computeGstLine({
        unit_price: 50,
        quantity: 4,
        rate_pct: 12,
        seller_state_code: "27",
        place_of_supply: "27",
      }),
    ];
    const totals = aggregateInvoiceTotals(lines);
    // line1: tax 1000, cgst 90, sgst 90, total 1180
    // line2: tax 200, cgst 12, sgst 12, total 224
    expect(totals.subtotal).toBe("1200.00");
    expect(totals.cgst_total).toBe("102.00");
    expect(totals.sgst_total).toBe("102.00");
    expect(totals.tax_total).toBe("204.00");
    expect(totals.grand_total).toBe("1404.00");
  });

  it("returns zeros for empty input", () => {
    const totals = aggregateInvoiceTotals([]);
    expect(totals.subtotal).toBe("0.00");
    expect(totals.grand_total).toBe("0.00");
  });

  it("aggregates CGST+SGST and IGST simultaneously (mixed-state invoice)", () => {
    const lines = [
      computeGstLine({
        unit_price: 100,
        quantity: 1,
        rate_pct: 18,
        seller_state_code: "27",
        place_of_supply: "27",
      }), // intra-state
      computeGstLine({
        unit_price: 100,
        quantity: 1,
        rate_pct: 18,
        seller_state_code: "27",
        place_of_supply: "29",
      }), // inter-state
    ];
    const totals = aggregateInvoiceTotals(lines);
    expect(totals.cgst_total).toBe("9.00");
    expect(totals.sgst_total).toBe("9.00");
    expect(totals.igst_total).toBe("18.00");
    expect(totals.tax_total).toBe("36.00");
    expect(totals.grand_total).toBe("236.00");
  });
});

describe("isValidGstin", () => {
  it("accepts well-formed GSTIN", () => {
    expect(isValidGstin("27AAAPL2356Q1ZS")).toBe(true);
    expect(isValidGstin("29AAAAA0001A1Z5")).toBe(true);
    expect(isValidGstin("07AAAAA0000A1ZA")).toBe(true);
  });

  it("rejects malformed GSTIN", () => {
    expect(isValidGstin("")).toBe(false);
    expect(isValidGstin("abc")).toBe(false);
    expect(isValidGstin("27AAAPL2356Q1Z")).toBe(false);   // too short
    expect(isValidGstin("27AAAPL2356Q1ZSX")).toBe(false); // too long
    expect(isValidGstin("27AAAPL2356Q1AS")).toBe(false);  // missing Z at position 13
  });
});

describe("isValidHsn", () => {
  it("accepts 4, 6, or 8 digit HSN codes", () => {
    expect(isValidHsn("8471")).toBe(true);
    expect(isValidHsn("847130")).toBe(true);
    expect(isValidHsn("84713010")).toBe(true);
  });

  it("rejects bad lengths and non-digits", () => {
    expect(isValidHsn("")).toBe(false);
    expect(isValidHsn("847")).toBe(false);    // 3 digits
    expect(isValidHsn("84713")).toBe(false);  // 5 digits
    expect(isValidHsn("8471A")).toBe(false);
  });
});

describe("amountInWords", () => {
  it("zero amount", () => {
    expect(amountInWords(0)).toBe("Zero Rupees");
  });

  it("simple integer", () => {
    expect(amountInWords(12)).toBe("Twelve Rupees");
    expect(amountInWords(100)).toBe("One Hundred Rupees");
    expect(amountInWords(999)).toBe("Nine Hundred Ninety Nine Rupees");
  });

  it("Indian numbering — thousand, lakh, crore", () => {
    expect(amountInWords(1000)).toBe("One Thousand Rupees");
    expect(amountInWords(123456)).toBe(
      "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees",
    );
    expect(amountInWords(12345678)).toBe(
      "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees",
    );
  });

  it("paise", () => {
    expect(amountInWords(100.5)).toBe("One Hundred Rupees and Fifty Paise");
    expect(amountInWords(1234.67)).toBe(
      "One Thousand Two Hundred Thirty Four Rupees and Sixty Seven Paise",
    );
  });

  it("string input", () => {
    expect(amountInWords("250.00")).toBe("Two Hundred Fifty Rupees");
  });
});

describe("stateName", () => {
  it("resolves 2-digit codes to state names", () => {
    expect(stateName("27")).toBe("Maharashtra");
    expect(stateName("29")).toBe("Karnataka");
    expect(stateName("07")).toBe("Delhi");
  });

  it("returns the code unchanged when unknown", () => {
    expect(stateName("99")).toBe("99");
    expect(stateName(undefined)).toBe("");
  });
});
