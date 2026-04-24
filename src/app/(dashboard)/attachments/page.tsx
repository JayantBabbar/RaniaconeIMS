"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionMenu } from "@/components/ui/action-menu";
import { useToast } from "@/components/ui/toast";
import { Can, useCan } from "@/components/ui/can";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { attachmentService, type Attachment } from "@/services/settings.service";
import { formatDate } from "@/lib/utils";
import { isApiError } from "@/lib/api-client";
import { Paperclip, Trash2, Download, ExternalLink } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// S-66: Standalone Attachments Viewer
//
// A tenant-wide list of every file uploaded against any entity. Useful
// for audits or finding a file when you don't remember which item /
// document / party it was attached to.
// ═══════════════════════════════════════════════════════════════════

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "item", label: "Item" },
  { value: "party", label: "Party" },
  { value: "document_header", label: "Document" },
  { value: "document_line", label: "Document line" },
  { value: "inventory_location", label: "Location" },
  { value: "warehouse_bin", label: "Bin" },
];

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  item: (id) => `/items/${id}`,
  party: (id) => `/parties/${id}`,
  document_header: (id) => `/documents/detail/${id}`,
  inventory_location: () => `/locations`,
};

function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.items.write");

  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attachments"],
    queryFn: () => attachmentService.list({ limit: 200 }),
  });
  const rows = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => attachmentService.delete(id),
    onSuccess: () => {
      toast.success("Attachment removed");
      qc.invalidateQueries({ queryKey: ["attachments"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.apiError(err),
  });

  const columns: ColumnDef<Attachment>[] = useMemo(
    () => [
      {
        key: "file_name",
        label: "File name",
        sortable: true,
        filterType: "text",
      },
      {
        key: "entity",
        label: "Entity",
        sortable: true,
        filterType: "select",
        options: ENTITY_OPTIONS,
      },
      {
        key: "entity_id",
        label: "Entity ID",
        sortable: true,
        filterType: "text",
        getValue: (r) => r.entity_id.slice(0, 8),
      },
      {
        key: "mime_type",
        label: "Type",
        sortable: true,
        filterType: "text",
      },
      {
        key: "file_size",
        label: "Size",
        sortable: true,
      },
      {
        key: "created_at",
        label: "Uploaded",
        sortable: true,
      },
    ],
    [],
  );

  const {
    rows: visible,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  } = useTableFilters({ data: rows, columns });

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Attachments"]} />

      <div className="p-5 space-y-4">
        <PageHeader
          title="Attachments"
          description="Every file uploaded anywhere in this workspace — invoices attached to documents, photos on items, policy PDFs on parties. Search by filename, filter by entity type, or click through to the record it's attached to."
          learnMore="Attachments belong to a specific entity (an item, a party, a document, etc). You can't upload files from this page — uploads happen on the entity's own detail page. Delete here removes the file link but doesn't affect the entity it was attached to."
          badge={
            <Badge tone="neutral">
              {visible.length}
              {visible.length !== rows.length ? ` / ${rows.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by filename, entity, MIME type…"
          />
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

        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Spinner size={24} />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Paperclip size={22} />}
              title={
                activeFilterCount > 0
                  ? "No attachments match those filters"
                  : "No attachments yet"
              }
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters or clear them all."
                  : "Upload files from an item, party, or document detail page — they'll show up here once attached."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={
                        col.key === "file_size"
                          ? "text-right px-4 py-2.5"
                          : "text-left px-4 py-2.5"
                      }
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          col.key === "file_size" ? "justify-end" : ""
                        }`}
                      >
                        <SortHeader
                          col={col}
                          sort={sort}
                          toggleSort={toggleSort}
                          align={col.key === "file_size" ? "right" : "left"}
                        >
                          {col.label}
                        </SortHeader>
                        <ColumnFilter
                          col={col}
                          value={columnFilters[col.key]}
                          onChange={(v) => setColumnFilter(col.key, v)}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const linkFn = ENTITY_LINKS[a.entity];
                  const entityHref = linkFn ? linkFn(a.entity_id) : null;
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-hairline-light hover:bg-surface/50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Paperclip
                            size={12}
                            className="text-foreground-muted flex-shrink-0"
                          />
                          <span className="font-medium truncate max-w-[280px]">
                            {a.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone="neutral">
                          {ENTITY_OPTIONS.find((e) => e.value === a.entity)?.label ||
                            a.entity}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {entityHref ? (
                          <a
                            href={entityHref}
                            className="flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
                          >
                            {a.entity_id.slice(0, 8)}…
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="font-mono text-[11px] text-foreground-muted">
                            {a.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-foreground-secondary">
                        {a.mime_type || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {formatBytes(a.file_size)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground-secondary tabular-nums">
                        {formatDate(a.created_at, "short")}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Download",
                              icon: <Download size={12} />,
                              href: a.file_path,
                            },
                            ...(entityHref
                              ? [
                                  {
                                    label: "Open entity",
                                    icon: <ExternalLink size={12} />,
                                    href: entityHref,
                                  },
                                ]
                              : []),
                            ...(canWrite
                              ? [
                                  { divider: true, label: "" },
                                  {
                                    label: "Remove attachment",
                                    icon: <Trash2 size={12} />,
                                    danger: true,
                                    onClick: () => setDeleteTarget(a),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Remove "${deleteTarget?.file_name}"?`}
        description={`The file link is removed from this workspace's records. The underlying file on storage may or may not be deleted depending on your storage setup. The entity it was attached to is not affected.`}
        confirmLabel="Remove attachment"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
