import { api } from "@/lib/api-client";
import {
  STATUS_MASTER,
  NUMBER_SERIES,
  UOM_CATEGORIES,
  UOMS,
  UOM_CONVERSIONS,
  ITEM_BRANDS,
  ITEM_CATEGORIES,
  DOCUMENT_TYPES,
} from "@/lib/api-constants";
import type {
  StatusMaster,
  NumberSeries,
  ItemBrand,
  ItemCategory,
  DocumentType,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════
// Master Data Service — tenant-scoped CRUD for the "setup" domain
// ═══════════════════════════════════════════════════════════

// ── Status Master ─────────────────────────────────────────
export const statusMasterService = {
  list: (params?: { limit?: number; cursor?: string; entity?: string }) =>
    api.get<PaginatedResponse<StatusMaster>>(STATUS_MASTER.LIST, params),
  create: (data: { code: string; label: string; category: string; entity: string }) =>
    api.post<StatusMaster>(STATUS_MASTER.LIST, data),
  update: (id: string, data: Partial<{ label: string; category: string }>) =>
    api.patch<StatusMaster>(STATUS_MASTER.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(STATUS_MASTER.DETAIL(id)),
};

// ── Number Series ─────────────────────────────────────────
export const numberSeriesService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<NumberSeries>>(NUMBER_SERIES.LIST, params),
  create: (data: {
    code?: string;
    entity: string;
    prefix?: string;
    suffix?: string;
    padding?: number;
    start_value?: number;
  }) => api.post<NumberSeries>(NUMBER_SERIES.LIST, data),
  update: (
    id: string,
    data: Partial<{
      prefix: string;
      suffix: string;
      padding: number;
    }>
  ) => api.patch<NumberSeries>(NUMBER_SERIES.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(NUMBER_SERIES.DETAIL(id)),
  peek: (id: string) => api.get<{ next: string }>(NUMBER_SERIES.PEEK(id)),
  allocate: (id: string) => api.post<{ number: string }>(NUMBER_SERIES.ALLOCATE(id)),
};

// ── UoM Categories ────────────────────────────────────────
export interface UomCategory {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const uomCategoryService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<UomCategory>>(UOM_CATEGORIES.LIST, params),
  create: (data: { code: string; name: string }) =>
    api.post<UomCategory>(UOM_CATEGORIES.LIST, data),
  update: (id: string, data: Partial<{ name: string }>) =>
    api.patch<UomCategory>(UOM_CATEGORIES.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(UOM_CATEGORIES.DETAIL(id)),
};

// ── UoMs ──────────────────────────────────────────────────
export interface Uom {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol?: string;
  uom_category_id?: string;
  created_at: string;
  updated_at: string;
}

export const uomService = {
  list: (params?: { limit?: number; cursor?: string; uom_category_id?: string }) =>
    api.get<PaginatedResponse<Uom>>(UOMS.LIST, params),
  create: (data: {
    code: string;
    name: string;
    symbol?: string;
    uom_category_id?: string;
  }) => api.post<Uom>(UOMS.LIST, data),
  update: (id: string, data: Partial<{ name: string; symbol: string }>) =>
    api.patch<Uom>(UOMS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(UOMS.DETAIL(id)),
};

// ── UoM Conversions ───────────────────────────────────────
export interface UomConversion {
  id: string;
  tenant_id: string;
  from_uom_id: string;
  to_uom_id: string;
  factor: string;
  created_at: string;
  updated_at: string;
}

export const uomConversionService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<UomConversion>>(UOM_CONVERSIONS.LIST, params),
  create: (data: { from_uom_id: string; to_uom_id: string; factor: string }) =>
    api.post<UomConversion>(UOM_CONVERSIONS.LIST, data),
  update: (id: string, data: Partial<{ factor: string }>) =>
    api.patch<UomConversion>(UOM_CONVERSIONS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(UOM_CONVERSIONS.DETAIL(id)),
};

// ── Item Brands ───────────────────────────────────────────
export const itemBrandService = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get<PaginatedResponse<ItemBrand>>(ITEM_BRANDS.LIST, params),
  create: (data: { code: string; name: string }) =>
    api.post<ItemBrand>(ITEM_BRANDS.LIST, data),
  update: (id: string, data: Partial<{ name: string }>) =>
    api.patch<ItemBrand>(ITEM_BRANDS.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(ITEM_BRANDS.DETAIL(id)),
};

// ── Item Categories (hierarchical) ────────────────────────
export const itemCategoryService = {
  list: (params?: { limit?: number; cursor?: string; parent_id?: string }) =>
    api.get<PaginatedResponse<ItemCategory>>(ITEM_CATEGORIES.LIST, params),
  create: (data: { code: string; name: string; parent_id?: string | null }) =>
    api.post<ItemCategory>(ITEM_CATEGORIES.LIST, data),
  update: (
    id: string,
    data: Partial<{ name: string; parent_id: string | null }>
  ) => api.patch<ItemCategory>(ITEM_CATEGORIES.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(ITEM_CATEGORIES.DETAIL(id)),
};

// ── Document Types ────────────────────────────────────────
export const documentTypeService = {
  list: (params?: { limit?: number; cursor?: string; module?: string }) =>
    api.get<PaginatedResponse<DocumentType>>(DOCUMENT_TYPES.LIST, params),
  create: (data: {
    code: string;
    name: string;
    direction: string;
    module: string;
    affects_stock?: boolean;
  }) => api.post<DocumentType>(DOCUMENT_TYPES.LIST, data),
  update: (id: string, data: Partial<{ name: string; affects_stock: boolean }>) =>
    api.patch<DocumentType>(DOCUMENT_TYPES.DETAIL(id), data),
  delete: (id: string) => api.delete<void>(DOCUMENT_TYPES.DETAIL(id)),
};
