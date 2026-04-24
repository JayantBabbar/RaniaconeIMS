"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
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
import {
  uomService,
  uomCategoryService,
  Uom,
} from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import { Plus, Edit, Trash2, Scale } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Units of Measure — nouns you quantify things in (kg, litre, box, each).
// ═══════════════════════════════════════════════════════════════════

export default function UomsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.uoms.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Uom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Uom | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["uoms"],
    queryFn: () => uomService.list({ limit: 200 }),
  });
  const { data: catsRaw } = useQuery({
    queryKey: ["uomCategories"],
    queryFn: () => uomCategoryService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];
  const categories = catsRaw?.data || [];
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const columns: ColumnDef<Uom>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "name", label: "Name", sortable: true, filterType: "text" },
    { key: "symbol", label: "Symbol", sortable: true },
    {
      key: "uom_category_id",
      label: "Category",
      sortable: true,
      filterType: "select",
      getValue: (r) => catMap.get(r.uom_category_id || "") || "",
      options: categories.map((c) => ({ value: c.name, label: c.name })),
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
  } = useTableFilters({ data: allRows, columns });

  const deleteMut = useMutation({
    mutationFn: (id: string) => uomService.delete(id),
    onSuccess: () => {
      toast.success("UoM deleted");
      qc.invalidateQueries({ queryKey: ["uoms"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.uoms.read" crumbs={["Master Data", "Units of Measure"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Units of Measure"]}
        right={
          <Can perm="inventory.uoms.write">
            <Button
              kind="primary"
              icon={<Plus size={13} />}
              onClick={() => setShowCreate(true)}
            >
              Add UoM
            </Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Units of Measure"
          description="The units you quantify items in — like kilograms, litres, pieces, or boxes. You'll pick one every time you add an item or record stock movements, so keep the list tight and meaningful."
          learnMore={`Group related units into "UoM Categories" (e.g. Weight: kg, g, tonne) so you can set up conversions later. Every item has one base unit it's stored in — the canonical unit. Other units can be added as alternatives (e.g. "we buy in boxes of 24 each").`}
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
            placeholder="Search UoMs by code or name…"
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

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Scale size={22} />}
              title={activeFilterCount > 0 ? "No UoMs match those filters" : "No units of measure yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Start with the units your team actually says out loud — kg, litre, each, box. You can always add more."
                    : "Your admin hasn't set any units up yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate(true)}
                  >
                    Add your first UoM
                  </Button>
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
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort} align="center">Symbol</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Category</SortHeader>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-hairline-light hover:bg-surface/50"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{u.code}</td>
                    <td className="px-4 py-2.5 font-medium">{u.name}</td>
                    <td className="px-4 py-2.5 text-center text-sm">{u.symbol || "—"}</td>
                    <td className="px-4 py-2.5 text-foreground-secondary">
                      {u.uom_category_id ? catMap.get(u.uom_category_id) || "—" : "—"}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(u),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(u),
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

      <UomFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        categories={categories}
      />
      {editTarget && (
        <UomFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          target={editTarget}
          categories={categories}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={`Items and document lines currently using this UoM will fail to save until they're switched to a different UoM. This cannot be undone.`}
        confirmLabel="Delete UoM"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

// ── Form modal with Zod validation ───────────────────────────────

const uomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20, "Keep it short — max 20 characters")
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers, and underscores only"),
  name: z.string().trim().min(1, "Name is required").max(100, "Too long"),
  symbol: z.string().trim().max(10, "Keep it short").optional().or(z.literal("")),
  uom_category_id: z.string().optional().or(z.literal("")),
});
type UomFormValues = z.infer<typeof uomSchema>;

function UomFormModal({
  open,
  onClose,
  target,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  target?: Uom;
  categories: { id: string; code: string; name: string }[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<UomFormValues>({
    resolver: zodResolver(uomSchema),
    defaultValues: {
      code: target?.code || "",
      name: target?.name || "",
      symbol: target?.symbol || "",
      uom_category_id: target?.uom_category_id || "",
    },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: UomFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await uomService.update(target!.id, {
          name: data.name,
          symbol: data.symbol || undefined,
        });
      } else {
        await uomService.create({
          code: data.code,
          name: data.name,
          symbol: data.symbol || undefined,
          uom_category_id: data.uom_category_id || undefined,
        });
      }
      toast.success(isEdit ? "UoM updated" : "UoM created");
      qc.invalidateQueries({ queryKey: ["uoms"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setError("code", { message: "A UoM with this code already exists." });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={isEdit ? `Edit UoM "${target?.code}"` : "Add a unit of measure"}
      description={
        isEdit
          ? "Rename the unit or adjust its symbol. The code can't be changed once created — delete and re-create if you need a different code."
          : "Define a new unit your team uses to quantify items."
      }
      width="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Code"
            placeholder="KG"
            required
            disabled={isEdit || submitting}
            help="Short uppercase identifier used in filters and reports. Cannot be changed later."
            error={errors.code?.message}
            {...register("code", {
              setValueAs: (v) => (typeof v === "string" ? v.toUpperCase() : v),
            })}
          />
          <Input
            label="Symbol"
            placeholder="kg"
            help="The short label shown in the UI (lowercase OK). Keep it to 1–3 characters."
            error={errors.symbol?.message}
            disabled={submitting}
            {...register("symbol")}
          />
        </div>

        <Input
          label="Name"
          placeholder="Kilogram"
          required
          help="The full human-readable name."
          error={errors.name?.message}
          disabled={submitting}
          {...register("name")}
        />

        <FormField
          label="Category"
          help="Group units that can be converted between (e.g. Weight contains kg, g, and tonne). You can leave this blank and set it later."
        >
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            disabled={isEdit || submitting}
            {...register("uom_category_id")}
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>
            {isEdit ? "Save changes" : "Add UoM"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
