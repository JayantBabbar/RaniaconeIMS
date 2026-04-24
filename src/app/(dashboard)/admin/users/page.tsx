"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar, EmptyState, Spinner } from "@/components/ui/shared";
import { Input } from "@/components/ui/form-elements";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
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
import { userService, roleService } from "@/services/rbac.service";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { isApiError } from "@/lib/api-client";
import type { User, Role } from "@/types";
import {
  Shield,
  UserPlus,
  Eye,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/users — Users & Roles management for the Client Admin
// ═══════════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  "#6366f1", "#14b8a6", "#f59e0b", "#ec4899",
  "#8b5cf6", "#0ea5e9", "#dc2626", "#16a34a",
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("auth.users.write");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => userService.list({ limit: 200 }),
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.delete(id),
    onSuccess: () => {
      toast.success("User removed");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to remove user");
    },
  });

  const users = usersData ?? [];

  // ── Column config drives search / sort / filter ─────────────
  const columns: ColumnDef<User>[] = [
    {
      key: "full_name",
      label: "User",
      sortable: true,
      filterType: "text",
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      filterType: "text",
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      filterType: "select",
      getValue: (u) => (u.is_active ? "Active" : "Disabled"),
      options: [
        { value: "Active", label: "Active" },
        { value: "Disabled", label: "Disabled" },
      ],
    },
    {
      key: "is_super_admin",
      label: "Super",
      filterType: "boolean",
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
  } = useTableFilters({ data: users, columns });

  return (
    <RequireRead perm="auth.users.read" crumbs={["Admin", "Users"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Admin", "Users"]}
        right={
          <>
            <Link href="/admin/roles">
              <Button icon={<Shield size={13} />}>Manage Roles</Button>
            </Link>
            <Can perm="auth.users.write">
              <Button
                kind="primary"
                icon={<UserPlus size={13} />}
                onClick={() => setShowInviteModal(true)}
              >
                Invite User
              </Button>
            </Can>
          </>
        }
      />

      <div className="p-5 space-y-4">
        <PageHeader
          title="Users"
          description="People who can sign in to this workspace. Inviting someone creates their account and sets their initial password; you can then assign them roles to control what they can do."
          learnMore="Every user has exactly one email, and that email belongs to only one workspace. Users can't self-register — you invite them from here. Each user can be assigned one or more roles; a role is a named bundle of permissions."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== users.length ? ` / ${users.length}` : ""} total
            </Badge>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search users by name or email…"
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

        {/* Table */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={22} />}
              title={activeFilterCount > 0 ? "No users match those filters" : "No users found"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Invite your first teammate to get started."
                    : "Only admins with user management permission can invite new teammates."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button
                    kind="primary"
                    icon={<UserPlus size={13} />}
                    onClick={() => setShowInviteModal(true)}
                  >
                    Invite User
                  </Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>
                        {columns[0].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[0]}
                        value={columnFilters[columns[0].key]}
                        onChange={(v) => setColumnFilter(columns[0].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>
                        {columns[1].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[1]}
                        value={columnFilters[columns[1].key]}
                        onChange={(v) => setColumnFilter(columns[1].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-left px-3.5 py-2.5">Roles</th>
                  <th className="text-center px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort} align="center">
                        {columns[2].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[2]}
                        value={columnFilters[columns[2].key]}
                        onChange={(v) => setColumnFilter(columns[2].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-center px-3.5 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <span>{columns[3].label}</span>
                      <ColumnFilter
                        col={columns[3]}
                        value={columnFilters[columns[3].key]}
                        onChange={(v) => setColumnFilter(columns[3].key, v)}
                      />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5">
                      <Link href={`/admin/users/${user.id}`} className="flex items-center gap-2.5">
                        <Avatar
                          name={user.full_name || user.email}
                          color={getAvatarColor(user.full_name || user.email)}
                          size={28}
                        />
                        <span className="font-medium hover:text-brand transition-colors">
                          {user.full_name || "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5 text-foreground-secondary">
                      {user.email}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <UserRoleBadges userId={user.id} roles={roles || []} />
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <StatusBadge status={user.is_active ? "active" : "disabled"} />
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      {user.is_super_admin && <Badge tone="blue">Super</Badge>}
                    </td>
                    {canWrite && (
                      <td className="px-3.5 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "View details",
                              icon: <Eye size={12} />,
                              href: `/admin/users/${user.id}`,
                            },
                            { divider: true, label: "" },
                            {
                              label: "Remove user",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(user),
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

      <InviteUserModal open={showInviteModal} onClose={() => setShowInviteModal(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Remove this user?"
        description={
          deleteTarget
            ? `${deleteTarget.full_name || deleteTarget.email} will lose access to this workspace immediately. This cannot be undone — you'd have to invite them again to restore access.`
            : ""
        }
        confirmLabel="Remove user"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </RequireRead>
  );
}

// ── User role badges (one fetch per user — reuses react-query cache) ──

function UserRoleBadges({ userId, roles }: { userId: string; roles: Role[] }) {
  const { data: userRoles } = useQuery({
    queryKey: ["userRoles", userId],
    queryFn: () => userService.listRoles(userId),
    staleTime: 60 * 1000,
  });

  if (!userRoles || userRoles.length === 0) {
    return <span className="text-xs text-foreground-muted">No roles assigned</span>;
  }

  const roleMap = new Map(roles.map((r) => [r.id, r]));
  return (
    <div className="flex flex-wrap gap-1">
      {userRoles.map((ur) => {
        const role = roleMap.get(ur.role_id);
        return (
          <Badge key={ur.id} tone="blue">
            {role?.name || "Unknown"}
          </Badge>
        );
      })}
    </div>
  );
}

// ── Invite modal — admin-invite flow (creates user under current tenant) ──

const inviteSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(255, "Max 255 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

function InviteUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();
  const brand = useBranding();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: InviteFormValues) => {
    if (!tenantId) {
      setServerError(
        "We couldn't find your workspace. Sign out and back in, then try again.",
      );
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await authService.register({
        email: data.email.trim().toLowerCase(),
        full_name: data.full_name.trim(),
        password: data.password,
        tenant_id: tenantId,
      });
      toast.success(
        "User invited",
        `${data.email} can now sign in. Share their password securely and ask them to change it.`,
      );
      queryClient.invalidateQueries({ queryKey: ["users"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        // Map server field errors onto form fields.
        if (err.code === "EMAIL_EXISTS") {
          setError("email", {
            message: "This email is already registered to another workspace.",
          });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          for (const [field, msg] of Object.entries(err.fieldErrors)) {
            setError(field as keyof InviteFormValues, { message: msg });
          }
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite a user"
      description={`Create an account for a teammate so they can sign in to your workspace. They'll use the email and password you set here — you can assign their roles right after.`}
      width="md"
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
          label="Full name"
          placeholder="e.g. Priya Mehta"
          required
          autoComplete="name"
          error={errors.full_name?.message}
          disabled={submitting}
          {...register("full_name")}
        />

        <Input
          label="Work email"
          type="email"
          placeholder="priya@company.com"
          required
          autoComplete="email"
          help="Each email belongs to one workspace only. If this person already has an account in another workspace, they'll need a different email."
          error={errors.email?.message}
          disabled={submitting}
          {...register("email")}
        />

        <Input
          label="Initial password"
          type="password"
          placeholder="Minimum 8 characters"
          required
          autoComplete="new-password"
          hint="Share this securely (e.g. password manager). Ask them to change it after first sign-in."
          help="The user can change this themselves under Account → Change password once they're signed in."
          error={errors.password?.message}
          disabled={submitting}
          {...register("password")}
        />

        <div className="bg-surface rounded-md px-3 py-2 text-[11.5px] text-foreground-secondary leading-relaxed">
          <strong className="text-foreground">Next step:</strong> After the
          user is created, open their profile and assign one or more roles.
          Without a role they can sign in but won&apos;t see any data.
          <br />
          <span className="text-foreground-muted">
            Having trouble? Contact <a href={`mailto:${brand.supportEmail}`} className="text-brand font-medium hover:underline">{brand.supportEmail}</a>.
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting} icon={<UserPlus size={13} />}>
            Create user
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
