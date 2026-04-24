"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { documentService } from "@/services/documents.service";
import { itemService } from "@/services/items.service";
import { partyService } from "@/services/parties.service";
import { locationService } from "@/services/locations.service";
import { useBranding } from "@/providers/branding-provider";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/shared";
import { unwrapList, formatDate } from "@/lib/utils";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Printer, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// S-59: Document print / export view
//
// A clean, print-ready layout of a single document (header + lines +
// totals). Uses @media print to hide the chrome so the page prints
// straight to PDF with just the document content.
// ═══════════════════════════════════════════════════════════════════

export default function DocumentPrintPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireRead perm="inventory.documents.read" crumbs={["Documents"]}>
      <DocumentPrintView documentId={id} />
    </RequireRead>
  );
}

function DocumentPrintView({ documentId }: { documentId: string }) {
  const router = useRouter();
  const brand = useBranding();
  const { tenantName } = useAuth();

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentService.getById(documentId),
    enabled: !!documentId,
  });

  const { data: linesRaw } = useQuery({
    queryKey: ["document-lines", documentId],
    queryFn: () => documentService.listLines(documentId),
    enabled: !!documentId,
  });
  const lines = unwrapList(linesRaw);

  const { data: itemsRaw } = useQuery({
    queryKey: ["items-for-print"],
    queryFn: () => itemService.list({ limit: 200 }),
  });
  const itemMap = new Map(
    (itemsRaw?.data || []).map((i) => [i.id, i] as const),
  );

  const { data: partyRaw } = useQuery({
    queryKey: ["party-for-print", doc?.party_id],
    enabled: !!doc?.party_id,
    queryFn: () => partyService.getById(doc!.party_id!),
  });

  const { data: locationsRaw } = useQuery({
    queryKey: ["locations-for-print"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const locMap = new Map(
    (locationsRaw?.data || []).map((l) => [l.id, l] as const),
  );

  // Auto-set the page title so browser print dialogs show a useful filename.
  useEffect(() => {
    if (doc) {
      const prev = document.title;
      document.title = `${doc.document_number} · ${brand.name}`;
      return () => {
        document.title = prev;
      };
    }
  }, [doc, brand.name]);

  if (isLoading || !doc) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  const sourceLoc = doc.source_location_id
    ? locMap.get(doc.source_location_id)
    : null;
  const destLoc = doc.destination_location_id
    ? locMap.get(doc.destination_location_id)
    : null;

  // Compute totals from lines.
  const subtotal = lines.reduce(
    (s, l) => s + Number(l.line_total ?? 0),
    0,
  );
  const totalTax = lines.reduce(
    (s, l) => s + Number(l.tax_amount ?? 0),
    0,
  );
  const totalQty = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);

  const status = doc.posting_date ? "Posted" : "Draft";
  const Logo = brand.LogoMark;

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      {/* Screen-only chrome — hidden from the printed page */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-hairline px-5 h-12 flex items-center gap-3">
        <Button
          icon={<ArrowLeft size={13} />}
          onClick={() => router.push(`/documents/detail/${documentId}`)}
        >
          Back to document
        </Button>
        <div className="flex-1" />
        <div className="text-xs text-foreground-secondary">
          Preview • use browser Print to export as PDF
        </div>
        <Button
          kind="primary"
          icon={<Printer size={13} />}
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </Button>
      </div>

      {/* Printable sheet */}
      <div className="max-w-[800px] mx-auto bg-white p-8 mt-5 mb-10 shadow-card print:shadow-none print:mt-0 print:mb-0 print:max-w-full print:p-6">
        {/* Masthead */}
        <div className="flex items-start justify-between border-b border-hairline pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-brand flex items-center justify-center text-white">
              <Logo width="20" height="20" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight">{brand.name}</div>
              <div className="text-sm text-foreground-secondary">
                {tenantName || "Workspace"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted">
              Document
            </div>
            <div className="text-2xl font-semibold tracking-tight mt-0.5">
              {doc.document_number}
            </div>
            <div
              className={
                "inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium " +
                (status === "Posted"
                  ? "bg-status-green-bg text-status-green-text"
                  : "bg-status-gray-bg text-status-gray-text")
              }
            >
              {status}
            </div>
          </div>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm mb-6">
          <div className="space-y-2">
            {doc.document_date && (
              <Field label="Document date" value={doc.document_date} />
            )}
            {doc.posting_date && (
              <Field label="Posted on" value={formatDate(doc.posting_date)} />
            )}
            {partyRaw && (
              <Field
                label="Party"
                value={partyRaw.name}
                secondary={partyRaw.legal_name || partyRaw.code}
              />
            )}
          </div>
          <div className="space-y-2">
            {sourceLoc && (
              <Field
                label="From"
                value={sourceLoc.name}
                secondary={sourceLoc.code}
              />
            )}
            {destLoc && (
              <Field
                label="To"
                value={destLoc.name}
                secondary={destLoc.code}
              />
            )}
            {doc.remarks && <Field label="Remarks" value={doc.remarks} />}
          </div>
        </div>

        {/* Lines */}
        <div className="border-t border-b border-hairline">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider bg-surface print:bg-white">
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2 w-20">Qty</th>
                <th className="text-right px-3 py-2 w-24">Unit price</th>
                <th className="text-right px-3 py-2 w-20">Tax</th>
                <th className="text-right px-3 py-2 w-24">Line total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-sm text-foreground-muted"
                  >
                    No lines on this document.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const item = itemMap.get(line.item_id);
                  return (
                    <tr
                      key={line.id}
                      className="border-t border-hairline-light align-top"
                    >
                      <td className="px-3 py-2 text-foreground-muted tabular-nums">
                        {line.line_number}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item?.name || "—"}</div>
                        <div className="text-[10.5px] text-foreground-muted font-mono">
                          {item?.item_code}
                        </div>
                        {line.remarks && (
                          <div className="text-[11px] text-foreground-secondary mt-0.5">
                            {line.remarks}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(line.unit_price ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(line.tax_amount ?? 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {Number(line.line_total ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between text-foreground-secondary">
              <span>Total quantity</span>
              <span className="tabular-nums">{totalQty}</span>
            </div>
            <div className="flex justify-between text-foreground-secondary">
              <span>Subtotal</span>
              <span className="tabular-nums">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-foreground-secondary">
              <span>Tax</span>
              <span className="tabular-nums">{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-hairline font-semibold">
              <span>Grand total</span>
              <span className="tabular-nums">
                {(subtotal + totalTax).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-hairline text-[10.5px] text-foreground-muted flex items-center justify-between">
          <span>
            {brand.name} · {tenantName || "Workspace"} · Generated{" "}
            {new Date().toLocaleString()}
          </span>
          <span className="font-mono">{doc.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 12mm;
            size: A4 portrait;
          }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
      {secondary && (
        <div className="text-[11px] text-foreground-secondary font-mono">
          {secondary}
        </div>
      )}
    </div>
  );
}
