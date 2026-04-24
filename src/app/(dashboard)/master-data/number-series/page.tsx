"use client";

import React, { useState } from "react";
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
import { numberSeriesService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import type { NumberSeries } from "@/types";
import { Plus, Edit, Trash2, Hash, Eye } from "lucide-react";

export default function NumberSeriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.number_series.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<NumberSeries | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NumberSeries | null>(null);
  const [peekResult, setPeekResult] = useState<{ code: string; next: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["numberSeries"],
    queryFn: () => numberSeriesService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];

  const entityOptions = Array.from(new Set(allRows.map((r) => r.entity).filter(Boolean))).map(
    (v) => ({ value: v, label: v }),
  );

  const columns: ColumnDef<NumberSeries>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "entity", label: "Entity", sortable: true, filterType: "select", options: entityOptions },
    { key: "prefix", label: "Prefix", sortable: true, filterType: "text" },
    { key: "padding", label: "Padding", sortable: true, filterType: "text" },
    { key: "current_value", label: "Current", sortable: true, filterType: "text" },
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
    mutationFn: (id: string) => numberSeriesService.delete(id),
    onSuccess: () => {
      toast.success("Number series deleted");
      qc.invalidateQueries({ queryKey: ["numberSeries"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const peek = async (id: string, code: string) => {
    try {
      const res = await numberSeriesService.peek(id);
      setPeekResult({ code, next: res.next });
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "Peek failed");
    }
  };

  const preview = (n: NumberSeries) => {
    const num = String(n.current_value + 1).padStart(n.padding, "0");
    return `${n.prefix || ""}${num}${n.suffix || ""}`;
  };

  return (
    <RequireRead perm="inventory.number_series.read" crumbs={["Master Data", "Number Series"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Number Series"]}
        right={
          <Can perm="inventory.number_series.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              Add Series
            </Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Number Series"
          description="Auto-generate document numbers like PO-00001, SO-00042. Each series belongs to one entity (PO, SO, Transfer, Stock Count) and hands out sequential numbers on demand."
          learnMore="Create one series per document type you use. Prefix + padding give you the display format (e.g. 'PO-' + 5 = PO-00001). 'Peek' shows the next number without consuming it; 'Allocate' actually increments the counter."
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
            placeholder="Search number series by code or prefix…"
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
            <EmptyState
              icon={<Hash size={22} />}
              title={activeFilterCount > 0 ? "No series match those filters" : "No number series yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add a series for every kind of document you want numbered — Purchase Orders, Sales Orders, Transfers, Stock Counts."
                    : "Your admin hasn't configured number series yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                    Add Series
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
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Entity</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">Format</th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort} align="right">Current</SortHeader>
                      <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">Next preview</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{n.code || "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{n.entity}</Badge></td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs">
                      {n.prefix || ""}{'​'}{`{N:${n.padding}}`}{n.suffix || ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{n.current_value}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-brand">{preview(n)}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Peek next",
                              icon: <Eye size={12} />,
                              onClick: () => peek(n.id, n.code || n.entity),
                            },
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(n),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(n),
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

      <NumberSeriesFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && (
        <NumberSeriesFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          target={editTarget}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete series "${deleteTarget?.code || deleteTarget?.entity}"?`}
        description="Delete this series? Any document type relying on it won't be able to generate new numbers until you create a replacement."
        confirmLabel="Delete series"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />

      <Dialog open={!!peekResult} onClose={() => setPeekResult(null)} title="Next number" width="sm">
        <div className="py-2">
          <p className="text-sm text-foreground-secondary mb-3">
            The next number for <code className="font-mono font-semibold">{peekResult?.code}</code> would be:
          </p>
          <div className="bg-surface rounded-md px-3 py-2.5 font-mono text-base font-bold text-center">
            {peekResult?.next}
          </div>
          <p className="text-[11px] text-foreground-muted mt-2">
            Peeking does not advance the counter. Numbers are allocated atomically when used.
          </p>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setPeekResult(null)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </div>
    </RequireRead>
  );
}

const numberSeriesSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Keep it short — max 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers, and underscores only"),
  entity: z.string().min(1, "Entity is required"),
  prefix: z.string().max(10, "Prefix too long").optional().or(z.literal("")),
  suffix: z.string().max(10, "Suffix too long").optional().or(z.literal("")),
  padding: z
    .number({ invalid_type_error: "Padding is required" })
    .int("Whole number required")
    .min(1, "At least 1")
    .max(10, "At most 10"),
  start_value: z
    .number({ invalid_type_error: "Start value is required" })
    .int("Whole number required")
    .min(1, "Must be 1 or greater"),
});
type NumberSeriesFormValues = z.infer<typeof numberSeriesSchema>;

function NumberSeriesFormModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target?: NumberSeries;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<NumberSeriesFormValues>({
    resolver: zodResolver(numberSeriesSchema),
    defaultValues: {
      code: target?.code || "",
      entity: target?.entity || "document",
      prefix: target?.prefix || "",
      suffix: target?.suffix || "",
      padding: target?.padding ?? 5,
      start_value: target?.start_value ?? 1,
    },
  });

  const prefixVal = watch("prefix") || "";
  const suffixVal = watch("suffix") || "";
  const paddingVal = watch("padding") || 0;
  const startVal = watch("start_value") || 0;

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: NumberSeriesFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await numberSeriesService.update(target!.id, {
          prefix: data.prefix,
          suffix: data.suffix,
          padding: data.padding,
        });
      } else {
        await numberSeriesService.create({
          code: data.code,
          entity: data.entity,
          prefix: data.prefix || "",
          suffix: data.suffix || "",
          padding: data.padding,
          start_value: data.start_value,
        });
      }
      toast.success(isEdit ? "Series updated" : "Series created");
      qc.invalidateQueries({ queryKey: ["numberSeries"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setError("code", { message: "A series with this code already exists." });
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
      title={isEdit ? `Edit series "${target?.code || target?.entity}"` : "Add a number series"}
      description={
        isEdit
          ? "Adjust the display format. Code, entity, and start value can't be changed once in use."
          : "Auto-generate numbers for one kind of document — e.g. Purchase Orders."
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

        <Input
          label="Code"
          placeholder="PO_SERIES"
          required
          disabled={isEdit || submitting}
          help="Internal identifier — how you'll reference this series when wiring a document type to it."
          error={errors.code?.message}
          {...register("code", {
            setValueAs: (v) => (typeof v === "string" ? v.toUpperCase() : v),
          })}
        />
        <FormField
          label="Entity"
          required
          help="Which kind of object this series numbers — Document, Item, Count, Lot."
          error={errors.entity?.message}
        >
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            disabled={isEdit || submitting}
            {...register("entity")}
          >
            <option value="document">Document</option>
            <option value="item">Item</option>
            <option value="count">Count</option>
            <option value="lot">Lot</option>
          </select>
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Prefix"
            placeholder="PO-"
            help="Shown before the number. Leave blank for no prefix."
            error={errors.prefix?.message}
            disabled={submitting}
            {...register("prefix")}
          />
          <Input
            label="Suffix"
            placeholder="/2026"
            help="Shown after the number. Leave blank for no suffix."
            error={errors.suffix?.message}
            disabled={submitting}
            {...register("suffix")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Padding"
            type="number"
            min={1}
            max={10}
            required
            placeholder="5"
            help="How many digits the number is padded to with leading zeros (e.g. 5 = 00001)."
            error={errors.padding?.message}
            disabled={submitting}
            {...register("padding", { valueAsNumber: true })}
          />
          <Input
            label="Start value"
            type="number"
            min={1}
            required
            placeholder="1"
            help="The first number to allocate. Usually 1. Cannot be changed later."
            error={errors.start_value?.message}
            disabled={isEdit || submitting}
            {...register("start_value", { valueAsNumber: true })}
          />
        </div>
        <div className="bg-surface rounded-md px-3 py-2 text-xs">
          <span className="text-foreground-muted">Preview: </span>
          <code className="font-mono font-bold text-brand">
            {prefixVal}{String(startVal).padStart(Math.max(1, Math.min(10, paddingVal || 1)), "0")}{suffixVal}
          </code>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save changes" : "Add series"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
