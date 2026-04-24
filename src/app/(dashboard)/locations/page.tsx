"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { locationService } from "@/services/locations.service";
import { isApiError } from "@/lib/api-client";
import type { InventoryLocation } from "@/types";
import {
  Plus, Edit, Trash2, MapPin,
  ChevronRight, ChevronDown, Grid3x3, Building,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Inventory Locations — hierarchical tree + per-location bins
// ═══════════════════════════════════════════════════════════

const LOCATION_TYPES = [
  "warehouse", "zone", "aisle", "shelf", "bin",
  "yard", "staging", "transit",
] as const;

interface TreeNode extends InventoryLocation {
  children: TreeNode[];
}

function buildTree(rows: InventoryLocation[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
  roots.sort(sort);
  byId.forEach((n) => n.children.sort(sort));
  return roots;
}

export default function LocationsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canLocationsWrite = can("inventory.locations.write");
  const canBinsWrite = can("inventory.bins.write");
  const [showCreate, setShowCreate] = useState<{ parentId: string | null } | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryLocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryLocation | null>(null);
  const [binsFor, setBinsFor] = useState<InventoryLocation | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const rows = data?.data || [];
  const tree = useMemo(() => buildTree(rows), [rows]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => locationService.delete(id),
    onSuccess: () => {
      toast.success("Location deleted");
      qc.invalidateQueries({ queryKey: ["locations"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const expandAll = () => setExpanded(new Set(rows.map((r) => r.id)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <RequireRead perm="inventory.locations.read" crumbs={["Inventory", "Locations & Bins"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Locations & Bins"]}
        right={
          <>
            <Button onClick={expandAll}>Expand all</Button>
            <Button onClick={collapseAll}>Collapse all</Button>
            <Can perm="inventory.locations.write">
              <Button kind="primary" icon={<Plus size={13} />}
                onClick={() => setShowCreate({ parentId: null })}>
                Add Warehouse
              </Button>
            </Can>
          </>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Locations & Bins"
          description="Where your stock physically lives. Build a tree: warehouses at the top, zones inside them, aisles and bins further in. Every stock movement and balance points at a location."
          learnMore={`Use levels that match how your team actually talks about storage. For a small shop, just "Main Warehouse" with a few zones may be enough. For larger operations, go deeper: Warehouse → Zone → Aisle → Bin. Stock balances are kept at the location level by default — bins are optional extra precision.`}
          badge={<Badge tone="neutral">{rows.length}</Badge>}
        />

        <div className="bg-white border border-hairline rounded-md overflow-x-auto max-w-4xl">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Building size={22} />}
              title="No locations yet"
              description={
                canLocationsWrite
                  ? "Start with a warehouse — the top of your location tree. Once it's there you can add zones, aisles, and bins underneath."
                  : "Your admin hasn't added any warehouses or locations yet. Once they do, you'll see them here."
              }
              action={
                canLocationsWrite && (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate({ parentId: null })}
                  >
                    Add your first warehouse
                  </Button>
                )
              }
            />
          ) : (
            <div className="py-1">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  onAddChild={(parentId) => setShowCreate({ parentId })}
                  onEdit={(n) => setEditTarget(n)}
                  onDelete={(n) => setDeleteTarget(n)}
                  onManageBins={(n) => setBinsFor(n)}
                  canWrite={canLocationsWrite}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <LocationFormModal
          open
          onClose={() => setShowCreate(null)}
          parentId={showCreate.parentId}
          allLocations={rows}
        />
      )}
      {editTarget && (
        <LocationFormModal
          open
          onClose={() => setEditTarget(null)}
          target={editTarget}
          allLocations={rows}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={
          deleteTarget
            ? `Any sub-locations inside ${deleteTarget.name} and stock balances pointing at it will be orphaned — they'll stay in the database but without a valid parent. Move those elsewhere first if they matter.`
            : ""
        }
        confirmLabel="Delete location"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
      {binsFor && <BinsModal location={binsFor} onClose={() => setBinsFor(null)} canWrite={canBinsWrite} />}
    </div>
    </RequireRead>
  );
}

function TreeRow({
  node, depth, expanded, onToggle, onAddChild, onEdit, onDelete, onManageBins, canWrite,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (n: InventoryLocation) => void;
  onDelete: (n: InventoryLocation) => void;
  onManageBins: (n: InventoryLocation) => void;
  canWrite: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  const typeTone = (t: string): "green" | "blue" | "amber" | "neutral" => {
    if (t === "warehouse") return "green";
    if (t === "zone") return "blue";
    if (t === "bin") return "amber";
    return "neutral";
  };

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface/60 transition-colors border-b border-hairline-light/50"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className="text-foreground-muted hover:text-foreground">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <MapPin size={14} className="text-brand flex-shrink-0" />
        <code className="font-mono text-xs font-bold text-foreground-muted">{node.code}</code>
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
        <Badge tone={typeTone(node.location_type)}>{node.location_type}</Badge>
        {!node.is_active && <Badge tone="red">inactive</Badge>}
        <ActionMenu
          items={[
            ...(canWrite
              ? [
                  {
                    label: "Add sub-location",
                    icon: <Plus size={12} />,
                    onClick: () => onAddChild(node.id),
                  },
                ]
              : []),
            {
              label: "Manage bins",
              icon: <Grid3x3 size={12} />,
              onClick: () => onManageBins(node),
            },
            ...(canWrite
              ? [
                  {
                    label: "Edit",
                    icon: <Edit size={12} />,
                    onClick: () => onEdit(node),
                  },
                  { divider: true, label: "" },
                  {
                    label: "Delete",
                    icon: <Trash2 size={12} />,
                    danger: true,
                    onClick: () => onDelete(node),
                  },
                ]
              : []),
          ]}
        />
      </div>
      {hasChildren && isOpen && node.children.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1}
          expanded={expanded} onToggle={onToggle}
          onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} onManageBins={onManageBins}
          canWrite={canWrite} />
      ))}
    </>
  );
}

function LocationFormModal({
  open, onClose, target, parentId, allLocations,
}: {
  open: boolean;
  onClose: () => void;
  target?: InventoryLocation;
  parentId?: string | null;
  allLocations: InventoryLocation[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: target?.code || "",
    name: target?.name || "",
    location_type: target?.location_type || (parentId ? "zone" : "warehouse"),
    parent_id: target?.parent_id ?? parentId ?? "",
    is_active: target?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await locationService.update(target!.id, {
          name: form.name,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
        });
      } else {
        await locationService.create({
          code: form.code,
          name: form.name,
          location_type: form.location_type,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
        });
      }
      toast.success(isEdit ? "Location updated" : "Location created");
      qc.invalidateQueries({ queryKey: ["locations"] });
      onClose();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Save failed");
    } finally { setLoading(false); }
  };

  const selectableParents = isEdit
    ? allLocations.filter((l) => l.id !== target?.id)
    : allLocations;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit "${target?.name}"` : parentId ? "Add a sub-location" : "Add a warehouse"}
      description={
        isEdit
          ? "Rename or reparent this location. Code and type can't be changed after creation."
          : parentId
            ? "Zones, aisles, shelves, and bins all nest underneath their parent location."
            : "Warehouses are the top of your location tree. Every other location lives inside one."
      }
      width="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Code"
            placeholder="WH-01"
            required
            disabled={isEdit}
            help="Short identifier shown in reports and document headers. Cannot be changed later."
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <FormField
            label="Type"
            required
            help="Broad category of the location. Use 'warehouse' for the top of each tree; 'zone', 'aisle', 'shelf', 'bin' for inner levels; 'yard', 'staging', 'transit' for special areas."
          >
            <select
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
              value={form.location_type}
              onChange={(e) => setForm({ ...form, location_type: e.target.value })}
              disabled={isEdit}
            >
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>
        <Input
          label="Name"
          placeholder="Main Warehouse"
          required
          help="The human-friendly name shown in the tree and in dropdowns."
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <FormField
          label="Parent"
          help="Where this location sits in the tree. Leave blank for a top-level warehouse."
        >
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={form.parent_id || ""}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
          >
            <option value="">— None (top level) —</option>
            {selectableParents.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </FormField>
        <Checkbox
          label="Active — inactive locations stay in reports but can't receive new stock"
          checked={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>
            {isEdit ? "Save changes" : "Add location"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function BinsModal({ location, onClose, canWrite }: { location: InventoryLocation; onClose: () => void; canWrite: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["bins", location.id],
    queryFn: () => locationService.listBins(location.id),
  });
  const bins = data?.data || [];

  return (
    <>
      <Dialog open onClose={onClose} title={`Bins in ${location.code}`} width="md">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-secondary">
              Optional sub-location bins for precise stock tracking. Balances can be scoped to a bin.
            </p>
            {canWrite && (
              <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Bin</Button>
            )}
          </div>

          {isLoading ? (
            <div className="py-10 flex justify-center"><Spinner size={20} /></div>
          ) : bins.length === 0 ? (
            <div className="text-center py-8 text-sm text-foreground-muted">
              No bins yet for <code className="font-mono">{location.code}</code>.
            </div>
          ) : (
            <div className="border border-hairline rounded-md overflow-hidden">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                    <th className="text-left px-3 py-2">Code</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-center px-3 py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {bins.map((b) => (
                    <tr key={b.id} className="border-t border-hairline-light">
                      <td className="px-3 py-2 font-mono text-xs font-bold">{b.code}</td>
                      <td className="px-3 py-2">{b.name}</td>
                      <td className="px-3 py-2 text-center">{b.is_active ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Dialog>

      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)} title="Add Bin" width="sm">
          <BinForm
            locationId={location.id}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["bins", location.id] });
              setShowCreate(false);
              toast.success("Bin created");
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Dialog>
      )}
    </>
  );
}

function BinForm({
  locationId, onSuccess, onCancel,
}: { locationId: string; onSuccess: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", is_active: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await locationService.createBin(locationId, form);
      onSuccess();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Save failed");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Code"
        placeholder="A1-B2"
        required
        help="Short identifier for this bin. Often matches the label you put on the shelf."
        value={form.code}
        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
      />
      <Input
        label="Name"
        placeholder="Aisle 1, Bay 2"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Checkbox
        label="Active"
        checked={form.is_active}
        onChange={(v) => setForm({ ...form, is_active: v })}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" kind="primary" loading={loading}>Add bin</Button>
      </div>
    </form>
  );
}
