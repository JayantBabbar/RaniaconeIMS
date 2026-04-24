import { api } from "@/lib/api-client";
import { ITEMS, ITEM_BRANDS, ITEM_CATEGORIES, STOCK, CUSTOM_FIELDS, ATTACHMENTS } from "@/lib/api-constants";
import type { Item, Balance, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Items Service — Items + all sub-resources
// ═══════════════════════════════════════════════════════════

// ── Sub-resource interfaces ───────────────────────────────

export interface ItemIdentifier {
  id: string;
  tenant_id: string;
  item_id: string;
  identifier_type: string;
  identifier_value: string;
  created_at: string;
  updated_at: string;
}

export interface ItemVariant {
  id: string;
  tenant_id: string;
  item_id: string;
  variant_code: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ItemUom {
  id: string;
  tenant_id: string;
  item_id: string;
  uom_id: string;
  is_purchase: boolean;
  is_sales: boolean;
  conversion_factor: string;
  created_at: string;
}

export interface Lot {
  id: string;
  tenant_id: string;
  item_id: string;
  lot_number: string;
  mfg_date?: string;
  expiry_date?: string;
  received_qty: string;
  created_at: string;
  updated_at: string;
}

export interface Serial {
  id: string;
  tenant_id: string;
  item_id: string;
  serial_number: string;
  status: "in_stock" | "reserved" | "issued" | "returned" | "scrapped";
  lot_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReorderPolicy {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  min_qty: string;
  max_qty?: string;
  reorder_point?: string;
  reorder_qty?: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  tenant_id: string;
  entity: string;
  entity_id: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  file_size?: number;
  created_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  entity: string;
  code: string;
  name: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "json";
  options?: { choices?: string[] };
  is_required: boolean;
  created_at: string;
}

export interface CustomFieldValue {
  id: string;
  field_definition_id: string;
  entity_id: string;
  value_text?: string;
  value_number?: string;
  value_date?: string;
  value_boolean?: boolean;
  value_json?: unknown;
}

// ── Items CRUD ────────────────────────────────────────────

export const itemService = {
  async list(params?: {
    limit?: number;
    cursor?: string;
    category_id?: string;
    brand_id?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<Item>> {
    return api.get<PaginatedResponse<Item>>(ITEMS.LIST, params);
  },

  async getById(id: string): Promise<{ item: Item; etag: string }> {
    const res = await api.getWithHeaders<Item>(ITEMS.DETAIL(id));
    return { item: res.data, etag: res.headers["etag"] || `"${res.data.version}"` };
  },

  async create(data: {
    item_code: string;
    name: string;
    description?: string;
    category_id?: string;
    brand_id?: string;
    item_type?: string;
    base_uom_id?: string;
    is_batch_tracked?: boolean;
    is_serial_tracked?: boolean;
    is_active?: boolean;
  }): Promise<Item> {
    return api.post<Item>(ITEMS.LIST, data);
  },

  async update(id: string, data: Partial<Item>, etag: string): Promise<Item> {
    return api.patchWithEtag<Item>(ITEMS.DETAIL(id), data, etag);
  },

  async delete(id: string): Promise<void> {
    await api.delete(ITEMS.DETAIL(id));
  },

  // ── Identifiers ──
  async listIdentifiers(itemId: string): Promise<ItemIdentifier[]> {
    return api.get<ItemIdentifier[]>(ITEMS.IDENTIFIERS(itemId));
  },

  async addIdentifier(itemId: string, data: { identifier_type: string; identifier_value: string }): Promise<ItemIdentifier> {
    return api.post<ItemIdentifier>(ITEMS.IDENTIFIERS(itemId), data);
  },

  // ── Variants ──
  async listVariants(itemId: string): Promise<ItemVariant[]> {
    return api.get<ItemVariant[]>(ITEMS.VARIANTS(itemId));
  },

  async addVariant(itemId: string, data: { variant_code: string; name: string }): Promise<ItemVariant> {
    return api.post<ItemVariant>(ITEMS.VARIANTS(itemId), data);
  },

  // ── Item UoMs ──
  async listUoms(itemId: string): Promise<ItemUom[]> {
    return api.get<ItemUom[]>(ITEMS.UOMS(itemId));
  },

  async addUom(itemId: string, data: { uom_id: string; conversion_factor: number; is_purchase?: boolean; is_sales?: boolean }): Promise<ItemUom> {
    return api.post<ItemUom>(ITEMS.UOMS(itemId), data);
  },

  // ── Lots ──
  async listLots(itemId: string, params?: { expiring_before?: string }): Promise<Lot[]> {
    return api.get<Lot[]>(ITEMS.LOTS(itemId), params);
  },

  async addLot(itemId: string, data: { lot_number: string; mfg_date?: string; expiry_date?: string; received_qty: number }): Promise<Lot> {
    return api.post<Lot>(ITEMS.LOTS(itemId), data);
  },

  // ── Serials ──
  async listSerials(itemId: string): Promise<Serial[]> {
    return api.get<Serial[]>(ITEMS.SERIALS(itemId));
  },

  async addSerial(itemId: string, data: { serial_number: string; status?: string; lot_id?: string }): Promise<Serial> {
    return api.post<Serial>(ITEMS.SERIALS(itemId), data);
  },

  // ── Reorder Policies ──
  async listReorderPolicies(itemId: string): Promise<ReorderPolicy[]> {
    return api.get<ReorderPolicy[]>(ITEMS.REORDER_POLICIES(itemId));
  },

  async addReorderPolicy(itemId: string, data: { location_id: string; min_qty: number; max_qty?: number; reorder_point?: number; reorder_qty?: number }): Promise<ReorderPolicy> {
    return api.post<ReorderPolicy>(ITEMS.REORDER_POLICIES(itemId), data);
  },

  // ── Stock Balances for item ──
  async getBalances(itemId: string): Promise<Balance[]> {
    const res = await api.get<Balance[] | { items: Balance[] }>(STOCK.BALANCES, { item_id: itemId });
    return Array.isArray(res) ? res : res.items;
  },
};

// ── Master data (brands, categories) ──────────────────────

export const brandService = {
  async list(): Promise<PaginatedResponse<{ id: string; code: string; name: string }>> {
    return api.get(ITEM_BRANDS.LIST, { limit: 200 });
  },
};

export const categoryService = {
  async list(): Promise<PaginatedResponse<{ id: string; code: string; name: string; parent_id?: string }>> {
    return api.get(ITEM_CATEGORIES.LIST, { limit: 200 });
  },
};

// ── Custom Fields ─────────────────────────────────────────

export const customFieldService = {
  async listDefinitions(entity: string): Promise<CustomFieldDefinition[]> {
    return api.get<CustomFieldDefinition[]>(CUSTOM_FIELDS.DEFINITIONS, { entity });
  },

  async listValues(entity: string, entityId: string): Promise<CustomFieldValue[]> {
    return api.get<CustomFieldValue[]>(CUSTOM_FIELDS.VALUES(entity, entityId));
  },

  async setValue(entity: string, entityId: string, data: { field_definition_id: string; value: unknown }): Promise<CustomFieldValue> {
    return api.post<CustomFieldValue>(CUSTOM_FIELDS.VALUES(entity, entityId), data);
  },
};

// ── Attachments ───────────────────────────────────────────

export const attachmentService = {
  async list(entity: string, entityId: string): Promise<Attachment[]> {
    return api.get<Attachment[]>(ATTACHMENTS.LIST, { entity, entity_id: entityId });
  },

  async create(data: { entity: string; entity_id: string; file_name: string; file_path: string; mime_type?: string; file_size?: number }): Promise<Attachment> {
    return api.post<Attachment>(ATTACHMENTS.LIST, data);
  },

  async delete(id: string): Promise<void> {
    await api.delete(ATTACHMENTS.DETAIL(id));
  },
};
