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
import { statusMasterService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import type { StatusMaster } from "@/types";
import { Plus, Edit, Trash2, Flag } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Status Master — tenant-scoped status definitions
// e.g. document statuses ("draft","approved","posted"), etc.
// ═══════════════════════════════════════════════════════════

export default function StatusMasterPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.status_master.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<StatusMaster | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StatusMaster | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["statusMaster"],
    queryFn: () => statusMasterService.list({ limit: 200 }),
  });
  const allRows = data?.data || [];

  const categoryOptions = Array.from(new Set(allRows.map((r) => r.category).filter(Boolean))).map(
    (v) => ({ value: v, label: v }),
  );
  const entityOptions = Array.from(new Set(allRows.map((r) => r.entity).filter(Boolean))).map(
    (v) => ({ value: v, label: v }),
  );

  const columns: ColumnDef<StatusMaster>[] = [
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "label", label: "Label", sortable: true, filterType: "text" },
    {
      key: "category",
      label: "Category",
      sortable: true,
      filterType: "select",
      options: categoryOptions,
    },
    {
      key: "entity",
      label: "Entity",
      sortable: true,
      filterType: "select",
      options: entityOptions,
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
    mutationFn: (id: string) => statusMasterService.delete(id),
    onSuccess: () => {
      toast.success("Status deleted");
      qc.invalidateQueries({ queryKey: ["statusMaster"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.status_master.read" crumbs={["Master Data", "Status Master"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Status Master"]}
        right={
          <Can perm="inventory.status_master.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              Add Status
            </Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Status Master"
          description="Named states your documents and items move through — 'Draft', 'Submitted', 'Approved', 'Posted', 'Cancelled'. Defined once here, used everywhere statuses appear."
          learnMore="Statuses are the building blocks of Workflows. Create the statuses you'll need first, then wire them into state machines under Settings → Workflows. The 'entity' field says what the status applies to (document, item, etc.)."
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
            placeholder="Search statuses by code or label…"
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
              icon={<Flag size={22} />}
              title={activeFilterCount > 0 ? "No statuses match those filters" : "No statuses defined yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add the states your documents and items will flow through — like Draft, Submitted, Approved, Posted."
                    : "Your admin hasn't set any statuses up yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                    Add Status
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
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Label</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Entity</SortHeader>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Category</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{s.code}</td>
                    <td className="px-4 py-2.5 font-medium">{s.label}</td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{s.entity}</Badge></td>
                    <td className="px-4 py-2.5 text-foreground-secondary">{s.category}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(s),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(s),
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

      <StatusMasterFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && (
        <StatusMasterFormModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          target={editTarget}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.code} — ${deleteTarget?.label}"?`}
        description="Delete this status? Any documents, items, or workflow transitions currently using it will break. Move or re-point them first."
        confirmLabel="Delete status"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const statusSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Keep it short — max 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers, and underscores only"),
  label: z.string().trim().min(1, "Label is required").max(60, "Too long"),
  entity: z.string().min(1, "Entity is required"),
  category: z.string().trim().min(1, "Category is required").max(40, "Too long"),
});
type StatusFormValues = z.infer<typeof statusSchema>;

function StatusMasterFormModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target?: StatusMaster;
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
  } = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      code: target?.code || "",
      label: target?.label || "",
      entity: target?.entity || "document",
      category: target?.category || "",
    },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: StatusFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await statusMasterService.update(target!.id, {
          label: data.label,
          category: data.category,
        });
      } else {
        await statusMasterService.create(data);
      }
      toast.success(isEdit ? "Status updated" : "Status created");
      qc.invalidateQueries({ queryKey: ["statusMaster"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setError("code", { message: "A status with this code already exists." });
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
      title={isEdit ? `Edit status "${target?.code}"` : "Add a status"}
      description={
        isEdit
          ? "Update the label or category. Code and entity can't be changed once created."
          : "Name a state your documents or items can be in."
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
          placeholder="DRAFT"
          required
          disabled={isEdit || submitting}
          help="Uppercase identifier used in API and filters. Cannot be changed later."
          error={errors.code?.message}
          {...register("code", {
            setValueAs: (v) => (typeof v === "string" ? v.toUpperCase() : v),
          })}
        />
        <Input
          label="Label"
          placeholder="Draft"
          required
          help="The human-readable name shown in dropdowns and badges."
          error={errors.label?.message}
          disabled={submitting}
          {...register("label")}
        />
        <FormField
          label="Entity"
          required
          help="What this status applies to. Pick the entity type before you use it in a workflow."
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
            <option value="reservation">Reservation</option>
          </select>
        </FormField>
        <Input
          label="Category"
          placeholder="lifecycle"
          required
          help="A tag that groups related statuses (e.g. 'lifecycle', 'approval')."
          error={errors.category?.message}
          disabled={submitting}
          {...register("category")}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>
            {isEdit ? "Save changes" : "Add status"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
