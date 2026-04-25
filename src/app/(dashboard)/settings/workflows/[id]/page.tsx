"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { FormField, Checkbox, Input } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { workflowService, WorkflowState } from "@/services/workflows.service";
import { statusMasterService } from "@/services/master-data.service";
import { isApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, GitBranch, Flag, MoveRight,
} from "lucide-react";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canRead = can("inventory.workflows.read");
  const canWrite = can("inventory.workflows.write");
  const [showAddState, setShowAddState] = useState(false);
  const [showAddTransition, setShowAddTransition] = useState(false);
  const [deleteStateTarget, setDeleteStateTarget] = useState<WorkflowState | null>(null);
  const [deleteTransTarget, setDeleteTransTarget] = useState<string | null>(null);

  const { data: wf, isLoading } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowService.getById(id),
    enabled: !!id && canRead,
  });
  const { data: statesRaw } = useQuery({
    queryKey: ["workflowStates", id],
    queryFn: () => workflowService.listStates(id),
    enabled: !!id,
  });
  const { data: transRaw } = useQuery({
    queryKey: ["workflowTransitions", id],
    queryFn: () => workflowService.listTransitions(id),
    enabled: !!id,
  });
  const { data: statusMasterRaw } = useQuery({
    queryKey: ["statusMaster"],
    queryFn: () => statusMasterService.list({ limit: 200 }),
  });

  const states = statesRaw || [];
  const transitions = transRaw || [];
  const statuses = statusMasterRaw?.data || [];
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const deleteStateMut = useMutation({
    mutationFn: (stateId: string) => workflowService.deleteState(id, stateId),
    onSuccess: () => {
      toast.success("State removed");
      qc.invalidateQueries({ queryKey: ["workflowStates", id] });
      qc.invalidateQueries({ queryKey: ["workflowTransitions", id] });
      setDeleteStateTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const deleteTransMut = useMutation({
    mutationFn: (transId: string) => workflowService.deleteTransition(id, transId),
    onSuccess: () => {
      toast.success("Transition removed");
      qc.invalidateQueries({ queryKey: ["workflowTransitions", id] });
      setDeleteTransTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Settings", "Workflows"]} missingPerm="inventory.workflows.read" />;
  }
  if (isLoading || !wf) return <PageLoading />;

  const sortedStates = [...states].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Settings", "Workflows", wf.name]} />
      <div className="p-4 md:p-5 space-y-4">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Header */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <Badge tone="blue">{wf.entity}</Badge>
            {wf.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
          </div>
          <PageHeader
            title={wf.name}
            description="Define the states this workflow has and how they connect. A state is a named stage; a transition is an arrow between states."
            learnMore="Mark one state as 'initial' — that's where every new entity starts. Mark terminal states (no outgoing transitions) for final outcomes like 'Posted' or 'Cancelled'. Transitions are strictly directional — define 'Draft → Submitted' AND 'Submitted → Draft' if you want both directions to be possible."
          />
        </div>

        {/* States */}
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          <div className="px-5 py-3 flex items-center justify-between border-b border-hairline-light">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">States</h2>
              <Badge tone="neutral">{states.length}</Badge>
            </div>
            {canWrite && (
              <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowAddState(true)}>Add State</Button>
            )}
          </div>

          {sortedStates.length === 0 ? (
            <EmptyState
              icon={<Flag size={22} />}
              title="No states added yet"
              description="Pick statuses from Status Master to act as stages in this workflow. Mark one as 'initial' — that's where new records start."
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-right px-3 py-2 w-12">Order</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2">Initial</th>
                  <th className="text-center px-3 py-2">Final</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((s) => {
                  const status = statusMap.get(s.status_id);
                  return (
                    <tr key={s.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-foreground-muted">{s.sort_order}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{status?.label || "—"}</div>
                        <div className="text-xs text-foreground-muted font-mono">{status?.code}</div>
                      </td>
                      <td className="px-3 py-2 text-center">{s.is_initial ? <Badge tone="blue">Start</Badge> : "—"}</td>
                      <td className="px-3 py-2 text-center">{s.is_final ? <Badge tone="neutral">End</Badge> : "—"}</td>
                      {canWrite && (
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setDeleteStateTarget(s)}
                            className="text-foreground-muted hover:text-status-red-text">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Transitions */}
        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          <div className="px-5 py-3 flex items-center justify-between border-b border-hairline-light">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Transitions</h2>
              <Badge tone="neutral">{transitions.length}</Badge>
            </div>
            {canWrite && (
              <Button kind="primary" icon={<Plus size={13} />}
                disabled={states.length < 2}
                onClick={() => setShowAddTransition(true)}>
                Add Transition
              </Button>
            )}
          </div>

          {transitions.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={22} />}
              title="No transitions defined"
              description={states.length < 2 ? "Add at least 2 states before you can define transitions between them." : "Define which state changes are allowed — e.g. 'Draft → Submitted'. Transitions are one-way; add both directions if you need reversibility."}
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">From</th>
                  <th className="text-center px-4 py-2.5"></th>
                  <th className="text-left px-4 py-2.5">To</th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {transitions.map((t) => {
                  const fromState = stateMap.get(t.from_state_id);
                  const toState = stateMap.get(t.to_state_id);
                  const fromStatus = fromState ? statusMap.get(fromState.status_id) : null;
                  const toStatus = toState ? statusMap.get(toState.status_id) : null;
                  return (
                    <tr key={t.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5 font-medium">{fromStatus?.label || "—"}</td>
                      <td className="px-4 py-2.5 text-center"><MoveRight size={14} className="text-foreground-muted mx-auto" /></td>
                      <td className="px-4 py-2.5 font-medium">{toStatus?.label || "—"}</td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => setDeleteTransTarget(t.id)}
                            className="text-foreground-muted hover:text-status-red-text">
                            <Trash2 size={14} />
                          </button>
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

      {showAddState && (
        <AddStateModal workflowId={id} onClose={() => setShowAddState(false)}
          existingStatusIds={new Set(states.map((s) => s.status_id))}
          statuses={statuses} />
      )}
      {showAddTransition && (
        <AddTransitionModal workflowId={id} onClose={() => setShowAddTransition(false)}
          states={sortedStates} statusMap={statusMap} />
      )}
      <ConfirmDialog
        open={!!deleteStateTarget}
        onClose={() => setDeleteStateTarget(null)}
        onConfirm={() => deleteStateTarget && deleteStateMut.mutate(deleteStateTarget.id)}
        title="Remove this state?"
        description="Any transition that starts or ends at this state is removed with it. Entities currently in this state will keep their raw status, but won't be able to transition via this workflow until you re-add it."
        confirmLabel="Remove state"
        confirmKind="danger"
        loading={deleteStateMut.isPending}
      />
      <ConfirmDialog
        open={!!deleteTransTarget}
        onClose={() => setDeleteTransTarget(null)}
        onConfirm={() => deleteTransTarget && deleteTransMut.mutate(deleteTransTarget)}
        title="Remove this transition?"
        description="Users will no longer be able to move records from the From state to the To state via this workflow. Other transitions between the same states (if any) still apply."
        confirmLabel="Remove transition"
        confirmKind="danger"
        loading={deleteTransMut.isPending}
      />
    </div>
  );
}

function AddStateModal({
  workflowId, onClose, existingStatusIds, statuses,
}: {
  workflowId: string;
  onClose: () => void;
  existingStatusIds: Set<string>;
  statuses: { id: string; code: string; label: string; entity: string }[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    status_id: "",
    is_initial: false,
    is_final: false,
    sort_order: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableStatuses = statuses.filter((s) => !existingStatusIds.has(s.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.status_id) {
      setErrors({ status_id: "Select a status" });
      return;
    }
    setLoading(true);
    try {
      await workflowService.createState(workflowId, form);
      qc.invalidateQueries({ queryKey: ["workflowStates", workflowId] });
      toast.success("State added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.fieldErrors) setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("Add failed");
      }
    } finally { setLoading(false); }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a state"
      description="Pick a status to act as a stage in this workflow. Mark it as initial if it's where records start, or final if records can end there."
      width="sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormField label="Status" required error={errors.status_id} help="Only statuses not already used in this workflow appear here. Add more in Settings → Status Master if needed.">
          <select value={form.status_id}
            onChange={(e) => { setForm({ ...form, status_id: e.target.value }); setErrors({}); }}
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              errors.status_id ? "border-status-red" : "border-hairline"
            )}>
            <option value="">— Select —</option>
            {availableStatuses.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.code})</option>)}
          </select>
        </FormField>
        <Input
          label="Sort order"
          type="number"
          help="Lower numbers appear first. Use 10, 20, 30… so you can slot new states between existing ones later."
          value={form.sort_order}
          onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
        />
        <div className="flex gap-4">
          <Checkbox label="Initial state" checked={form.is_initial} onChange={(v) => setForm({ ...form, is_initial: v })} />
          <Checkbox label="Final state" checked={form.is_final} onChange={(v) => setForm({ ...form, is_final: v })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AddTransitionModal({
  workflowId, onClose, states, statusMap,
}: {
  workflowId: string;
  onClose: () => void;
  states: WorkflowState[];
  statusMap: Map<string, { label: string }>;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ from_state_id: "", to_state_id: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.from_state_id) errs.from_state_id = "Required";
    if (!form.to_state_id) errs.to_state_id = "Required";
    if (form.from_state_id && form.from_state_id === form.to_state_id)
      errs.to_state_id = "From and to must differ";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await workflowService.createTransition(workflowId, form);
      qc.invalidateQueries({ queryKey: ["workflowTransitions", workflowId] });
      toast.success("Transition added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (err.fieldErrors) setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error("Add failed");
      }
    } finally { setLoading(false); }
  };

  const stateLabel = (s: WorkflowState) => {
    const status = statusMap.get(s.status_id);
    return status ? status.label : "Unknown";
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a transition"
      description="Allow moving from one state to another. Transitions are directional — add the reverse separately if you need both ways."
      width="sm"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormField label="From state" required error={errors.from_state_id} help="The starting state. Records in this state will be allowed to move to the To state.">
          <select value={form.from_state_id}
            onChange={(e) => { setForm({ ...form, from_state_id: e.target.value }); setErrors({ ...errors, from_state_id: "" }); }}
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              errors.from_state_id ? "border-status-red" : "border-hairline"
            )}>
            <option value="">— Select —</option>
            {states.map((s) => <option key={s.id} value={s.id}>{stateLabel(s)}</option>)}
          </select>
        </FormField>
        <FormField label="To state" required error={errors.to_state_id} help="The destination state. Must be different from the From state.">
          <select value={form.to_state_id}
            onChange={(e) => { setForm({ ...form, to_state_id: e.target.value }); setErrors({ ...errors, to_state_id: "" }); }}
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              errors.to_state_id ? "border-status-red" : "border-hairline"
            )}>
            <option value="">— Select —</option>
            {states.map((s) => <option key={s.id} value={s.id}>{stateLabel(s)}</option>)}
          </select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}
