"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox, Textarea } from "@/components/ui/form-elements";
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
  customFieldService, CustomFieldDefinition,
  CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES,
} from "@/services/settings.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Plus, Puzzle, Edit, Trash2 } from "lucide-react";

export default function CustomFieldsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.custom_fields.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomFieldDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customFields"],
    queryFn: () =>
      customFieldService.listDefinitions({
        limit: 200,
      }),
  });
  const allRows = data || [];

  const columns: ColumnDef<CustomFieldDefinition>[] = [
    {
      key: "entity",
      label: "Entity",
      sortable: true,
      filterType: "select",
      options: [
        { value: "item", label: "item" },
        { value: "party", label: "party" },
        { value: "inventory_location", label: "inventory_location" },
        { value: "warehouse_bin", label: "warehouse_bin" },
        { value: "document_header", label: "document_header" },
        { value: "document_line", label: "document_line" },
      ],
    },
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    { key: "label", label: "Label", sortable: true, filterType: "text" },
    {
      key: "field_type",
      label: "Type",
      sortable: true,
      filterType: "select",
      options: [
        { value: "text", label: "text" },
        { value: "number", label: "number" },
        { value: "date", label: "date" },
        { value: "boolean", label: "boolean" },
        { value: "select", label: "select" },
        { value: "json", label: "json" },
      ],
    },
    { key: "is_required", label: "Required", filterType: "boolean" },
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
    mutationFn: (id: string) => customFieldService.deleteDefinition(id),
    onSuccess: () => {
      toast.success("Field deleted");
      qc.invalidateQueries({ queryKey: ["customFields"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.custom_fields.read" crumbs={["Settings", "Custom Fields"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Custom Fields"]}
        right={
          <Can perm="inventory.custom_fields.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Field</Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Custom Fields"
          description="Extend items, parties, documents, and more with fields specific to your business — e.g. shelf-life days on items, customer tier on parties."
          learnMore="Custom fields come in six types: text, number, date, boolean, select (dropdown), and JSON. Once defined, they appear automatically on the relevant entity's detail page. Marking a field as required forces it to be filled on every record of that entity."
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
            placeholder="Search custom fields by code or label…"
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
              icon={<Puzzle size={22} />}
              title={activeFilterCount > 0 ? "No fields match those filters" : "No custom fields yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Define a field to capture data your business needs beyond the built-in schema — shelf-life days, customer tier, anything."
                    : "Your admin hasn't set up any custom fields yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add your first field</Button>
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
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Code</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Label</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Entity</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Type</SortHeader>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>Required</span>
                      <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                    </div>
                  </th>
                  <th className="text-right px-4 py-2.5">Order</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{f.code}</td>
                    <td className="px-4 py-2.5 font-medium">{f.label}</td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{f.entity}</Badge></td>
                    <td className="px-4 py-2.5"><Badge tone="neutral">{f.field_type}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{f.is_required ? "✓" : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.sort_order}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(f),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(f),
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

      {showCreate && <FieldFormModal onClose={() => setShowCreate(false)} />}
      {editTarget && <FieldFormModal target={editTarget} onClose={() => setEditTarget(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.label}"?`}
        description="The field definition is removed. Values already saved on records of this entity are orphaned — they'll still be in the database but won't show in the UI. Re-creating a field with the same code won't re-link them."
        confirmLabel="Delete field"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function FieldFormModal({ target, onClose }: { target?: CustomFieldDefinition; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    entity: target?.entity || "item",
    code: target?.code || "",
    label: target?.label || "",
    field_type: target?.field_type || "text",
    is_required: target?.is_required ?? false,
    sort_order: target?.sort_order ?? 0,
    select_choices: (target?.options as any)?.choices?.join(", ") || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = "Code is required";
    else if (!/^[a-z0-9_]+$/.test(form.code)) errs.code = "Lowercase, digits, underscores only";
    if (!form.label.trim()) errs.label = "Label is required";
    if (!form.entity) errs.entity = "Entity is required";
    if (!form.field_type) errs.field_type = "Field type is required";
    if (form.field_type === "select" && !form.select_choices.trim())
      errs.select_choices = "At least one choice required for select type";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const options = form.field_type === "select"
        ? { choices: form.select_choices.split(",").map((c: string) => c.trim()).filter(Boolean) }
        : undefined;
      if (isEdit) {
        await customFieldService.updateDefinition(target!.id, {
          label: form.label,
          is_required: form.is_required,
          sort_order: form.sort_order,
          options,
        });
      } else {
        await customFieldService.createDefinition({
          entity: form.entity,
          code: form.code,
          label: form.label,
          field_type: form.field_type,
          is_required: form.is_required,
          sort_order: form.sort_order,
          options,
        });
      }
      toast.success(isEdit ? "Field updated" : "Field created");
      qc.invalidateQueries({ queryKey: ["customFields"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("Save failed");
      }
    } finally { setLoading(false); }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit "${target?.code}"` : "Add a custom field"}
      description={isEdit
        ? "Update the label, required flag, sort order, or choices. Code, entity, and type can't be changed once created."
        : "Define a field for an entity. Once saved, it appears on every record of that entity's detail page."}
      width="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Entity" required error={errors.entity} help="Which kind of record this field attaches to. Cannot be changed later.">
            <select value={form.entity}
              onChange={(e) => setField("entity", e.target.value)}
              disabled={isEdit}
              className={cn(
                "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                errors.entity ? "border-status-red" : "border-hairline"
              )}>
              {CUSTOM_FIELD_ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </FormField>
          <FormField label="Type" required error={errors.field_type} help="Data type — text, number, date, boolean, select (dropdown), or json. Cannot be changed later.">
            <select value={form.field_type}
              onChange={(e) => setField("field_type", e.target.value as typeof form.field_type)}
              disabled={isEdit}
              className={cn(
                "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                errors.field_type ? "border-status-red" : "border-hairline"
              )}>
              {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
        </div>
        <Input
          label="Code"
          placeholder="serial_notes"
          required
          help="Internal identifier for this field. Lowercase letters, numbers, and underscores only. Cannot be changed later."
          value={form.code}
          onChange={(e) => setField("code", e.target.value.toLowerCase())}
          error={errors.code}
          disabled={isEdit}
          maxLength={100}
        />
        <Input
          label="Label"
          placeholder="Serial Notes"
          required
          help="Human-readable label shown above the field on the detail page."
          value={form.label}
          onChange={(e) => setField("label", e.target.value)}
          error={errors.label}
          maxLength={255}
        />
        {form.field_type === "select" && (
          <Textarea label="Choices (comma-separated)" placeholder="small, medium, large"
            value={form.select_choices}
            onChange={(e) => setField("select_choices", e.target.value)} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <Input label="Sort order" type="number" value={form.sort_order}
            onChange={(e) => setField("sort_order", parseInt(e.target.value) || 0)} />
          <Checkbox label="Required" checked={form.is_required}
            onChange={(v) => setField("is_required", v)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
