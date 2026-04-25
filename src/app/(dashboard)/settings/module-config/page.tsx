"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner, Pill } from "@/components/ui/shared";
import { Input } from "@/components/ui/form-elements";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { moduleConfigService } from "@/services/settings.service";
import { isApiError } from "@/lib/api-client";
import {
  Plus,
  Search,
  X,
  Boxes,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import type { ModuleConfigEntry } from "@/services/settings.service";

// ═══════════════════════════════════════════════════════════
// S-25: Module Configuration
// Grouped key-value editor per module (items, documents,
// counts, stock, etc.). Tenant-scoped, JSON values.
// ═══════════════════════════════════════════════════════════

const KNOWN_MODULES = [
  "items",
  "documents",
  "stock",
  "counts",
  "parties",
  "locations",
  "integrations",
  "workflows",
] as const;

export default function ModuleConfigPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.config.write");

  const [search, setSearch] = useState("");
  const [activeModule, setActiveModule] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ModuleConfigEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModuleConfigEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["moduleConfig"],
    queryFn: () => moduleConfigService.list({ limit: 200 }),
  });

  const entries = data || [];

  const modules = useMemo(() => {
    const fromData = new Set(entries.map((e) => e.module));
    for (const m of KNOWN_MODULES) fromData.add(m);
    return Array.from(fromData).sort();
  }, [entries]);

  const moduleCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) map[e.module] = (map[e.module] || 0) + 1;
    return map;
  }, [entries]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = entries.filter((e) =>
      activeModule === "all" ? true : e.module === activeModule,
    );
    const filtered = !q
      ? base
      : base.filter(
          (e) =>
            e.key.toLowerCase().includes(q) ||
            e.module.toLowerCase().includes(q) ||
            JSON.stringify(e.value).toLowerCase().includes(q),
        );
    const groups = new Map<string, ModuleConfigEntry[]>();
    for (const e of filtered) {
      if (!groups.has(e.module)) groups.set(e.module, []);
      groups.get(e.module)!.push(e);
    }
    Array.from(groups.values()).forEach((arr: ModuleConfigEntry[]) =>
      arr.sort((a, b) => a.key.localeCompare(b.key)),
    );
    return groups;
  }, [entries, search, activeModule]);

  const deleteMutation = useMutation({
    mutationFn: (entry: ModuleConfigEntry) =>
      moduleConfigService.delete(entry.module, entry.key),
    onSuccess: () => {
      toast.success("Module config removed");
      queryClient.invalidateQueries({ queryKey: ["moduleConfig"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to delete entry");
    },
  });

  return (
    <RequireRead perm="inventory.config.read" crumbs={["Settings", "Module Configuration"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Module Configuration"]}
        right={
          <Can perm="inventory.config.write">
            <Button
              kind="primary"
              icon={<Plus size={13} />}
              onClick={() => setShowCreate(true)}
            >
              Add Config Entry
            </Button>
          </Can>
        }
      />

      <div className="p-4 md:p-5 space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Module Configuration
            </h1>
            <Badge tone="neutral">{entries.length}</Badge>
          </div>
          <p className="text-sm text-foreground-secondary mt-1">
            Module-scoped key/value settings. Group related config under a
            module name (e.g. <code>items</code>, <code>documents</code>).
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-hairline rounded px-2.5 h-9 md:h-[30px] w-full sm:w-[280px]">
            <Search size={13} className="text-foreground-muted" />
            <input
              type="text"
              placeholder="Search key, module, or value…"
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
                {entries.length}
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
                  {moduleCounts[m] || 0}
                </span>
              </Pill>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white border border-hairline rounded-md py-20 flex justify-center">
            <Spinner size={24} />
          </div>
        ) : grouped.size === 0 ? (
          <div className="bg-white border border-hairline rounded-md">
            <EmptyState
              icon={<Boxes size={22} />}
              title="No module config"
              description={
                search || activeModule !== "all"
                  ? "No entries match your filter"
                  : canWrite
                    ? "Configure module-specific settings to fine-tune behavior."
                    : "Your admin hasn't set any module configuration yet."
              }
              action={
                !search &&
                activeModule === "all" && canWrite && (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate(true)}
                  >
                    Add Config Entry
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([module, rows]) => (
              <div
                key={module}
                className="bg-white border border-hairline rounded-md overflow-x-auto"
              >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline bg-surface">
                  <div className="w-6 h-6 rounded bg-brand-light flex items-center justify-center">
                    <Boxes size={12} className="text-brand" />
                  </div>
                  <h2 className="text-sm font-semibold capitalize">{module}</h2>
                  <Badge tone="neutral">{rows.length}</Badge>
                </div>
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                      <th className="text-left px-4 py-2 w-64">Key</th>
                      <th className="text-left px-4 py-2">Value (JSON)</th>
                      {canWrite && <th className="w-32" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                      >
                        <td className="px-4 py-2 font-mono text-xs font-medium">
                          {entry.key}
                        </td>
                        <td className="px-4 py-2">
                          <code className="text-xs bg-surface px-2 py-0.5 rounded font-mono">
                            {JSON.stringify(entry.value)}
                          </code>
                        </td>
                        {canWrite && (
                          <td className="px-4 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <Button
                                size="sm"
                                icon={<Pencil size={11} />}
                                onClick={() => setEditTarget(entry)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                kind="danger"
                                icon={<Trash2 size={11} />}
                                onClick={() => setDeleteTarget(entry)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleConfigModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="create"
        modules={modules}
        presetModule={activeModule !== "all" ? activeModule : undefined}
      />

      {editTarget && (
        <ModuleConfigModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          mode="edit"
          initial={editTarget}
          modules={modules}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Delete module config"
        description={`Delete "${deleteTarget?.module}.${deleteTarget?.key}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </RequireRead>
  );
}

function ModuleConfigModal({
  open,
  onClose,
  mode,
  initial,
  modules,
  presetModule,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: ModuleConfigEntry;
  modules: string[];
  presetModule?: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState(initial?.module || presetModule || KNOWN_MODULES[0]);
  const [key, setKey] = useState(initial?.key || "");
  const [valueStr, setValueStr] = useState(
    initial ? JSON.stringify(initial.value, null, 2) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!module.trim()) {
      setError("Module is required");
      return;
    }
    if (mode === "create" && !key.trim()) {
      setError("Key is required");
      return;
    }

    let parsed: unknown;
    try {
      parsed = valueStr.trim() === "" ? "" : JSON.parse(valueStr);
    } catch {
      setError("Value must be valid JSON");
      return;
    }

    setLoading(true);
    try {
      if (mode === "create") {
        await moduleConfigService.set({
          module: module.trim(),
          key: key.trim(),
          value: parsed,
        });
        toast.success("Module config created");
      } else if (initial) {
        await moduleConfigService.update(initial.module, initial.key, parsed);
        toast.success("Module config updated");
      }
      queryClient.invalidateQueries({ queryKey: ["moduleConfig"] });
      onClose();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const allModules = Array.from(
    new Set([...KNOWN_MODULES, ...modules]),
  ).sort();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        mode === "create"
          ? "Add Module Config"
          : `Edit: ${initial?.module}.${initial?.key}`
      }
      description="Scope settings to a specific module. Values are stored as JSON."
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-1.5">
            Module
          </label>
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            disabled={mode === "edit"}
          >
            {allModules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Key"
          placeholder="e.g. default_price_list"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={mode === "edit"}
        />
        <div>
          <label className="block text-xs font-medium mb-1 text-foreground-secondary">
            Value (JSON)
          </label>
          <textarea
            rows={8}
            placeholder={`"retail"\nor\n{"threshold": 100}`}
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          {error && (
            <p className="text-[11px] text-status-red-text mt-1">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            kind="primary"
            loading={loading}
            icon={<Save size={13} />}
          >
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
