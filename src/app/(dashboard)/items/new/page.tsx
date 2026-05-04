"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/shared";
import { Input, Textarea, Checkbox, FormField } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { itemService, brandService, categoryService } from "@/services/items.service";
import { isApiError } from "@/lib/api-client";
import { ArrowLeft, Save, X, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// New Item Page — Zod-validated form
// ═══════════════════════════════════════════════════════════

const itemSchema = z.object({
  item_code: z
    .string()
    .trim()
    .min(1, "Item code is required")
    .max(50, "Keep it under 50 characters"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Too long"),
  description: z.string().max(2000, "Too long").optional().or(z.literal("")),
  item_type: z.string().min(1),
  category_id: z.string().optional().or(z.literal("")),
  brand_id: z.string().optional().or(z.literal("")),
  base_uom_id: z.string().optional().or(z.literal("")),
  is_batch_tracked: z.boolean(),
  is_serial_tracked: z.boolean(),
  is_active: z.boolean(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function NewItemPage() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useCan();
  const canRead = can("inventory.items.read");
  const canWrite = can("inventory.items.write");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => brandService.list(), staleTime: 5 * 60 * 1000 });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list(), staleTime: 5 * 60 * 1000 });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      item_code: "",
      name: "",
      description: "",
      item_type: "stock",
      category_id: "",
      brand_id: "",
      base_uom_id: "",
      is_batch_tracked: false,
      is_serial_tracked: false,
      is_active: true,
    },
  });

  const onSubmit = async (data: ItemFormValues) => {
    setServerError(null);
    setLoading(true);
    try {
      const item = await itemService.create({
        ...data,
        description: data.description || undefined,
        category_id: data.category_id || undefined,
        brand_id: data.brand_id || undefined,
        base_uom_id: data.base_uom_id || undefined,
      });
      toast.success("Item created successfully");
      router.push(`/items/${item.id}`);
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT" || err.code === "CODE_EXISTS") {
          setError("item_code", { message: "An item with this code already exists." });
        } else if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not create item. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!canRead) {
    return <ForbiddenState crumbs={["Inventory", "Items", "New"]} missingPerm="inventory.items.read" />;
  }

  if (!canWrite) {
    return (
      <div className="flex-1 bg-surface">
        <TopBar crumbs={["Inventory", "Items", "New Item"]} />
        <div className="p-5">
          <div className="bg-white border border-hairline rounded-md max-w-lg">
            <EmptyState
              icon={<Lock size={22} />}
              title="You don't have access to create this"
              description="Your role doesn't include the permission needed to create items. Contact your workspace admin if you need access."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Inventory", "Items", "New Item"]} />

      <div className="p-5">
        <button
          onClick={() => router.push("/items")}
          className="flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={12} /> Back to items
        </button>

        <PageHeader
          title="Add a new item"
          description="Create a new SKU. You can edit every attribute later; only the item code is permanent."
          learnMore="The item code is the short identifier used everywhere (documents, reports, barcodes). Pick something your team will recognize. Batch-tracked items let you record lot numbers with mfg/expiry dates on receipt. Serial-tracked items have a unique serial per unit."
          className="mb-5"
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-6">
          {serverError && (
            <div
              role="alert"
              className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
            >
              {serverError}
            </div>
          )}

          {/* Basic info */}
          <div className="bg-white border border-hairline rounded-md p-5">
            <h2 className="text-sm font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Item Code"
                placeholder="SKU-001"
                required
                help="Short identifier your team will recognize. Used on documents, reports, and barcodes. Cannot be changed later."
                error={errors.item_code?.message}
                disabled={loading}
                {...register("item_code")}
              />
              <Input
                label="Name"
                placeholder="Widget A"
                required
                help="Human-readable name shown in lists and search."
                error={errors.name?.message}
                disabled={loading}
                {...register("name")}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Description"
                placeholder="Optional — notes about the item, intended use, specifications"
                {...register("description")}
              />
            </div>
          </div>

          {/* Classification */}
          <div className="bg-white border border-hairline rounded-md p-5">
            <h2 className="text-sm font-semibold mb-4">Classification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Item Type" help="Stock items carry inventory balances; services and consumables do not.">
                <select
                  className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={loading}
                  {...register("item_type")}
                >
                  <option value="stock">Stock</option>
                  <option value="service">Service</option>
                  <option value="consumable">Consumable</option>
                </select>
              </FormField>
              <FormField label="Category" help="Optional grouping used for filters and reports.">
                <select
                  className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={loading}
                  {...register("category_id")}
                >
                  <option value="">— None —</option>
                  {(categories?.data || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Brand" help="Optional. Useful when you stock multiple brands of the same kind of item.">
                <select
                  className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
                  disabled={loading}
                  {...register("brand_id")}
                >
                  <option value="">— None —</option>
                  {(brands?.data || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Base UoM ID"
                placeholder="UUID of the base unit"
                help="The canonical unit this item is stored in (e.g. the UUID for 'Each' or 'Kilogram'). Alternative UoMs with conversions can be added later."
                error={errors.base_uom_id?.message}
                disabled={loading}
                {...register("base_uom_id")}
              />
            </div>
          </div>

          {/* Tracking */}
          <div className="bg-white border border-hairline rounded-md p-5">
            <h2 className="text-sm font-semibold mb-4">Tracking Options</h2>
            <div className="space-y-3">
              <Checkbox
                label="Enable Batch / Lot Tracking"
                checked={watch("is_batch_tracked")}
                onChange={(v) => setValue("is_batch_tracked", v)}
              />
              {/* Hidden for Nova Bond — ACP catalog uses lots, not serials.
                  Re-enable when serial-tracked items are introduced.
              <Checkbox
                label="Enable Serial Number Tracking"
                checked={watch("is_serial_tracked")}
                onChange={(v) => setValue("is_serial_tracked", v)}
              />
              */}
              <Checkbox
                label="Active (visible in catalog)"
                checked={watch("is_active")}
                onChange={(v) => setValue("is_active", v)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" kind="primary" icon={<Save size={13} />} loading={loading}>
              Create Item
            </Button>
            <Button type="button" onClick={() => router.push("/items")} icon={<X size={13} />}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
