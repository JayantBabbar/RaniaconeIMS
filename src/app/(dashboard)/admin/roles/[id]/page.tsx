"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { HelpHint } from "@/components/ui/help-hint";
import { PageLoading, Spinner } from "@/components/ui/shared";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { roleService, permissionService } from "@/services/rbac.service";
import { isApiError } from "@/lib/api-client";
import { cn, capitalize } from "@/lib/utils";
import type { Permission } from "@/types";
import { ArrowLeft, Shield, Check, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Role Detail — Permission grid grouped by module
// ═══════════════════════════════════════════════════════════

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canRead = can("auth.roles.read");
  const canWrite = can("auth.roles.write");

  // Fetch role
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["role", id],
    queryFn: () => roleService.getById(id),
    enabled: !!id && canRead,
  });

  // Fetch all permissions
  const { data: allPermissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionService.list(),
  });

  // Fetch role's granted permissions
  const { data: rolePermissions } = useQuery({
    queryKey: ["rolePermissions", id],
    queryFn: () => roleService.listPermissions(id),
    enabled: !!id,
  });

  // Grant permission
  const grantMutation = useMutation({
    mutationFn: (permId: string) => roleService.grantPermission(id, permId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rolePermissions", id] });
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to grant permission");
    },
  });

  // Revoke permission
  const revokeMutation = useMutation({
    mutationFn: (permId: string) => roleService.revokePermission(id, permId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rolePermissions", id] });
    },
    onError: (err) => {
      toast.error(
        isApiError(err) ? err.message : "Failed to revoke permission"
      );
    },
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Admin", "Roles"]} missingPerm="auth.roles.read" />;
  }
  if (roleLoading) return <PageLoading />;
  if (!role) return <PageLoading />;

  // Group permissions by module
  const grantedPermIds = new Set(
    (rolePermissions || []).map((rp) => rp.permission_id)
  );

  const permsByModule = (allPermissions || []).reduce(
    (acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const modules = Object.keys(permsByModule).sort();
  const totalGranted = grantedPermIds.size;
  const totalPerms = allPermissions?.length || 0;

  const togglePermission = (permId: string) => {
    if (!canWrite) return;
    if (grantedPermIds.has(permId)) {
      revokeMutation.mutate(permId);
    } else {
      grantMutation.mutate(permId);
    }
  };

  const grantAllInModule = (module: string) => {
    if (!canWrite) return;
    const perms = permsByModule[module] || [];
    perms.forEach((p) => {
      if (!grantedPermIds.has(p.id)) {
        grantMutation.mutate(p.id);
      }
    });
  };

  const revokeAllInModule = (module: string) => {
    if (!canWrite) return;
    const perms = permsByModule[module] || [];
    perms.forEach((p) => {
      if (grantedPermIds.has(p.id)) {
        revokeMutation.mutate(p.id);
      }
    });
  };

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Admin", "Roles", role.name]}
      />

      <div className="p-5 space-y-5">
        {/* Back + header */}
        <button
          onClick={() => router.push("/admin/roles")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to roles
        </button>

        <PageHeader
          title={role.name}
          description="Tick the permissions this role grants. Every user assigned this role gets every ticked permission. Changes save automatically — no need to press 'Save'."
          learnMore="Permissions are grouped by the feature they unlock. For most teams, granting all .read permissions in a group and only some .write permissions gives a sensible 'safe by default' setup. When in doubt, start narrow — you can always grant more later."
          badge={
            <div className="flex items-center gap-2">
              {role.is_system && <Badge tone="amber">System</Badge>}
              <Badge tone="blue">
                {totalGranted} / {totalPerms} permissions
              </Badge>
            </div>
          }
        />

        <div className="text-[11.5px] text-foreground-muted font-mono">
          Role code: {role.code}
        </div>

        {!canWrite && (
          <div
            role="status"
            className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-[12.5px] text-amber-900 max-w-2xl"
          >
            <Lock size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              Read-only — your role doesn&apos;t include <code className="font-mono font-semibold">auth.roles.write</code>. Ask an admin to grant permission changes.
            </span>
          </div>
        )}

        {/* Permission grid */}
        <div className="space-y-4">
          {modules.map((module) => {
            const perms = permsByModule[module];
            const grantedCount = perms.filter((p) =>
              grantedPermIds.has(p.id)
            ).length;
            const allGranted = grantedCount === perms.length;

            return (
              <div
                key={module}
                className="bg-white border border-hairline rounded-md overflow-hidden"
              >
                {/* Module header */}
                <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {formatModuleName(module)}
                    </h3>
                    <HelpHint size={11}>
                      {MODULE_DESCRIPTIONS[module] ||
                        `Permissions that unlock ${formatModuleName(module)} features.`}
                    </HelpHint>
                    <span className="text-[10.5px] text-foreground-muted">
                      {grantedCount}/{perms.length}
                    </span>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() =>
                        allGranted
                          ? revokeAllInModule(module)
                          : grantAllInModule(module)
                      }
                      className="text-xs text-brand font-medium hover:underline"
                    >
                      {allGranted ? "Revoke all" : "Grant all"}
                    </button>
                  )}
                </div>

                {/* Permission checkboxes */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-0">
                  {perms.map((perm) => {
                    const isGranted = grantedPermIds.has(perm.id);
                    const isLoading =
                      (grantMutation.isPending &&
                        grantMutation.variables === perm.id) ||
                      (revokeMutation.isPending &&
                        revokeMutation.variables === perm.id);

                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        disabled={isLoading || !canWrite}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-left border-b border-r border-hairline-light",
                          "transition-colors",
                          canWrite ? "hover:bg-surface/50" : "cursor-default",
                          isGranted && "bg-brand-light/30"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors flex-shrink-0",
                            isGranted
                              ? "bg-brand border-brand"
                              : "border-foreground-faint"
                          )}
                        >
                          {isGranted && (
                            <Check size={11} className="text-white" />
                          )}
                          {isLoading && (
                            <Spinner size={10} className="text-white" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{perm.name}</div>
                          <div className="text-[10.5px] text-foreground-muted font-mono">
                            {perm.code}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatModuleName(module: string): string {
  return module.split("_").map(capitalize).join(" ");
}

// ── Module-level descriptions shown as a (?) next to each group ──

const MODULE_DESCRIPTIONS: Record<string, string> = {
  auth: "Who-can-do-what: managing users, roles, permissions, and currencies. Only trust Admin-type roles with the .write entries here.",
  inventory: "The core inventory module: items, parties, stock movements, documents, counts. Day-to-day operations live here.",
  erp: "ERP module — general ledger, receivables, payables. (Feature coming soon.)",
  rag: "Document search / knowledge assistant module. (Feature coming soon.)",
  crm: "Customer relationship module. (Feature coming soon.)",
};
