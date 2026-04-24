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
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-elements";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { roleService } from "@/services/rbac.service";
import { isApiError } from "@/lib/api-client";
import type { Role } from "@/types";
import {
  Plus,
  Shield,
  Lock,
  Trash2,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/roles — List roles and create new ones.
// ═══════════════════════════════════════════════════════════════════

export default function RolesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("auth.roles.write");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roleService.delete(id),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(isApiError(err) ? err.message : "Failed to delete role"),
  });

  return (
    <RequireRead perm="auth.roles.read" crumbs={["Admin", "Roles"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Admin", "Roles"]}
        right={
          <Can perm="auth.roles.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              New Role
            </Button>
          </Can>
        }
      />

      <div className="p-5 space-y-4">
        <PageHeader
          title="Roles"
          description="Roles are named bundles of permissions you assign to users. Create roles that match your team's job functions — e.g. 'Warehouse Operator', 'Purchaser', 'Finance Viewer' — then assign them from each user's profile."
          learnMore="Think of a role as a job description. Every permission in the role is a specific action a user can take: 'read items', 'post documents', etc. Users can have multiple roles; their final power is the union of every role's permissions."
          badge={<Badge tone="neutral">{roles?.length ?? 0} total</Badge>}
        />

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Spinner size={24} />
          </div>
        ) : !roles || roles.length === 0 ? (
          <div className="bg-white border border-hairline rounded-md">
            <EmptyState
              icon={<Shield size={22} />}
              title="No roles yet"
              description={
                canWrite
                  ? "Create your first role so you can assign permissions to your users."
                  : "Only admins with role management permission can create roles."
              }
              action={
                canWrite && <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
                  Create role
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} canWrite={canWrite} onDelete={() => setDeleteTarget(role)} />
            ))}
          </div>
        )}
      </div>

      <CreateRoleModal open={showCreate} onClose={() => setShowCreate(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete the "${deleteTarget?.name}" role?`}
        description={`Every user currently assigned this role will lose the permissions it granted. They'll keep any permissions from other roles they have. This cannot be undone.`}
        confirmLabel="Delete role"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </RequireRead>
  );
}

// ── Role card ─────────────────────────────────────────────────────

function RoleCard({ role, onDelete, canWrite }: { role: Role; onDelete: () => void; canWrite: boolean }) {
  const { data: perms } = useQuery({
    queryKey: ["rolePermissions", role.id],
    queryFn: () => roleService.listPermissions(role.id),
    staleTime: 60 * 1000,
  });

  return (
    <div className="bg-white border border-hairline rounded-md p-4 hover:shadow-card transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-brand-light flex items-center justify-center">
            <Shield size={15} className="text-brand" />
          </div>
          <div>
            <Link
              href={`/admin/roles/${role.id}`}
              className="text-sm font-semibold hover:text-brand transition-colors"
            >
              {role.name}
            </Link>
            <div className="text-[10.5px] text-foreground-muted font-mono">
              {role.code}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {role.is_system && <Badge tone="amber">System</Badge>}
          {!role.is_system && canWrite && (
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-status-red-bg text-foreground-muted hover:text-status-red transition-colors"
              title="Delete role"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-foreground-secondary">
        <span className="flex items-center gap-1.5">
          <Lock size={11} className="text-foreground-muted" />
          {perms?.length ?? "—"} permissions
        </span>
      </div>

      <Link
        href={`/admin/roles/${role.id}`}
        className="mt-3 flex items-center justify-between pt-3 border-t border-hairline-light text-xs text-brand font-medium hover:underline"
      >
        Manage permissions
        <ChevronRight size={12} />
      </Link>
    </div>
  );
}

// ── Create role modal ────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Too long"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50, "Too long")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Lowercase letters, numbers, and underscores only (e.g. warehouse_manager)",
    ),
});
type CreateFormValues = z.infer<typeof createSchema>;

function CreateRoleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", code: "" },
  });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  // Auto-suggest code from name (but let user override).
  const nameValue = watch("name");
  const codeValue = watch("code");
  React.useEffect(() => {
    if (!codeValue && nameValue) {
      const suggested = nameValue
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setValue("code", suggested);
    }
  }, [nameValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: CreateFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await roleService.create({ code: data.code, name: data.name });
      toast.success("Role created");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      close();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "ROLE_EXISTS") {
          setServerError("A role with that code already exists. Pick a different code.");
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
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
      title="Create a new role"
      description="Give the role a human-friendly name (what you see in the UI) and a unique code (used internally). You'll pick the specific permissions on the next screen."
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
          label="Role name"
          placeholder="e.g. Warehouse Operator"
          required
          help="Shown in dropdowns and badges across the app. Keep it short and describe a job."
          error={errors.name?.message}
          disabled={submitting}
          {...register("name")}
        />

        <Input
          label="Role code"
          placeholder="warehouse_operator"
          required
          hint="Auto-filled from the name. Edit if you need something specific."
          help="Internal identifier used by the backend. Lowercase letters, numbers, and underscores only. Cannot be changed after creation."
          error={errors.code?.message}
          disabled={submitting}
          {...register("code")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={close}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>
            Create role
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
