"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-elements";
import { auditLogService } from "@/services/audit-log.service";
import { formatDate } from "@/lib/utils";
import { ScrollText, ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { AuditLogEntry } from "@/types";

// ═══════════════════════════════════════════════════════════
// /admin/audit-log — Audit timeline
//
// Read-only view over backend's audit_log table. Filters by user,
// action prefix (e.g. "invoice." catches all invoice events),
// entity type, and date range. Each row expands to show the
// before/after JSON diff when present.
// ═══════════════════════════════════════════════════════════

const ACTION_PREFIXES = [
  { value: "", label: "All actions" },
  { value: "invoice.", label: "Invoices" },
  { value: "vendor_bill.", label: "Vendor bills" },
  { value: "challan.", label: "Challans" },
  { value: "payment.", label: "Payments" },
  { value: "expense.", label: "Expenses" },
  { value: "salary.", label: "Salary" },
  { value: "period_close.", label: "Period close" },
  { value: "import.", label: "Imports" },
  { value: "role.", label: "Roles" },
];

const ACTION_TONES: Record<string, "green" | "red" | "amber" | "blue"> = {
  post: "green",
  cancel: "red",
  delete: "red",
  set: "amber",
  unlock: "amber",
  permission_grant: "blue",
  permission_revoke: "red",
  commit: "blue",
};

export default function AuditLogPage() {
  const [actionPrefix, setActionPrefix] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", { actionPrefix, startDate, endDate }],
    queryFn: () =>
      auditLogService.list({
        action: actionPrefix || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 200,
      }),
  });

  const rows = data ?? [];

  return (
    <RequireRead perm="inventory.audit_log.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-6xl mx-auto">
        <PageHeader
          title="Audit log"
          description="Every critical action — post, cancel, edit, lock, grant — is recorded here with who did it and what changed. Read-only; entries are immutable."
        />

        <div className="rounded-lg border border-border bg-bg-elevated p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Action group</label>
            <select
              value={actionPrefix}
              onChange={(e) => setActionPrefix(e.target.value)}
              className="w-full text-[13px] rounded-md border border-border bg-bg-base px-2 py-1.5"
            >
              {ACTION_PREFIXES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <Input type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" label="To"   value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={20} />}
            title="No audit entries match these filters"
            description="Try widening the date range or clearing the action group."
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <ul className="divide-y divide-border">
              {rows.map((entry) => <AuditEntryRow key={entry.id} entry={entry} />)}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[11px] text-text-tertiary flex items-center gap-1.5">
          <FileText size={12} /> Audit entries are written automatically by the system. They can never be edited or deleted from the UI.
        </p>
      </div>
    </RequireRead>
  );
}

function AuditEntryRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = !!(entry.before || entry.after);
  const verb = entry.action.split(".").pop() ?? entry.action;
  const tone = ACTION_TONES[verb] ?? "blue";

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDiff && setExpanded((v) => !v)}
        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-bg-hover transition-colors ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex-shrink-0 mt-0.5 w-4">
          {hasDiff && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={tone}>{entry.action}</Badge>
            {entry.entity_type && (
              <span className="text-[12px] font-mono text-text-tertiary">
                {entry.entity_type}
                {entry.entity_id && <span className="opacity-60"> · {entry.entity_id}</span>}
              </span>
            )}
          </div>
          {entry.remarks && (
            <p className="mt-1 text-[12px] text-text-secondary italic">"{entry.remarks}"</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[12px] font-medium">{entry.user_email ?? "system"}</p>
          <p className="text-[11px] text-text-tertiary tabular-nums">{formatDate(entry.created_at)}</p>
        </div>
      </button>

      {expanded && hasDiff && (
        <div className="px-4 pb-3 pt-0 ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
          {entry.before && (
            <DiffBlock title="Before" data={entry.before} tone="red" />
          )}
          {entry.after && (
            <DiffBlock title="After" data={entry.after} tone="green" />
          )}
        </div>
      )}
    </li>
  );
}

function DiffBlock({ title, data, tone }: { title: string; data: Record<string, unknown>; tone: "red" | "green" }) {
  const colour = tone === "red"
    ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30 text-red-800 dark:text-red-300"
    : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300";
  return (
    <div className={`rounded border p-2.5 ${colour}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1">{title}</p>
      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words">
{JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
