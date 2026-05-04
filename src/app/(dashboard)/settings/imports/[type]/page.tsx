"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { importsService } from "@/services/imports.service";
import { isApiError } from "@/lib/api-client";
import {
  ArrowLeft, Download, Upload, CheckCircle2, AlertTriangle, Sparkles, FileText,
} from "lucide-react";
import type {
  ImportEntityType, ImportPreviewResponse, ImportRowError,
} from "@/types";

// ═══════════════════════════════════════════════════════════
// /settings/imports/[type] — Three-step wizard
//
//   Step 1: Download template — header row + 1 example row
//   Step 2: Upload + preview   — server validates; show parsed rows
//                                with errors highlighted
//   Step 3: Commit             — only valid rows; errors reported
// ═══════════════════════════════════════════════════════════

const ENTITY_TITLES: Record<ImportEntityType, { title: string; blurb: string }> = {
  items: {
    title: "Import items",
    blurb: "Bulk-create your SKU master. Brands and categories must already exist; the upload only adds items.",
  },
  parties: {
    title: "Import parties",
    blurb: "Bulk-create customers and suppliers. Opening balance writes a ledger seed entry on commit.",
  },
  stock_balances: {
    title: "Import stock balances",
    blurb: "Set initial qty_on_hand per item per location, with the unit cost used to seed valuation.",
  },
  opening_balances: {
    title: "Import opening balances",
    blurb: "Carry-forward receivables and payables from your previous system. Positive = customer owes; negative = we owe.",
  },
};

// Tiny CSV parser — handles quoted values and embedded commas/newlines.
// We don't pull in PapaParse for the demo; backend will parse server-side.
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i += 1;
        cur.push(cell); cell = "";
        if (cur.some((v) => v !== "")) rows.push(cur);
        cur = [];
      } else cell += c;
    }
  }
  if (cell !== "" || cur.length > 0) {
    cur.push(cell);
    if (cur.some((v) => v !== "")) rows.push(cur);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

export default function ImportWizardPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const entity = type as ImportEntityType;
  const valid = ["items", "parties", "stock_balances", "opening_balances"].includes(entity);
  const meta = ENTITY_TITLES[entity];
  const qc = useQueryClient();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>("");
  const [fileText, setFileText] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [committed, setCommitted] = useState<{ created: number; total: number; errors: ImportRowError[] } | null>(null);

  const previewMutation = useMutation({
    mutationFn: (rows: Array<Record<string, string>>) =>
      importsService.preview({ entity, rows }),
    onSuccess: (res) => {
      setPreview(res);
      setStep(2);
    },
    onError: (e: Error) => toast.error(isApiError(e) ? e.message : "Preview failed"),
  });

  const commitMutation = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) =>
      importsService.commit({ entity, rows, file_name: fileName }),
    onSuccess: (res) => {
      setCommitted({
        created: res.created_count,
        total: res.total_rows,
        errors: res.errors,
      });
      qc.invalidateQueries({ queryKey: ["imports"] });
      // Invalidate everything that might display freshly-imported data.
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      setStep(3);
      toast.success(`Imported ${res.created_count} of ${res.total_rows} rows`);
    },
    onError: (e: Error) => toast.error(isApiError(e) ? e.message : "Commit failed"),
  });

  const downloadTemplate = async () => {
    try {
      const csv = await importsService.getTemplate(entity);
      const blob = new Blob([typeof csv === "string" ? csv : ""], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "Failed to download template");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "");
      setFileText(text);
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("No data rows found in CSV");
        return;
      }
      previewMutation.mutate(rows);
    };
    reader.readAsText(file);
  };

  const validRowsForCommit = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter((r) => r._valid).map((r) => {
      // Strip wizard-internal flags before sending to commit.
      const clean: Record<string, unknown> = {};
      for (const k of Object.keys(r)) {
        if (k !== "_valid" && k !== "_errors") clean[k] = r[k];
      }
      return clean;
    });
  }, [preview]);

  if (!valid) {
    return (
      <div className="px-4 py-8">
        <p className="text-text-secondary">Unknown import type.</p>
        <Link href="/settings/imports" className="text-brand text-sm hover:underline">Back to imports</Link>
      </div>
    );
  }

  return (
    <RequireRead perm="inventory.imports.read">
      <TopBar />
      <div className="px-4 lg:px-6 py-4 max-w-5xl mx-auto">
        <PageHeader
          title={meta.title}
          description={meta.blurb}
          actions={
            <Link href="/settings/imports" className="text-[13px] text-brand hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Back to imports
            </Link>
          }
        />

        {/* Stepper */}
        <div className="flex items-center gap-2 my-4">
          <Step n={1} label="Download template"   active={step === 1} done={step > 1} />
          <div className="flex-1 h-px bg-border" />
          <Step n={2} label="Upload + preview"    active={step === 2} done={step > 2} />
          <div className="flex-1 h-px bg-border" />
          <Step n={3} label="Commit"              active={step === 3} done={false} />
        </div>

        {/* Step 1 — template download */}
        {step === 1 && (
          <div className="rounded-lg border border-border bg-bg-elevated p-5 space-y-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="text-text-tertiary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold">Download the CSV template</h3>
                <p className="mt-1 text-[12px] text-text-secondary">
                  The template has the exact columns the importer expects, plus one example row. Open in Excel / Google Sheets, fill rows below the example, save as CSV, then come back here.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button kind="primary" onClick={downloadTemplate}>
                    <Download size={14} /> Download template
                  </Button>
                  <Button kind="secondary" onClick={() => setStep(2)}>
                    I have a file already <Sparkles size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — upload + preview */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-bg-elevated p-5">
              <div className="flex items-start gap-3">
                <Upload size={20} className="text-text-tertiary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-[14px] font-semibold">Upload your CSV</h3>
                  <p className="mt-1 text-[12px] text-text-secondary">
                    The server runs a validation pass — nothing is written yet. Fix any errors in your CSV and re-upload before committing.
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="mt-3 block w-full text-[13px] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-brand file:text-white file:font-medium hover:file:bg-brand-dark file:cursor-pointer"
                  />
                  {fileName && <p className="mt-2 text-[11px] text-text-tertiary">Loaded: {fileName}</p>}
                </div>
              </div>
            </div>

            {previewMutation.isPending && (
              <p className="text-[13px] text-text-secondary">Validating…</p>
            )}

            {preview && (
              <PreviewPanel
                preview={preview}
                fileName={fileName}
                onCommit={() => commitMutation.mutate(validRowsForCommit)}
                isCommitting={commitMutation.isPending}
                onRestart={() => { setPreview(null); setFileName(""); setFileText(""); setStep(1); }}
              />
            )}

            {!preview && fileText && !previewMutation.isPending && (
              <p className="text-[13px] text-amber-700">Preview failed — check the file and try again.</p>
            )}
          </div>
        )}

        {/* Step 3 — commit result */}
        {step === 3 && committed && (
          <div className="rounded-lg border border-border bg-bg-elevated p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold">Import finished</h3>
                <p className="mt-1 text-[13px]">
                  Created <span className="font-semibold">{committed.created}</span> of{" "}
                  <span className="font-semibold">{committed.total}</span> rows.
                </p>
                {committed.errors.length > 0 && (
                  <div className="mt-3 rounded border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3">
                    <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {committed.errors.length} row{committed.errors.length === 1 ? "" : "s"} skipped
                    </p>
                    <ul className="mt-2 space-y-1 text-[12px] text-amber-800 dark:text-amber-300">
                      {committed.errors.slice(0, 20).map((err, i) => (
                        <li key={i}>
                          Row {err.row_index}{err.field ? ` · ${err.field}` : ""}: {err.message}
                        </li>
                      ))}
                      {committed.errors.length > 20 && (
                        <li className="italic">…and {committed.errors.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Link href="/settings/imports">
                    <Button kind="primary">Done</Button>
                  </Link>
                  <Button kind="secondary" onClick={() => {
                    setPreview(null); setCommitted(null); setFileName(""); setFileText(""); setStep(1);
                  }}>
                    Import another file
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireRead>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
        done ? "bg-emerald-600 text-white" : active ? "bg-brand text-white" : "bg-bg-subtle text-text-tertiary border border-border"
      }`}>
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <span className={`text-[13px] ${active ? "font-semibold" : "text-text-secondary"}`}>{label}</span>
    </div>
  );
}

function PreviewPanel({
  preview, fileName, onCommit, isCommitting, onRestart,
}: {
  preview: ImportPreviewResponse;
  fileName: string;
  onCommit: () => void;
  isCommitting: boolean;
  onRestart: () => void;
}) {
  const hasErrors = preview.error_rows > 0;
  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone="neutral">{fileName}</Badge>
          <Badge tone="green">{preview.valid_rows} valid</Badge>
          {hasErrors && <Badge tone="red">{preview.error_rows} error{preview.error_rows === 1 ? "" : "s"}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button kind="ghost" onClick={onRestart}>Restart</Button>
          <Button
            kind="primary"
            onClick={onCommit}
            disabled={preview.valid_rows === 0 || isCommitting}
            title={preview.valid_rows === 0 ? "Fix the errors and re-upload" : undefined}
          >
            {isCommitting ? "Committing…" : `Commit ${preview.valid_rows} valid row${preview.valid_rows === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-bg-subtle text-text-tertiary text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium w-10">#</th>
              <th className="text-left px-2 py-1.5 font-medium w-12" />
              {preview.columns.map((c) => (
                <th key={c.key} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                  {c.label}
                  {c.required && <span className="text-red-600 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.slice(0, 200).map((r, i) => (
              <React.Fragment key={i}>
                <tr className={r._valid ? "border-t border-border hover:bg-bg-hover" : "border-t border-border bg-red-50/40 dark:bg-red-950/20"}>
                  <td className="px-2 py-1.5 text-text-tertiary tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    {r._valid
                      ? <CheckCircle2 size={14} className="text-emerald-600" />
                      : <AlertTriangle size={14} className="text-red-600" />}
                  </td>
                  {preview.columns.map((c) => {
                    const fieldErr = r._errors?.find((e) => e.field === c.key);
                    return (
                      <td key={c.key} className={`px-2 py-1.5 whitespace-nowrap ${fieldErr ? "text-red-700 font-medium" : ""}`} title={fieldErr?.message}>
                        {String(r[c.key] ?? "") || <span className="text-text-tertiary">—</span>}
                      </td>
                    );
                  })}
                </tr>
                {!r._valid && r._errors && r._errors.length > 0 && (
                  <tr className="border-t-0 bg-red-50/40 dark:bg-red-950/20">
                    <td colSpan={2 + preview.columns.length} className="px-2 pb-1.5 text-[11px] text-red-700 dark:text-red-400">
                      <span className="ml-12">↳ {r._errors.map((e) => e.message).join(" · ")}</span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {preview.rows.length > 200 && (
          <p className="px-3 py-2 text-[11px] text-text-tertiary border-t border-border">
            Showing first 200 of {preview.rows.length} rows.
          </p>
        )}
      </div>
    </div>
  );
}
