"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { itemService, brandService, categoryService } from "@/services/items.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";
import {
  Plus,
  Upload,
  Download,
  Eye,
  Edit,
  Trash2,
  Box,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Items List Page
// ═══════════════════════════════════════════════════════════

export default function ItemsListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.items.write");

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  // Fetch items (no server-side filtering — the toolkit handles it client-side).
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => itemService.list({ limit: 200 }),
  });

  const { data: brandsData } = useQuery({
    queryKey: ["brands"],
    queryFn: () => brandService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemService.delete(id),
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to delete item");
    },
  });

  const items = itemsData?.data || [];
  const brands = brandsData?.data || [];
  const categories = categoriesData?.data || [];
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // ── Column config drives search / sort / filter ─────────────
  const columns: ColumnDef<Item>[] = [
    {
      key: "item_code",
      label: "Code",
      sortable: true,
      filterType: "text",
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      filterType: "text",
    },
    {
      key: "category_id",
      label: "Category",
      sortable: true,
      filterType: "select",
      getValue: (r) => catMap.get(r.category_id || "") || "",
      options: categories.map((c) => ({ value: c.name, label: c.name })),
    },
    {
      key: "brand_id",
      label: "Brand",
      sortable: true,
      filterType: "select",
      getValue: (r) => brandMap.get(r.brand_id || "") || "",
      options: brands.map((b) => ({ value: b.name, label: b.name })),
    },
    {
      key: "item_type",
      label: "Type",
      sortable: true,
      filterType: "text",
    },
    {
      key: "is_batch_tracked",
      label: "Batch tracked",
      filterType: "boolean",
    },
    {
      key: "is_serial_tracked",
      label: "Serial tracked",
      filterType: "boolean",
    },
    {
      key: "is_active",
      label: "Active",
      sortable: true,
      filterType: "boolean",
    },
  ];

  const {
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
  } = useTableFilters({ data: items, columns });

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === rows.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(rows.map((i) => i.id)));
    }
  };

  return (
    <RequireRead perm="inventory.items.read" crumbs={["Inventory", "Items"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-hidden">
      <TopBar
        crumbs={["Inventory", "Items"]}
        right={
          <>
            <Button icon={<Upload size={13} />}>Import</Button>
            <Button icon={<Download size={13} />}>Export</Button>
            <Can perm="inventory.items.write">
              <Link href="/items/new">
                <Button kind="primary" icon={<Plus size={13} />}>
                  New Item
                </Button>
              </Link>
            </Can>
          </>
        }
      />

      {/* Page header */}
      <div className="px-5 pt-4 pb-0">
        <PageHeader
          title="Items"
          description="Everything you stock — SKUs, products, materials. Each item has a base unit of measure and can be tagged with a brand and category. Items are the backbone of every document and stock movement."
          learnMore="Flag an item as 'batch-tracked' to track lots with expiry dates, or 'serial-tracked' for unique per-unit tracking (e.g. laptops). Items have sub-tabs on their detail page for identifiers (barcodes), alternative UoMs, reorder policies, and more."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== items.length ? ` / ${items.length}` : ""}
            </Badge>
          }
        />
      </div>

      {/* Filters bar */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
        <GlobalSearch
          search={search}
          setSearch={setSearch}
          placeholder="Search by code, name, category, brand…"
        />
        <div className="flex-1" />
        {activeFilterCount > 0 && (
          <span className="text-[11px] text-foreground-muted">
            {rows.length} match{rows.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="px-5 pb-2">
          <ActiveFilterBar
            columns={columns}
            search={search}
            setSearch={setSearch}
            columnFilters={columnFilters}
            clearColumnFilter={clearColumnFilter}
            clearAll={clearAll}
            activeFilterCount={activeFilterCount}
          />
        </div>
      )}

      {/* Table */}
      <div className="mx-5 mb-5 bg-white border border-hairline rounded-md overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size={24} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Box size={22} />}
            title={activeFilterCount > 0 ? "No items match those filters" : "No items yet"}
            description={
              activeFilterCount > 0
                ? "Try loosening the filters, or clear them all to start over."
                : canWrite
                  ? "Add your first item so you can post documents and track stock."
                  : "Your admin hasn't added any items yet. Once they do, you'll see them here."
            }
            action={
              activeFilterCount === 0 && canWrite ? (
                <Link href="/items/new">
                  <Button kind="primary" icon={<Plus size={13} />}>
                    Add your first item
                  </Button>
                </Link>
              ) : activeFilterCount > 0 ? (
                <Button onClick={clearAll}>Clear all filters</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 w-8">
                      <button
                        onClick={toggleSelectAll}
                        className={cn(
                          "w-3.5 h-3.5 rounded-sm border flex items-center justify-center",
                          selectedItems.size === rows.length && rows.length > 0
                            ? "bg-brand border-brand"
                            : "border-foreground-faint"
                        )}
                        aria-label="Select all"
                      >
                        {selectedItems.size === rows.length && rows.length > 0 && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </th>
                    {columns.slice(0, 5).map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "text-left px-3 py-2.5 font-medium",
                          col.key === "item_type" && "text-center",
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <SortHeader col={col} sort={sort} toggleSort={toggleSort}>
                            {col.label}
                          </SortHeader>
                          <ColumnFilter
                            col={col}
                            value={columnFilters[col.key]}
                            onChange={(v) => setColumnFilter(col.key, v)}
                          />
                        </div>
                      </th>
                    ))}
                    <th className="text-center px-3 py-2.5 font-medium">
                      <div className="flex items-center gap-1 justify-center">
                        <span>Tracking</span>
                        <ColumnFilter
                          col={columns[5]}
                          value={columnFilters[columns[5].key]}
                          onChange={(v) => setColumnFilter(columns[5].key, v)}
                        />
                        <ColumnFilter
                          col={columns[6]}
                          value={columnFilters[columns[6].key]}
                          onChange={(v) => setColumnFilter(columns[6].key, v)}
                        />
                      </div>
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      <div className="flex items-center gap-1 justify-center">
                        <SortHeader col={columns[7]} sort={sort} toggleSort={toggleSort} align="center">
                          Status
                        </SortHeader>
                        <ColumnFilter
                          col={columns[7]}
                          value={columnFilters[columns[7].key]}
                          onChange={(v) => setColumnFilter(columns[7].key, v)}
                        />
                      </div>
                    </th>
                    {canWrite && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-t border-hairline-light transition-colors",
                          isSelected ? "bg-brand-light/40" : "hover:bg-surface/50"
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className={cn(
                              "w-3.5 h-3.5 rounded-sm border flex items-center justify-center",
                              isSelected ? "bg-brand border-brand" : "border-foreground-faint"
                            )}
                          >
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/items/${item.id}`}
                            className="font-mono text-xs text-brand-dark font-medium hover:underline"
                          >
                            {item.item_code}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/items/${item.id}`}
                            className="font-medium hover:text-brand transition-colors"
                          >
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-foreground-secondary">
                          {catMap.get(item.category_id || "") || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-foreground-secondary">
                          {brandMap.get(item.brand_id || "") || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge tone="neutral">{item.item_type}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex justify-center gap-1">
                            {item.is_batch_tracked && (
                              <Badge tone="blue">Batch</Badge>
                            )}
                            {item.is_serial_tracked && (
                              <Badge tone="blue">Serial</Badge>
                            )}
                            {!item.is_batch_tracked && !item.is_serial_tracked && (
                              <span className="text-xs text-foreground-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={item.is_active ? "active" : "inactive"} />
                        </td>
                        {canWrite && (
                          <td className="px-3 py-2.5 text-center">
                            <ActionMenu
                              items={[
                                { label: "View", icon: <Eye size={12} />, href: `/items/${item.id}` },
                                { label: "Edit", icon: <Edit size={12} />, href: `/items/${item.id}?edit=true` },
                                { divider: true, label: "" },
                                {
                                  label: "Delete",
                                  icon: <Trash2 size={12} />,
                                  danger: true,
                                  onClick: () => setDeleteTarget(item),
                                },
                              ]}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination placeholder */}
            <div className="px-3.5 py-2.5 border-t border-hairline flex items-center gap-2.5 text-xs text-foreground-muted">
              <span>
                Showing {rows.length}
                {rows.length !== items.length ? ` of ${items.length}` : ""}
              </span>
              <div className="flex-1" />
              <Button size="sm" icon={<ChevronLeft size={12} />}>Prev</Button>
              <Button size="sm" iconRight={<ChevronRight size={12} />}>Next</Button>
            </div>
          </>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-white rounded-md px-4 py-2 flex items-center gap-3 text-sm shadow-overlay animate-fade-in z-50">
          <button onClick={() => setSelectedItems(new Set())}>
            <X size={13} />
          </button>
          <span className="font-medium">{selectedItems.size} selected</span>
          <div className="w-px h-3.5 bg-neutral-600" />
          <button className="flex items-center gap-1.5 hover:text-blue-300 transition-colors">
            <Tag size={12} /> Change category
          </button>
          <button className="flex items-center gap-1.5 hover:text-blue-300 transition-colors">
            <Download size={12} /> Export
          </button>
          <button className="flex items-center gap-1.5 text-red-300 hover:text-red-200 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={`Item code ${deleteTarget?.item_code} will be removed. Existing stock balances and past documents that reference it stay intact for audit, but you won't be able to put this item on new documents. Consider marking it inactive instead if you might bring it back.`}
        confirmLabel="Delete item"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </RequireRead>
  );
}
