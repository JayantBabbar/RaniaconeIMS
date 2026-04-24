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
  uomConversionService,
  uomService,
  UomConversion,
} from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import { Plus, Edit, Trash2, ArrowLeftRight } from "lucide-react";

export default function UomConversionsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.uoms.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UomConversion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UomConversion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["uomConversions"],
    queryFn: () => uomConversionService.list({ limit: 200 }),
  });
  const { data: uomsRaw } = useQuery({
    queryKey: ["uoms"],
    queryFn: () => uomService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];
  const uoms = uomsRaw?.data || [];
  const uomMap = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);

  const uomOptions = uoms.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }));

  const columns: ColumnDef<UomConversion>[] = [
    {
      key: "from_uom_id",
      label: "From",
      filterType: "select",
      getValue: (r) => uomMap.get(r.from_uom_id)?.code || "",
      options: uomOptions,
    },
    {
      key: "to_uom_id",
      label: "To",
      filterType: "select",
      getValue: (r) => uomMap.get(r.to_uom_id)?.code || "",
      options: uomOptions,
    },
    { key: "factor", label: "Factor", sortable: true, filterType: "text" },
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
    mutationFn: (id: string) => uomConversionService.delete(id),
    onSuccess: () => {
      toast.success("Conversion deleted");
      qc.invalidateQueries({ queryKey: ["uomConversions"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.uoms.read" crumbs={["Master Data", "UoM Conversions"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "UoM Conversions"]}
        right={
          <Can perm="inventory.uoms.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Conversion</Button>
          </Can>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title="UoM Conversions"
          description="How one unit equals another inside the same category — '1 kg = 1000 g', '1 box = 24 each'. The system uses these to convert automatically when you buy in one unit but track stock in another."
          learnMore="Every conversion is expressed as from → to × factor. The reverse direction is derived (1 g = 0.001 kg). Only set conversions between units in the same category; cross-category conversions don't make sense."
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
            placeholder="Search conversions by factor…"
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
            <EmptyState icon={<ArrowLeftRight size={22} />}
              title={activeFilterCount > 0 ? "No conversions match those filters" : "No conversions set up"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add conversions so you can buy in one unit and track stock in another — e.g. '1 case = 12 bottles'."
                    : "Your admin hasn't set up any unit conversions yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Conversion</Button>
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
                      <span>From</span>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5"></th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <span>To</span>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort} align="right">Factor</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const from = uomMap.get(c.from_uom_id);
                  const to = uomMap.get(c.to_uom_id);
                  return (
                    <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold">{from?.code || "—"}</td>
                      <td className="px-4 py-2.5 text-center"><ArrowLeftRight size={12} className="text-foreground-muted mx-auto" /></td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold">{to?.code || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{c.factor}</td>
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConvFormModal open={showCreate} onClose={() => setShowCreate(false)} uoms={uoms} />
      {editTarget && <ConvFormModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} uoms={uoms} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title="Delete this conversion?"
        description="Delete this conversion? Any transaction that relied on it will fail to convert automatically."
        confirmLabel="Delete conversion"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const conversionSchema = z
  .object({
    from_uom_id: z.string().min(1, "Select a 'from' unit"),
    to_uom_id: z.string().min(1, "Select a 'to' unit"),
    factor: z
      .string()
      .trim()
      .min(1, "Factor is required")
      .refine((v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: "Factor must be a positive number",
      }),
  })
  .refine((d) => d.from_uom_id !== d.to_uom_id, {
    message: "From and To must be different units",
    path: ["to_uom_id"],
  });
type ConversionFormValues = z.infer<typeof conversionSchema>;

function ConvFormModal({ open, onClose, target, uoms }: {
  open: boolean; onClose: () => void; target?: UomConversion;
  uoms: { id: string; code: string; name: string }[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConversionFormValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      from_uom_id: target?.from_uom_id || "",
      to_uom_id: target?.to_uom_id || "",
      factor: target?.factor || "1",
    },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: ConversionFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await uomConversionService.update(target!.id, { factor: data.factor });
      } else {
        await uomConversionService.create({
          from_uom_id: data.from_uom_id,
          to_uom_id: data.to_uom_id,
          factor: data.factor,
        });
      }
      toast.success(isEdit ? "Conversion updated" : "Conversion created");
      qc.invalidateQueries({ queryKey: ["uomConversions"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
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
      title={isEdit ? "Edit conversion" : "Add a UoM conversion"}
      description={
        isEdit
          ? "Only the factor can be changed. Swap units by deleting and re-creating."
          : "Express how one unit equals another — both units must be in the same category."
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
        <FormField
          label="From UoM"
          required
          help="The unit you're converting from (e.g. kg)."
          error={errors.from_uom_id?.message}
        >
          <select
            className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            disabled={isEdit || submitting}
            {...register("from_uom_id")}
          >
            <option value="">— Select —</option>
            {uoms.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
          </select>
        </FormField>
        <FormField
          label="To UoM"
          required
          help="The unit you're converting to (e.g. g). Must be in the same UoM category as 'From'."
          error={errors.to_uom_id?.message}
        >
          <select
            className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            disabled={isEdit || submitting}
            {...register("to_uom_id")}
          >
            <option value="">— Select —</option>
            {uoms.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
          </select>
        </FormField>
        <Input
          label="Factor"
          type="number"
          step="0.000001"
          placeholder="1000"
          required
          help="How many 'To' units equal one 'From' unit. E.g. for kg → g, factor is 1000."
          hint="1 FROM unit = N TO units"
          error={errors.factor?.message}
          disabled={submitting}
          {...register("factor")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save changes" : "Add conversion"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
