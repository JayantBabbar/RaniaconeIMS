import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { PARTIES } from "@/lib/api-constants";
import type { Party, PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Parties Service — suppliers, customers, both
// ═══════════════════════════════════════════════════════════

export interface Address {
  id: string;
  tenant_id: string;
  party_id: string;
  address_type: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  party_id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export const partyService = {
  list: (params?: {
    limit?: number;
    cursor?: string;
    party_type?: string;
    is_active?: boolean;
  }) => api.get<PaginatedResponse<Party>>(PARTIES.LIST, params),

  getById: (id: string) => api.get<Party>(PARTIES.DETAIL(id)),

  create: (data: {
    code: string;
    name: string;
    legal_name?: string;
    tax_id?: string;
    party_type?: string;
    opening_balance?: string;
    currency_id?: string;
    is_active?: boolean;
  }) => api.post<Party>(PARTIES.LIST, data),

  update: (
    id: string,
    data: Partial<{
      name: string;
      legal_name: string;
      tax_id: string;
      party_type: string;
      currency_id: string;
      is_active: boolean;
    }>
  ) => api.patch<Party>(PARTIES.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(PARTIES.DETAIL(id)),

  listAddresses: async (partyId: string): Promise<Address[]> => {
    const res = await api.get<Address[] | PaginatedResponse<Address>>(
      PARTIES.ADDRESSES(partyId),
    );
    return unwrapList(res);
  },
  createAddress: (
    partyId: string,
    data: {
      address_type: string;
      line1: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
      is_primary?: boolean;
    }
  ) => api.post<Address>(PARTIES.ADDRESSES(partyId), data),

  listContacts: async (partyId: string): Promise<Contact[]> => {
    const res = await api.get<Contact[] | PaginatedResponse<Contact>>(
      PARTIES.CONTACTS(partyId),
    );
    return unwrapList(res);
  },
  createContact: (
    partyId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      is_primary?: boolean;
    }
  ) => api.post<Contact>(PARTIES.CONTACTS(partyId), data),
};
