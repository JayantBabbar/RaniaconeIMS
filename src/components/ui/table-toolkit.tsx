"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter as FilterIcon,
  X,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ColumnDef,
  ColumnFilterValue,
  SortState,
} from "@/hooks/useTableFilters";

// ═══════════════════════════════════════════════════════════════════
// Table toolkit — small components paired with useTableFilters().
//
//   <GlobalSearch search={...} setSearch={...} />
//   <SortHeader col={...} sort={...} toggleSort={...}>Item Name</SortHeader>
//   <ColumnFilter col={...} filter={...} onChange={...} />
//   <ActiveFilterBar filters={...} search={search} ... />
// ═══════════════════════════════════════════════════════════════════

// ── Global search ──────────────────────────────────────────────

export function GlobalSearch({
  search,
  setSearch,
  placeholder = "Search across all columns…",
  className,
}: {
  search: string;
  setSearch: (s: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-white border border-hairline rounded px-2.5 h-[34px] md:h-[30px] w-full sm:w-[280px]",
        className,
      )}
    >
      <Search size={13} className="text-foreground-muted flex-shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-foreground-muted"
      />
      {search && (
        <button
          onClick={() => setSearch("")}
          className="text-foreground-muted hover:text-foreground-secondary"
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Sort-enabled column header ─────────────────────────────────

export function SortHeader<T>({
  col,
  sort,
  toggleSort,
  children,
  align = "left",
  className,
}: {
  col: ColumnDef<T>;
  sort: SortState;
  toggleSort: (key: string) => void;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sort?.key === col.key;
  const direction = active ? sort?.direction : null;
  const alignClass =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  if (!col.sortable) {
    return (
      <span className={cn("inline-flex items-center gap-1", alignClass, className)}>
        {children}
      </span>
    );
  }

  return (
    <button
      onClick={() => toggleSort(col.key)}
      className={cn(
        "inline-flex items-center gap-1 w-full hover:text-foreground transition-colors select-none",
        alignClass,
        active ? "text-foreground" : "text-foreground-muted",
        className,
      )}
      aria-label={`Sort by ${col.label}`}
    >
      <span>{children}</span>
      {direction === "asc" ? (
        <ArrowUp size={11} strokeWidth={2.25} />
      ) : direction === "desc" ? (
        <ArrowDown size={11} strokeWidth={2.25} />
      ) : (
        <ArrowUpDown
          size={10}
          strokeWidth={1.75}
          className="opacity-40 group-hover:opacity-70"
        />
      )}
    </button>
  );
}

// ── Per-column filter popover ─────────────────────────────────

export function ColumnFilter<T>({
  col,
  value,
  onChange,
  className,
}: {
  col: ColumnDef<T>;
  value: ColumnFilterValue | undefined;
  onChange: (v: ColumnFilterValue | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!col.filterType) return null;

  const active =
    value !== undefined &&
    ((value.type === "text" && value.value.length > 0) ||
      (value.type === "select" && value.value !== null) ||
      (value.type === "multi-select" && value.value.length > 0) ||
      (value.type === "boolean" && value.value !== null));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label={`Filter ${col.label}`}
          className={cn(
            "p-0.5 rounded transition-colors",
            active
              ? "text-brand bg-brand-light"
              : "text-foreground-muted hover:text-foreground-secondary hover:bg-surface-secondary",
            className,
          )}
        >
          <FilterIcon size={11} strokeWidth={2} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="bg-white border border-hairline rounded-md shadow-raised p-3 w-[240px] z-[60] animate-scale-in"
        >
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-2">
            Filter by {col.label}
          </div>

          {col.filterType === "text" && (
            <TextFilter value={value} onChange={onChange} label={col.label} />
          )}
          {col.filterType === "select" && (
            <SelectFilter value={value} onChange={onChange} options={col.options || []} />
          )}
          {col.filterType === "multi-select" && (
            <MultiSelectFilter
              value={value}
              onChange={onChange}
              options={col.options || []}
            />
          )}
          {col.filterType === "boolean" && (
            <BooleanFilter value={value} onChange={onChange} label={col.label} />
          )}

          {active && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-2 w-full text-[11.5px] text-status-red-text hover:underline"
            >
              Clear filter
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Filter input variants ─────────────────────────────────────

function TextFilter({
  value,
  onChange,
  label,
}: {
  value: ColumnFilterValue | undefined;
  onChange: (v: ColumnFilterValue | null) => void;
  label: string;
}) {
  const current = value?.type === "text" ? value.value : "";
  return (
    <input
      type="text"
      placeholder={`Contains…`}
      autoFocus
      value={current}
      onChange={(e) =>
        onChange(
          e.target.value
            ? { type: "text", value: e.target.value }
            : null,
        )
      }
      className="w-full h-[28px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
      aria-label={`Filter ${label} text`}
    />
  );
}

function SelectFilter({
  value,
  onChange,
  options,
}: {
  value: ColumnFilterValue | undefined;
  onChange: (v: ColumnFilterValue | null) => void;
  options: { value: string; label: string }[];
}) {
  const current = value?.type === "select" ? value.value : null;
  return (
    <div className="space-y-1 max-h-60 overflow-auto">
      {options.map((opt) => {
        const selected = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() =>
              onChange(
                selected ? null : { type: "select", value: opt.value },
              )
            }
            className={cn(
              "w-full text-left px-2 py-1 rounded text-xs transition-colors",
              selected
                ? "bg-brand-light text-brand font-medium"
                : "hover:bg-surface",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectFilter({
  value,
  onChange,
  options,
}: {
  value: ColumnFilterValue | undefined;
  onChange: (v: ColumnFilterValue | null) => void;
  options: { value: string; label: string }[];
}) {
  const current = value?.type === "multi-select" ? value.value : [];
  const toggle = (v: string) => {
    const next = current.includes(v)
      ? current.filter((x) => x !== v)
      : [...current, v];
    onChange(next.length > 0 ? { type: "multi-select", value: next } : null);
  };
  return (
    <div className="space-y-1 max-h-60 overflow-auto">
      {options.map((opt) => {
        const selected = current.includes(opt.value);
        return (
          <label
            key={opt.value}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer hover:bg-surface"
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => toggle(opt.value)}
              className="accent-brand"
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function BooleanFilter({
  value,
  onChange,
  label,
}: {
  value: ColumnFilterValue | undefined;
  onChange: (v: ColumnFilterValue | null) => void;
  label: string;
}) {
  const current = value?.type === "boolean" ? value.value : null;
  return (
    <div className="flex gap-1.5">
      {[
        { label: "Yes", v: true },
        { label: "No", v: false },
      ].map((opt) => {
        const selected = current === opt.v;
        return (
          <button
            key={String(opt.v)}
            onClick={() =>
              onChange(selected ? null : { type: "boolean", value: opt.v })
            }
            className={cn(
              "flex-1 h-[28px] rounded text-xs font-medium border transition-colors",
              selected
                ? "bg-brand text-white border-brand"
                : "bg-white border-hairline text-foreground-secondary hover:bg-surface",
            )}
            aria-label={`${label} is ${opt.label}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Active filter bar ─────────────────────────────────────────

export function ActiveFilterBar<T>({
  columns,
  search,
  setSearch,
  columnFilters,
  clearColumnFilter,
  clearAll,
  activeFilterCount,
  className,
}: {
  columns: ColumnDef<T>[];
  search: string;
  setSearch: (s: string) => void;
  columnFilters: Record<string, ColumnFilterValue>;
  clearColumnFilter: (key: string) => void;
  clearAll: () => void;
  activeFilterCount: number;
  className?: string;
}) {
  if (activeFilterCount === 0) return null;

  const colLabel = (key: string) =>
    columns.find((c) => c.key === key)?.label || key;

  const formatValue = (f: ColumnFilterValue): string => {
    switch (f.type) {
      case "text":
        return `"${f.value}"`;
      case "select":
        return f.value || "";
      case "multi-select":
        return f.value.join(", ");
      case "boolean":
        return f.value === null ? "" : f.value ? "Yes" : "No";
    }
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className="text-[11px] text-foreground-muted">Filters:</span>
      {search && (
        <button
          onClick={() => setSearch("")}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light text-brand text-[11px] font-medium rounded hover:bg-brand/15"
        >
          <span>search: &ldquo;{search}&rdquo;</span>
          <X size={10} />
        </button>
      )}
      {Object.entries(columnFilters).map(([key, filter]) => (
        <button
          key={key}
          onClick={() => clearColumnFilter(key)}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light text-brand text-[11px] font-medium rounded hover:bg-brand/15"
        >
          <span>
            {colLabel(key)}: {formatValue(filter)}
          </span>
          <X size={10} />
        </button>
      ))}
      <button
        onClick={clearAll}
        className="text-[11px] text-foreground-secondary hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
