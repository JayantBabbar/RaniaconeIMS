"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Spinner } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField, Textarea } from "@/components/ui/form-elements";
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
import { countService } from "@/services/counts.service";
import { locationService } from "@/services/locations.service";
import { isApiError } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import { Plus, ClipboardList } from "lucide-react";

export default function CountsPage() {
  const { can } = useCan();
  const canWrite = can("inventory.counts.write");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["counts"],
    queryFn: () => countService.list({ limit: 200 }),
  });
  const { data: locsRaw } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationService.list({ limit: 200 }),
  });

  const allRows = data?.data || [];
  const locations = locsRaw?.data || [];
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  type CountRow = (typeof allRows)[number];

  const columns: ColumnDef<CountRow>[] = [
    { key: "count_number", label: "Number", sortable: true, filterType: "text" },
    { key: "count_date", label: "Date", sortable: true },
    {
      key: "location_id",
      label: "Location",
      sortable: true,
      filterType: "select",
      getValue: (r) => locMap.get(r.location_id)?.code || "",
      options: locations.map((l) => ({ value: l.code, label: `${l.code} — ${l.name}` })),
    },
    { key: "remarks", label: "Remarks", filterType: "text" },
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
  } = useTableFilters({ data: allRows, columns });

  return (
    <RequireRead perm="inventory.counts.read" crumbs={["Operations", "Stock Counts"]}>
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar
        crumbs={["Operations", "Stock Counts"]}
        right={
          <Can perm="inventory.counts.write">
            <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>New Count</Button>
          </Can>
        }
      />
      <div className="p-4 md:p-5 space-y-4">
        <PageHeader
          title="Stock Counts"
          description="Physical count sessions where you reconcile what's on the shelf against what the system says. Variances turn into adjustment movements when you apply the count."
          learnMore="Create a count session scoped to a location. Add each item you intend to count — the system snapshots the current balance as 'system_qty'. As you count, enter the 'counted_qty'; variance auto-fills. Apply when done — every non-zero variance books an IN or OUT adjustment movement in one transaction."
          badge={
            <Badge tone="neutral">
              {rows.length}
              {rows.length !== allRows.length ? ` / ${allRows.length}` : ""}
            </Badge>
          }
        />

        <div className="flex items-center gap-2 flex-wrap">
          <GlobalSearch
            search={search}
            setSearch={setSearch}
            placeholder="Search counts by number or remarks…"
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
              icon={<ClipboardList size={22} />}
              title={activeFilterCount > 0 ? "No counts match those filters" : "No count sessions yet"}
              description={
                activeFilterCount > 0
                  ? "Try loosening the filters, or clear them all to start over."
                  : canWrite
                    ? "Start a count session for a location when you need to reconcile what's on the shelf against what the system thinks you have."
                    : "No stock count sessions have been started yet."
              }
              action={
                activeFilterCount === 0 && canWrite ? (
                  <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Start your first count</Button>
                ) : activeFilterCount > 0 ? (
                  <Button onClick={clearAll}>Clear all filters</Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[0]} sort={sort} toggleSort={toggleSort}>Number</SortHeader>
                      <ColumnFilter col={columns[0]} value={columnFilters[columns[0].key]} onChange={(v) => setColumnFilter(columns[0].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[1]} sort={sort} toggleSort={toggleSort}>Date</SortHeader>
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SortHeader col={columns[2]} sort={sort} toggleSort={toggleSort}>Location</SortHeader>
                      <ColumnFilter col={columns[2]} value={columnFilters[columns[2].key]} onChange={(v) => setColumnFilter(columns[2].key, v)} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <span>Remarks</span>
                      <ColumnFilter col={columns[3]} value={columnFilters[columns[3].key]} onChange={(v) => setColumnFilter(columns[3].key, v)} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const loc = locMap.get(c.location_id);
                  return (
                    <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/counts/${c.id}`} className="font-mono text-xs font-bold text-brand hover:underline">
                          {c.count_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{formatDate(c.count_date)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{loc?.code || "—"}</td>
                      <td className="px-4 py-2.5 text-foreground-secondary">{c.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && <CountFormModal locations={locations} onClose={() => setShowCreate(false)} />}
    </div>
    </RequireRead>
  );
}

const countSchema = z.object({
  count_number: z.string().max(50, "Max 50 characters").optional().or(z.literal("")),
  count_date: z.string().min(1, "Count date is required"),
  location_id: z.string().min(1, "Location is required"),
  remarks: z.string().max(2000, "Too long").optional().or(z.literal("")),
});

type CountFormValues = z.infer<typeof countSchema>;

function CountFormModal({
  locations, onClose,
}: { locations: { id: string; code: string; name: string }[]; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CountFormValues>({
    resolver: zodResolver(countSchema),
    defaultValues: {
      count_number: "",
      count_date: new Date().toISOString().slice(0, 10),
      location_id: "",
      remarks: "",
    },
  });

  const onSubmit = async (data: CountFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await countService.create({
        count_number: data.count_number || undefined,
        count_date: data.count_date,
        location_id: data.location_id,
        remarks: data.remarks || undefined,
      });
      toast.success("Count session created");
      qc.invalidateQueries({ queryKey: ["counts"] });
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not create count session. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Start a stock count"
      description="Pick a location and date. Lines for each item you count are added on the next screen."
      width="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        {serverError && (
          <div
            role="alert"
            className="p-2.5 rounded-md bg-status-red-bg border border-status-red/20 text-[12.5px] text-status-red-text"
          >
            {serverError}
          </div>
        )}
        <Input
          label="Count number"
          placeholder="Auto"
          help="Leave blank to auto-allocate from the number series. Override only if your process requires a specific number."
          error={errors.count_number?.message}
          maxLength={50}
          disabled={submitting}
          {...register("count_number")}
        />
        <Input
          label="Count date"
          type="date"
          required
          help="The date the physical count is being performed."
          error={errors.count_date?.message}
          disabled={submitting}
          {...register("count_date")}
        />
        <FormField label="Location" required error={errors.location_id?.message} help="Every count session is scoped to one location — counts at multiple locations use separate sessions.">
          <select
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm bg-white border rounded focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-surface-secondary",
              errors.location_id ? "border-status-red" : "border-hairline"
            )}
            disabled={submitting}
            {...register("location_id")}
          >
            <option value="">— Select —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </select>
        </FormField>
        <Textarea label="Remarks" placeholder="Who's counting, cycle vs full, anything worth noting" {...register("remarks")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Create</Button>
        </div>
      </form>
    </Dialog>
  );
}
