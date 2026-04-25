"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { RequireRead } from "@/components/ui/forbidden-state";
import { importService, ImportBatch } from "@/services/settings.service";
import { formatDate } from "@/lib/utils";
import { Upload } from "lucide-react";

export default function ImportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: () => importService.list({ limit: 200 }),
  });
  const rows = data || [];

  const statusTone = (s: string): "green" | "blue" | "amber" | "red" | "neutral" => {
    if (s === "completed") return "green";
    if (s === "processing") return "blue";
    if (s === "pending") return "amber";
    if (s === "failed") return "red";
    return "neutral";
  };

  const successPct = (b: ImportBatch) => {
    if (b.total_rows === 0) return 0;
    return (b.success_rows / b.total_rows) * 100;
  };

  return (
    <RequireRead perm="inventory.integrations.read" crumbs={["Settings", "Imports"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Settings", "Imports"]} />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Imports"
          description="Bulk data uploads — CSV or Excel files for items, parties, stock, and more. Every import runs as a background job with a progress indicator and a per-row error report."
          learnMore="Uploads are queued and processed server-side. Successful rows land in the target entity; failed rows are logged with the reason so you can fix them and re-upload. Drafts of failed imports are NOT partially applied — each job is atomic per entity."
          badge={<Badge tone="neutral">{rows.length}</Badge>}
        />

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Upload size={22} />}
              title="No imports yet"
              description="Start an import from any entity's list page (Items, Parties, Stock…). Each upload appears here with live progress and a per-row error report."
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Created</th>
                  <th className="text-left px-4 py-2.5">Entity</th>
                  <th className="text-left px-4 py-2.5">File</th>
                  <th className="text-center px-4 py-2.5">Status</th>
                  <th className="text-right px-4 py-2.5">Rows</th>
                  <th className="text-right px-4 py-2.5">Success</th>
                  <th className="text-right px-4 py-2.5">Errors</th>
                  <th className="text-left px-4 py-2.5 w-32">Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const pct = successPct(b);
                  return (
                    <tr key={b.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(b.created_at)}</td>
                      <td className="px-4 py-2.5"><Badge tone="blue">{b.entity}</Badge></td>
                      <td className="px-4 py-2.5 text-xs font-mono truncate max-w-xs">{b.file_name}</td>
                      <td className="px-4 py-2.5 text-center"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.total_rows}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-status-green-text">{b.success_rows}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-status-red-text">{b.error_rows}</td>
                      <td className="px-4 py-2.5">
                        <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                          <div
                            className={
                              "h-full transition-all " +
                              (b.status === "failed" ? "bg-status-red" : "bg-brand")
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10.5px] text-foreground-muted mt-0.5 tabular-nums">{pct.toFixed(1)}%</div>
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
