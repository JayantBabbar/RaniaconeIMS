import { api } from "@/lib/api-client";
import { unwrapList } from "@/lib/utils";
import { WORKFLOWS } from "@/lib/api-constants";
import type { PaginatedResponse } from "@/types";

// ═══════════════════════════════════════════════════════════
// Workflow Service — state machines per entity
// ═══════════════════════════════════════════════════════════

export interface Workflow {
  id: string;
  tenant_id: string;
  entity: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowState {
  id: string;
  workflow_id: string;
  status_id: string;
  is_initial: boolean;
  is_final: boolean;
  sort_order: number;
  created_at: string;
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_state_id: string;
  to_state_id: string;
  required_permission_id: string | null;
  created_at: string;
}

export const workflowService = {
  list: async (params?: { limit?: number; cursor?: string; entity?: string }): Promise<Workflow[]> => {
    const res = await api.get<Workflow[] | PaginatedResponse<Workflow>>(
      WORKFLOWS.LIST,
      params,
    );
    return unwrapList(res);
  },

  getById: (id: string) => api.get<Workflow>(WORKFLOWS.DETAIL(id)),

  create: (data: { entity: string; name: string; is_active?: boolean }) =>
    api.post<Workflow>(WORKFLOWS.LIST, data),

  update: (id: string, data: Partial<{ name: string; is_active: boolean }>) =>
    api.patch<Workflow>(WORKFLOWS.DETAIL(id), data),

  delete: (id: string) => api.delete<void>(WORKFLOWS.DETAIL(id)),

  // States
  listStates: async (workflowId: string): Promise<WorkflowState[]> => {
    const res = await api.get<WorkflowState[] | PaginatedResponse<WorkflowState>>(
      WORKFLOWS.STATES(workflowId),
    );
    return unwrapList(res);
  },

  createState: (
    workflowId: string,
    data: { status_id: string; is_initial?: boolean; is_final?: boolean; sort_order?: number }
  ) => api.post<WorkflowState>(WORKFLOWS.STATES(workflowId), data),

  updateState: (
    workflowId: string,
    stateId: string,
    data: Partial<{ is_initial: boolean; is_final: boolean; sort_order: number }>
  ) => api.patch<WorkflowState>(WORKFLOWS.STATE(workflowId, stateId), data),

  deleteState: (workflowId: string, stateId: string) =>
    api.delete<void>(WORKFLOWS.STATE(workflowId, stateId)),

  // Transitions
  listTransitions: async (workflowId: string): Promise<WorkflowTransition[]> => {
    const res = await api.get<WorkflowTransition[] | PaginatedResponse<WorkflowTransition>>(
      WORKFLOWS.TRANSITIONS(workflowId),
    );
    return unwrapList(res);
  },

  createTransition: (
    workflowId: string,
    data: { from_state_id: string; to_state_id: string; required_permission_id?: string }
  ) => api.post<WorkflowTransition>(WORKFLOWS.TRANSITIONS(workflowId), data),

  deleteTransition: (workflowId: string, transId: string) =>
    api.delete<void>(WORKFLOWS.TRANSITION(workflowId, transId)),
};
