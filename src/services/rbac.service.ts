import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { USERS, ROLES, PERMISSIONS } from "@/lib/api-constants";
import type {
  User,
  Role,
  Permission,
  RolePermission,
  UserRole,
  PaginatedResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Users & RBAC Service — all endpoints live on the auth service (:8000).
// Cross-tenant actions for super admins use X-Acting-Tenant-Id on the
// request (not X-Tenant-Id, which is legacy).
// ═══════════════════════════════════════════════════════════════════

// ── Users ─────────────────────────────────────────────────

export const userService = {
  async list(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<User[]> {
    const res = await api.auth.get<User[] | PaginatedResponse<User>>(
      USERS.LIST,
      params,
    );
    return unwrapList(res);
  },

  /**
   * Super-admin helper: list users in a specific tenant via the
   * X-Acting-Tenant-Id override. Regular users cannot call this.
   */
  async listByTenant(
    tenantId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<User[]> {
    const res = await api.auth.get<User[] | PaginatedResponse<User>>(
      USERS.LIST,
      params,
      { "X-Acting-Tenant-Id": tenantId },
    );
    return unwrapList(res);
  },

  async getById(id: string): Promise<User> {
    return api.auth.get<User>(USERS.DETAIL(id));
  },

  async update(
    id: string,
    data: Partial<{
      email: string;
      full_name: string;
      is_active: boolean;
      is_super_admin: boolean;
    }>,
  ): Promise<User> {
    return api.auth.patch<User>(USERS.DETAIL(id), data);
  },

  async delete(id: string): Promise<void> {
    await api.auth.delete(USERS.DETAIL(id));
  },

  async deleteInTenant(id: string, tenantId: string): Promise<void> {
    await api.auth.delete(USERS.DETAIL(id), {
      "X-Acting-Tenant-Id": tenantId,
    });
  },

  /**
   * Admin-initiated password reset (auth service §2 — 2026-04-24 changes).
   * On 204, the target user's refresh tokens are revoked server-side.
   * Pass `actingTenantId` when called from a super-admin context — the
   * backend requires X-Acting-Tenant-Id for SPAs and ignores it for
   * tenant admins (they're scoped to their JWT's tid).
   */
  async adminResetPassword(
    userId: string,
    newPassword: string,
    actingTenantId?: string,
  ): Promise<void> {
    const headers = actingTenantId
      ? { "X-Acting-Tenant-Id": actingTenantId }
      : undefined;
    await api.auth.post<void>(
      USERS.RESET_PASSWORD(userId),
      { new_password: newPassword },
      headers,
    );
  },

  // ── User Roles ──
  async listRoles(userId: string): Promise<UserRole[]> {
    const res = await api.auth.get<UserRole[] | PaginatedResponse<UserRole>>(
      USERS.ROLES(userId),
    );
    return unwrapList(res);
  },

  async assignRole(userId: string, roleId: string): Promise<UserRole> {
    return api.auth.post<UserRole>(USERS.ROLES(userId), { role_id: roleId });
  },

  async unassignRole(userId: string, roleId: string): Promise<void> {
    await api.auth.delete(USERS.ROLE(userId, roleId));
  },
};

// ── Roles ─────────────────────────────────────────────────

export const roleService = {
  async list(): Promise<Role[]> {
    const res = await api.auth.get<Role[] | PaginatedResponse<Role>>(ROLES.LIST);
    return unwrapList(res);
  },

  async getById(id: string): Promise<Role> {
    return api.auth.get<Role>(ROLES.DETAIL(id));
  },

  async create(data: {
    code: string;
    name: string;
    is_system?: boolean;
  }): Promise<Role> {
    return api.auth.post<Role>(ROLES.LIST, data);
  },

  async update(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Role> {
    return api.auth.patch<Role>(ROLES.DETAIL(id), data);
  },

  async delete(id: string): Promise<void> {
    await api.auth.delete(ROLES.DETAIL(id));
  },

  // ── Role Permissions ──
  async listPermissions(roleId: string): Promise<RolePermission[]> {
    const res = await api.auth.get<RolePermission[] | PaginatedResponse<RolePermission>>(
      ROLES.PERMISSIONS(roleId),
    );
    return unwrapList(res);
  },

  async grantPermission(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission> {
    return api.auth.post<RolePermission>(ROLES.PERMISSIONS(roleId), {
      permission_id: permissionId,
    });
  },

  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await api.auth.delete(ROLES.PERMISSION(roleId, permissionId));
  },
};

// ── Permissions ───────────────────────────────────────────

export const permissionService = {
  async list(module?: string): Promise<Permission[]> {
    const res = await api.auth.get<Permission[] | PaginatedResponse<Permission>>(
      PERMISSIONS.LIST,
      module ? { module } : undefined,
    );
    return unwrapList(res);
  },
};

// ── Helper: Build effective permissions for current user ──
// Fallback ONLY for the pre-JWT-decode path. The auth provider now
// seeds perms directly from the access token's `perms` claim, so this
// helper should rarely run.

export async function buildUserPermissions(userId: string): Promise<Set<string>> {
  const permissions = new Set<string>();

  try {
    const userRoles = await userService.listRoles(userId);
    const allPerms = await permissionService.list();
    const permMap = new Map(allPerms.map((p) => [p.id, p.code]));

    for (const ur of userRoles) {
      const rolePerms = await roleService.listPermissions(ur.role_id);
      for (const rp of rolePerms) {
        const code = permMap.get(rp.permission_id);
        if (code) permissions.add(code);
      }
    }
  } catch {
    // Silently fail — the user may not have permission to read roles,
    // or the endpoints haven't been wired up yet.
  }

  return permissions;
}
