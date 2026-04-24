import { describe, it, expect } from "vitest";
import { unwrapList, formatCurrency, formatNumber, getInitials } from "./utils";

describe("unwrapList", () => {
  it("returns [] for null/undefined input", () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList(undefined)).toEqual([]);
  });

  it("returns input unchanged for a plain array", () => {
    const arr = [{ id: "1" }, { id: "2" }];
    expect(unwrapList(arr)).toBe(arr);
  });

  it("unwraps a paginated response", () => {
    const paginated = {
      data: [{ id: "1" }],
      pagination: { limit: 50, next_cursor: null, has_more: false },
    };
    expect(unwrapList(paginated)).toEqual([{ id: "1" }]);
  });

  it("returns [] when `data` is missing or non-array", () => {
    // @ts-expect-error — intentional malformed input
    expect(unwrapList({ pagination: {} })).toEqual([]);
    // @ts-expect-error — intentional malformed input
    expect(unwrapList({ data: "nope" })).toEqual([]);
  });
});

describe("formatCurrency", () => {
  it("formats integer-like values", () => {
    const result = formatCurrency(1000, "USD", "en-US");
    expect(result).toMatch(/\$1,000/);
  });

  it("accepts numeric strings", () => {
    expect(formatCurrency("42.5", "USD", "en-US")).toMatch(/\$42\.5/);
  });
});

describe("formatNumber", () => {
  it("adds locale separators", () => {
    expect(formatNumber(1234567, "en-US")).toBe("1,234,567");
  });
});

describe("getInitials", () => {
  it("returns first letters of first two words, uppercase", () => {
    expect(getInitials("jayant babbar")).toBe("JB");
    expect(getInitials("Priya Mehta Sharma")).toBe("PM");
  });

  it("handles single names", () => {
    expect(getInitials("Elena")).toBe("E");
  });
});
