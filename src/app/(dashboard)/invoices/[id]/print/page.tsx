"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { invoiceService } from "@/services/invoices.service";
import { partyService } from "@/services/parties.service";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { PageLoading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { RequireRead } from "@/components/ui/forbidden-state";
import { formatDate } from "@/lib/utils";
import { stateName, amountInWords } from "@/lib/gst";
import { ArrowLeft, Printer } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Invoice — Print view.
// Single-page A4 layout that prints cleanly. The screen-only chrome
// (back button, Print CTA) is hidden in print via @media print.
// ═══════════════════════════════════════════════════════════════════

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const brand = useBranding();
  const { tenantName } = useAuth();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceService.getById(id),
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["invoiceLines", id],
    queryFn: () => invoiceService.listLines(id),
    enabled: !!id,
  });

  const { data: party } = useQuery({
    queryKey: ["party", invoice?.party_id],
    queryFn: () => (invoice?.party_id ? partyService.getById(invoice.party_id) : null),
    enabled: !!invoice?.party_id,
  });

  // Auto-focus → user hits Cmd/Ctrl+P. We don't auto-trigger print
  // (annoying); we just keep the chrome out of the way.
  useEffect(() => {
    document.title = invoice?.invoice_number
      ? `Invoice ${invoice.invoice_number}`
      : "Invoice";
  }, [invoice?.invoice_number]);

  if (isLoading || !invoice) return <PageLoading />;

  const cgstTotal = lines.reduce((s, l) => s + parseFloat(l.cgst_amount || "0"), 0);
  const sgstTotal = lines.reduce((s, l) => s + parseFloat(l.sgst_amount || "0"), 0);
  const igstTotal = lines.reduce((s, l) => s + parseFloat(l.igst_amount || "0"), 0);
  const cessTotal = lines.reduce((s, l) => s + parseFloat(l.cess_amount || "0"), 0);
  const isInterState = igstTotal > 0;

  const sellerName = tenantName || brand.name || "Company name";

  return (
    <RequireRead perm="inventory.invoices.read" crumbs={["Billing", "Invoices", invoice.invoice_number, "Print"]}>
    <div className="invoice-print-root">
      {/* Screen-only toolbar */}
      <div className="invoice-toolbar print-hidden">
        <Button onClick={() => router.back()} icon={<ArrowLeft size={13} />}>Back</Button>
        <Button kind="primary" icon={<Printer size={13} />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <article className="invoice-paper" aria-label={`Tax invoice ${invoice.invoice_number}`}>
        {/* ─── Header ────────────────────────────────────── */}
        <header className="ip-head">
          <div>
            <div className="ip-eyebrow">Tax Invoice</div>
            <h1 className="ip-seller">{sellerName}</h1>
            <div className="ip-seller-meta">
              <div>State of supply: <strong>{stateName("27")}</strong> (27)</div>
              <div>Tenant GSTIN: <span className="ip-mono">27AAACA0001Z1Z5</span></div>
            </div>
          </div>
          <div className="ip-doc-meta">
            <div className="ip-doc-num">{invoice.invoice_number}</div>
            <dl className="ip-meta-grid">
              <Meta label="Invoice date" value={formatDate(invoice.invoice_date)} mono />
              {invoice.due_date && <Meta label="Due date" value={formatDate(invoice.due_date)} mono />}
              <Meta label="Place of supply" value={`${stateName(invoice.place_of_supply)} (${invoice.place_of_supply})`} />
              <Meta label="Status" value={invoice.status.toUpperCase()} />
            </dl>
          </div>
        </header>

        {/* ─── Bill to ───────────────────────────────────── */}
        <section className="ip-billto">
          <div className="ip-section-label">Bill to</div>
          <div className="ip-billto-name">{party?.name || invoice.party_id}</div>
          {party?.legal_name && <div className="ip-billto-legal">{party.legal_name}</div>}
          <div className="ip-billto-meta">
            {party?.gstin ? (
              <>GSTIN: <span className="ip-mono">{party.gstin}</span></>
            ) : (
              <>Unregistered (Bill of Supply rules apply if seller is composition)</>
            )}
            {party?.state_code && (
              <> · State: <strong>{stateName(party.state_code)}</strong> ({party.state_code})</>
            )}
          </div>
        </section>

        {/* ─── Lines ─────────────────────────────────────── */}
        <table className="ip-lines">
          <thead>
            <tr>
              <th className="ip-num">#</th>
              <th>Item</th>
              <th>HSN</th>
              <th className="ip-num">Qty</th>
              <th className="ip-num">Rate</th>
              <th className="ip-num">Taxable</th>
              {isInterState ? (
                <th className="ip-num">IGST</th>
              ) : (
                <>
                  <th className="ip-num">CGST</th>
                  <th className="ip-num">SGST</th>
                </>
              )}
              <th className="ip-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="ip-num">{l.line_number}</td>
                <td>{l.description}</td>
                <td className="ip-mono">{l.hsn_code}</td>
                <td className="ip-num ip-mono">{l.quantity}</td>
                <td className="ip-num ip-mono">{l.unit_price}</td>
                <td className="ip-num ip-mono">{l.taxable_value}</td>
                {isInterState ? (
                  <td className="ip-num ip-mono">
                    {l.igst_amount}
                    <span className="ip-rate"> @ {l.rate_pct}%</span>
                  </td>
                ) : (
                  <>
                    <td className="ip-num ip-mono">
                      {l.cgst_amount}
                      <span className="ip-rate"> @ {(parseFloat(l.rate_pct) / 2).toFixed(1)}%</span>
                    </td>
                    <td className="ip-num ip-mono">
                      {l.sgst_amount}
                      <span className="ip-rate"> @ {(parseFloat(l.rate_pct) / 2).toFixed(1)}%</span>
                    </td>
                  </>
                )}
                <td className="ip-num ip-mono ip-line-total">{l.line_total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── Totals ────────────────────────────────────── */}
        <section className="ip-totals-row">
          <div className="ip-words">
            <div className="ip-section-label">Amount in words</div>
            <div className="ip-words-body">{invoice.amount_in_words || amountInWords(invoice.grand_total)}</div>
          </div>
          <dl className="ip-totals">
            <TotalRow label="Sub-total" value={invoice.subtotal} />
            {!isInterState && cgstTotal > 0 && <TotalRow label="CGST" value={cgstTotal.toFixed(2)} />}
            {!isInterState && sgstTotal > 0 && <TotalRow label="SGST" value={sgstTotal.toFixed(2)} />}
            {isInterState && igstTotal > 0 && <TotalRow label="IGST" value={igstTotal.toFixed(2)} />}
            {cessTotal > 0 && <TotalRow label="Cess" value={cessTotal.toFixed(2)} />}
            <TotalRow label="Total tax" value={invoice.tax_total} />
            <TotalRow label="Grand total" value={`₹ ${invoice.grand_total}`} bold />
          </dl>
        </section>

        {/* ─── Footer ────────────────────────────────────── */}
        <footer className="ip-footer">
          {invoice.remarks && (
            <div className="ip-remarks">
              <div className="ip-section-label">Remarks</div>
              <div>{invoice.remarks}</div>
            </div>
          )}
          <div className="ip-sign">
            <div className="ip-sign-line" aria-hidden="true" />
            <div className="ip-sign-label">Authorised signatory · {sellerName}</div>
          </div>
        </footer>
      </article>

      <style jsx>{`
        .invoice-print-root {
          min-height: 100vh;
          background: var(--color-surface);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .invoice-toolbar {
          width: 100%;
          max-width: 800px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .invoice-paper {
          background: white;
          color: #1a1a1a;
          width: 100%;
          max-width: 800px;
          padding: 36px 40px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 12px;
          line-height: 1.4;
        }
        .ip-head {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          padding-bottom: 18px;
          border-bottom: 2px solid #1a1a1a;
          margin-bottom: 18px;
        }
        .ip-eyebrow {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 4px;
        }
        .ip-seller {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .ip-seller-meta {
          font-size: 11px;
          color: #555;
          line-height: 1.6;
        }
        .ip-doc-meta {
          text-align: right;
          min-width: 220px;
        }
        .ip-doc-num {
          font-size: 18px;
          font-weight: 600;
          font-family: var(--font-mono);
          margin-bottom: 6px;
        }
        :global(.ip-meta-grid) {
          display: grid;
          grid-template-columns: auto auto;
          gap: 4px 12px;
          margin: 0;
          font-size: 11px;
        }
        .ip-billto {
          margin-bottom: 18px;
          padding: 10px 12px;
          background: #fafafa;
          border-radius: 4px;
        }
        .ip-section-label {
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .ip-billto-name {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .ip-billto-legal {
          font-size: 11px;
          color: #555;
          margin-bottom: 4px;
        }
        .ip-billto-meta {
          font-size: 11px;
          color: #555;
        }
        .ip-mono {
          font-family: var(--font-mono);
          font-feature-settings: "tnum";
        }
        .ip-lines {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 11px;
        }
        .ip-lines thead th {
          text-align: left;
          padding: 6px 8px;
          background: #1a1a1a;
          color: white;
          font-weight: 500;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .ip-lines td {
          padding: 7px 8px;
          border-bottom: 1px solid #eaeaea;
        }
        .ip-num {
          text-align: right;
        }
        .ip-line-total {
          font-weight: 600;
        }
        .ip-rate {
          color: #888;
          font-size: 9px;
          font-weight: 400;
        }
        .ip-totals-row {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          margin-bottom: 18px;
        }
        .ip-words {
          padding: 10px 12px;
          background: #fafafa;
          border-radius: 4px;
        }
        .ip-words-body {
          font-size: 12px;
          line-height: 1.5;
          font-style: italic;
          color: #333;
        }
        :global(.ip-totals) {
          margin: 0;
          font-size: 12px;
        }
        .ip-footer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
          padding-top: 16px;
          border-top: 1px solid #eaeaea;
        }
        .ip-remarks {
          font-size: 11px;
          color: #555;
          max-width: 380px;
        }
        .ip-sign {
          text-align: center;
          width: 220px;
          padding-top: 28px;
        }
        .ip-sign-line {
          height: 1px;
          background: #aaa;
          margin-bottom: 4px;
        }
        .ip-sign-label {
          font-size: 10px;
          color: #555;
        }
        .print-hidden {
          /* shown on screen; hidden when printing */
        }

        @media print {
          .invoice-print-root {
            background: white;
            padding: 0;
          }
          .invoice-paper {
            box-shadow: none;
            border-radius: 0;
            padding: 16mm 14mm;
            max-width: none;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
    </RequireRead>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt style={{ color: "#666", fontSize: 10, textAlign: "right" }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          fontWeight: 500,
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </dd>
    </>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        borderTop: bold ? "2px solid #1a1a1a" : "none",
        marginTop: bold ? 4 : 0,
        paddingTop: bold ? 8 : 4,
        fontWeight: bold ? 700 : 400,
        fontSize: bold ? 14 : 12,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontFeatureSettings: '"tnum"' }}>
        {value}
      </span>
    </div>
  );
}
