"use client";

import React, { useMemo, useState } from "react";
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
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { webhookService, integrationService, Webhook } from "@/services/settings.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Plus, Webhook as WebhookIcon, Edit, Trash2 } from "lucide-react";

export default function WebhooksPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.integrations.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => webhookService.list({ limit: 200 }),
  });
  const { data: integrationsRaw } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationService.list({ limit: 200 }),
  });

  const rows = data || [];
  const integrations = integrationsRaw || [];
  const integMap = useMemo(() => new Map(integrations.map((i) => [i.id, i])), [integrations]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => webhookService.delete(id),
    onSuccess: () => {
      toast.success("Webhook removed");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  return (
    <RequireRead perm="inventory.integrations.read" crumbs={["Settings", "Webhooks"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Settings", "Webhooks"]}
        right={
          <Can perm="inventory.integrations.write">
            <Button kind="primary" icon={<Plus size={13} />}
              disabled={integrations.length === 0}
              onClick={() => setShowCreate(true)}>Add Webhook</Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Webhooks"
          description="Outbound HTTP notifications. When something interesting happens in the system (e.g. a document is posted), we POST a JSON payload to your configured URL."
          learnMore="Webhooks are tied to events. Each webhook has a URL, a secret (used to sign the payload so you can verify it came from us), and an active/inactive flag. Retries are attempted a few times on non-2xx responses; check the integration's delivery log for failures."
          badge={<Badge tone="neutral">{rows.length}</Badge>}
        />

        {integrations.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900 max-w-2xl">
            No integrations yet. Create one in <span className="font-medium">Settings → Integrations</span> before adding webhooks.
          </div>
        )}

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<WebhookIcon size={22} />}
              title="No webhooks configured yet"
              description={
                canWrite
                  ? "Set one up when you want another system to hear about events — a document posting, a stock count applied, and so on."
                  : "Your admin hasn't configured any webhooks yet."
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Integration</th>
                  <th className="text-left px-4 py-2.5">Event</th>
                  <th className="text-left px-4 py-2.5">URL</th>
                  <th className="text-center px-4 py-2.5">Active</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const integ = integMap.get(w.integration_id);
                  return (
                    <tr key={w.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-medium">{integ?.name || "—"}</td>
                      <td className="px-4 py-2.5"><Badge tone="blue">{w.event_type}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-xs truncate max-w-md">{w.url}</td>
                      <td className="px-4 py-2.5 text-center">{w.is_active ? "✓" : "—"}</td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-center">
                          <ActionMenu
                            items={[
                              {
                                label: "Edit",
                                icon: <Edit size={12} />,
                                onClick: () => setEditTarget(w),
                              },
                              { divider: true, label: "" },
                              {
                                label: "Delete",
                                icon: <Trash2 size={12} />,
                                danger: true,
                                onClick: () => setDeleteTarget(w),
                              },
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && <WebhookFormModal integrations={integrations} onClose={() => setShowCreate(false)} />}
      {editTarget && <WebhookFormModal target={editTarget} integrations={integrations} onClose={() => setEditTarget(null)} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title="Delete this webhook?"
        description="Events of this type will no longer be POSTed to the URL. Any in-flight retries are cancelled. Recreate the webhook if you want delivery to resume."
        confirmLabel="Delete webhook"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

const webhookSchema = z.object({
  integration_id: z.string().min(1, "Select an integration"),
  event_type: z.string().trim().min(1, "Event type is required").max(100, "Max 100 characters"),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(500, "Max 500 characters")
    .regex(/^https?:\/\//, "Must start with http:// or https://"),
  secret: z.string().max(255, "Max 255 characters").optional().or(z.literal("")),
  is_active: z.boolean(),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

function WebhookFormModal({
  target, integrations, onClose,
}: {
  target?: Webhook;
  integrations: { id: string; name: string; provider: string }[];
  onClose: () => void;
}) {
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
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      integration_id: target?.integration_id || (integrations[0]?.id || ""),
      event_type: target?.event_type || "",
      url: target?.url || "",
      secret: target?.secret || "",
      is_active: target?.is_active ?? true,
    },
  });

  const onSubmit = async (data: WebhookFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await webhookService.update(target!.id, {
          url: data.url,
          secret: data.secret,
          is_active: data.is_active,
        });
      } else {
        await webhookService.create({
          integration_id: data.integration_id,
          event_type: data.event_type,
          url: data.url,
          secret: data.secret || undefined,
          is_active: data.is_active,
        });
      }
      toast.success(isEdit ? "Webhook updated" : "Webhook created");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save webhook. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? "Edit webhook" : "Add a webhook"}
      description="POST a signed JSON payload to a URL whenever an event of the chosen type fires."
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
        <FormField label="Integration" required error={errors.integration_id?.message} help="The saved integration that owns this webhook — its delivery log groups events.">
          <select
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.integration_id ? "border-status-red" : "border-hairline"
            )}
            disabled={isEdit || submitting}
            {...register("integration_id")}
          >
            <option value="">— Select —</option>
            {integrations.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.provider})</option>)}
          </select>
        </FormField>
        <Input
          label="Event type"
          placeholder="document.posted"
          required
          help="The event name to subscribe to — e.g. 'document.posted', 'stock.movement.created'. Cannot be changed later."
          error={errors.event_type?.message}
          disabled={isEdit || submitting}
          maxLength={100}
          {...register("event_type")}
        />
        <Input
          label="URL"
          placeholder="https://example.com/webhook"
          required
          help="The URL that receives the POST. Must start with http:// or https://."
          error={errors.url?.message}
          maxLength={500}
          disabled={submitting}
          {...register("url")}
        />
        <Input
          label="Secret (optional)"
          type="password"
          placeholder="Shared secret for HMAC signing"
          help="If set, every payload is signed with this secret. Verify the signature on receipt to confirm it came from us."
          error={errors.secret?.message}
          maxLength={255}
          disabled={submitting}
          {...register("secret")}
        />
        <Checkbox label="Active" checked={watch("is_active")} onChange={(v) => setValue("is_active", v)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
