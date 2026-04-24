"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
import { useToast } from "@/components/ui/toast";
import { tenantService, currencyService } from "@/services/platform.service";
import { userService } from "@/services/rbac.service";
import { authService } from "@/services/auth.service";
import { isApiError } from "@/lib/api-client";
import { formatDate, getInitials } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, Spinner } from "@/components/ui/shared";
import type { Tenant } from "@/types";
import {
  ArrowLeft,
  Calendar,
  Globe,
  DollarSign,
  Layers,
  Clock,
  UserPlus,
  Copy,
  Users as UsersIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Tenant Detail Page
// View tenant info + register first admin user
// ═══════════════════════════════════════════════════════════

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [showRegisterUser, setShowRegisterUser] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["platformTenant", id],
    queryFn: () => tenantService.getById(id),
    enabled: !!id,
  });

  const { data: currenciesRaw } = useQuery({
    queryKey: ["platformCurrencies"],
    queryFn: () => currencyService.list({ limit: 200 }),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["tenantUsers", id],
    queryFn: () => userService.listByTenant(id, { limit: 200 }),
    enabled: !!id,
  });

  const currencies = currenciesRaw ?? [];
  const users = useMemo(() => usersData ?? [], [usersData]);

  if (isLoading || !tenant) return <PageLoading />;

  const currency = currencies.find((c) => c.id === tenant.base_currency_id);

  const copyTenantId = async () => {
    await navigator.clipboard.writeText(tenant.id);
    setCopied(true);
    toast.info("Tenant ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Platform", "Tenants", tenant.name]}
        right={
          <Button
            kind="primary"
            icon={<UserPlus size={13} />}
            onClick={() => setShowRegisterUser(true)}
          >
            Register Admin User
          </Button>
        }
      />

      <div className="p-5 space-y-5">
        <button
          onClick={() => router.push("/platform/tenants")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to tenants
        </button>

        {/* Tenant header card */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-brand-light flex items-center justify-center text-lg font-bold text-brand">
              {getInitials(tenant.name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  {tenant.name}
                </h1>
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
                  {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                </Badge>
                {tenant.plan && (
                  <Badge tone="neutral">{tenant.plan}</Badge>
                )}
              </div>
              <div className="text-sm text-foreground-secondary font-mono mt-0.5">
                {tenant.code}.raniacone.app
              </div>
            </div>
          </div>

          {/* Tenant ID — copyable */}
          <div className="mt-5 bg-surface rounded-md px-3.5 py-2.5 flex items-center gap-3">
            <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
              Tenant ID (X-Tenant-Id)
            </div>
            <code className="text-xs font-mono text-foreground font-medium flex-1">
              {tenant.id}
            </code>
            <button
              onClick={copyTenantId}
              className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
            >
              <Copy size={11} />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-hairline rounded-md p-5 space-y-4">
            <h2 className="text-sm font-semibold">Configuration</h2>
            <DetailRow
              icon={<DollarSign size={13} />}
              label="Base Currency"
              value={
                currency
                  ? `${currency.code} — ${currency.name} (${currency.symbol})`
                  : "Not set"
              }
            />
            <DetailRow
              icon={<Clock size={13} />}
              label="Timezone"
              value={tenant.timezone}
            />
            <DetailRow
              icon={<Layers size={13} />}
              label="Plan"
              value={tenant.plan || "—"}
            />
          </div>

          <div className="bg-white border border-hairline rounded-md p-5 space-y-4">
            <h2 className="text-sm font-semibold">Metadata</h2>
            <DetailRow
              icon={<Calendar size={13} />}
              label="Created"
              value={formatDate(tenant.created_at)}
            />
            <DetailRow
              icon={<Calendar size={13} />}
              label="Updated"
              value={formatDate(tenant.updated_at)}
            />
            <DetailRow
              icon={<Globe size={13} />}
              label="Tenant Code"
              value={tenant.code}
              mono
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
          <div className="flex gap-3">
            <Button
              kind="primary"
              icon={<UserPlus size={13} />}
              onClick={() => setShowRegisterUser(true)}
            >
              {users.length === 0 ? "Register First Admin" : "Register User"}
            </Button>
            <Button
              icon={<Copy size={13} />}
              onClick={copyTenantId}
            >
              Copy Tenant ID
            </Button>
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            After provisioning, register a Client Admin user so they can log in and configure their workspace.
          </p>
        </div>

        {/* Users in this tenant */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-hairline-light">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold">Users</h2>
              <Badge tone="neutral">{users.length}</Badge>
            </div>
            <Button
              kind="primary"
              icon={<UserPlus size={13} />}
              onClick={() => setShowRegisterUser(true)}
            >
              Register User
            </Button>
          </div>

          {usersLoading ? (
            <div className="py-16 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={22} />}
              title="No users yet"
              description={`Register the first admin for "${tenant.name}" so they can log in.`}
              action={
                <Button
                  kind="primary"
                  icon={<UserPlus size={13} />}
                  onClick={() => setShowRegisterUser(true)}
                >
                  Register First Admin
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">User</th>
                  <th className="text-left px-4 py-2.5">Email</th>
                  <th className="text-center px-4 py-2.5">Status</th>
                  <th className="text-center px-4 py-2.5">Admin</th>
                  <th className="text-left px-4 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
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
                    <td className="px-4 py-2.5 text-foreground-secondary">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge
                        status={u.is_active ? "active" : "disabled"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {u.is_super_admin ? (
                        <Badge tone="blue">Super</Badge>
                      ) : (
                        <span className="text-xs text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-foreground-secondary text-xs">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Register Admin User Modal */}
      <RegisterAdminModal
        open={showRegisterUser}
        onClose={() => setShowRegisterUser(false)}
        tenant={tenant}
      />
    </div>
  );
}

// ── Register Admin User Modal ─────────────────────────────

function RegisterAdminModal({
  open,
  onClose,
  tenant,
}: {
  open: boolean;
  onClose: () => void;
  tenant: Tenant;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
  });
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.register({
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        password: form.password,
        tenant_id: tenant.id,
      });

      queryClient.invalidateQueries({ queryKey: ["tenantUsers", tenant.id] });

      setCreated(true);
      toast.success(
        "Admin user registered",
        `${form.email} can now sign in to workspace "${tenant.code}"`,
      );
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to register user");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setForm({ email: "", full_name: "", password: "" });
    setCreated(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Register Admin User"
      description={`Create the first user for "${tenant.name}" (${tenant.code}). This user can then log in and set up the workspace.`}
      width="md"
    >
      {created ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-status-green-bg flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-1">User Created!</h3>
          <p className="text-sm text-foreground-secondary mb-4">
            <strong>{form.full_name}</strong> ({form.email}) can now log in using:
          </p>
          <div className="bg-surface rounded-md p-3 text-left text-xs space-y-1.5">
            <div>
              <span className="text-foreground-muted">Workspace:</span>{" "}
              <span className="font-mono font-medium">{tenant.code}</span>
            </div>
            <div>
              <span className="text-foreground-muted">Email:</span>{" "}
              <span className="font-medium">{form.email}</span>
            </div>
            <div>
              <span className="text-foreground-muted">Password:</span>{" "}
              <span className="font-medium">(as set)</span>
            </div>
          </div>
          <Button className="mt-4" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Full Name"
            placeholder="Elena Ortega"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="elena@acme.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            hint="The user should change this after first login"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <div className="bg-surface rounded-md p-2.5 text-xs text-foreground-secondary">
            This user will be created under tenant{" "}
            <span className="font-mono font-medium text-foreground">{tenant.code}</span>{" "}
            ({tenant.id.slice(0, 8)}…). After creation, assign them a Client Admin role via the workspace admin panel.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={handleClose}>Cancel</Button>
            <Button type="submit" kind="primary" loading={loading} icon={<UserPlus size={13} />}>
              Register User
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

// ── Helpers ────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-foreground-muted">{icon}</div>
      <div>
        <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
          {label}
        </div>
        <div className={`text-sm font-medium mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
