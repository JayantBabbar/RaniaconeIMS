"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
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
import { documentTypeService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import type { DocumentType } from "@/types";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

const DIRECTIONS = ["in", "out", "transfer", "internal"] as const;
const MODULES = ["purchase", "sales", "inventory", "production"] as const;

export default function DocumentTypesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.documents.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<DocumentType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documentTypes"],
    queryFn: () => documentTypeService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];

  const moduleOptions = Array.from(new Set(allRows.map((r) => r.module).filter(Boolean))).map(
    (v) => ({ value: v, label: v }),
  );

  const columns: ColumnDef<DocumentType>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "name", label: "Name", sortable: true, filterType: "text" },
    {
      key: "direction",
      label: "Direction",
      sortable: true,
      filterType: "select",
      options: [
        { value: "in", label: "in" },
        { value: "out", label: "out" },
        { value: "transfer", label: "transfer" },
        { value: "internal", label: "internal" },
      ],
    },
    {
      key: "module",
      label: "Module",
      sortable: true,
      filterType: "select",
      options: moduleOptions,
    },
    { key: "affects_stock", label: "Affects Stock", filterType: "boolean" },
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
    mutationFn: (id: string) => documentTypeService.delete(id),
    onSuccess: () => {
      toast.success("Document type deleted");
      qc.invalidateQueries({ queryKey: ["documentTypes"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const directionTone = (d: string): "green" | "blue" | "amber" | "neutral" => {
    if (d === "in") return "green";
    if (d === "out") return "blue";
    if (d === "transfer") return "amber";
    return "neutral";
  };

  return (
    <RequireRead perm="inventory.documents.read" crumbs={["Master Data", "Document Types"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Document Types"]}
        right={
          <Can perm="inventory.documents.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Type</Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Document Types"
          description="The kinds of documents your business creates — Purchase Order, Sales Order, Transfer, Goods Receipt. Each type decides whether the document affects stock and in which direction."
          learnMore="Direction says how stock moves: 'in' adds stock (receipts, returns), 'out' removes it (sales, issues), 'transfer' moves between locations, 'internal' doesn't touch stock. The 'affects_stock' checkbox must match the direction for posting to work."
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
            placeholder="Search document types by code or name…"
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
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<FileText size={22} />}
              title={activeFilterCount > 0 ? "No types match those filters" : "No document types defined"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Create the documents you'll post — at minimum a Purchase Order, Sales Order, and Transfer."
                    : "Your admin hasn't set up any document types yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Type</Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              } />
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
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Module</SortHeader>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Direction</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>Affects Stock</span>
                      <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{d.code}</td>
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="px-4 py-2.5 text-foreground-secondary">{d.module}</td>
                    <td className="px-4 py-2.5"><Badge tone={directionTone(d.direction)}>{d.direction}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{d.affects_stock ? "Yes" : "—"}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(d),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(d),
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

      <DocTypeFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <DocTypeFormModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.code}"?`}
        description="Delete this document type? Existing documents of this type stay, but you can't create new ones until you replace it."
        confirmLabel="Delete type"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const docTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Keep it short — max 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers, and underscores only"),
  name: z.string().trim().min(1, "Name is required").max(100, "Too long"),
  direction: z.enum(DIRECTIONS),
  module: z.enum(MODULES),
  affects_stock: z.boolean(),
});
type DocTypeFormValues = z.infer<typeof docTypeSchema>;

function DocTypeFormModal({ open, onClose, target }: { open: boolean; onClose: () => void; target?: DocumentType }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors },
  } = useForm<DocTypeFormValues>({
    resolver: zodResolver(docTypeSchema),
    defaultValues: {
      code: target?.code || "",
      name: target?.name || "",
      direction: (target?.direction as (typeof DIRECTIONS)[number]) || "in",
      module: (target?.module as (typeof MODULES)[number]) || "purchase",
      affects_stock: target?.affects_stock ?? true,
    },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: DocTypeFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await documentTypeService.update(target!.id, {
          name: data.name,
          affects_stock: data.affects_stock,
        });
      } else {
        await documentTypeService.create(data);
      }
      toast.success(isEdit ? "Type updated" : "Type created");
      qc.invalidateQueries({ queryKey: ["documentTypes"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setError("code", { message: "A document type with this code already exists." });
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
      title={isEdit ? `Edit type "${target?.code}"` : "Add a document type"}
      description={
        isEdit
          ? "Rename the type or toggle stock impact. Code, module, and direction can't be changed once created."
          : "Define a new kind of document your team will create."
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
            placeholder="PO"
            required
            disabled={isEdit || submitting}
            help="Short uppercase identifier (e.g. PO, SO, GRN). Cannot be changed later."
            error={errors.code?.message}
            {...register("code", {
              setValueAs: (v) => (typeof v === "string" ? v.toUpperCase() : v),
            })}
          />
          <Input
            label="Name"
            placeholder="Purchase Order"
            required
            help="Human-readable title shown in menus and document headers."
            error={errors.name?.message}
            disabled={submitting}
            {...register("name")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Module"
            help="Which part of the app this document lives under."
            error={errors.module?.message}
          >
            <select
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
              disabled={isEdit || submitting}
              {...register("module")}
            >
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField
            label="Direction"
            required
            help="How stock moves when this document posts. In = add, out = remove, transfer = between locations, internal = no stock effect."
            error={errors.direction?.message}
          >
            <select
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
              disabled={isEdit || submitting}
              {...register("direction")}
            >
              {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
        </div>
        <Controller
          name="affects_stock"
          control={control}
          render={({ field }) => (
            <Checkbox
              label="Affects stock (creates movements on posting)"
              checked={field.value}
              onChange={field.onChange}
              disabled={submitting}
            />
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save changes" : "Add type"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
