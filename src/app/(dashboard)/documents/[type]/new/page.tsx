"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, PageLoading } from "@/components/ui/shared";
import { Input, FormField, Textarea } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { documentService } from "@/services/documents.service";
import { documentTypeService } from "@/services/master-data.service";
import { partyService } from "@/services/parties.service";
import { locationService } from "@/services/locations.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// New Document — header only. Lines are added after creation
// via the detail page line editor.
// ═══════════════════════════════════════════════════════════

const TYPE_MAP: Record<string, { label: string; codes: string[] }> = {
  "purchase-orders": { label: "Purchase Order", codes: ["PO"] },
  "sales-orders": { label: "Sales Order", codes: ["SO"] },
  "transfers": { label: "Transfer", codes: ["TRANSFER", "XFER"] },
  "all": { label: "Document", codes: [] },
};

const docSchema = z
  .object({
    document_type_id: z.string().min(1, "Select a document type"),
    document_number: z.string().max(100, "Max 100 characters").optional().or(z.literal("")),
    document_date: z.string().min(1, "Date is required"),
    party_id: z.string().optional().or(z.literal("")),
    source_location_id: z.string().optional().or(z.literal("")),
    destination_location_id: z.string().optional().or(z.literal("")),
    remarks: z.string().max(2000, "Too long").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (
      data.source_location_id &&
      data.destination_location_id &&
      data.source_location_id === data.destination_location_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_location_id"],
        message: "Source and destination must differ",
      });
    }
  });

type DocFormValues = z.infer<typeof docSchema>;

export default function NewDocumentPage() {
  const { type } = useParams<{ type: string }>();
  const router = useRouter();
  const toast = useToast();
  const typeInfo = TYPE_MAP[type] || TYPE_MAP.all;
  const { can } = useCan();
  const canRead = can("inventory.documents.read");
  const canWrite = can("inventory.documents.write");

  const { data: typesRaw, isLoading: typesLoading } = useQuery({
    queryKey: ["documentTypes"],
    queryFn: () => documentTypeService.list({ limit: 200 }),
  });
  const { data: partiesRaw } = useQuery({
    queryKey: ["parties"], queryFn: () => partyService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locations"], queryFn: () => locationService.list({ limit: 200 }),
  });

  const allTypes = typesRaw?.data || [];
  const candidateTypes = useMemo(
    () => (typeInfo.codes.length === 0 ? allTypes : allTypes.filter((t) => typeInfo.codes.includes(t.code))),
    [allTypes, typeInfo]
  );
  const parties = partiesRaw?.data || [];
  const locations = locsRaw?.data || [];

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DocFormValues>({
    resolver: zodResolver(docSchema),
    defaultValues: {
      document_type_id: "",
      document_number: "",
      document_date: new Date().toISOString().slice(0, 10),
      party_id: "",
      source_location_id: "",
      destination_location_id: "",
      remarks: "",
    },
  });

  // Auto-select document type if only one candidate
  React.useEffect(() => {
    if (!watch("document_type_id") && candidateTypes.length === 1) {
      setValue("document_type_id", candidateTypes[0].id);
    }
  }, [candidateTypes, watch, setValue]);

  const selectedType = candidateTypes.find((t) => t.id === watch("document_type_id"));
  const needsSource = selectedType?.direction === "out" || selectedType?.direction === "transfer";
  const needsDest = selectedType?.direction === "in" || selectedType?.direction === "transfer";

  const onSubmit = async (data: DocFormValues) => {
    setServerError(null);
    // Extra guard for conditional required fields
    if (needsSource && !data.source_location_id) {
      setError("source_location_id", { message: "Source location is required" });
      return;
    }
    if (needsDest && !data.destination_location_id) {
      setError("destination_location_id", { message: "Destination location is required" });
      return;
    }
    setSubmitting(true);
    try {
      const doc = await documentService.create({
        document_type_id: data.document_type_id,
        document_number: data.document_number || undefined,
        document_date: data.document_date,
        party_id: data.party_id || undefined,
        source_location_id: data.source_location_id || undefined,
        destination_location_id: data.destination_location_id || undefined,
        remarks: data.remarks || undefined,
      });
      toast.success("Document created", "Now add lines");
      router.push(`/documents/detail/${doc.id}`);
    } catch (err) {
      if (isApiError(err)) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not create document. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canRead) {
    return <ForbiddenState crumbs={["Documents", "New"]} missingPerm="inventory.documents.read" />;
  }

  if (typesLoading) return <PageLoading />;

  if (!canWrite) {
    return (
      <div className="flex-1 bg-surface">
        <TopBar crumbs={["Documents", typeInfo.label, "New"]} />
        <div className="p-5">
          <div className="bg-white border border-hairline rounded-md max-w-lg">
            <EmptyState
              icon={<Lock size={22} />}
              title="You don't have access to create this"
              description={`Your role doesn't include the permission needed to create a ${typeInfo.label.toLowerCase()}. Contact your workspace admin if you need access.`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (candidateTypes.length === 0) {
    return (
      <div className="flex-1 bg-surface flex flex-col">
        <TopBar crumbs={["Documents", typeInfo.label, "New"]} />
        <div className="p-5">
          <EmptyState
            title={`No ${typeInfo.label.toLowerCase()} type configured yet`}
            description="Before you can create documents of this type, define a document type in Master Data — then come back here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Documents", typeInfo.label, "New"]} />
      <div className="p-5 space-y-4 max-w-2xl">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </button>

        <PageHeader
          title={`Create ${typeInfo.label}`}
          description="A header with one or more lines. Save as Draft first, then add lines, then post when you're ready."
          learnMore="Document numbers are auto-generated from the number series configured for this document type. If no number series exists, you'll need to set one up in Master Data first. Posting date can be back-dated within reason but can't be set in the future."
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-white border border-hairline rounded-md p-5 space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
            >
              {serverError}
            </div>
          )}

          {candidateTypes.length > 1 && (
            <FormField
              label="Document type"
              required
              error={errors.document_type_id?.message}
              help="Which kind of document this is — PO, SO, Transfer, etc. Determines direction of movement."
            >
              <select
                className={cn(
                  "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                  errors.document_type_id ? "border-status-red" : "border-hairline"
                )}
                disabled={submitting}
                {...register("document_type_id")}
              >
                <option value="">— Select —</option>
                {candidateTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </select>
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Document number"
              placeholder="Auto"
              help="Leave blank to auto-allocate from the number series. Override only if you need a specific identifier."
              error={errors.document_number?.message}
              maxLength={100}
              disabled={submitting}
              {...register("document_number")}
            />
            <Input
              label="Date"
              type="date"
              required
              help="The document date on paper. Can be back-dated within reason but not future-dated."
              error={errors.document_date?.message}
              disabled={submitting}
              {...register("document_date")}
            />
          </div>

          <FormField
            label="Party"
            error={errors.party_id?.message}
            help="The supplier, customer, or other counterparty on this document. Leave blank for internal transfers."
          >
            <select
              className={cn(
                "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                errors.party_id ? "border-status-red" : "border-hairline"
              )}
              disabled={submitting}
              {...register("party_id")}
            >
              <option value="">— None —</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </FormField>

          {needsSource && (
            <FormField
              label="Source location"
              required
              error={errors.source_location_id?.message}
              help="Where stock is going OUT from."
            >
              <select
                className={cn(
                  "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                  errors.source_location_id ? "border-status-red" : "border-hairline"
                )}
                disabled={submitting}
                {...register("source_location_id")}
              >
                <option value="">— Select —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </FormField>
          )}
          {needsDest && (
            <FormField
              label="Destination location"
              required
              error={errors.destination_location_id?.message}
              help="Where stock is coming IN to."
            >
              <select
                className={cn(
                  "w-full h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
                  errors.destination_location_id ? "border-status-red" : "border-hairline"
                )}
                disabled={submitting}
                {...register("destination_location_id")}
              >
                <option value="">— Select —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </FormField>
          )}

          <Textarea
            label="Remarks"
            placeholder="Internal notes or special instructions"
            {...register("remarks")}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-hairline-light">
            <Button type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" kind="primary" icon={<Save size={13} />} loading={submitting}>
              Create & edit lines
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
