"use client";

import { useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// useTableFilters — composable hook for tables.
//
// Accepts a column config describing what's searchable, sortable, and
// filterable. Returns the filtered+sorted rows plus the setters a
// consumer needs to wire up a search input, sort headers, and
// per-column filter popovers.
//
// Purely client-side today. Backend-driven sort/filter can be layered
// on later by passing the same state up as query params.
// ═══════════════════════════════════════════════════════════════════

export type FilterType = "text" | "select" | "multi-select" | "boolean";

export interface ColumnDef<T> {
  /** Property key on row OR a stable id for custom columns. */
  key: string;
  label: string;
  /** Whether column header should cycle sort on click. Default false. */
  sortable?: boolean;
  /** Include this column's value in the global search. Default true for
   *  text columns, false otherwise. */
  searchable?: boolean;
  filterType?: FilterType;
  /** For `select` / `multi-select` filter types: the choices. */
  options?: { value: string; label: string }[];
  /** Extract the filterable / sortable value from a row. Defaults to
   *  row[key]. Use this for nested fields or computed values. */
  getValue?: (row: T) => unknown;
  /** Render function for the value — only affects presentation, not
   *  filtering. Optional. */
  render?: (row: T) => React.ReactNode;
}

export type SortState = { key: string; direction: "asc" | "desc" } | null;

export type ColumnFilterValue =
  | { type: "text"; value: string }
  | { type: "select"; value: string | null }
  | { type: "multi-select"; value: string[] }
  | { type: "boolean"; value: boolean | null };

export type ColumnFilterState = Record<string, ColumnFilterValue>;

interface UseTableFiltersArgs<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Initial global search string. Default "". */
  initialSearch?: string;
  /** Initial sort state. Default null (insertion order). */
  initialSort?: SortState;
}

interface UseTableFiltersResult<T> {
  // Filtered + sorted rows ready to render.
  rows: T[];
  // Global search.
  search: string;
  setSearch: (s: string) => void;
  // Sort state + cycle helper.
  sort: SortState;
  toggleSort: (key: string) => void;
  // Per-column filters.
  columnFilters: ColumnFilterState;
  setColumnFilter: (key: string, value: ColumnFilterValue | null) => void;
  clearColumnFilter: (key: string) => void;
  clearAll: () => void;
  // Derived: how many filter "chips" are active (for the active-filter bar).
  activeFilterCount: number;
}

// ── Helpers ────────────────────────────────────────────────────

function getColValue<T>(row: T, col: ColumnDef<T>): unknown {
  if (col.getValue) return col.getValue(row);
  return (row as unknown as Record<string, unknown>)[col.key];
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function matchesText(cellValue: unknown, needle: string): boolean {
  return stringify(cellValue).toLowerCase().includes(needle.toLowerCase());
}

// ── Hook ───────────────────────────────────────────────────────

export function useTableFilters<T>({
  data,
  columns,
  initialSearch = "",
  initialSort = null,
}: UseTableFiltersArgs<T>): UseTableFiltersResult<T> {
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortState>(initialSort);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({});

  const setColumnFilter = (key: string, value: ColumnFilterValue | null) => {
    setColumnFilters((prev) => {
      if (value === null) {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const clearColumnFilter = (key: string) => setColumnFilter(key, null);

  const clearAll = () => {
    setSearch("");
    setColumnFilters({});
    // Keep sort — it's not a "filter".
  };

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  // Default: columns searchable if the column has filterType "text" OR
  // searchable explicitly set. boolean / select columns don't get full-
  // text-searched.
  const searchableColumns = useMemo(
    () =>
      columns.filter((c) => {
        if (c.searchable === true) return true;
        if (c.searchable === false) return false;
        return c.filterType === "text";
      }),
    [columns],
  );

  const rows = useMemo(() => {
    let out = data;

    // 1. Global search.
    if (search.trim()) {
      const needle = search.trim();
      out = out.filter((row) =>
        searchableColumns.some((c) => matchesText(getColValue(row, c), needle)),
      );
    }

    // 2. Column filters.
    const activeFilters = Object.entries(columnFilters);
    if (activeFilters.length > 0) {
      out = out.filter((row) =>
        activeFilters.every(([key, filter]) => {
          const col = columns.find((c) => c.key === key);
          if (!col) return true;
          const v = getColValue(row, col);

          switch (filter.type) {
            case "text":
              return !filter.value || matchesText(v, filter.value);
            case "select":
              return !filter.value || stringify(v) === filter.value;
            case "multi-select":
              return filter.value.length === 0 || filter.value.includes(stringify(v));
            case "boolean":
              return filter.value === null || Boolean(v) === filter.value;
            default:
              return true;
          }
        }),
      );
    }

    // 3. Sort.
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const av = getColValue(a, col);
          const bv = getColValue(b, col);
          const dir = sort.direction === "asc" ? 1 : -1;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number") {
            return (av - bv) * dir;
          }
          return stringify(av).localeCompare(stringify(bv)) * dir;
        });
      }
    }

    return out;
  }, [data, search, sort, columnFilters, columns, searchableColumns]);

  const activeFilterCount =
    Object.keys(columnFilters).length + (search.trim() ? 1 : 0);

  return {
    rows,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  };
}
