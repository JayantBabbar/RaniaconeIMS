"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { workflowService, Workflow } from "@/services/workflows.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Plus, Workflow as WorkflowIcon, Edit, Trash2 } from "lucide-react";

const WORKFLOW_ENTITIES = [
  "document", "item", "party", "count", "reservation",
] as const;

export default function WorkflowsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.workflows.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Workflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowService.list({ limit: 200 }),
  });
  const allRows = data || [];

  const entityOptions = Array.from(new Set(allRows.map((r) => r.entity).filter(Boolean))).map(
    (v) => ({ value: v, label: v }),
  );

  const columns: ColumnDef<Workflow>[] = [
    { key: "name", label: "Name", sortable: true, filterType: "text" },
    { key: "entity", label: "Entity", sortable: true, filterType: "select", options: entityOptions },
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
    mutationFn: (id: string) => workflowService.delete(id),
    onSuccess: () => {
      toast.success("Workflow deleted");
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.workflows.read" crumbs={["Settings", "Workflows"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Workflows"]}
        right={
          <Can perm="inventory.workflows.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>New Workflow</Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Workflows"
          description="State machines that control how documents (and other entities) move through statuses. Draft → Submitted → Approved → Posted is the default — you can define your own."
          learnMore="A workflow binds to an entity (e.g. 'document') and lists the states it can be in plus the allowed transitions between them. Transitions can be permission-gated so only certain roles can advance a document. Click a workflow to edit its states and transitions."
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
            placeholder="Search workflows by code or name…"
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
              icon={<WorkflowIcon size={22} />}
              title={activeFilterCount > 0 ? "No workflows match those filters" : "No workflows yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Define a workflow when you want to enforce an approval path — e.g. which roles can move a PO from Submitted to Approved to Posted."
                    : "Your admin hasn't set up any workflows yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Create your first workflow</Button>
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
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Name</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Entity</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">Active</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/settings/workflows/${w.id}`} className="font-medium hover:text-brand">
                        {w.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{w.entity}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{w.is_active ? "✓" : "—"}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(w),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(w),
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

      {showCreate && <WorkflowFormModal onClose={() => setShowCreate(false)} />}
      {editTarget && <WorkflowFormModal target={editTarget} onClose={() => setEditTarget(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="All states and transitions defined on this workflow are removed with it. Entities that reference this workflow will no longer have a state machine enforced — they'll still save, but approvals won't be gated."
        confirmLabel="Delete workflow"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const workflowSchema = z.object({
  entity: z.string().min(1, "Entity is required"),
  name: z.string().trim().min(1, "Name is required").max(255, "Max 255 characters"),
  is_active: z.boolean(),
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

function WorkflowFormModal({ target, onClose }: { target?: Workflow; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      entity: target?.entity || "document",
      name: target?.name || "",
      is_active: target?.is_active ?? true,
    },
  });

  const onSubmit = async (data: WorkflowFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await workflowService.update(target!.id, { name: data.name, is_active: data.is_active });
      } else {
        await workflowService.create(data);
      }
      toast.success(isEdit ? "Workflow updated" : "Workflow created");
      qc.invalidateQueries({ queryKey: ["workflows"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save workflow. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit "${target?.name}"` : "New workflow"}
      description={isEdit
        ? "Rename this workflow or toggle it active. Entity type can't be changed after creation — delete and re-create if needed."
        : "Name this workflow and pick the entity it applies to. States and transitions are added on the next screen."}
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
          label="Name"
          placeholder="Purchase Order approval"
          required
          help="A short name for this workflow, shown in filters and on entity detail pages."
          error={errors.name?.message}
          maxLength={255}
          disabled={submitting}
          {...register("name")}
        />
        <FormField label="Entity" required error={errors.entity?.message} help="Which kind of record this workflow governs. Cannot be changed later.">
          <select
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.entity ? "border-status-red" : "border-hairline"
            )}
            disabled={isEdit || submitting}
            {...register("entity")}
          >
            {WORKFLOW_ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </FormField>
        <Checkbox label="Active" checked={watch("is_active")} onChange={(v) => setValue("is_active", v)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
