"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Input, FormField } from "@/components/ui/form-elements";
import { RequireRead, ForbiddenState } from "@/components/ui/forbidden-state";
import { useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { itemService } from "@/services/items.service";
import { locationService } from "@/services/locations.service";
import { movementService, balanceService } from "@/services/stock.service";
import { uomService } from "@/services/master-data.service";
import { cn } from "@/lib/utils";
import { isApiError } from "@/lib/api-client";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeft,
  Save,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// S-43: Direct Stock Movement
//
// For ops teams who need to post a single IN or OUT without routing
// through a document. Examples: logging a write-off, a found-item
// adjustment, a shrinkage OUT. For a normal receive-a-PO or ship-an-SO
// flow, use the Documents page instead.
// ═══════════════════════════════════════════════════════════════════

const schema = z
  .object({
    direction: z.enum(["in", "out"]),
    item_id: z.string().min(1, "Pick an item"),
    location_id: z.string().min(1, "Pick a location"),
    uom_id: z.string().min(1, "Pick a unit"),
    quantity: z
      .string()
      .min(1, "Enter a quantity")
      .refine((v) => Number(v) > 0, "Quantity must be greater than zero"),
    unit_cost: z.string().optional().or(z.literal("")),
    posting_date: z.string().min(1, "Pick a date"),
    lot_id: z.string().optional().or(z.literal("")),
    serial_id: z.string().optional().or(z.literal("")),
    source: z.string().optional().or(z.literal("")),
    remarks: z.string().optional().or(z.literal("")),
  })
  .refine(
    (d) => d.direction === "out" || d.unit_cost === "" || Number(d.unit_cost) >= 0,
    { path: ["unit_cost"], message: "Unit cost must be zero or more" },
  );

type FormValues = z.infer<typeof schema>;

export default function NewMovementPage() {
  const { can } = useCan();
  const canWrite = can("inventory.movements.write");
  if (!canWrite) {
    return (
      <ForbiddenState
        crumbs={["Movements", "Post movement"]}
        missingPerm="inventory.movements.write"
        title="You can't post stock movements"
        description="Posting a direct stock movement changes inventory balances. Your role doesn't include the permission for this — ask an admin."
      />
    );
  }
  return (
    <RequireRead perm="inventory.movements.read" crumbs={["Movements", "Post movement"]}>
      <NewMovementForm />
    </RequireRead>
  );
}

function NewMovementForm() {
  const router = useRouter();
  const toast = useToast();

  const { data: itemsData } = useQuery({
    queryKey: ["items-for-movement"],
    queryFn: () => itemService.list({ limit: 200, is_active: true }),
  });
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });
  const { data: uomsData } = useQuery({
    queryKey: ["uoms"],
    queryFn: () => uomService.list({ limit: 200 }),
  });

  const items = itemsData?.data || [];
  const locations = locationsData?.data || [];
  const uoms = uomsData?.data || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "in",
      item_id: "",
      location_id: "",
      uom_id: "",
      quantity: "",
      unit_cost: "",
      posting_date: new Date().toISOString().slice(0, 10),
      lot_id: "",
      serial_id: "",
      source: "manual",
      remarks: "",
    },
  });

  const direction = watch("direction");
  const itemId = watch("item_id");
  const locationId = watch("location_id");

  // Auto-pick the item's base UoM when an item is chosen.
  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId),
    [items, itemId],
  );
  React.useEffect(() => {
    if (selectedItem?.base_uom_id) {
      setValue("uom_id", selectedItem.base_uom_id, { shouldValidate: false });
    }
  }, [selectedItem, setValue]);

  // Available stock hint when direction=out so the user doesn't over-ship.
  const { data: availableQty } = useQuery({
    queryKey: ["balance-for-movement", itemId, locationId],
    enabled: !!(itemId && locationId && direction === "out"),
    queryFn: async () => {
      const res = await balanceService.list({
        item_id: itemId,
        location_id: locationId,
        limit: 1,
      });
      const first = res[0];
      return first ? Number(first.qty_available) : 0;
    },
  });

  const submit = async (data: FormValues) => {
    try {
      await movementService.create({
        item_id: data.item_id,
        location_id: data.location_id,
        direction: data.direction,
        quantity: data.quantity,
        uom_id: data.uom_id,
        unit_cost: data.unit_cost ? data.unit_cost : undefined,
        posting_date: new Date(data.posting_date + "T00:00:00Z").toISOString(),
        lot_id: data.lot_id || undefined,
        serial_id: data.serial_id || undefined,
        source: data.source || "manual",
      });
      toast.success(
        "Movement posted",
        `${direction === "in" ? "IN" : "OUT"} ${data.quantity} of ${
          selectedItem?.name || "item"
        } at ${locations.find((l) => l.id === data.location_id)?.name || ""}`,
      );
      router.push("/movements");
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "INSUFFICIENT_STOCK") {
          setError("quantity", {
            message: `Only ${availableQty ?? 0} available at this location.`,
          });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          for (const [field, msg] of Object.entries(err.fieldErrors)) {
            setError(field as keyof FormValues, { message: msg });
          }
        } else {
          toast.apiError(err);
        }
      } else {
        toast.apiError(err);
      }
    }
  };

  const insufficient =
    direction === "out" &&
    availableQty !== undefined &&
    Number(watch("quantity") || 0) > availableQty;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Inventory", "Movements", "Post movement"]}
        right={
          <Button
            icon={<ArrowLeft size={13} />}
            onClick={() => router.push("/movements")}
          >
            Back
          </Button>
        }
      />

      <div className="p-5 max-w-3xl space-y-5">
        <PageHeader
          title="Post a direct stock movement"
          description="For adjustments, write-offs, or one-off moves that don't flow through a Purchase Order / Sales Order / Transfer. Balances update immediately."
          learnMore="Every movement is permanent — you can't edit or delete it. If you make a mistake, post the reverse movement (OUT for an IN, or vice versa). For normal receiving or shipping, use the Documents pages instead — they also track parties and line prices."
        />

        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="bg-white border border-hairline rounded-md p-5 space-y-4"
        >
          {/* Direction tabs */}
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted mb-1.5">
              Direction <span className="text-status-red">*</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setValue("direction", "in", { shouldValidate: true })
                }
                className={cn(
                  "border rounded-md p-3 text-left transition-colors",
                  direction === "in"
                    ? "border-status-green bg-status-green-bg"
                    : "border-hairline bg-white hover:bg-surface",
                )}
              >
                <div className="flex items-center gap-2">
                  <ArrowDownToLine
                    size={16}
                    className={
                      direction === "in"
                        ? "text-status-green"
                        : "text-foreground-muted"
                    }
                  />
                  <span className="font-semibold text-sm">Stock IN</span>
                </div>
                <div className="text-[11.5px] text-foreground-secondary mt-1">
                  Adds to on-hand. Creates a FIFO valuation layer.
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setValue("direction", "out", { shouldValidate: true })
                }
                className={cn(
                  "border rounded-md p-3 text-left transition-colors",
                  direction === "out"
                    ? "border-status-red bg-status-red-bg"
                    : "border-hairline bg-white hover:bg-surface",
                )}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine
                    size={16}
                    className={
                      direction === "out"
                        ? "text-status-red"
                        : "text-foreground-muted"
                    }
                  />
                  <span className="font-semibold text-sm">Stock OUT</span>
                </div>
                <div className="text-[11.5px] text-foreground-secondary mt-1">
                  Removes from on-hand. Consumes oldest FIFO layers first.
                </div>
              </button>
            </div>
          </div>

          {/* Item + location */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Item"
              required
              help="The SKU being moved. Only active items show up."
              error={errors.item_id?.message}
            >
              <select
                className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                {...register("item_id")}
              >
                <option value="">Pick an item…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.item_code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Location"
              required
              help="The warehouse / zone / bin this movement happens at."
              error={errors.location_id?.message}
            >
              <select
                className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                {...register("location_id")}
              >
                <option value="">Pick a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Quantity + UoM */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Quantity"
              type="number"
              min="0"
              step="any"
              required
              placeholder="0"
              error={errors.quantity?.message}
              {...register("quantity")}
            />

            <FormField
              label="Unit"
              required
              help="Defaults to the item's base UoM. Change to another UoM defined on the item (receiving in boxes, for example)."
              error={errors.uom_id?.message}
            >
              <select
                className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                {...register("uom_id")}
              >
                <option value="">Pick a unit…</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </FormField>

            <Input
              label={direction === "in" ? "Unit cost" : "Unit cost (optional)"}
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.00"
              help={
                direction === "in"
                  ? "The cost per unit. Creates the FIFO valuation layer at this price."
                  : "For OUT, the unit cost is computed by FIFO consumption — this field is ignored."
              }
              hint={
                direction === "out" ? "Ignored for OUT movements" : undefined
              }
              disabled={direction === "out"}
              error={errors.unit_cost?.message}
              {...register("unit_cost")}
            />
          </div>

          {direction === "out" &&
            itemId &&
            locationId &&
            availableQty !== undefined && (
              <div
                className={cn(
                  "px-3 py-2 rounded-md text-[11.5px] leading-relaxed",
                  insufficient
                    ? "bg-status-red-bg text-status-red-text"
                    : "bg-status-green-bg text-status-green-text",
                )}
              >
                {insufficient ? (
                  <>
                    <strong>Insufficient stock:</strong> only {availableQty} available at
                    this location.
                  </>
                ) : (
                  <>
                    <strong>Available:</strong> {availableQty} units at this location
                    right now.
                  </>
                )}
              </div>
            )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Posting date"
              type="date"
              required
              error={errors.posting_date?.message}
              {...register("posting_date")}
            />
            <Input
              label="Source"
              placeholder="manual"
              hint="Free-text tag that shows on the movement ledger"
              help="Used to label this movement's origin — e.g. 'manual', 'write-off', 'damage', 'cycle-count'. Defaults to 'manual'."
              error={errors.source?.message}
              {...register("source")}
            />
          </div>

          {selectedItem?.is_batch_tracked && (
            <Input
              label="Lot ID"
              placeholder="UUID of the lot"
              hint="Required if this item is batch-tracked"
              help="The specific lot being moved. If blank, the backend may reject with a 422."
              error={errors.lot_id?.message}
              {...register("lot_id")}
            />
          )}

          {selectedItem?.is_serial_tracked && (
            <Input
              label="Serial ID"
              placeholder="UUID of the serial"
              hint="Required if this item is serial-tracked"
              help="The specific serial being moved. Each serial can only be in one state at a time."
              error={errors.serial_id?.message}
              {...register("serial_id")}
            />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-hairline-light">
            <div className="text-[11.5px] text-foreground-muted">
              This will immediately{" "}
              {direction === "in" ? (
                <Badge tone="green" dot>
                  add
                </Badge>
              ) : (
                <Badge tone="red" dot>
                  remove
                </Badge>
              )}{" "}
              stock and can&rsquo;t be undone.
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => router.push("/movements")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                kind={direction === "in" ? "success" : "danger"}
                icon={<Save size={13} />}
                loading={isSubmitting}
                disabled={insufficient}
              >
                Post {direction === "in" ? "IN" : "OUT"} movement
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
