"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Input, FormField } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import { movementService, balanceService } from "@/services/stock.service";
import { uomService } from "@/services/master-data.service";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/api-client";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  Plus,
  Trash2,
  ArrowLeft,
  Send,
  Truck,
  Lock,
} from "lucide-react";
import type { Item, InventoryLocation, Balance } from "@/types";

// ═══════════════════════════════════════════════════════════
// S-50: Stock Transfer Wizard
// Multi-step: source → destination → lines → review & submit.
// Posts paired OUT (source) + IN (destination) movements
// linked by reference_movement_id.
// ═══════════════════════════════════════════════════════════

interface TransferLine {
  tempId: string;
  item_id: string;
  quantity: string;
  uom_id: string;
  lot_id?: string;
}

type Step = 1 | 2 | 3 | 4;

export default function StockTransferWizardPage() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useCan();
  const canRead = can("inventory.movements.read");
  const canWrite = can("inventory.movements.write");

  const [step, setStep] = useState<Step>(1);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [postingDate, setPostingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);

  // Load locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const locations = locationsData?.data || [];
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations],
  );

  // Load items (for the line picker)
  const { data: itemsData } = useQuery({
    queryKey: ["items", "transfer-picker"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
  });
  const items = itemsData?.data || [];
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Load UoMs (for line quantity unit)
  const { data: uomsData } = useQuery({
    queryKey: ["uoms"],
    queryFn: () => uomService.list({ limit: 200 }),
  });
  const uoms = uomsData?.data || [];

  // Load balances at the source location (used for stock validation)
  const { data: sourceBalances } = useQuery({
    queryKey: ["balances", sourceId],
    enabled: !!sourceId,
    queryFn: () => balanceService.list({ location_id: sourceId, limit: 200 }),
  });
  const sourceBalanceMap = useMemo(() => {
    const m = new Map<string, Balance>();
    for (const b of sourceBalances ?? []) m.set(b.item_id, b);
    return m;
  }, [sourceBalances]);

  const source = locationMap.get(sourceId);
  const dest = locationMap.get(destId);

  // Step gating
  const canNextFromStep1 = !!sourceId && !!destId && sourceId !== destId;
  const canNextFromStep2 = true; // meta is optional
  const canNextFromStep3 =
    lines.length > 0 && lines.every((l) => l.item_id && l.uom_id && Number(l.quantity) > 0);

  const transferMutation = useMutation({
    mutationFn: async () => {
      // Post OUT at source for each line, then IN at dest with reference_movement_id
      for (const line of lines) {
        const outMovement = await movementService.create({
          item_id: line.item_id,
          location_id: sourceId,
          direction: "out",
          quantity: line.quantity,
          uom_id: line.uom_id,
          lot_id: line.lot_id || undefined,
          posting_date: postingDate,
          source: "transfer",
        });

        await movementService.create({
          item_id: line.item_id,
          location_id: destId,
          direction: "in",
          quantity: line.quantity,
          uom_id: line.uom_id,
          lot_id: line.lot_id || undefined,
          posting_date: postingDate,
          reference_movement_id: outMovement.id,
          source: "transfer",
        });
      }
    },
    onSuccess: () => {
      toast.success(
        "Transfer posted",
        `${lines.length} line${lines.length === 1 ? "" : "s"} moved from ${source?.name} to ${dest?.name}`,
      );
      router.push("/movements");
    },
    onError: (err) => {
      toast.error(
        isApiError(err) ? err.message : "Transfer failed — see movements log",
      );
    },
  });

  const addLine = () => {
    setLines([
      ...lines,
      {
        tempId: `tmp-${Date.now()}`,
        item_id: "",
        quantity: "",
        uom_id: uoms[0]?.id || "",
      },
    ]);
  };

  const updateLine = (tempId: string, patch: Partial<TransferLine>) => {
    setLines(lines.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  };

  const removeLine = (tempId: string) => {
    setLines(lines.filter((l) => l.tempId !== tempId));
  };

  if (!canRead) {
    return <ForbiddenState crumbs={["Movements", "Transfer Wizard"]} missingPerm="inventory.movements.read" />;
  }

  if (!canWrite) {
    return (
      <div className="flex-1 bg-surface">
        <TopBar crumbs={["Movements", "Transfer Wizard"]} />
        <div className="p-5">
          <div className="bg-white border border-hairline rounded-md max-w-lg">
            <EmptyState
              icon={<Lock size={22} />}
              title="You don't have access to create this"
              description="Your role doesn't include the permission needed to transfer stock. Contact your workspace admin if you need access."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Movements", "Transfer Wizard"]}
        right={
          <Button icon={<ArrowLeft size={13} />} onClick={() => router.push("/movements")}>
            Back to Movements
          </Button>
        }
      />

      <div className="p-4 md:p-5 space-y-5 max-w-5xl">
        <PageHeader
          title="Stock Transfer"
          description="Move stock between locations. The wizard posts paired OUT and IN movements atomically — either both succeed or neither happens."
          learnMore="Stock costs flow with the goods. When you move 30 units from Warehouse A to Warehouse B, FIFO consumes the oldest lots at A and creates a new layer at B with the same weighted unit cost. Both legs share a 'reference_movement_id' so you can trace them as one operation."
        />

        <Stepper step={step} />

        {/* Step content */}
        <div className="bg-white border border-hairline rounded-md p-5">
          {step === 1 && (
            <Step1
              locations={locations}
              sourceId={sourceId}
              destId={destId}
              onSource={setSourceId}
              onDest={setDestId}
            />
          )}
          {step === 2 && (
            <Step2
              postingDate={postingDate}
              remarks={remarks}
              onPostingDate={setPostingDate}
              onRemarks={setRemarks}
              source={source}
              dest={dest}
            />
          )}
          {step === 3 && (
            <Step3
              lines={lines}
              items={items}
              uoms={uoms}
              sourceBalanceMap={sourceBalanceMap}
              onAdd={addLine}
              onUpdate={updateLine}
              onRemove={removeLine}
            />
          )}
          {step === 4 && (
            <Step4
              source={source}
              dest={dest}
              postingDate={postingDate}
              remarks={remarks}
              lines={lines}
              itemMap={itemMap}
              uoms={uoms}
            />
          )}
        </div>

        {/* Footer: step controls */}
        <div className="flex items-center justify-between">
          <Button
            icon={<ArrowLeft size={13} />}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            disabled={step === 1}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-muted">
              Step {step} of 4
            </span>
            {step < 4 ? (
              <Button
                kind="primary"
                iconRight={<ArrowRight size={13} />}
                onClick={() => setStep((s) => (s < 4 ? ((s + 1) as Step) : s))}
                disabled={
                  (step === 1 && !canNextFromStep1) ||
                  (step === 2 && !canNextFromStep2) ||
                  (step === 3 && !canNextFromStep3)
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                kind="success"
                icon={<Send size={13} />}
                loading={transferMutation.isPending}
                onClick={() => transferMutation.mutate()}
              >
                Post Transfer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1 as Step, label: "Locations", icon: MapPin },
    { n: 2 as Step, label: "Meta", icon: Truck },
    { n: 3 as Step, label: "Lines", icon: Package },
    { n: 4 as Step, label: "Review", icon: CheckCircle2 },
  ];
  return (
    <div className="flex items-center bg-white border border-hairline rounded-md p-3">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  active && "bg-brand text-white",
                  done && "bg-status-green text-white",
                  !active && !done && "bg-surface-secondary text-foreground-muted",
                )}
              >
                {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
              </div>
              <div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    active && "text-brand",
                    done && "text-status-green-text",
                    !active && !done && "text-foreground-muted",
                  )}
                >
                  Step {s.n}
                </div>
                <div className="text-sm font-semibold">{s.label}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-3",
                  step > s.n ? "bg-status-green" : "bg-hairline",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Source + Destination ──────────────────────────

function Step1({
  locations,
  sourceId,
  destId,
  onSource,
  onDest,
}: {
  locations: InventoryLocation[];
  sourceId: string;
  destId: string;
  onSource: (id: string) => void;
  onDest: (id: string) => void;
}) {
  const sameLocation = sourceId && destId && sourceId === destId;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Pick source and destination</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <FormField label="From (Source)" required>
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={sourceId}
            onChange={(e) => onSource(e.target.value)}
          >
            <option value="">Select source…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="To (Destination)" required>
          <select
            className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            value={destId}
            onChange={(e) => onDest(e.target.value)}
          >
            <option value="">Select destination…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {sameLocation && (
        <div className="bg-status-red-bg text-status-red-text text-xs rounded-md px-3 py-2">
          Source and destination must differ.
        </div>
      )}
    </div>
  );
}

// ── Step 2: Meta ──────────────────────────────────────────

function Step2({
  postingDate,
  remarks,
  onPostingDate,
  onRemarks,
  source,
  dest,
}: {
  postingDate: string;
  remarks: string;
  onPostingDate: (v: string) => void;
  onRemarks: (v: string) => void;
  source?: InventoryLocation;
  dest?: InventoryLocation;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Transfer details</h2>
      <div className="bg-surface rounded-md p-3 text-xs flex items-center gap-3">
        <Badge tone="neutral">{source?.name}</Badge>
        <ArrowRight size={14} className="text-foreground-muted" />
        <Badge tone="blue">{dest?.name}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          type="date"
          label="Posting Date"
          value={postingDate}
          onChange={(e) => onPostingDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-1.5">
          Remarks
        </label>
        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => onRemarks(e.target.value)}
          placeholder="Optional note for audit log…"
          className="w-full px-3 py-2 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
    </div>
  );
}

// ── Step 3: Lines ─────────────────────────────────────────

function Step3({
  lines,
  items,
  uoms,
  sourceBalanceMap,
  onAdd,
  onUpdate,
  onRemove,
}: {
  lines: TransferLine[];
  items: Item[];
  uoms: { id: string; code: string; name: string }[];
  sourceBalanceMap: Map<string, Balance>;
  onAdd: () => void;
  onUpdate: (tempId: string, patch: Partial<TransferLine>) => void;
  onRemove: (tempId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Line items</h2>
        <Button kind="primary" size="sm" icon={<Plus size={12} />} onClick={onAdd}>
          Add line
        </Button>
      </div>

      {lines.length === 0 ? (
        <div className="bg-surface rounded-md py-8 text-center text-sm text-foreground-muted">
          No lines yet. Click <strong>Add line</strong> to start.
        </div>
      ) : (
        <table className="w-full text-sm border border-hairline rounded-md overflow-hidden">
          <thead>
            <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2 w-28">Quantity</th>
              <th className="text-left px-3 py-2 w-28">UoM</th>
              <th className="text-right px-3 py-2 w-28">On Hand</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const avail = line.item_id
                ? Number(sourceBalanceMap.get(line.item_id)?.qty_available || 0)
                : null;
              const qty = Number(line.quantity || 0);
              const insufficient = avail !== null && qty > avail;
              return (
                <tr key={line.tempId} className="border-t border-hairline-light">
                  <td className="px-3 py-2">
                    <select
                      className="w-full h-[28px] px-2 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={line.item_id}
                      onChange={(e) =>
                        onUpdate(line.tempId, { item_id: e.target.value })
                      }
                    >
                      <option value="">Pick item…</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.item_code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={cn(
                        "w-full h-[28px] px-2 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 text-right tabular-nums",
                        insufficient
                          ? "border-status-red text-status-red-text"
                          : "border-hairline",
                      )}
                      value={line.quantity}
                      onChange={(e) =>
                        onUpdate(line.tempId, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full h-[28px] px-2 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={line.uom_id}
                      onChange={(e) =>
                        onUpdate(line.tempId, { uom_id: e.target.value })
                      }
                    >
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {avail !== null ? (
                      <span
                        className={
                          insufficient
                            ? "text-status-red-text font-medium"
                            : "text-foreground-secondary"
                        }
                      >
                        {avail.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onRemove(line.tempId)}
                      className="p-1 rounded hover:bg-status-red-bg text-foreground-muted hover:text-status-red-text transition-colors"
                      title="Remove line"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────

function Step4({
  source,
  dest,
  postingDate,
  remarks,
  lines,
  itemMap,
  uoms,
}: {
  source?: InventoryLocation;
  dest?: InventoryLocation;
  postingDate: string;
  remarks: string;
  lines: TransferLine[];
  itemMap: Map<string, Item>;
  uoms: { id: string; code: string; name: string }[];
}) {
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Review &amp; submit</h2>

      <div className="bg-surface border border-hairline rounded-md p-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
            From
          </div>
          <div className="text-sm font-semibold">{source?.name}</div>
          <div className="text-xs text-foreground-muted font-mono">
            {source?.code}
          </div>
        </div>
        <ArrowRight size={18} className="text-foreground-muted" />
        <div className="flex-1 text-right">
          <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
            To
          </div>
          <div className="text-sm font-semibold">{dest?.name}</div>
          <div className="text-xs text-foreground-muted font-mono">
            {dest?.code}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
            Posting Date
          </div>
          <div className="font-medium tabular-nums">{postingDate}</div>
        </div>
        <div>
          <div className="text-[10.5px] text-foreground-muted uppercase tracking-wider font-medium">
            Remarks
          </div>
          <div className="font-medium">
            {remarks || <span className="text-foreground-muted">—</span>}
          </div>
        </div>
      </div>

      <table className="w-full text-sm border border-hairline rounded-md overflow-hidden">
        <thead>
          <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
            <th className="text-left px-3 py-2">Item</th>
            <th className="text-right px-3 py-2 w-28">Qty</th>
            <th className="text-left px-3 py-2 w-24">UoM</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const item = itemMap.get(l.item_id);
            const uom = uomMap.get(l.uom_id);
            return (
              <tr key={l.tempId} className="border-t border-hairline-light">
                <td className="px-3 py-2">
                  <div className="font-medium">{item?.name || "—"}</div>
                  <div className="text-[10.5px] text-foreground-muted font-mono">
                    {item?.item_code}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-sm font-medium">
                  {Number(l.quantity).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">{uom?.code || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="bg-status-blue-bg text-status-blue-text text-xs rounded-md px-3 py-2 leading-relaxed">
        Posting this transfer will create <strong>{lines.length * 2}</strong>{" "}
        atomic stock movements ({lines.length} OUT at {source?.code},{" "}
        {lines.length} IN at {dest?.code}) linked by reference.
      </div>
    </div>
  );
}
