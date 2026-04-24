"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { Input, FormField } from "@/components/ui/form-elements";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { tenantService, currencyService } from "@/services/platform.service";
import { isApiError } from "@/lib/api-client";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Tenant, Currency } from "@/types";
import {
  Plus,
  Building2,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Tenant Management Page — Tier 1 Service Provider Admin
// The core page for provisioning new client companies
// ═══════════════════════════════════════════════════════════

export default function TenantManagementPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  // Fetch tenants
  const { data: tenantsRaw, isLoading } = useQuery({
    queryKey: ["platformTenants"],
    queryFn: () =>
      tenantService.list({
        limit: 200,
      }),
  });

  // Fetch currencies for display
  const { data: currenciesRaw } = useQuery({
    queryKey: ["platformCurrencies"],
    queryFn: () => currencyService.list({ limit: 200 }),
  });

  const tenants = tenantsRaw ?? [];
  const currencies = currenciesRaw ?? [];
  const currencyMap = new Map(currencies.map((c) => [c.id, c]));

  const columns: ColumnDef<Tenant>[] = [
    { key: "name", label: "Name", sortable: true, filterType: "text" },
    { key: "code", label: "Code", sortable: true, filterType: "text" },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      filterType: "select",
      options: [
        { value: "trial", label: "Trial" },
        { value: "starter", label: "Starter" },
        { value: "pro", label: "Pro" },
        { value: "enterprise", label: "Enterprise" },
      ],
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterType: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "trialing", label: "Trialing" },
        { value: "suspended", label: "Suspended" },
      ],
    },
    { key: "timezone", label: "Timezone", sortable: true, filterType: "text" },
    { key: "created_at", label: "Created", sortable: true },
  ];

  const {
    rows: filteredTenants,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  } = useTableFilters({ data: tenants, columns });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantService.delete(id),
    onSuccess: () => {
      toast.success("Tenant deleted (soft-delete)");
      queryClient.invalidateQueries({ queryKey: ["platformTenants"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to delete tenant");
    },
  });

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-hidden">
      <TopBar
        crumbs={["Platform", "Tenants"]}
        right={
          <Button
            kind="primary"
            icon={<Plus size={13} />}
            onClick={() => setShowCreate(true)}
          >
            Provision Tenant
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Tenants</h1>
            <Badge tone="neutral">
              {filteredTenants.length}
              {filteredTenants.length !== tenants.length ? ` / ${tenants.length}` : ""} total
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <GlobalSearch
              search={search}
              setSearch={setSearch}
              placeholder="Search tenants by name or code…"
            />
            <div className="flex-1" />
            {activeFilterCount > 0 && (
              <span className="text-[11px] text-foreground-muted">
                {filteredTenants.length} match{filteredTenants.length === 1 ? "" : "es"}
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

          {/* Table */}
          <div className="bg-white border border-hairline rounded-md overflow-hidden">
            {isLoading ? (
              <div className="py-20 flex justify-center">
                <Spinner size={24} />
              </div>
            ) : filteredTenants.length === 0 ? (
              <EmptyState
                icon={<Building2 size={22} />}
                title={activeFilterCount > 0 ? "No tenants match those filters" : "No tenants found"}
                description={
                  activeFilterCount > 0
                    ? "Try loosening the filters, or clear them all to start over."
                    : "Provision your first tenant to onboard a client"
                }
                action={
                  activeFilterCount === 0 ? (
                    <Button
                      kind="primary"
                      icon={<Plus size={13} />}
                      onClick={() => setShowCreate(true)}
                    >
                      Provision Tenant
                    </Button>
                  ) : (
                    <Button onClick={clearAll}>Clear all filters</Button>
                  )
                }
              />
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                      <th className="text-left px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Tenant</SortHeader>
                          <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                          <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                        </div>
                      </th>
                      <th className="text-left px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Plan</SortHeader>
                          <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                        </div>
                      </th>
                      <th className="text-left px-3.5 py-2.5">Currency</th>
                      <th className="text-left px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort}>Timezone</SortHeader>
                          <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                        </div>
                      </th>
                      <th className="text-left px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort}>Status</SortHeader>
                          <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                        </div>
                      </th>
                      <th className="text-left px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort}>Created</SortHeader>
                        </div>
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((tenant) => {
                      const currency = currencyMap.get(tenant.base_currency_id || "");
                      return (
                        <tr
                          key={tenant.id}
                          className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                        >
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-surface-secondary text-[11px] font-semibold flex items-center justify-center text-foreground-secondary">
                                {getInitials(tenant.name)}
                              </div>
                              <div>
                                <div className="font-medium">{tenant.name}</div>
                                <div className="text-[10.5px] text-foreground-muted font-mono">
                                  {tenant.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge
                              tone={
                                tenant.plan === "enterprise" || tenant.plan === "Enterprise"
                                  ? "blue"
                                  : tenant.plan === "pro" || tenant.plan === "Growth"
                                    ? "neutral"
                                    : "amber"
                              }
                            >
                              {tenant.plan || "—"}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-xs">
                            {currency ? `${currency.code} (${currency.symbol})` : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-foreground-secondary text-xs">
                            {tenant.timezone}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge
                              tone={
                                tenant.status === "active"
                                  ? "green"
                                  : tenant.status === "trialing"
                                    ? "blue"
                                    : "red"
                              }
                              dot
                            >
                              {tenant.status.charAt(0).toUpperCase() +
                                tenant.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 text-foreground-muted text-xs tabular-nums">
                            {formatDate(tenant.created_at, "short")}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <ActionMenu
                              items={[
                                {
                                  label: "View details",
                                  icon: <Eye size={12} />,
                                  href: `/platform/tenants/${tenant.id}`,
                                },
                                {
                                  label: "Edit tenant",
                                  icon: <Edit size={12} />,
                                  onClick: () => setEditTarget(tenant),
                                },
                                { divider: true, label: "" },
                                {
                                  label: "Delete",
                                  icon: <Trash2 size={12} />,
                                  danger: true,
                                  onClick: () => setDeleteTarget(tenant),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="px-3.5 py-2.5 border-t border-hairline flex items-center text-xs text-foreground-muted">
                  <span>Showing 1–{filteredTenants.length} of {tenants.length}</span>
                  <div className="flex-1" />
                  <Button size="sm" icon={<ChevronLeft size={12} />}>Prev</Button>
                  <Button size="sm" iconRight={<ChevronRight size={12} />} className="ml-1">Next</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Tenant Modal ── */}
      <CreateTenantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        currencies={currencies}
      />

      {/* ── Edit Tenant Modal ── */}
      {editTarget && (
        <EditTenantModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          tenant={editTarget}
          currencies={currencies}
        />
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        title="Delete tenant"
        description={`Soft-delete "${deleteTarget?.name}" (${deleteTarget?.code})? The tenant code can be reused after deletion. All data within this tenant will be inaccessible.`}
        confirmLabel="Delete Tenant"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Create Tenant Modal
// Fields: name, code, status, base_currency, timezone, plan
// ═══════════════════════════════════════════════════════════

function CreateTenantModal({
  open,
  onClose,
  currencies,
}: {
  open: boolean;
  onClose: () => void;
  currencies: Currency[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    status: "active",
    base_currency_id: "",
    timezone: "Asia/Kolkata",
    plan: "pro",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedCurrencies = React.useMemo(
    () => [...currencies].sort((a, b) => a.code.localeCompare(b.code)),
    [currencies]
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Tenant name is required";
    if (!form.code.trim()) errs.code = "Tenant code is required";
    if (!/^[a-z0-9_-]+$/.test(form.code))
      errs.code = "Code must be lowercase alphanumeric with hyphens/underscores";
    if (!form.base_currency_id) errs.base_currency_id = "Base currency is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await tenantService.create({
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        status: form.status,
        base_currency_id: form.base_currency_id,
        timezone: form.timezone,
        plan: form.plan,
      });

      toast.success("Tenant provisioned successfully", `Code: ${form.code}`);
      queryClient.invalidateQueries({ queryKey: ["platformTenants"] });
      onClose();
      setForm({ name: "", code: "", status: "active", base_currency_id: "", timezone: "Asia/Kolkata", plan: "pro" });
      setErrors({});
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.message.includes("unique") || err.message.includes("duplicate")) {
          setErrors({ code: "This tenant code is already in use" });
        } else if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Failed to create tenant");
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  };

  // Auto-generate code from name
  const handleNameChange = (value: string) => {
    updateField("name", value);
    if (!form.code || form.code === slugify(form.name)) {
      updateField("code", slugify(value));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Provision New Tenant"
      description="Create a new client workspace. They'll be able to register users and start managing inventory immediately."
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Tenant Name"
              placeholder="Acme Hardware Co."
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              error={errors.name}
            />
          </div>
          <div>
            <Input
              label="Tenant Code"
              placeholder="acme-hardware"
              hint="Unique identifier — used in URLs and API headers"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              error={errors.code}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Base Currency" required error={errors.base_currency_id}>
            <select
              className={cn(
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded",
                "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
                errors.base_currency_id ? "border-status-red" : "border-hairline"
              )}
              value={form.base_currency_id}
              onChange={(e) => updateField("base_currency_id", e.target.value)}
            >
              <option value="">Select currency…</option>
              {sortedCurrencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                  {c.symbol ? ` (${c.symbol})` : ""}
                </option>
              ))}
            </select>
            {currencies.length === 0 && (
              <p className="text-[11px] text-status-amber-text mt-1">
                No currencies loaded. Check that migrations have been applied.
              </p>
            )}
          </FormField>

          <FormField label="Timezone">
            <select
              className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Plan">
            <select
              className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.plan}
              onChange={(e) => updateField("plan", e.target.value)}
            >
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </FormField>

          <FormField label="Initial Status">
            <select
              className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>
        </div>

        {/* Summary preview */}
        {form.name && form.code && (
          <div className="bg-surface rounded-md p-3 border border-hairline-light animate-fade-in">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-2">
              Preview
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-light flex items-center justify-center text-xs font-bold text-brand">
                {getInitials(form.name)}
              </div>
              <div>
                <div className="text-sm font-semibold">{form.name}</div>
                <div className="text-[10.5px] text-foreground-muted font-mono">
                  {form.code}.raniacone.app
                </div>
              </div>
              <div className="ml-auto flex gap-1.5">
                <Badge
                  tone={form.status === "active" ? "green" : form.status === "trialing" ? "blue" : "red"}
                  dot
                >
                  {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                </Badge>
                <Badge tone="neutral">{form.plan}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            kind="primary"
            loading={loading}
            icon={<Plus size={13} />}
          >
            Provision Tenant
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// Edit Tenant Modal
// ═══════════════════════════════════════════════════════════

function EditTenantModal({
  open,
  onClose,
  tenant,
  currencies,
}: {
  open: boolean;
  onClose: () => void;
  tenant: Tenant;
  currencies: Currency[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: tenant.name,
    status: tenant.status,
    timezone: tenant.timezone,
    plan: tenant.plan || "",
    base_currency_id: tenant.base_currency_id || "",
  });

  const sortedCurrencies = React.useMemo(
    () => [...currencies].sort((a, b) => a.code.localeCompare(b.code)),
    [currencies]
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    else if (form.name.trim().length > 255) errs.name = "Max 255 characters";
    if (!form.base_currency_id) errs.base_currency_id = "Base currency is required";
    if (!form.timezone.trim()) errs.timezone = "Timezone is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await tenantService.update(tenant.id, {
        name: form.name.trim(),
        status: form.status,
        timezone: form.timezone,
        plan: form.plan,
        base_currency_id: form.base_currency_id,
      });
      toast.success("Tenant updated");
      queryClient.invalidateQueries({ queryKey: ["platformTenants"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("Failed to update tenant");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Edit: ${tenant.name}`} width="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Tenant Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
          maxLength={255}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status" required>
            <select
              className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Tenant["status"] })}
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="suspended">Suspended</option>
            </select>
          </FormField>
          <FormField label="Plan">
            <select
              className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
            >
              <option value="">— None —</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Base Currency" required error={errors.base_currency_id}>
            <select
              className={cn(
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded",
                "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
                errors.base_currency_id ? "border-status-red" : "border-hairline"
              )}
              value={form.base_currency_id}
              onChange={(e) => {
                setForm({ ...form, base_currency_id: e.target.value });
                if (errors.base_currency_id) setErrors({ ...errors, base_currency_id: "" });
              }}
            >
              <option value="">Select currency…</option>
              {sortedCurrencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}{c.symbol ? ` (${c.symbol})` : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Timezone" required error={errors.timezone}>
            <select
              className={cn(
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded",
                "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
                errors.timezone ? "border-status-red" : "border-hairline"
              )}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="text-[11px] text-foreground-muted bg-surface rounded-md px-3 py-2">
          Tenant code <span className="font-mono font-medium">{tenant.code}</span> cannot be changed after creation.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Save Changes</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];
