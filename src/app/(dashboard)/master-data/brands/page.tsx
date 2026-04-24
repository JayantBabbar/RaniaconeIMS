"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
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
import { itemBrandService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import type { ItemBrand } from "@/types";
import { Plus, Edit, Trash2, Tag } from "lucide-react";

export default function ItemBrandsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.brands.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ItemBrand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemBrand | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["itemBrands"],
    queryFn: () => itemBrandService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];

  const columns: ColumnDef<ItemBrand>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "name", label: "Name", sortable: true, filterType: "text" },
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
  } = useTableFilters({ data: allRows, columns });

  const deleteMut = useMutation({
    mutationFn: (id: string) => itemBrandService.delete(id),
    onSuccess: () => {
      toast.success("Brand deleted");
      qc.invalidateQueries({ queryKey: ["itemBrands"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.brands.read" crumbs={["Master Data", "Brands"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Brands"]}
        right={
          <Can perm="inventory.brands.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              Add Brand
            </Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Item Brands"
          description="Manufacturers or product brands you stock — GSK, Dell, Ariel. Optional, but handy for filtering items and running brand-specific reports."
          learnMore="Brands are optional labels on items. You can have items with no brand. Deleting a brand un-labels its items; the items themselves aren't affected."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== allRows.length ? ` / ${allRows.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search brands by code or name…"
          />
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <span className="text-[11px] text-foreground-muted">
              {rows.length} match{rows.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <ActiveFilterBar
            columns={columns}
            search={search}
            setSearch={setSearch}
            columnFilters={columnFilters}
            clearColumnFilter={clearColumnFilter}
            clearAll={clearAll}
            activeFilterCount={activeFilterCount}
          />
        )}

        <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-3xl">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Tag size={22} />}
              title={activeFilterCount > 0 ? "No brands match those filters" : "No brands yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add the brands of the items you stock. Skip this if you don't care about brand reporting."
                    : "Your admin hasn't set up any brands yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Brand</Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Code</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Name</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{b.code}</td>
                    <td className="px-4 py-2.5 font-medium">{b.name}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(b),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(b),
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <BrandFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <BrandFormModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Delete this brand? Items currently tagged with it will become un-branded — no data lost, just the association."
        confirmLabel="Delete brand"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function BrandFormModal({ open, onClose, target }: { open: boolean; onClose: () => void; target?: ItemBrand }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: target?.code || "", name: target?.name || "" });
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = () => {
    const errs: { code?: string; name?: string } = {};
    if (!isEdit) {
      if (!form.code.trim()) errs.code = "Code is required";
      else if (!/^[A-Z0-9_]+$/.test(form.code)) errs.code = "Uppercase letters, numbers, and underscores only";
    }
    if (!form.name.trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) await itemBrandService.update(target!.id, { name: form.name });
      else await itemBrandService.create(form);
      toast.success(isEdit ? "Brand updated" : "Brand created");
      qc.invalidateQueries({ queryKey: ["itemBrands"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setErrors({ code: "A brand with this code already exists." });
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save. Please try again.");
      }
    } finally { setLoading(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit brand "${target?.code}"` : "Add a brand"}
      description={
        isEdit
          ? "Rename the brand. Code can't be changed once created."
          : "Tag your items with the manufacturer or product line they belong to."
      }
      width="sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <Input
          label="Code"
          placeholder="GSK"
          required
          disabled={isEdit || loading}
          help="Short uppercase identifier. Cannot be changed later."
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
        <Input
          label="Name"
          placeholder="GlaxoSmithKline"
          required
          help="The brand name as you want it to appear on items and reports."
          error={errors.name}
          disabled={loading}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>{isEdit ? "Save changes" : "Add brand"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
