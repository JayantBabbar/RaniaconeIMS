import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { ADMIN, HEALTH, MODULES, SUBSCRIPTIONS } from "@/lib/api-constants";
import type { Currency, Tenant, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Platform Admin Service — auth service (:8000)
//
// Currencies, tenants, modules catalogue, module subscriptions.
// All tenant-aware actions use the caller's JWT; super admins may
// target another tenant via X-Acting-Tenant-Id on specific calls.
// ═══════════════════════════════════════════════════════════════════

// ── Currencies (auth service) ─────────────────────────────

export const currencyService = {
  async list(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<Currency[]> {
    const res = await api.auth.get<Currency[] | PaginatedResponse<Currency>>(
      ADMIN.CURRENCIES,
      params,
    );
    return unwrapList(res);
  },

  async getById(id: string): Promise<Currency> {
    return api.auth.get<Currency>(ADMIN.CURRENCY(id));
  },

  async create(data: {
    code: string;
    name: string;
    symbol?: string;
    decimal_precision?: number;
  }): Promise<Currency> {
    return api.auth.post<Currency>(ADMIN.CURRENCIES, data);
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      symbol: string;
      decimal_precision: number;
    }>,
  ): Promise<Currency> {
    return api.auth.patch<Currency>(ADMIN.CURRENCY(id), data);
  },

  async delete(id: string): Promise<void> {
    await api.auth.delete(ADMIN.CURRENCY(id));
  },
};

// ── Tenants (auth service) ────────────────────────────────

export const tenantService = {
  async list(params?: {
    limit?: number;
    cursor?: string;
    status?: string;
  }): Promise<Tenant[]> {
    const res = await api.auth.get<Tenant[] | PaginatedResponse<Tenant>>(
      ADMIN.TENANTS,
      params,
    );
    return unwrapList(res);
  },

  async getById(id: string): Promise<Tenant> {
    return api.auth.get<Tenant>(ADMIN.TENANT(id));
  },

  async create(data: {
    name: string;
    code: string;
    status?: string;
    base_currency_id?: string;
    timezone?: string;
    plan?: string;
  }): Promise<Tenant> {
    return api.auth.post<Tenant>(ADMIN.TENANTS, data);
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      status: string;
      base_currency_id: string;
      timezone: string;
      plan: string;
    }>,
  ): Promise<Tenant> {
    return api.auth.patch<Tenant>(ADMIN.TENANT(id), data);
  },

  async delete(id: string): Promise<void> {
    await api.auth.delete(ADMIN.TENANT(id));
  },
};

// ── Modules catalog (auth service) ────────────────────────

export interface Module {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const moduleService = {
  async list(): Promise<Module[]> {
    return api.auth.get<Module[]>(MODULES.LIST);
  },
};

// ── Module subscriptions per tenant (auth service) ───────

export interface TenantModuleSubscription {
  id: string;
  tenant_id: string;
  module_id: string;
  module_code: string;
  plan: string;
  status: "active" | "suspended" | "expired" | "cancelled";
  activated_at: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const subscriptionService = {
  async listForTenant(
    tenantId: string,
    params?: { only_active?: boolean },
  ): Promise<TenantModuleSubscription[]> {
    return api.auth.get<TenantModuleSubscription[]>(
      SUBSCRIPTIONS.TENANT(tenantId),
      params,
    );
  },

  async subscribe(
    tenantId: string,
    data: { module_code: string; plan?: string; expires_at?: string | null },
  ): Promise<TenantModuleSubscription> {
    return api.auth.post<TenantModuleSubscription>(
      SUBSCRIPTIONS.TENANT(tenantId),
      data,
    );
  },

  async cancel(id: string): Promise<void> {
    await api.auth.delete(SUBSCRIPTIONS.DETAIL(id));
  },
};

// ── Health — pings both services in parallel ─────────────

export interface HealthSnapshot {
  status: "ok" | "degraded" | "down";
  auth: { status: string; database?: string };
  inventory: { status: string; database?: string };
}

export const healthService = {
  async checkInventory(): Promise<{ status: string; database?: string; db?: string }> {
    return api.inventory.get(HEALTH);
  },
  async checkAuth(): Promise<{ status: string; database?: string; db?: string }> {
    return api.auth.get(HEALTH);
  },
  /** Combined check — both services at once. */
  async check(): Promise<HealthSnapshot> {
    const [auth, inv] = await Promise.allSettled([
      healthService.checkAuth(),
      healthService.checkInventory(),
    ]);
    const authVal = auth.status === "fulfilled" ? auth.value : null;
    const invVal = inv.status === "fulfilled" ? inv.value : null;
    const authOk = !!authVal && authVal.status === "ok";
    const invOk = !!invVal && invVal.status === "ok";

    return {
      status: authOk && invOk ? "ok" : authOk || invOk ? "degraded" : "down",
      auth: {
        status: authVal?.status ?? "down",
        database: authVal?.database ?? authVal?.db,
      },
      inventory: {
        status: invVal?.status ?? "down",
        database: invVal?.database ?? invVal?.db,
      },
    };
  },
};
