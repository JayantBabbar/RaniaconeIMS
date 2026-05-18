"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { estimateService, routeService } from "@/services/estimates.service";
import { partyService } from "@/services/parties.service";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { PageLoading } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";
import { RequireRead } from "@/components/ui/forbidden-state";
import { formatDate } from "@/lib/utils";
import type { EstimatePrintMode } from "@/types";
import { ArrowLeft, Printer, Eye, EyeOff } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Estimate — Print view.
// Two modes (toggleable on screen, persisted at default in estimate):
//   - with_remarks  → shows unit price + line totals (billing copy)
//   - no_amount     → hides prices entirely (driver / customer copy)
// ═══════════════════════════════════════════════════════════════════

export default function EstimatePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const brand = useBranding();
  const { tenantName } = useAuth();

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", id],
    queryFn: () => estimateService.getById(id),
    enabled: !!id,
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["estimateLines", id],
    queryFn: () => estimateService.listLines(id),
    enabled: !!id,
  });
  const { data: party } = useQuery({
    queryKey: ["party", estimate?.party_id],
    queryFn: () => (estimate?.party_id ? partyService.getById(estimate.party_id) : null),
    enabled: !!estimate?.party_id,
  });
  const { data: route } = useQuery({
    queryKey: ["route", estimate?.route_id],
    queryFn: () => (estimate?.route_id ? routeService.getById(estimate.route_id) : null),
    enabled: !!estimate?.route_id,
  });

  const [mode, setMode] = useState<EstimatePrintMode>("no_amount");
  useEffect(() => {
    if (estimate) setMode(estimate.print_mode);
  }, [estimate]);

  useEffect(() => {
    document.title = estimate?.estimate_number
      ? `Estimate ${estimate.estimate_number}`
      : "Estimate";
  }, [estimate?.estimate_number]);

  if (isLoading || !estimate) return <PageLoading />;

  const showAmounts = mode === "with_remarks";
  const sellerName = tenantName || brand.name || "Company name";

  return (
    <RequireRead perm="inventory.estimates.read" crumbs={["Billing", "Estimates", estimate.estimate_number, "Print"]}>
    <div className="estimate-print-root">
      <div className="estimate-toolbar print-hidden">
        <Button onClick={() => router.back()} icon={<ArrowLeft size={13} />}>Back</Button>
        <Button
          onClick={() => setMode(mode === "with_remarks" ? "no_amount" : "with_remarks")}
          icon={mode === "with_remarks" ? <EyeOff size={13} /> : <Eye size={13} />}
        >
          {mode === "with_remarks" ? "Hide amounts" : "Show amounts"}
        </Button>
        <Button kind="primary" icon={<Printer size={13} />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <article className="estimate-paper" aria-label={`Delivery estimate ${estimate.estimate_number}`}>
        <header className="cp-head">
          <div>
            <div className="cp-eyebrow">Delivery Estimate</div>
            <h1 className="cp-seller">{sellerName}</h1>
            <div className="cp-seller-meta">
              {!showAmounts && <div className="cp-mode-tag">Driver / Customer copy · Amounts withheld</div>}
              {showAmounts && <div className="cp-mode-tag cp-mode-billing">Billing copy · Amounts shown</div>}
            </div>
          </div>
          <div className="cp-doc-meta">
            <div className="cp-doc-num">{estimate.estimate_number}</div>
            <dl className="cp-meta-grid">
              <Meta label="Estimate date" value={formatDate(estimate.estimate_date)} mono />
              {route && <Meta label="Route" value={`${route.code} · ${route.name}`} />}
              <Meta label="Status" value={estimate.status.toUpperCase()} />
              <Meta label="Bill toggle" value={estimate.is_billed ? "INVOICED" : "NO INVOICE"} />
            </dl>
          </div>
        </header>

        <section className="cp-billto">
          <div className="cp-section-label">Deliver to</div>
          <div className="cp-billto-name">{party?.name || estimate.party_id}</div>
          {party?.legal_name && <div className="cp-billto-legal">{party.legal_name}</div>}
          {estimate.destination_address && (
            <div className="cp-billto-address">{estimate.destination_address}</div>
          )}
        </section>

        {(estimate.vehicle_number || estimate.driver_name) && (
          <section className="cp-dispatch">
            <div className="cp-section-label">Dispatch</div>
            <div className="cp-dispatch-row">
              {estimate.vehicle_number && <span><strong>Vehicle:</strong> <span className="cp-mono">{estimate.vehicle_number}</span></span>}
              {estimate.driver_name && <span><strong>Driver:</strong> {estimate.driver_name}</span>}
              {estimate.driver_phone && <span className="cp-mono">{estimate.driver_phone}</span>}
            </div>
          </section>
        )}

        <table className="cp-lines">
          <thead>
            <tr>
              <th className="cp-num">#</th>
              <th>Item</th>
              <th className="cp-num">Qty</th>
              {showAmounts && <th className="cp-num">Unit price</th>}
              {showAmounts && <th className="cp-num">Disc %</th>}
              {showAmounts && <th className="cp-num">Line total</th>}
              {!showAmounts && <th>Remarks</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="cp-num">{l.line_number}</td>
                <td>{l.description}</td>
                <td className="cp-num cp-mono">{l.quantity}</td>
                {showAmounts && <td className="cp-num cp-mono">{l.unit_price}</td>}
                {showAmounts && <td className="cp-num cp-mono">{l.discount_pct}</td>}
                {showAmounts && <td className="cp-num cp-mono cp-line-total">{l.line_total}</td>}
                {!showAmounts && <td className="cp-remarks">{l.remarks || ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {showAmounts && (
          <section className="cp-totals">
            <TotalRow label="Sub-total" value={estimate.subtotal} />
            {parseFloat(estimate.discount_total) > 0 && <TotalRow label="Discount" value={estimate.discount_total} />}
            <TotalRow label="Grand total" value={`₹ ${estimate.grand_total}`} bold />
            <div className="cp-tax-note">
              Estimate is not a tax invoice. GST will be added on the linked invoice.
            </div>
          </section>
        )}

        <footer className="cp-footer">
          <div className="cp-receiver">
            <div className="cp-sign-line" aria-hidden="true" />
            <div className="cp-sign-label">Receiver's signature &amp; stamp</div>
          </div>
          <div className="cp-issuer">
            <div className="cp-sign-line" aria-hidden="true" />
            <div className="cp-sign-label">For {sellerName}</div>
          </div>
        </footer>
      </article>

      <style jsx>{`
        .estimate-print-root {
          min-height: 100vh;
          background: var(--color-surface);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .estimate-toolbar {
          width: 100%;
          max-width: 800px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .estimate-paper {
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
        .cp-head {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          padding-bottom: 18px;
          border-bottom: 2px solid #1a1a1a;
          margin-bottom: 18px;
        }
        .cp-eyebrow {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 4px;
        }
        .cp-seller {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .cp-mode-tag {
          display: inline-block;
          font-size: 10px;
          letter-spacing: 0.04em;
          padding: 2px 8px;
          border-radius: 999px;
          background: #fff3e0;
          color: #b25b00;
          margin-top: 4px;
          font-weight: 500;
        }
        .cp-mode-billing {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .cp-doc-meta {
          text-align: right;
          min-width: 220px;
        }
        .cp-doc-num {
          font-size: 18px;
          font-weight: 600;
          font-family: var(--font-mono);
          margin-bottom: 6px;
        }
        :global(.cp-meta-grid) {
          display: grid;
          grid-template-columns: auto auto;
          gap: 4px 12px;
          margin: 0;
          font-size: 11px;
        }
        .cp-billto, .cp-dispatch {
          margin-bottom: 14px;
          padding: 10px 12px;
          background: #fafafa;
          border-radius: 4px;
        }
        .cp-section-label {
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .cp-billto-name {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .cp-billto-legal { font-size: 11px; color: #555; margin-bottom: 4px; }
        .cp-billto-address { font-size: 11px; color: #555; white-space: pre-line; }
        .cp-dispatch-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 11px;
          color: #444;
        }
        .cp-mono { font-family: var(--font-mono); font-feature-settings: "tnum"; }
        .cp-lines {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 11px;
        }
        .cp-lines thead th {
          text-align: left;
          padding: 6px 8px;
          background: #1a1a1a;
          color: white;
          font-weight: 500;
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .cp-lines td {
          padding: 7px 8px;
          border-bottom: 1px solid #eaeaea;
        }
        .cp-num { text-align: right; }
        .cp-line-total { font-weight: 600; }
        .cp-remarks { font-style: italic; color: #777; font-size: 10px; }
        :global(.cp-totals) {
          margin-bottom: 18px;
          padding: 10px 14px;
          background: #fafafa;
          border-radius: 4px;
          max-width: 320px;
          margin-left: auto;
        }
        .cp-tax-note {
          font-size: 10px;
          color: #888;
          font-style: italic;
          padding-top: 6px;
          margin-top: 4px;
          border-top: 1px solid #e0e0e0;
        }
        .cp-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          margin-top: 36px;
        }
        .cp-receiver, .cp-issuer {
          text-align: center;
          padding-top: 32px;
        }
        .cp-sign-line {
          height: 1px;
          background: #aaa;
          margin-bottom: 4px;
        }
        .cp-sign-label {
          font-size: 10px;
          color: #555;
        }

        @media print {
          .estimate-print-root {
            background: white;
            padding: 0;
          }
          .estimate-paper {
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
      <span style={{ fontFamily: "var(--font-mono)", fontFeatureSettings: '"tnum"' }}>{value}</span>
    </div>
  );
}
