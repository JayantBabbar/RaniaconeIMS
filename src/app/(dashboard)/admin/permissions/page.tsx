"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner, Pill } from "@/components/ui/shared";
import { permissionService } from "@/services/rbac.service";
import { PageHeader } from "@/components/ui/page-header";
import { Search, Shield, X, Users as UsersIcon, Lock } from "lucide-react";
import type { Permission } from "@/types";

// ═══════════════════════════════════════════════════════════
// S-38: Permissions Reference
// Read-only catalogue of all seeded permissions grouped by
// resource/module. Used by Client Admins when designing roles.
// ═══════════════════════════════════════════════════════════

const ACTION_TONES: Record<string, "green" | "blue" | "amber" | "red" | "neutral"> = {
  read: "blue",
  list: "blue",
  view: "blue",
  write: "green",
  create: "green",
  update: "amber",
  edit: "amber",
  delete: "red",
  manage: "neutral",
  post: "green",
  cancel: "red",
  apply: "green",
  approve: "green",
  reject: "red",
  admin: "neutral",
};

export default function PermissionsReferencePage() {
  const [search, setSearch] = useState("");
  const [activeModule, setActiveModule] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => permissionService.list(),
    retry: false,
  });

  const permissions = data || [];
  const forbidden =
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: number }).status === 403;

  // Group by resource/module (derived from code prefix, e.g. "items.read")
  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permissions) {
      const moduleKey = (p.module || p.code.split(".")[0] || "other").toLowerCase();
      if (!groups.has(moduleKey)) groups.set(moduleKey, []);
      groups.get(moduleKey)!.push(p);
    }
    // Sort within each group by code
    Array.from(groups.values()).forEach((perms: Permission[]) => {
      perms.sort((a, b) => a.code.localeCompare(b.code));
    });
    return groups;
  }, [permissions]);

  const modules = useMemo(
    () => Array.from(grouped.keys()).sort(),
    [grouped],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterPerms = (perms: Permission[]) =>
      !q
        ? perms
        : perms.filter(
            (p) =>
              p.code.toLowerCase().includes(q) ||
              (p.name || "").toLowerCase().includes(q),
          );

    const result = new Map<string, Permission[]>();
    Array.from(grouped.entries()).forEach(([module, perms]) => {
      if (activeModule !== "all" && activeModule !== module) return;
      const match = filterPerms(perms);
      if (match.length > 0) result.set(module, match);
    });
    return result;
  }, [grouped, search, activeModule]);

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Admin", "Permissions"]}
        right={
          <>
            <Link href="/admin/roles">
              <Button icon={<Shield size={13} />}>Roles</Button>
            </Link>
            <Link href="/admin/users">
              <Button icon={<UsersIcon size={13} />}>Users</Button>
            </Link>
          </>
        }
      />

      <div className="p-5 space-y-4">
        <PageHeader
          title="Permissions reference"
          description="Every permission your workspace can grant, grouped by the feature it unlocks. This page is read-only — you assign permissions to roles from the Roles screen, then assign roles to users."
          learnMore={`Permission codes follow the pattern <module>.<resource>.<action>. For example, "inventory.items.read" lets someone view the item catalog; "inventory.items.write" lets them create and edit items. Actions are colour-coded (blue for read, green for create, amber for update, red for delete) to make scanning easier.`}
          badge={<Badge tone="neutral">{permissions.length} total</Badge>}
          actions={
            <Link
              href="/admin/roles"
              className="text-xs text-brand font-medium hover:underline"
            >
              Go to Roles →
            </Link>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-hairline rounded px-2.5 h-[30px] w-[280px]">
            <Search size={13} className="text-foreground-muted" />
            <input
              type="text"
              placeholder="Search permission code or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-foreground-muted"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={12} className="text-foreground-muted" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Pill
              active={activeModule === "all"}
              onClick={() => setActiveModule("all")}
            >
              All
              <span className="ml-1 text-foreground-muted">
                {permissions.length}
              </span>
            </Pill>
            {modules.map((m) => (
              <Pill
                key={m}
                active={activeModule === m}
                onClick={() => setActiveModule(m)}
              >
                {m}
                <span className="ml-1 text-foreground-muted">
                  {grouped.get(m)?.length || 0}
                </span>
              </Pill>
            ))}
          </div>
        </div>

        {/* Content */}
        {forbidden ? (
          <div className="bg-white border border-hairline rounded-md">
            <EmptyState
              icon={<Lock size={22} />}
              title="You don't have access to this reference"
              description="Viewing the full permissions catalog requires the 'auth.roles.read' permission, which usually sits on the Administrator role. Ask your workspace admin to grant it, or contact support."
            />
          </div>
        ) : isLoading ? (
          <div className="bg-white border border-hairline rounded-md py-20 flex justify-center">
            <Spinner size={24} />
          </div>
        ) : filtered.size === 0 ? (
          <div className="bg-white border border-hairline rounded-md">
            <EmptyState
              icon={<Lock size={22} />}
              title="No permissions found"
              description={
                search
                  ? "No permissions match your filter"
                  : "No permissions are seeded yet. Run the migrations to populate the permissions catalogue."
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(filtered.entries()).map(([module, perms]) => (
              <div
                key={module}
                className="bg-white border border-hairline rounded-md overflow-hidden"
              >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline bg-surface">
                  <div className="w-6 h-6 rounded bg-brand-light flex items-center justify-center">
                    <Lock size={12} className="text-brand" />
                  </div>
                  <h2 className="text-sm font-semibold capitalize">{module}</h2>
                  <Badge tone="neutral">{perms.length}</Badge>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                      <th className="text-left px-4 py-2 w-64">Code</th>
                      <th className="text-left px-4 py-2 w-24">Action</th>
                      <th className="text-left px-4 py-2">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perms.map((p) => {
                      const parts = p.code.split(".");
                      const action =
                        parts.length > 1 ? parts[parts.length - 1] : "—";
                      const tone = ACTION_TONES[action] || "neutral";
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-hairline-light"
                        >
                          <td className="px-4 py-2 font-mono text-xs font-medium">
                            {p.code}
                          </td>
                          <td className="px-4 py-2">
                            <Badge tone={tone}>{action}</Badge>
                          </td>
                          <td className="px-4 py-2 text-foreground-secondary text-xs">
                            {p.name || (
                              <span className="text-foreground-muted">
                                (no name)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
