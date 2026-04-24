"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Input } from "@/components/ui/form-elements";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { tenantConfigService } from "@/services/settings.service";
import { isApiError } from "@/lib/api-client";
import {
  Plus,
  Search,
  X,
  Settings2,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import type { TenantConfigEntry } from "@/services/settings.service";

// ═══════════════════════════════════════════════════════════
// S-24: Tenant Configuration
// Key-value editor for tenant-wide settings (JSON values).
// ═══════════════════════════════════════════════════════════

export default function TenantConfigPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.config.write");

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantConfigEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantConfigEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenantConfig"],
    queryFn: () => tenantConfigService.list({ limit: 200 }),
  });

  const entries = data?.data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        JSON.stringify(e.value).toLowerCase().includes(q),
    );
  }, [entries, search]);

  const deleteMutation = useMutation({
    mutationFn: (key: string) => tenantConfigService.delete(key),
    onSuccess: () => {
      toast.success("Config entry removed");
      queryClient.invalidateQueries({ queryKey: ["tenantConfig"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to delete entry");
    },
  });

  return (
    <RequireRead perm="inventory.config.read" crumbs={["Settings", "Tenant Configuration"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Tenant Configuration"]}
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

      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Tenant Configuration
            </h1>
            <Badge tone="neutral">{filtered.length}</Badge>
          </div>
          <p className="text-sm text-foreground-secondary mt-1">
            Workspace-wide key/value settings. Values are stored as JSON.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-hairline rounded px-2.5 h-[30px] w-[320px]">
          <Search size={13} className="text-foreground-muted" />
          <input
            type="text"
            placeholder="Search by key or value…"
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

        {/* Table */}
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Settings2 size={22} />}
              title="No config entries"
              description={
                search
                  ? "No entries match your search"
                  : canWrite
                    ? "Add your first tenant-wide configuration entry."
                    : "Your admin hasn't set any configuration entries yet."
              }
              action={
                !search && canWrite && (
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
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-3.5 py-2.5 w-64">Key</th>
                  <th className="text-left px-3.5 py-2.5">Value (JSON)</th>
                  {canWrite && <th className="w-32" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-hairline-light hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5 font-mono text-xs font-medium">
                      {entry.key}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <code className="text-xs bg-surface px-2 py-0.5 rounded font-mono">
                        {JSON.stringify(entry.value)}
                      </code>
                    </td>
                    {canWrite && (
                      <td className="px-3.5 py-2.5 text-right">
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
          )}
        </div>
      </div>

      <ConfigEntryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="create"
      />

      {editTarget && (
        <ConfigEntryModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          mode="edit"
          initial={editTarget}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.key)}
        title="Delete config entry"
        description={`Delete "${deleteTarget?.key}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmKind="danger"
        loading={deleteMutation.isPending}
      />
    </div>
    </RequireRead>
  );
}

function ConfigEntryModal({
  open,
  onClose,
  mode,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: TenantConfigEntry;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(initial?.key || "");
  const [valueStr, setValueStr] = useState(
    initial ? JSON.stringify(initial.value, null, 2) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "create" && !key.trim()) {
      setError("Key is required");
      return;
    }

    let parsed: unknown;
    try {
      parsed = valueStr.trim() === "" ? "" : JSON.parse(valueStr);
    } catch {
      setError("Value must be valid JSON (use quotes for strings)");
      return;
    }

    setLoading(true);
    try {
      if (mode === "create") {
        await tenantConfigService.set({ key: key.trim(), value: parsed });
        toast.success("Config entry created");
      } else if (initial) {
        await tenantConfigService.update(initial.key, parsed);
        toast.success("Config entry updated");
      }
      queryClient.invalidateQueries({ queryKey: ["tenantConfig"] });
      onClose();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add Config Entry" : `Edit: ${initial?.key}`}
      description={`Values are stored as JSON. Use quotes for strings (e.g., "Acme Corp"), or raw numbers/booleans for primitives.`}
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Key"
          placeholder="e.g. default_currency_display"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={mode === "edit"}
          hint={mode === "edit" ? "Key cannot be changed" : "Lowercase, underscore-separated"}
        />
        <div>
          <label className="block text-xs font-medium mb-1 text-foreground-secondary">
            Value (JSON)
          </label>
          <textarea
            rows={8}
            placeholder={`"USD"\nor\n{"prefix": "INV-", "padding": 5}`}
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
