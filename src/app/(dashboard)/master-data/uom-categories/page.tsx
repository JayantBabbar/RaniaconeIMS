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
import { uomCategoryService, UomCategory } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import { Plus, Edit, Trash2, Ruler } from "lucide-react";

export default function UomCategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.uoms.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UomCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UomCategory | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["uomCategories"],
    queryFn: () => uomCategoryService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];

  const columns: ColumnDef<UomCategory>[] = [
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
    mutationFn: (id: string) => uomCategoryService.delete(id),
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["uomCategories"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.uoms.read" crumbs={["Master Data", "UoM Categories"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "UoM Categories"]}
        right={
          <Can perm="inventory.uoms.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Category</Button>
          </Can>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title="UoM Categories"
          description="Groups of units that can be converted between each other. 'Weight' holds kg, g, tonne. 'Volume' holds litre, ml. You can only set up conversions between units in the same category."
          learnMore="Create a category before you create the units that belong to it. 'Each' is often a one-unit category on its own (you can't convert 'each' to anything). Keep the list short — 3–6 categories is typical."
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
            placeholder="Search categories by code or name…"
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

        <div className="bg-white border border-hairline rounded-md overflow-hidden max-w-3xl">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Ruler size={22} />}
              title={activeFilterCount > 0 ? "No categories match those filters" : "No UoM categories yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add categories like Weight, Volume, Length, Count — anything you need to group units under."
                    : "Your admin hasn't set up any unit categories yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Category</Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              } />
          ) : (
            <table className="w-full text-sm">
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
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{c.code}</td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(c),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(c),
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

      <UomCatFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <UomCatFormModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Delete this category? Units inside it become uncategorised. Conversions between those units will still work but new units in this category can't be added."
        confirmLabel="Delete category"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function UomCatFormModal({ open, onClose, target }: { open: boolean; onClose: () => void; target?: UomCategory }) {
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
      if (isEdit) await uomCategoryService.update(target!.id, { name: form.name });
      else await uomCategoryService.create(form);
      toast.success(isEdit ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["uomCategories"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setErrors({ code: "A category with this code already exists." });
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
      title={isEdit ? `Edit category "${target?.code}"` : "Add a UoM category"}
      description={
        isEdit
          ? "Rename the category. Code can't be changed once created."
          : "A group for units that can convert between each other."
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
          placeholder="WEIGHT"
          required
          disabled={isEdit || loading}
          help="Short uppercase identifier. Cannot be changed later."
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
        <Input
          label="Name"
          placeholder="Weight"
          required
          help="Plain-language name shown in dropdowns."
          error={errors.name}
          disabled={loading}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>{isEdit ? "Save changes" : "Add category"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
