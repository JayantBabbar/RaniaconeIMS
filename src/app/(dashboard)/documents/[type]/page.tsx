"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { documentService } from "@/services/documents.service";
import { documentTypeService } from "@/services/master-data.service";
import { partyService } from "@/services/parties.service";
import { Plus, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Documents list — scoped by /documents/[type]
//   type = "purchase-orders", "sales-orders", "transfers", "all"
// Maps to backend document_type code(s).
// ═══════════════════════════════════════════════════════════

const TYPE_MAP: Record<string, { label: string; codes: string[]; module?: string }> = {
  "purchase-orders": { label: "Purchase Orders", codes: ["PO"], module: "purchase" },
  "sales-orders": { label: "Sales Orders", codes: ["SO"], module: "sales" },
  "transfers": { label: "Transfers", codes: ["TRANSFER", "XFER"], module: "inventory" },
  "all": { label: "All Documents", codes: [] },
};

export default function DocumentsListPage() {
  const { type } = useParams<{ type: string }>();
  const typeInfo = TYPE_MAP[type] || TYPE_MAP.all;
  const { can } = useCan();
  const canWrite = can("inventory.documents.write");

  const { data: docTypesRaw } = useQuery({
    queryKey: ["documentTypes"],
    queryFn: () => documentTypeService.list({ limit: 200 }),
  });
  const allDocTypes = docTypesRaw?.data || [];
  const relevantTypes = useMemo(
    () =>
      typeInfo.codes.length === 0
        ? allDocTypes
        : allDocTypes.filter((t) => typeInfo.codes.includes(t.code)),
    [allDocTypes, typeInfo]
  );
  const typeIds = relevantTypes.map((t) => t.id);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", type],
    queryFn: () =>
      documentService.list({
        limit: 200,
      }),
    enabled: true,
  });
  const { data: partiesRaw } = useQuery({
    queryKey: ["partiesForMap"],
    queryFn: () => partyService.list({ limit: 200 }),
  });

  const allRowsRaw = data?.data || [];
  const parties = partiesRaw?.data || [];
  const typeMap = useMemo(() => new Map(allDocTypes.map((t) => [t.id, t])), [allDocTypes]);
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  // Scope rows to this type's docType ids.
  const allRows = useMemo(
    () => allRowsRaw.filter((d) => typeIds.length === 0 || typeIds.includes(d.document_type_id)),
    [allRowsRaw, typeIds],
  );

  type DocRow = (typeof allRows)[number];

  const columns: ColumnDef<DocRow>[] = [
    { key: "document_number", label: "Number", sortable: true, filterType: "text" },
    { key: "document_date", label: "Date", sortable: true },
    {
      key: "party_id",
      label: "Party",
      sortable: true,
      searchable: true,
      filterType: "text",
      getValue: (r) => (r.party_id ? partyMap.get(r.party_id)?.name || "" : ""),
    },
    {
      key: "posting_date",
      label: "Posted",
      sortable: true,
      filterType: "boolean",
      getValue: (r) => Boolean(r.posting_date),
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
  } = useTableFilters({ data: allRows, columns });

  const postedCount = rows.filter((d) => d.posting_date).length;

  return (
    <RequireRead perm="inventory.documents.read" crumbs={["Documents", typeInfo.label]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Documents", typeInfo.label]}
        right={
          <Can perm="inventory.documents.write">
            <Link href={`/documents/${type}/new`}>
              <Button kind="primary" icon={<Plus size={13} />}>New {typeInfo.label.slice(0, -1)}</Button>
            </Link>
          </Can>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title={typeInfo.label}
          description="Documents of this type, filterable by status, date range, and party. Click any row to view/edit its lines."
          learnMore="A document's life is Draft → Submitted → Approved → Posted (→ Cancelled). Posting is what actually moves stock and hits valuation layers. Cancellation creates reversal movements — nothing is deleted, the trail stays."
          badge={
            <div className="flex items-center gap-1.5">
              <Badge tone="neutral">
                {rows.length}
                {rows.length !== allRows.length ? ` / ${allRows.length}` : ""}
              </Badge>
              <Badge tone="green">{postedCount} posted</Badge>
              <Badge tone="amber">{rows.length - postedCount} draft</Badge>
            </div>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by number or party…"
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

        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title={activeFilterCount > 0 ? `No ${typeInfo.label.toLowerCase()} match those filters` : `No ${typeInfo.label.toLowerCase()} yet`}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? `Create your first ${typeInfo.label.slice(0, -1).toLowerCase()} as a draft, add lines to it, then post when you're ready to move stock.`
                    : `No ${typeInfo.label.toLowerCase()} have been created yet.`
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Link href={`/documents/${type}/new`}>
                    <Button kind="primary" icon={<Plus size={13} />}>New {typeInfo.label.slice(0, -1)}</Button>
                  </Link>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Number</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Date</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Party</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[3]} sort={sort} toggleSort={toggleSort} align="center">Status</SortHeader>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const t = typeMap.get(d.document_type_id);
                  const p = d.party_id ? partyMap.get(d.party_id) : null;
                  return (
                    <tr key={d.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/documents/detail/${d.id}`} className="font-mono text-xs font-bold text-brand hover:underline">
                          {d.document_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(d.document_date)}</td>
                      <td className="px-4 py-2.5"><Badge tone="blue">{t?.code || "—"}</Badge></td>
                      <td className="px-4 py-2.5">
                        {p ? <>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-foreground-muted font-mono">{p.code}</div>
                        </> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {d.posting_date
                          ? <Badge tone="green">Posted</Badge>
                          : <Badge tone="amber">Draft</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </RequireRead>
  );
}
