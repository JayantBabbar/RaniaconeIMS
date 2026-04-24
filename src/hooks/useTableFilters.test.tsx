import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableFilters, type ColumnDef } from "./useTableFilters";

interface Row {
  id: string;
  name: string;
  code: string;
  qty: number;
  active: boolean;
  type: string;
}

const sample: Row[] = [
  { id: "1", name: "Apple",  code: "AP", qty: 10, active: true,  type: "fruit" },
  { id: "2", name: "Banana", code: "BN", qty:  3, active: true,  type: "fruit" },
  { id: "3", name: "Carrot", code: "CR", qty: 20, active: false, type: "veg"   },
  { id: "4", name: "Daikon", code: "DK", qty:  7, active: true,  type: "veg"   },
];

const columns: ColumnDef<Row>[] = [
  { key: "name", label: "Name", sortable: true, filterType: "text" },
  { key: "code", label: "Code", sortable: true, filterType: "text" },
  { key: "qty",  label: "Qty",  sortable: true },
  { key: "active", label: "Active", filterType: "boolean" },
  { key: "type", label: "Type", filterType: "select", options: [
    { value: "fruit", label: "Fruit" },
    { value: "veg",   label: "Veg"   },
  ]},
];

describe("useTableFilters", () => {
  it("returns all rows by default with no filter state", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    expect(result.current.rows).toHaveLength(4);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it("global search matches across searchable text columns", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() => result.current.setSearch("ban"));
    expect(result.current.rows.map((r) => r.name)).toEqual(["Banana"]);
    expect(result.current.activeFilterCount).toBe(1);
  });

  it("toggleSort cycles asc → desc → off", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() => result.current.toggleSort("qty"));
    expect(result.current.rows.map((r) => r.qty)).toEqual([3, 7, 10, 20]);
    act(() => result.current.toggleSort("qty"));
    expect(result.current.rows.map((r) => r.qty)).toEqual([20, 10, 7, 3]);
    act(() => result.current.toggleSort("qty"));
    expect(result.current.sort).toBeNull();
  });

  it("text column filter narrows matches", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() =>
      result.current.setColumnFilter("name", { type: "text", value: "a" }),
    );
    // All four names contain 'a' or 'A' — wait, "Daikon" has 'a', so all four stay.
    expect(result.current.rows).toHaveLength(4);
    act(() =>
      result.current.setColumnFilter("name", { type: "text", value: "car" }),
    );
    expect(result.current.rows.map((r) => r.name)).toEqual(["Carrot"]);
  });

  it("select column filter matches exact value", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() =>
      result.current.setColumnFilter("type", { type: "select", value: "veg" }),
    );
    expect(result.current.rows.map((r) => r.code)).toEqual(["CR", "DK"]);
  });

  it("boolean column filter matches true/false", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() =>
      result.current.setColumnFilter("active", { type: "boolean", value: false }),
    );
    expect(result.current.rows.map((r) => r.name)).toEqual(["Carrot"]);
  });

  it("clearColumnFilter removes one filter but leaves others", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() => {
      result.current.setColumnFilter("type", { type: "select", value: "veg" });
      result.current.setColumnFilter("active", { type: "boolean", value: true });
    });
    expect(result.current.rows.map((r) => r.name)).toEqual(["Daikon"]);
    act(() => result.current.clearColumnFilter("active"));
    expect(result.current.rows.map((r) => r.name)).toEqual(["Carrot", "Daikon"]);
    expect(result.current.activeFilterCount).toBe(1);
  });

  it("clearAll wipes search and column filters but keeps sort", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() => {
      result.current.setSearch("apple");
      result.current.setColumnFilter("type", { type: "select", value: "veg" });
      result.current.toggleSort("qty");
    });
    act(() => result.current.clearAll());
    expect(result.current.search).toBe("");
    expect(result.current.activeFilterCount).toBe(0);
    // Sort retained.
    expect(result.current.sort).toEqual({ key: "qty", direction: "asc" });
  });

  it("activeFilterCount counts search + every column filter", () => {
    const { result } = renderHook(() => useTableFilters({ data: sample, columns }));
    act(() => {
      result.current.setSearch("a");
      result.current.setColumnFilter("type", { type: "select", value: "fruit" });
      result.current.setColumnFilter("active", { type: "boolean", value: true });
    });
    expect(result.current.activeFilterCount).toBe(3);
  });

  it("getValue + column filter: synthetic columns work", () => {
    interface LabelRow { id: string; display: { full: string }; }
    const rows: LabelRow[] = [
      { id: "1", display: { full: "One" } },
      { id: "2", display: { full: "Two" } },
    ];
    const cols: ColumnDef<LabelRow>[] = [
      {
        key: "display",
        label: "Display",
        filterType: "text",
        getValue: (r) => r.display.full,
      },
    ];
    const { result } = renderHook(() => useTableFilters({ data: rows, columns: cols }));
    act(() =>
      result.current.setColumnFilter("display", { type: "text", value: "one" }),
    );
    expect(result.current.rows.map((r) => r.id)).toEqual(["1"]);
  });

  it("sort handles null/undefined values consistently", () => {
    const withGaps: Row[] = [
      { id: "1", name: "Alpha", code: "AL", qty: 5,  active: true,  type: "x" },
      { id: "2", name: "",      code: "BE", qty: 10, active: true,  type: "y" },
      { id: "3", name: "Gamma", code: "GA", qty: 3,  active: false, type: "x" },
    ];
    const { result } = renderHook(() => useTableFilters({ data: withGaps, columns }));
    act(() => result.current.toggleSort("qty"));
    expect(result.current.rows.map((r) => r.qty)).toEqual([3, 5, 10]);
  });
});
