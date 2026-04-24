"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox, Textarea } from "@/components/ui/form-elements";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { integrationService, Integration } from "@/services/settings.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Plus, Puzzle, Edit, Trash2 } from "lucide-react";

export default function IntegrationsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.integrations.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Integration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationService.list({ limit: 200 }),
  });
  const rows = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationService.delete(id),
    onSuccess: () => {
      toast.success("Integration removed");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.integrations.read" crumbs={["Settings", "Integrations"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Integrations"]}
        right={
          <Can perm="inventory.integrations.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Integration</Button>
          </Can>
        }
      />
      <div className="p-5 space-y-4">
        <PageHeader
          title="Integrations"
          description="Saved connections to external systems — shipping providers, ERP systems, payment gateways, anything your team needs to sync with."
          learnMore="An integration is just a named configuration (credentials, endpoint URLs, options). Once saved, other parts of the app (webhooks, imports) can reference it. Marking an integration inactive keeps its config but stops all outgoing calls to it."
          badge={<Badge tone="neutral">{rows.length}</Badge>}
        />

        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Puzzle size={22} />}
              title="No integrations set up yet"
              description={
                canWrite
                  ? "Add one when you're ready to connect to an external system — a shipping API, an ERP, or anywhere else you need to sync data."
                  : "Your admin hasn't set up any integrations yet. Once they do, you'll see them here."
              }
              action={
                canWrite && <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add your first integration</Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-4 py-2.5">Provider</th>
                  <th className="text-center px-4 py-2.5">Active</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-medium">{i.name}</td>
                    <td className="px-4 py-2.5"><Badge tone="blue">{i.provider}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{i.is_active ? "✓" : "—"}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(i),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(i),
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && <IntegrationFormModal onClose={() => setShowCreate(false)} />}
      {editTarget && <IntegrationFormModal target={editTarget} onClose={() => setEditTarget(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="The saved configuration (URLs, credentials) is removed. Any webhooks attached to this integration stop firing. Consider marking it inactive instead if you might bring it back."
        confirmLabel="Delete integration"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const integrationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Max 255 characters"),
  provider: z
    .string()
    .trim()
    .min(1, "Provider is required")
    .max(100, "Max 100 characters"),
  config_json: z
    .string()
    .refine(
      (v) => {
        if (!v.trim()) return true;
        try { JSON.parse(v); return true; } catch { return false; }
      },
      "Invalid JSON",
    ),
  is_active: z.boolean(),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;

function IntegrationFormModal({ target, onClose }: { target?: Integration; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: target?.name || "",
      provider: target?.provider || "",
      config_json: JSON.stringify(target?.config ?? {}, null, 2),
      is_active: target?.is_active ?? true,
    },
  });

  const onSubmit = async (data: IntegrationFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const config = data.config_json.trim() ? JSON.parse(data.config_json) : {};
      if (isEdit) {
        await integrationService.update(target!.id, {
          name: data.name,
          config,
          is_active: data.is_active,
        });
      } else {
        await integrationService.create({
          name: data.name,
          provider: data.provider,
          config,
          is_active: data.is_active,
        });
      }
      toast.success(isEdit ? "Integration updated" : "Integration created");
      qc.invalidateQueries({ queryKey: ["integrations"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save integration. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit "${target?.name}"` : "Add an integration"}
      description={isEdit
        ? "Rename, update config, or toggle active. Provider type can't be changed after creation."
        : "Name a saved connection to an external system. You can store credentials and endpoints in the config JSON below."}
      width="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Name"
            placeholder="Stripe Production"
            required
            help="A friendly name for this integration, shown in the list and picker."
            error={errors.name?.message}
            maxLength={255}
            disabled={submitting}
            {...register("name")}
          />
          <Input
            label="Provider"
            placeholder="stripe"
            required
            help="Short machine identifier for the kind of service (e.g. stripe, shopify, shiprocket). Cannot be changed later."
            error={errors.provider?.message}
            disabled={isEdit || submitting}
            maxLength={100}
            {...register("provider")}
          />
        </div>
        <FormField label="Config (JSON)" error={errors.config_json?.message} help="Key-value config specific to this provider — API keys, URLs, options. Stored as JSON.">
          <textarea
            className={cn(
              "w-full px-2.5 py-2 text-xs font-mono bg-white border rounded",
              "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              "resize-y min-h-[100px]",
              errors.config_json ? "border-status-red" : "border-hairline"
            )}
            placeholder='{"api_key": "…", "webhook_secret": "…"}'
            disabled={submitting}
            {...register("config_json")}
          />
        </FormField>
        <Checkbox label="Active" checked={watch("is_active")} onChange={(v) => setValue("is_active", v)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
