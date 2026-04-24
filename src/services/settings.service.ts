import { api } from "@/lib/api-client";
import {
  CUSTOM_FIELDS,
  INTEGRATIONS,
  WEBHOOKS,
  IMPORTS,
  CONFIG,
  ATTACHMENTS,
} from "@/lib/api-constants";
import type { PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Settings services — custom fields, integrations, webhooks,
// imports, tenant/module config, attachments
// ═══════════════════════════════════════════════════════════

// ── Custom Fields ─────────────────────────────────────────
export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  entity: string;
  parent_field_id: string | null;
  code: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "json";
  options: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  tenant_id: string;
  field_definition_id: string;
  entity: string;
  entity_id: string;
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_json: unknown;
  created_at: string;
  updated_at: string;
}

export const CUSTOM_FIELD_ENTITIES = [
  "item", "party", "inventory_location", "warehouse_bin",
  "document_header", "document_line",
] as const;

export const CUSTOM_FIELD_TYPES = [
  "text", "number", "date", "boolean", "select", "json",
] as const;

export const customFieldService = {
  listDefinitions: (params?: { limit?: number; cursor?: string; entity?: string }) =>
    api.get<PaginatedResponse<CustomFieldDefinition>>(CUSTOM_FIELDS.DEFINITIONS, params),

  createDefinition: (data: {
    entity: string;
    code: string;
    label: string;
    field_type: string;
    options?: Record<string, unknown>;
    validation?: Record<string, unknown>;
    is_required?: boolean;
    sort_order?: number;
  }) => api.post<CustomFieldDefinition>(CUSTOM_FIELDS.DEFINITIONS, data),

  updateDefinition: (
    id: string,
    data: Partial<{
      label: string;
      options: Record<string, unknown>;
      validation: Record<string, unknown>;
      is_required: boolean;
      sort_order: number;
    }>
  ) => api.patch<CustomFieldDefinition>(CUSTOM_FIELDS.DEFINITION(id), data),

  deleteDefinition: (id: string) => api.delete<void>(CUSTOM_FIELDS.DEFINITION(id)),

  listValues: (entity: string, entityId: string) =>
    api.get<CustomFieldValue[]>(CUSTOM_FIELDS.VALUES(entity, entityId)),

  setValue: (
    entity: string,
    entityId: string,
    data: { field_definition_id: string; value: unknown }
  ) => api.post<CustomFieldValue>(CUSTOM_FIELDS.VALUES(entity, entityId), data),
};

// ── Integrations ──────────────────────────────────────────
export interface Integration {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const integrationService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<Integration>>(INTEGRATIONS.LIST, params),
  getById: (id: string) => api.get<Integration>(INTEGRATIONS.DETAIL(id)),
  create: (data: {
    name: string;
    provider: string;
    config?: Record<string, unknown>;
    is_active?: boolean;
  }) => api.post<Integration>(INTEGRATIONS.LIST, data),
  update: (
    id: string,
    data: Partial<{ name: string; config: Record<string, unknown>; is_active: boolean }>
  ) => api.patch<Integration>(INTEGRATIONS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(INTEGRATIONS.DETAIL(id)),
};

// ── Webhooks ──────────────────────────────────────────────
export interface Webhook {
  id: string;
  tenant_id: string;
  integration_id: string;
  event_type: string;
  url: string;
  secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const webhookService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<Webhook>>(WEBHOOKS.LIST, params),
  create: (data: {
    integration_id: string;
    event_type: string;
    url: string;
    secret?: string;
    is_active?: boolean;
  }) => api.post<Webhook>(WEBHOOKS.LIST, data),
  update: (
    id: string,
    data: Partial<{ url: string; secret: string; is_active: boolean }>
  ) => api.patch<Webhook>(WEBHOOKS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(WEBHOOKS.DETAIL(id)),
};

// ── Imports ───────────────────────────────────────────────
export interface ImportBatch {
  id: string;
  tenant_id: string;
  entity: string;
  file_name: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  success_rows: number;
  error_rows: number;
  errors: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export const importService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<ImportBatch>>(IMPORTS.LIST, params),
  getById: (id: string) => api.get<ImportBatch>(IMPORTS.DETAIL(id)),
};

// ── Tenant / Module Config (key-value) ────────────────────
export interface TenantConfigEntry {
  id: string;
  tenant_id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

export interface ModuleConfigEntry {
  id: string;
  tenant_id: string;
  module: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

// Backend treats PUT as upsert by key (no POST / no PATCH for these endpoints).
export const tenantConfigService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<TenantConfigEntry>>(CONFIG.TENANT, params),
  getByKey: (key: string) => api.get<TenantConfigEntry>(CONFIG.TENANT_KEY(key)),
  set: (data: { key: string; value: unknown }) =>
    api.getInstance()
      .put<TenantConfigEntry>(CONFIG.TENANT_KEY(data.key), { value: data.value })
      .then((r) => r.data),
  update: (key: string, value: unknown) =>
    api.getInstance()
      .put<TenantConfigEntry>(CONFIG.TENANT_KEY(key), { value })
      .then((r) => r.data),
  delete: (key: string) => api.delete<void>(CONFIG.TENANT_KEY(key)),
};

export const moduleConfigService = {
  list: (params?: { limit?: number; cursor?: string; module?: string }) =>
    api.get<PaginatedResponse<ModuleConfigEntry>>(CONFIG.MODULE, params),
  set: (data: { module: string; key: string; value: unknown }) =>
    api.getInstance()
      .put<ModuleConfigEntry>(CONFIG.MODULE_KEY(data.module, data.key), {
        value: data.value,
      })
      .then((r) => r.data),
  update: (module: string, key: string, value: unknown) =>
    api.getInstance()
      .put<ModuleConfigEntry>(CONFIG.MODULE_KEY(module, key), { value })
      .then((r) => r.data),
  delete: (module: string, key: string) =>
    api.delete<void>(CONFIG.MODULE_KEY(module, key)),
};

// ── Attachments ───────────────────────────────────────────
export interface Attachment {
  id: string;
  tenant_id: string;
  entity: string;
  entity_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  created_by: string | null;
}

export const attachmentService = {
  list: (params?: { limit?: number; cursor?: string; entity?: string; entity_id?: string }) =>
    api.get<PaginatedResponse<Attachment>>(ATTACHMENTS.LIST, params),
  delete: (id: string) => api.delete<void>(ATTACHMENTS.DETAIL(id)),
};
