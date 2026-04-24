"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField } from "@/components/ui/form-elements";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { GlobalSearch } from "@/components/ui/table-toolkit";
import { useToast } from "@/components/ui/toast";
import { itemCategoryService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import type { ItemCategory } from "@/types";
import {
  Plus, Edit, Trash2, Folder,
  ChevronRight, ChevronDown, FolderPlus,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Item Categories — hierarchical tree CRUD
// ═══════════════════════════════════════════════════════════

interface TreeNode extends ItemCategory {
  children: TreeNode[];
}

function buildTree(rows: ItemCategory[]): TreeNode[] {
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

export default function ItemCategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.categories.write");
  const [showCreate, setShowCreate] = useState<{ parentId: string | null } | null>(null);
  const [editTarget, setEditTarget] = useState<ItemCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemCategory | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["itemCategories"],
    queryFn: () => itemCategoryService.list({ limit: 200 }),
  });
  const rows = data?.data || [];
  const tree = useMemo(() => buildTree(rows), [rows]);

  const searchQ = search.trim().toLowerCase();
  const filteredFlat = useMemo(
    () =>
      searchQ
        ? rows.filter(
            (r) =>
              r.code.toLowerCase().includes(searchQ) ||
              r.name.toLowerCase().includes(searchQ),
          )
        : [],
    [rows, searchQ],
  );

  const deleteMut = useMutation({
    mutationFn: (id: string) => itemCategoryService.delete(id),
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: ["itemCategories"] });
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
    <RequireRead perm="inventory.categories.read" crumbs={["Master Data", "Categories"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Master Data", "Item Categories"]}
        right={
          <>
            <Button onClick={expandAll}>Expand all</Button>
            <Button onClick={collapseAll}>Collapse all</Button>
            <Can perm="inventory.categories.write">
              <Button kind="primary" icon={<Plus size={13} />}
                onClick={() => setShowCreate({ parentId: null })}>
                Add Root Category
              </Button>
            </Can>
          </>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title="Item Categories"
          description="A hierarchy your team uses to organise items. Think folders — 'Tablets' can sit under 'Medicines'. Useful for navigating a large catalogue and for reports."
          learnMore="Categories are tree-structured — each category can have a parent, making a folder tree. Use them for broad groupings (don't overthink it). Each item has one primary category."
          badge={
            <Badge tone="neutral">
              {searchQ ? filteredFlat.length : rows.length}
              {searchQ ? ` / ${rows.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search categories by code or name…"
          />
        </div>

        <div className="bg-white border border-hairline rounded-md overflow-hidden max-w-4xl">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Folder size={22} />} title="No categories yet"
              description={
                canWrite
                  ? "Build a simple tree — top-level groupings like 'Medicines', 'Electronics', 'Office Supplies', with sub-categories inside."
                  : "Your admin hasn't set up any item categories yet. Once they do, you'll see them here."
              }
              action={
                canWrite && <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate({ parentId: null })}>Add Root</Button>
              } />
          ) : searchQ ? (
            filteredFlat.length === 0 ? (
              <EmptyState
                icon={<Folder size={22} />}
                title="No categories match your search"
                description="Try a different query, or clear the search to see the full tree."
                action={<Button onClick={() => setSearch("")}>Clear search</Button>}
              />
            ) : (
              <div className="py-1">
                {filteredFlat.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface/60 transition-colors border-b border-hairline-light/50"
                  >
                    <span className="w-[14px]" />
                    <Folder size={14} className="text-brand flex-shrink-0" />
                    <code className="font-mono text-xs font-bold text-foreground-muted">{node.code}</code>
                    <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
                    {canWrite && (
                      <ActionMenu
                        items={[
                          {
                            label: "Add sub-category",
                            icon: <FolderPlus size={12} />,
                            onClick: () => setShowCreate({ parentId: node.id }),
                          },
                          {
                            label: "Edit",
                            icon: <Edit size={12} />,
                            onClick: () => setEditTarget(node),
                          },
                          { divider: true, label: "" },
                          {
                            label: "Delete",
                            icon: <Trash2 size={12} />,
                            danger: true,
                            onClick: () => setDeleteTarget(node),
                          },
                        ]}
                      />
                    )}
                  </div>
                ))}
              </div>
            )
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
                  canWrite={canWrite}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CategoryFormModal
          open
          onClose={() => setShowCreate(null)}
          parentId={showCreate.parentId}
          allCategories={rows}
        />
      )}
      {editTarget && (
        <CategoryFormModal
          open
          onClose={() => setEditTarget(null)}
          target={editTarget}
          allCategories={rows}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete category"}
        description="Delete this category? Items in this category become uncategorised. If it has sub-categories, those become top-level."
        confirmLabel="Delete category"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function TreeRow({
  node, depth, expanded, onToggle, onAddChild, onEdit, onDelete, canWrite,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (n: ItemCategory) => void;
  onDelete: (n: ItemCategory) => void;
  canWrite: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

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
        <Folder size={14} className="text-brand flex-shrink-0" />
        <code className="font-mono text-xs font-bold text-foreground-muted">{node.code}</code>
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
        {canWrite && (
          <ActionMenu
            items={[
              {
                label: "Add sub-category",
                icon: <FolderPlus size={12} />,
                onClick: () => onAddChild(node.id),
              },
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
            ]}
          />
        )}
      </div>
      {hasChildren && isOpen && node.children.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1}
          expanded={expanded} onToggle={onToggle}
          onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete}
          canWrite={canWrite} />
      ))}
    </>
  );
}

function CategoryFormModal({
  open, onClose, target, parentId, allCategories,
}: {
  open: boolean;
  onClose: () => void;
  target?: ItemCategory;
  parentId?: string | null;
  allCategories: ItemCategory[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: target?.code || "",
    name: target?.name || "",
    parent_id: target?.parent_id ?? parentId ?? "",
  });
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = () => {
    const errs: { code?: string; name?: string } = {};
    if (!isEdit) {
      if (!form.code.trim()) errs.code = "Code is required";
      else if (!/^[A-Z0-9_]+$/.test(form.code)) errs.code = "Uppercase letters, numbers, and underscores only";
    }
    if (!form.name.trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await itemCategoryService.update(target!.id, {
          name: form.name,
          parent_id: form.parent_id || null,
        });
      } else {
        await itemCategoryService.create({
          code: form.code,
          name: form.name,
          parent_id: form.parent_id || null,
        });
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["itemCategories"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setErrors({ code: "A category with this code already exists." });
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save. Please try again.");
      }
    } finally { setLoading(false); }
  };

  // Prevent setting self or descendant as parent
  const selectableParents = isEdit
    ? allCategories.filter((c) => c.id !== target?.id)
    : allCategories;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit category "${target?.code}"` : "Add a category"}
      description={
        isEdit
          ? "Rename the category or move it to a different parent. Code can't be changed once created."
          : "Create a new folder in your item hierarchy."
      }
      width="sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <Input
          label="Code"
          placeholder="MEDS"
          required
          disabled={isEdit || loading}
          help="Short uppercase identifier for this category. Cannot be changed later."
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
        <Input
          label="Name"
          placeholder="Medicines"
          required
          help="The display name used in menus and navigation."
          error={errors.name}
          disabled={loading}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <FormField
          label="Parent"
          help="Pick a parent to nest this category under, or leave as root for a top-level group."
        >
          <select
            className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-secondary disabled:text-foreground-muted"
            value={form.parent_id || ""}
            disabled={loading}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
          >
            <option value="">— None (root) —</option>
            {selectableParents.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>{isEdit ? "Save changes" : "Add category"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
