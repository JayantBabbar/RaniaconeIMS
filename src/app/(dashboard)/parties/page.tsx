"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { ActionMenu } from "@/components/ui/action-menu";
import { Can, useCan } from "@/components/ui/can";
import { RequireRead } from "@/components/ui/forbidden-state";
import {
  GlobalSearch,
  SortHeader,
  ColumnFilter,
  ActiveFilterBar,
} from "@/components/ui/table-toolkit";
import { useTableFilters, type ColumnDef } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { currencyService } from "@/services/platform.service";
import { isApiError } from "@/lib/api-client";
import type { Party } from "@/types";
import { Plus, Edit, Trash2, Building2, Eye } from "lucide-react";

const PARTY_TYPES = ["customer", "supplier", "both"] as const;

export default function PartiesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { can } = useCan();
  const canWrite = can("inventory.parties.write");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Party | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["parties"],
    queryFn: () => partyService.list({ limit: 200 }),
  });
  const parties = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => partyService.delete(id),
    onSuccess: () => {
      toast.success("Party deleted");
      qc.invalidateQueries({ queryKey: ["parties"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Delete failed"),
  });

  const typeTone = (t?: string): "green" | "blue" | "amber" | "neutral" => {
    if (t === "customer") return "blue";
    if (t === "supplier") return "green";
    if (t === "both") return "amber";
    return "neutral";
  };

  // ── Column config drives search / sort / filter ─────────────
  const columns: ColumnDef<Party>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      filterType: "text",
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      filterType: "text",
    },
    {
      key: "legal_name",
      label: "Legal name",
      sortable: true,
      searchable: false,
      filterType: "text",
    },
    {
      key: "party_type",
      label: "Type",
      sortable: true,
      filterType: "select",
      options: PARTY_TYPES.map((t) => ({ value: t, label: t })),
    },
    {
      key: "tax_id",
      label: "Tax ID",
      filterType: "text",
    },
    {
      key: "is_active",
      label: "Active",
      sortable: true,
      filterType: "boolean",
    },
  ];

  const {
    rows,
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAll,
    activeFilterCount,
  } = useTableFilters({ data: parties, columns });

  return (
    <RequireRead perm="inventory.parties.read" crumbs={["Parties"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Parties"]}
        right={
          <Can perm="inventory.parties.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
              Add Party
            </Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Parties"
          description="The businesses you buy from and sell to. Suppliers and customers both live here — one entry per company, with their addresses, contacts, tax ID, and default currency."
          learnMore={`A party is tagged as a "supplier", "customer", or "both". Purchase Orders need a supplier; Sales Orders need a customer. Addresses and contacts are managed on each party's detail page. Currency is optional — if blank, transactions use your workspace's default currency.`}
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== parties.length ? ` / ${parties.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search by code or name…"
          />
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <span className="text-[11px] text-foreground-muted">
              {rows.length} match{rows.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <ActiveFilterBar
            columns={columns}
            search={search}
            setSearch={setSearch}
            columnFilters={columnFilters}
            clearColumnFilter={clearColumnFilter}
            clearAll={clearAll}
            activeFilterCount={activeFilterCount}
          />
        )}

        <div className="bg-white border border-hairline rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex justify-center"><Spinner size={24} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Building2 size={22} />}
              title={activeFilterCount > 0 ? "No parties match those filters" : "No parties yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Add your suppliers and customers — you'll pick from them every time you create a Purchase Order or Sales Order."
                    : "Your admin hasn't added any suppliers or customers yet. Once they do, you'll see them here."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button
                    kind="primary"
                    icon={<Plus size={13} />}
                    onClick={() => setShowCreate(true)}
                  >
                    Add your first party
                  </Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  {columns.slice(0, 4).map((col) => (
                    <th key={col.key} className="text-left px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <SortHeader col={col} sort={sort} toggleSort={toggleSort}>
                          {col.label}
                        </SortHeader>
                        <ColumnFilter
                          col={col}
                          value={columnFilters[col.key]}
                          onChange={(v) => setColumnFilter(col.key, v)}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[4]} sort={sort} toggleSort={toggleSort}>
                        {columns[4].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[4]}
                        value={columnFilters[columns[4].key]}
                        onChange={(v) => setColumnFilter(columns[4].key, v)}
                      />
                    </div>
                  </th>
                  <th className="text-center px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <SortHeader col={columns[5]} sort={sort} toggleSort={toggleSort} align="center">
                        {columns[5].label}
                      </SortHeader>
                      <ColumnFilter
                        col={columns[5]}
                        value={columnFilters[columns[5].key]}
                        onChange={(v) => setColumnFilter(columns[5].key, v)}
                      />
                    </div>
                  </th>
                  {canWrite && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-hairline-light hover:bg-surface/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{p.code}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/parties/${p.id}`} className="font-medium hover:text-brand">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground-secondary">
                      {p.legal_name || "—"}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone={typeTone(p.party_type)}>{p.party_type || "—"}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground-secondary">{p.tax_id || "—"}</td>
                    <td className="px-4 py-2.5 text-center">{p.is_active ? "✓" : "—"}</td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: "View",
                              icon: <Eye size={12} />,
                              href: `/parties/${p.id}`,
                            },
                            {
                              label: "Edit",
                              icon: <Edit size={12} />,
                              onClick: () => setEditTarget(p),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete",
                              icon: <Trash2 size={12} />,
                              danger: true,
                              onClick: () => setDeleteTarget(p),
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PartyFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <PartyFormModal open={!!editTarget} onClose={() => setEditTarget(null)} target={editTarget} />}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={`Existing documents referring to this party stay intact for audit, but you won't be able to create new ones. If this is a temporary pause, mark the party inactive instead.`}
        confirmLabel="Delete party"
        confirmKind="danger"
        loading={deleteMut.isPending}
      />
    </div>
    </RequireRead>
  );
}

function PartyFormModal({ open, onClose, target }: { open: boolean; onClose: () => void; target?: Party }) {
  const toast = useToast();
  const qc = useQueryClient();
  const isEdit = !!target;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: target?.code || "",
    name: target?.name || "",
    legal_name: target?.legal_name || "",
    tax_id: target?.tax_id || "",
    party_type: target?.party_type || "customer",
    currency_id: target?.currency_id || "",
    is_active: target?.is_active ?? true,
  });

  const { data: currenciesRaw } = useQuery({
    queryKey: ["currenciesForSelect"],
    queryFn: () => currencyService.list({ limit: 200 }),
  });
  const currencies = currenciesRaw ?? [];
  const sortedCurrencies = [...currencies].sort((a, b) => a.code.localeCompare(b.code));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await partyService.update(target!.id, {
          name: form.name,
          legal_name: form.legal_name,
          tax_id: form.tax_id,
          party_type: form.party_type,
          currency_id: form.currency_id,
          is_active: form.is_active,
        });
      } else {
        await partyService.create({
          code: form.code,
          name: form.name,
          legal_name: form.legal_name || undefined,
          tax_id: form.tax_id || undefined,
          party_type: form.party_type,
          currency_id: form.currency_id || undefined,
          is_active: form.is_active,
        });
      }
      toast.success(isEdit ? "Party updated" : "Party created");
      qc.invalidateQueries({ queryKey: ["parties"] });
      onClose();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Save failed");
    } finally { setLoading(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit "${target?.name}"` : "Add a party"}
      description={
        isEdit
          ? "Update this party's details. Code is permanent — if you need a different code, delete and recreate."
          : "A party is a company you do business with — supplier, customer, or both. Once added, you can manage their addresses and contacts on their detail page."
      }
      width="md"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Code"
            placeholder="ACME-CO"
            required
            disabled={isEdit}
            help="Short unique identifier (e.g. ACME-CO). Shown in documents and reports. Cannot be changed later."
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          <FormField
            label="Type"
            required
            help={`"Customer" = you sell to them. "Supplier" = you buy from them. "Both" = you do both.`}
          >
            <select
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.party_type}
              onChange={(e) => setForm({ ...form, party_type: e.target.value })}
            >
              {PARTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>
        <Input
          label="Display name"
          placeholder="Acme Corp"
          required
          help="What you'll see in dropdowns and tables. Keep it short and recognisable."
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Legal name"
          placeholder="Acme Corporation Pvt Ltd"
          help="The full registered name. Used on invoices and official documents. Leave blank if it's the same as the display name."
          value={form.legal_name}
          onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Tax ID / GSTIN"
            placeholder="29AAAAA0000A1Z5"
            help="Tax registration number — GSTIN in India, VAT in Europe, EIN in the US. Required for compliance-heavy workflows."
            value={form.tax_id}
            onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
          />
          <FormField
            label="Default currency"
            help="If this party always trades in a specific currency, set it here. Leave blank to use your workspace's default on each document."
          >
            <select
              className="w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={form.currency_id}
              onChange={(e) => setForm({ ...form, currency_id: e.target.value })}
            >
              <option value="">— Workspace default —</option>
              {sortedCurrencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <Checkbox
          label="Active — inactive parties stay in history but can't be used on new documents"
          checked={form.is_active}
          onChange={(v) => setForm({ ...form, is_active: v })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={loading}>
            {isEdit ? "Save changes" : "Add party"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
