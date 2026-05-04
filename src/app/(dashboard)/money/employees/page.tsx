"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { RequireRead } from "@/components/ui/forbidden-state";
import { Can, useCan } from "@/components/ui/can";
import { useToast } from "@/components/ui/toast";
import { employeeService } from "@/services/employees.service";
import { accountService } from "@/services/accounts.service";
import { isApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, UserCircle, ArrowRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Employees — minimal admin for the people who collect on
// behalf of the company.
//
// The big-picture wiring is the "Float" column — when a salesman
// receives a customer's GPay personally, that ₹ shows up here as
// money he's holding. At month-end the salary screen will net
// salary − float to figure out the actual payout.
// ═══════════════════════════════════════════════════════════

export default function EmployeesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.employees.write");
  const [showCreate, setShowCreate] = useState(false);

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeService.list({ limit: 200 }),
  });
  const employees = emps ?? [];

  const { data: accs } = useQuery({
    queryKey: ["accounts", { type: "employee_float" }],
    queryFn: () => accountService.list({ type: "employee_float", limit: 200 }),
  });
  const floatByEmp = new Map((accs ?? []).map((a) => [a.employee_id, a]));

  const createMut = useMutation({
    mutationFn: (data: { name: string; role: string; monthly_salary: string; phone?: string; email?: string; joined_at: string }) =>
      employeeService.create(data),
    onSuccess: () => {
      toast.success("Employee added");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setShowCreate(false);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Create failed"),
  });

  return (
    <RequireRead perm="inventory.employees.read">
      <TopBar />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Employees"
          description="Salesmen, drivers, accountants — anyone who collects money on the company's behalf or receives a salary. Each employee has a 'float' ledger that tracks money they're personally holding for the company."
          actions={
            <Can perm="inventory.employees.write">
              <Button onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New employee
              </Button>
            </Can>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={<UserCircle size={20} />}
            title="No employees yet"
            description={canWrite ? "Add your first employee to start tracking who's collecting what." : "Ask your admin to add employees."}
            action={canWrite ? <Button onClick={() => setShowCreate(true)}><Plus size={14} /> New employee</Button> : undefined}
          />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-subtle text-text-tertiary text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-right px-3 py-2 font-medium">Monthly salary</th>
                  <th className="text-right px-3 py-2 font-medium">Holding (float)</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const floatAcc = floatByEmp.get(e.id);
                  const floatBalance = floatAcc ? Number(floatAcc.current_balance) : 0;
                  return (
                    <tr key={e.id} className="border-t border-border hover:bg-bg-hover">
                      <td className="px-3 py-2 font-medium">{e.name}</td>
                      <td className="px-3 py-2 text-text-secondary">{e.role}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(e.monthly_salary, "INR", "en-IN")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {floatBalance > 0 ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {formatCurrency(floatBalance, "INR", "en-IN")}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={e.is_active ? "green" : "neutral"}>
                          {e.is_active ? "active" : "inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {floatAcc && (
                          <Link
                            href={`/money/ledger/${floatAcc.id}`}
                            className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
                          >
                            Ledger <ArrowRight size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateEmployeeDialog onClose={() => setShowCreate(false)} onSubmit={(d) => createMut.mutate(d)} loading={createMut.isPending} />}
    </RequireRead>
  );
}

// ── Create dialog ─────────────────────────────────────────
interface CreateProps {
  onClose: () => void;
  onSubmit: (data: { name: string; role: string; monthly_salary: string; phone?: string; email?: string; joined_at: string }) => void;
  loading: boolean;
}

function CreateEmployeeDialog({ onClose, onSubmit, loading }: CreateProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));

  const valid = name.trim() && role.trim() && Number(salary) > 0 && joinedAt;

  return (
    <Dialog open onClose={onClose} title="New employee" width="md">
      <div className="space-y-3">
        <FormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh Kumar" autoFocus />
        </FormField>
        <FormField label="Role" required hint="Free-text job title — not an RBAC role.">
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Sales Executive — MUM-N" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Monthly salary (₹)" required>
            <Input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="45000" type="number" />
          </FormField>
          <FormField label="Joined on" required>
            <Input value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} type="date" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98200…" />
          </FormField>
          <FormField label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ramesh@…" type="email" />
          </FormField>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => valid && onSubmit({ name, role, monthly_salary: salary, phone: phone || undefined, email: email || undefined, joined_at: joinedAt })}
          disabled={!valid || loading}
        >
          {loading ? <Spinner size={14} /> : "Create employee"}
        </Button>
      </div>
    </Dialog>
  );
}
