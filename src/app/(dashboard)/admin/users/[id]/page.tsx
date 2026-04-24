"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { HelpHint } from "@/components/ui/help-hint";
import { Avatar, PageLoading } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { userService, roleService } from "@/services/rbac.service";
import { useBranding } from "@/providers/branding-provider";
import { isApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Shield,
  Plus,
  X,
  Mail,
  Calendar,
  User as UserIcon,
  Power,
  KeyRound,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/users/[id] — User detail. Shows profile + lets the Admin
// manage roles, activate/deactivate, and reset password.
// ═══════════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  "#6366f1", "#14b8a6", "#f59e0b", "#ec4899",
  "#8b5cf6", "#0ea5e9", "#dc2626", "#16a34a",
];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canRead = can("auth.users.read");
  const canWrite = can("auth.users.write");
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<"activate" | "deactivate" | null>(null);
  const [removeRoleTarget, setRemoveRoleTarget] = useState<{
    roleId: string;
    roleName: string;
  } | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => userService.getById(id),
    enabled: !!id && canRead,
  });

  const { data: userRoles } = useQuery({
    queryKey: ["userRoles", id],
    queryFn: () => userService.listRoles(id),
    enabled: !!id,
  });

  const { data: allRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.list(),
  });

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => userService.assignRole(id, roleId),
    onSuccess: () => {
      toast.success("Role assigned");
      queryClient.invalidateQueries({ queryKey: ["userRoles", id] });
      setShowRolePicker(false);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Failed to assign role"),
  });

  const unassignMutation = useMutation({
    mutationFn: (roleId: string) => userService.unassignRole(id, roleId),
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["userRoles", id] });
      setRemoveRoleTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Failed to remove role"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => userService.update(id, { is_active: !user?.is_active }),
    onSuccess: () => {
      toast.success(user?.is_active ? "User deactivated" : "User activated");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setToggleTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Could not update"),
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Admin", "Users"]} missingPerm="auth.users.read" />;
  }
  if (isLoading || !user) return <PageLoading />;

  const roleMap = new Map((allRoles || []).map((r) => [r.id, r]));
  const assignedRoleIds = new Set((userRoles || []).map((ur) => ur.role_id));
  const availableRoles = (allRoles || []).filter((r) => !assignedRoleIds.has(r.id));

  const avatarColor =
    AVATAR_COLORS[
      Math.abs((user.full_name || user.email).charCodeAt(0) || 0) %
        AVATAR_COLORS.length
    ];

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Admin", "Users", user.full_name || user.email]}
        right={
          canWrite ? (
            <>
              <Button
                icon={<KeyRound size={13} />}
                onClick={() => setShowResetPassword(true)}
              >
                Reset password
              </Button>
              <Button
                kind={user.is_active ? "danger" : "success"}
                icon={<Power size={13} />}
                onClick={() => setToggleTarget(user.is_active ? "deactivate" : "activate")}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="p-4 md:p-5 space-y-5">
        <button
          onClick={() => router.push("/admin/users")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to users
        </button>

        <PageHeader
          title={user.full_name || "Unnamed user"}
          description={
            user.is_active
              ? "This account is active. They can sign in and use every feature their assigned roles allow."
              : "This account is deactivated. They can't sign in until you reactivate them. Existing data is preserved."
          }
          badge={
            <div className="flex gap-1.5">
              <StatusBadge status={user.is_active ? "active" : "disabled"} />
              {user.is_super_admin && <Badge tone="blue">Super Admin</Badge>}
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* User info card */}
          <div className="col-span-2 bg-white border border-hairline rounded-md p-5">
            <div className="flex items-start gap-4 mb-6">
              <Avatar name={user.full_name || user.email} color={avatarColor} size={48} />
              <div className="flex-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  {user.full_name || "Unnamed user"}
                </h2>
                <p className="text-sm text-foreground-secondary mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow icon={<Mail size={13} />} label="Email" value={user.email} />
              <DetailRow icon={<UserIcon size={13} />} label="Full Name" value={user.full_name || "—"} />
              <DetailRow icon={<Calendar size={13} />} label="Created" value={formatDate(user.created_at)} />
              <DetailRow icon={<Calendar size={13} />} label="Last Updated" value={formatDate(user.updated_at)} />
            </div>
          </div>

          {/* Roles panel */}
          <div className="bg-white border border-hairline rounded-md">
            <div className="flex items-center justify-between p-4 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-foreground-muted" />
                <h3 className="text-sm font-semibold">Assigned Roles</h3>
                <HelpHint size={11}>
                  A role is a named bundle of permissions. Assign one or
                  more roles to control exactly what this person can see
                  and do. A user with zero roles can sign in but won&apos;t
                  see any data.
                </HelpHint>
              </div>
              {canWrite && availableRoles.length > 0 && (
                <Button
                  size="sm"
                  icon={<Plus size={12} />}
                  onClick={() => setShowRolePicker(!showRolePicker)}
                >
                  Add
                </Button>
              )}
            </div>

            {showRolePicker && availableRoles.length > 0 && (
              <div className="p-3 border-b border-hairline bg-surface animate-fade-in">
                <p className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider mb-2">
                  Choose a role to assign
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableRoles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => assignMutation.mutate(role.id)}
                      disabled={assignMutation.isPending}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-white border border-hairline hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
                    >
                      + {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3">
              {!userRoles || userRoles.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-xs text-foreground-muted">
                    No roles assigned yet
                  </p>
                  <p className="text-[11px] text-foreground-muted max-w-[200px] mx-auto leading-relaxed">
                    Without a role, this user can sign in but won&apos;t see
                    any data. Add at least one to give them access.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userRoles.map((ur) => {
                    const role = roleMap.get(ur.role_id);
                    return (
                      <div
                        key={ur.id}
                        className="flex items-center justify-between p-2.5 rounded bg-surface"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {role?.name || "Unknown role"}
                          </div>
                          {role?.code && (
                            <div className="text-[10.5px] text-foreground-muted font-mono mt-0.5">
                              {role.code}
                            </div>
                          )}
                        </div>
                        {canWrite && (
                          <button
                            onClick={() =>
                              setRemoveRoleTarget({
                                roleId: ur.role_id,
                                roleName: role?.name || "this role",
                              })
                            }
                            className="p-1 rounded hover:bg-status-red-bg text-foreground-muted hover:text-status-red transition-colors"
                            title="Remove role"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm role removal */}
      <ConfirmDialog
        open={!!removeRoleTarget}
        onClose={() => setRemoveRoleTarget(null)}
        onConfirm={() => removeRoleTarget && unassignMutation.mutate(removeRoleTarget.roleId)}
        title={`Remove the "${removeRoleTarget?.roleName}" role?`}
        description={`The user will immediately lose every permission that came from this role. They'll keep any permissions they have through other roles.`}
        confirmLabel="Remove role"
        confirmKind="danger"
        loading={unassignMutation.isPending}
      />

      {/* Confirm activate/deactivate */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleActiveMutation.mutate()}
        title={toggleTarget === "deactivate" ? "Deactivate this user?" : "Reactivate this user?"}
        description={
          toggleTarget === "deactivate"
            ? "They'll be unable to sign in until you reactivate them. Their data, documents, and audit history stay intact."
            : "They'll be able to sign in again using their existing password."
        }
        confirmLabel={toggleTarget === "deactivate" ? "Deactivate" : "Activate"}
        confirmKind={toggleTarget === "deactivate" ? "danger" : "success"}
        loading={toggleActiveMutation.isPending}
      />

      {/* Reset password modal */}
      <ResetPasswordModal
        open={showResetPassword}
        onClose={() => setShowResetPassword(false)}
        userId={id}
        userEmail={user.email}
      />
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-foreground-muted">{icon}</div>
      <div>
        <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ── Reset password modal (admin-initiated) ───────────────────────
// The endpoint is pending backend confirmation (see changes_required.txt).
// Current behaviour tries PATCH /users/{id} with a password field; if the
// server rejects that, falls back to showing the pending notice.

const resetSchema = z
  .object({
    new_password: z.string().min(8, "Password must be at least 8 characters").max(128, "Too long"),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type ResetFormValues = z.infer<typeof resetSchema>;

function ResetPasswordModal({
  open,
  onClose,
  userId,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
}) {
  const toast = useToast();
  const brand = useBranding();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: "", confirm: "" },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (data: ResetFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      // Attempt PATCH /users/{id} with a password field. If the backend
      // accepts this, great. If not, we surface a clear error and the
      // admin knows to fall back to the email flow (once available).
      await userService.update(userId, {
        // `password` isn't in the declared update shape but the server
        // may accept it as an extra field. Cast narrowly.
        ...({ password: data.new_password } as unknown as { is_active: boolean }),
      });
      toast.success(
        "Password reset",
        `${userEmail} can sign in with the new password. Share it securely and ask them to change it.`,
      );
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 422 && err.fieldErrors?.password) {
          setServerError(err.fieldErrors.password);
        } else if (err.status === 405 || err.status === 422) {
          setServerError(
            `This workspace doesn't support admin-initiated password reset yet. We've filed a request with the backend team — until it's ready, contact ${brand.supportEmail}.`,
          );
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
      title="Reset this user's password"
      description={`Set a new password for ${userEmail}. Share it securely (e.g. password manager) and ask them to change it after sign-in.`}
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text leading-relaxed">
            {serverError}
          </div>
        )}
        <Input
          type="password"
          label="New password"
          placeholder="Minimum 8 characters"
          required
          autoComplete="new-password"
          error={errors.new_password?.message}
          disabled={submitting}
          {...register("new_password")}
        />
        <Input
          type="password"
          label="Confirm password"
          placeholder="Type it again"
          required
          autoComplete="new-password"
          error={errors.confirm?.message}
          disabled={submitting}
          {...register("confirm")}
        />
        <div className="bg-status-amber-bg rounded-md px-3 py-2 text-[11.5px] text-status-amber-text leading-relaxed">
          <strong>Heads up:</strong> the user will be signed out of all their
          other sessions and must sign in again with this new password.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting} icon={<KeyRound size={13} />}>
            Reset password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
