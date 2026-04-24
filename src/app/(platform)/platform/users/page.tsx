"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Avatar,
  EmptyState,
  Spinner,
  KPICard,
} from "@/components/ui/shared";
import { Input } from "@/components/ui/form-elements";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { userService } from "@/services/rbac.service";
import { authService } from "@/services/auth.service";
import { tenantService } from "@/services/platform.service";
import { api, isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import type { User, Tenant } from "@/types";
import {
  Shield,
  UserPlus,
  Users as UsersIcon,
  Building2,
  Trash2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// S-11: Platform User Management
// Cross-tenant directory of users, including Service Provider
// super-admins. Super admin can invite a first-admin to any tenant.
// ═══════════════════════════════════════════════════════════

interface DirectoryRow extends User {
  _tenant?: Tenant;
}

export default function PlatformUsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryRow | null>(null);

  // All tenants for scoping
  const { data: tenantsRaw } = useQuery({
    queryKey: ["platformTenants"],
    queryFn: () => tenantService.list({ limit: 200 }),
  });
  const tenants = tenantsRaw ?? [];

  // Fetch users for each tenant in parallel (super-admins appear in any of
  // them — we deduplicate by user id below).
  const tenantUserQueries = useQuery({
    queryKey: ["platformUserDirectory", tenants.map((t) => t.id).join(",")],
    enabled: tenants.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        tenants.map(async (t) => {
          try {
            const res = await userService.listByTenant(t.id, { limit: 200 });
            return res.map<DirectoryRow>((u) => ({ ...u, _tenant: t }));
          } catch {
            return [] as DirectoryRow[];
          }
        }),
      );
      const flat = results.flat();
      const byId = new Map<string, DirectoryRow>();
      for (const u of flat) {
        const existing = byId.get(u.id);
        if (!existing) byId.set(u.id, u);
        else if (!existing.is_super_admin && u.is_super_admin) byId.set(u.id, u);
      }
      return Array.from(byId.values());
    },
  });

  const users = tenantUserQueries.data || [];
  const loading = tenantUserQueries.isLoading;

  const columns: ColumnDef<DirectoryRow>[] = [
    { key: "full_name", label: "User", sortable: true, filterType: "text" },
    { key: "email", label: "Email", sortable: true, filterType: "text" },
    {
      key: "_tenant",
      label: "Tenant",
      sortable: true,
      filterType: "select",
      getValue: (r) => r._tenant?.name || "",
      options: tenants.map((t) => ({ value: t.name, label: `${t.name} (${t.code})` })),
    },
    { key: "is_super_admin", label: "Super admin", filterType: "boolean" },
    { key: "is_active", label: "Active", filterType: "boolean" },
  ];

  const {
    rows: filtered,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  } = useTableFilters({ data: users, columns });

  const counts = {
    all: users.length,
    super: users.filter((u) => u.is_super_admin).length,
    tenant: users.filter((u) => !u.is_super_admin).length,
    active: users.filter((u) => u.is_active).length,
  };

  const deleteMutation = useMutation({
    mutationFn: (u: DirectoryRow) => {
      const headers = u._tenant ? { "X-Tenant-Id": u._tenant.id } : undefined;
      return api.getInstance().delete(`/users/${u.id}`, { headers });
    },
    onSuccess: () => {
      toast.success("User removed");
      queryClient.invalidateQueries({ queryKey: ["platformUserDirectory"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to remove user");
    },
  });

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Platform", "Users"]}
        right={
          <Button
            kind="primary"
            icon={<UserPlus size={13} />}
            onClick={() => setShowInvite(true)}
          >
            Register Platform User
          </Button>
        }
      />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Platform Users</h1>
          <Badge tone="neutral">{filtered.length} shown</Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KPICard
            label="Total Users"
            value={String(counts.all)}
            subtitle="Across all tenants"
            icon={<UsersIcon size={15} />}
          />
          <KPICard
            label="Super Admins"
            value={String(counts.super)}
            subtitle="Service-provider tier"
            icon={<Shield size={15} />}
          />
          <KPICard
            label="Tenant Users"
            value={String(counts.tenant)}
            subtitle="Within client workspaces"
            icon={<Building2 size={15} />}
          />
          <KPICard
            label="Active"
            value={String(counts.active)}
            subtitle="Enabled accounts"
          />
        </div>

        {/* Filter strip */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by name, email, or tenant…"
          />
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <span className="text-[11px] text-foreground-muted">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
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
          {loading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={22} />}
              title={activeFilterCount > 0 ? "No users match those filters" : "No platform users found"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : "Register a service-provider admin or invite a first-admin to any tenant."
              }
              action={
                activeFilterCount === 0 ? (
                  <Button
                    kind="primary"
                    icon={<UserPlus size={13} />}
                    onClick={() => setShowInvite(true)}
                  >
                    Register Platform User
                  </Button>
                ) : (
                  <Button onClick={clearAll}>Clear all filters</Button>
                )
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>User</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Email</SortHeader>
                      <ColumnFilter col={columns[1]} value={columnFilters[columns[1].key]} onChange={(v) => setColumnFilter(columns[1].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Tenant</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>Role Tier</span>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>Status</span>
                      <ColumnFilter col={columns[4]} value={columnFilters[columns[4].key]} onChange={(v) => setColumnFilter(columns[4].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">Created</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={u.full_name || u.email}
                          size={26}
                        />
                        <span className="font-medium">
                          {u.full_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-foreground-secondary">
                      {u.email}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {u._tenant ? (
                        <Link
                          href={`/platform/tenants/${u._tenant.id}`}
                          className="flex items-center gap-1.5 text-xs hover:text-brand transition-colors"
                        >
                          <Building2 size={11} className="text-foreground-muted" />
                          <span className="font-medium">{u._tenant.name}</span>
                          <span className="font-mono text-foreground-muted">
                            {u._tenant.code}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {u.is_super_admin ? (
                        <Badge tone="blue">Super Admin</Badge>
                      ) : (
                        <Badge tone="neutral">Tenant</Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <StatusBadge status={u.is_active ? "active" : "disabled"} />
                    </td>
                    <td className="px-3.5 py-2.5 text-foreground-muted text-xs tabular-nums">
                      {formatDate(u.created_at, "short")}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <ActionMenu
                        items={[
                          ...(u._tenant
                            ? [
                                {
                                  label: "Open tenant",
                                  icon: <Building2 size={12} />,
                                  href: `/platform/tenants/${u._tenant.id}`,
                                },
                                { divider: true, label: "" },
                              ]
                            : []),
                          {
                            label: "Remove",
                            icon: <Trash2 size={12} />,
                            danger: true,
                            onClick: () => setDeleteTarget(u),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InviteUserModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        tenants={tenants}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Remove user"
        description={`Remove ${deleteTarget?.full_name || deleteTarget?.email}${
          deleteTarget?._tenant ? ` from tenant "${deleteTarget._tenant.name}"` : ""
        }? They will lose access immediately.`}
        confirmLabel="Remove"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Invite modal — register user against a chosen tenant ───

function InviteUserModal({
  open,
  onClose,
  tenants,
}: {
  open: boolean;
  onClose: () => void;
  tenants: Tenant[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    tenant_id: "",
    mode: "tenant" as "tenant" | "super",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => a.name.localeCompare(b.name)),
    [tenants],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.full_name.trim()) errs.full_name = "Name is required";
    if (!form.password || form.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    if (form.mode === "tenant" && !form.tenant_id) {
      errs.tenant_id = "Choose a tenant for the new user";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      if (form.mode === "super") {
        // Service-provider super admin — created without a tenant header
        await authService.register({
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          password: form.password,
        });
      } else {
        await api.post(
          "/auth/register",
          {
            email: form.email.trim(),
            full_name: form.full_name.trim(),
            password: form.password,
          },
          { "X-Tenant-Id": form.tenant_id },
        );
      }

      toast.success(
        "User registered",
        form.mode === "super"
          ? "Service-provider super admin account created"
          : "Tenant admin account created",
      );
      queryClient.invalidateQueries({ queryKey: ["platformUserDirectory"] });
      queryClient.invalidateQueries({ queryKey: ["tenantUsers"] });
      setForm({
        email: "",
        full_name: "",
        password: "",
        tenant_id: "",
        mode: "tenant",
      });
      onClose();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to register user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Register Platform User"
      description="Invite a user either as a Service Provider super admin or as the first admin of a specific tenant workspace."
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, mode: "super" })}
            className={
              form.mode === "super"
                ? "border border-brand bg-brand/5 text-brand rounded-md p-3 text-left"
                : "border border-hairline rounded-md p-3 text-left hover:bg-surface transition-colors"
            }
          >
            <div className="flex items-center gap-2">
              <Shield size={14} />
              <span className="text-sm font-semibold">Super Admin</span>
            </div>
            <p className="text-[11px] text-foreground-muted mt-1">
              Platform operator with access across tenants
            </p>
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, mode: "tenant" })}
            className={
              form.mode === "tenant"
                ? "border border-brand bg-brand/5 text-brand rounded-md p-3 text-left"
                : "border border-hairline rounded-md p-3 text-left hover:bg-surface transition-colors"
            }
          >
            <div className="flex items-center gap-2">
              <Building2 size={14} />
              <span className="text-sm font-semibold">Tenant Admin</span>
            </div>
            <p className="text-[11px] text-foreground-muted mt-1">
              First admin for a specific client workspace
            </p>
          </button>
        </div>

        {form.mode === "tenant" && (
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground-secondary">
              Tenant <span className="text-status-red">*</span>
            </label>
            <select
              className={
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 " +
                (errors.tenant_id ? "border-status-red" : "border-hairline")
              }
              value={form.tenant_id}
              onChange={(e) => {
                setForm({ ...form, tenant_id: e.target.value });
                setErrors((err) => ({ ...err, tenant_id: "" }));
              }}
            >
              <option value="">Select tenant…</option>
              {sortedTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            {errors.tenant_id && (
              <p className="text-[11px] text-status-red-text mt-1">
                {errors.tenant_id}
              </p>
            )}
          </div>
        )}

        <Input
          label="Full Name"
          placeholder="Elena Ortega"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          error={errors.full_name}
        />
        <Input
          label="Email"
          type="email"
          placeholder="elena@acme.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Minimum 8 characters"
          hint="The user should change this after first login"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            kind="primary"
            loading={loading}
            icon={<UserPlus size={13} />}
          >
            Register
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
