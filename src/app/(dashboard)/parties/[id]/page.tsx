"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, Spinner, EmptyState } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { Input, FormField, Checkbox } from "@/components/ui/form-elements";
import { useCan } from "@/components/ui/can";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { useToast } from "@/components/ui/toast";
import { partyService } from "@/services/parties.service";
import { isApiError } from "@/lib/api-client";
import { formatDate, getInitials } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Phone, Mail, Plus, Building2, User,
} from "lucide-react";

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useCan();
  const canRead = can("inventory.parties.read");
  const canWrite = can("inventory.parties.write");
  const [tab, setTab] = useState<"overview" | "addresses" | "contacts">("overview");

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: () => partyService.getById(id),
    enabled: !!id && canRead,
  });

  if (!canRead) {
    return <ForbiddenState crumbs={["Parties"]} missingPerm="inventory.parties.read" />;
  }
  if (isLoading || !party) return <PageLoading />;

  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Parties", party.name]} />
      <div className="p-5 space-y-4">
        <button
          onClick={() => router.push("/parties")}
          className="flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to parties
        </button>

        {/* Header card */}
        <div className="bg-white border border-hairline rounded-md p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-light flex items-center justify-center text-base font-bold text-brand flex-shrink-0">
              {getInitials(party.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge tone={party.party_type === "customer" ? "blue" : party.party_type === "supplier" ? "green" : "amber"}>
                  {party.party_type || "—"}
                </Badge>
                {!party.is_active && <Badge tone="red">inactive</Badge>}
              </div>
              <PageHeader
                title={party.name}
                description="Everything about this supplier/customer — addresses, contacts, tax ID, and custom fields. Used on every document tied to this party."
                learnMore="A party can have multiple addresses (billing, shipping, etc.) and multiple contacts. On a document, you pick one address and optionally one contact. If you disable a party here, they can't be selected on new documents but existing ones stay intact."
                className="mt-1"
              />
              <div className="text-xs text-foreground-muted mt-1">
                <code className="font-mono">{party.code}</code>
                {party.legal_name && <span> · {party.legal_name}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-hairline">
          <div className="flex gap-0">
            {(["overview", "addresses", "contacts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px " +
                  (tab === t
                    ? "text-brand border-brand"
                    : "text-foreground-secondary border-transparent hover:text-foreground")
                }
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" && (
          <div className="bg-white border border-hairline rounded-md p-5 space-y-4 max-w-xl">
            <Row label="Code" value={party.code} mono />
            <Row label="Legal name" value={party.legal_name || "—"} />
            <Row label="Tax ID / GSTIN" value={party.tax_id || "—"} mono />
            <Row label="Currency" value={party.currency_id || "—"} mono />
            <Row label="Created" value={formatDate(party.created_at)} />
            <Row label="Updated" value={formatDate(party.updated_at)} />
          </div>
        )}

        {tab === "addresses" && <AddressesTab partyId={party.id} canWrite={canWrite} />}
        {tab === "contacts" && <ContactsTab partyId={party.id} canWrite={canWrite} />}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="w-32 text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider pt-0.5">
        {label}
      </div>
      <div className={"text-sm font-medium flex-1 " + (mono ? "font-mono text-xs" : "")}>{value}</div>
    </div>
  );
}

function AddressesTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["partyAddresses", partyId],
    queryFn: () => partyService.listAddresses(partyId),
  });
  const rows = data?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-foreground-secondary">Ship-to, bill-to, and office addresses.</p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Address</Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Spinner size={20} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} />}
          title="No addresses on file for this party"
          description="Add at least one address so you can ship-to or bill-to this party on future documents."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rows.map((a) => (
            <div key={a.id} className="bg-white border border-hairline rounded-md p-4">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-brand mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.address_type}</span>
                    {a.is_primary && <Badge tone="blue">Primary</Badge>}
                  </div>
                  <div className="text-sm mt-1 text-foreground-secondary leading-snug">
                    {a.line1}
                    {a.line2 && <><br />{a.line2}</>}
                    <br />
                    {[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                    {a.country && <><br />{a.country}</>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <AddressFormModal partyId={partyId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

const addressSchema = z.object({
  address_type: z.string().min(1),
  line1: z.string().trim().min(1, "Address line 1 is required").max(255, "Too long"),
  line2: z.string().max(255, "Too long").optional().or(z.literal("")),
  city: z.string().max(100, "Too long").optional().or(z.literal("")),
  state: z.string().max(100, "Too long").optional().or(z.literal("")),
  postal_code: z.string().max(30, "Too long").optional().or(z.literal("")),
  country: z.string().max(100, "Too long").optional().or(z.literal("")),
  is_primary: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressSchema>;

function AddressFormModal({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address_type: "billing",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "India",
      is_primary: false,
    },
  });

  const onSubmit = async (data: AddressFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await partyService.createAddress(partyId, data);
      qc.invalidateQueries({ queryKey: ["partyAddresses", partyId] });
      toast.success("Address added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save address. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add an address"
      description="Billing, shipping, office, or warehouse — one address per record. A party can have many."
      width="md"
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
        <FormField label="Type" help="What this address is for — helps filter addresses when picking one on a document.">
          <select
            className="w-full h-[30px] px-2.5 text-sm bg-white border border-hairline rounded focus:outline-none focus:ring-2 focus:ring-brand/20"
            disabled={submitting}
            {...register("address_type")}
          >
            <option value="billing">Billing</option>
            <option value="shipping">Shipping</option>
            <option value="office">Office</option>
            <option value="warehouse">Warehouse</option>
          </select>
        </FormField>
        <Input
          label="Line 1"
          placeholder="Street address, P.O. box"
          required
          help="The first line of the postal address — usually street and number."
          error={errors.line1?.message}
          disabled={submitting}
          {...register("line1")}
        />
        <Input
          label="Line 2"
          placeholder="Apartment, suite, building"
          help="Optional — extra address detail if it doesn't fit on line 1."
          error={errors.line2?.message}
          disabled={submitting}
          {...register("line2")}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="City" placeholder="Bengaluru" error={errors.city?.message} disabled={submitting} {...register("city")} />
          <Input label="State" placeholder="Karnataka" error={errors.state?.message} disabled={submitting} {...register("state")} />
          <Input label="Postal code" placeholder="560001" error={errors.postal_code?.message} disabled={submitting} {...register("postal_code")} />
        </div>
        <Input label="Country" placeholder="India" error={errors.country?.message} disabled={submitting} {...register("country")} />
        <Checkbox
          label="Set as primary for this type"
          checked={watch("is_primary")}
          onChange={(v) => setValue("is_primary", v)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ContactsTab({ partyId, canWrite }: { partyId: string; canWrite: boolean }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["partyContacts", partyId],
    queryFn: () => partyService.listContacts(partyId),
  });
  const rows = data?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-foreground-secondary">People at this party — for approvals, notifications, or deliveries.</p>
        {canWrite && (
          <Button kind="primary" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>Add Contact</Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Spinner size={20} /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<User size={22} />}
          title="No contacts saved yet"
          description="Add a contact person so documents tied to this party have someone to name for approvals, notifications, or deliveries."
        />
      ) : (
        <div className="bg-white border border-hairline rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-center px-4 py-2.5">Primary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-hairline-light hover:bg-surface/50">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-foreground-secondary">{c.role || "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.email ? (
                      <a href={"mailto:" + c.email} className="text-brand hover:underline">
                        <Mail size={12} className="inline mr-1" />{c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {c.phone ? <><Phone size={12} className="inline mr-1" />{c.phone}</> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">{c.is_primary ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <ContactFormModal partyId={partyId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Too long"),
  role: z.string().max(100, "Too long").optional().or(z.literal("")),
  email: z
    .string()
    .max(255, "Too long")
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(50, "Too long").optional().or(z.literal("")),
  is_primary: z.boolean(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

function ContactFormModal({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", role: "", is_primary: false },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await partyService.createContact(partyId, data);
      qc.invalidateQueries({ queryKey: ["partyContacts", partyId] });
      toast.success("Contact added");
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setServerError(Object.values(err.fieldErrors).join(", "));
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Could not save contact. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a contact"
      description="A person at this party — buyer, accounts, delivery coordinator. Referenced on documents for approvals and notifications."
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
          label="Full name"
          placeholder="Priya Sharma"
          required
          help="The contact's full name, as it should appear in documents and notifications."
          error={errors.name?.message}
          disabled={submitting}
          {...register("name")}
        />
        <Input
          label="Role"
          placeholder="Purchasing Manager"
          help="Their job title or role. Optional, but useful for knowing who to reach for what."
          error={errors.role?.message}
          disabled={submitting}
          {...register("role")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="priya@example.com"
          help="Used for document-related notifications if email sending is configured."
          error={errors.email?.message}
          disabled={submitting}
          {...register("email")}
        />
        <Input
          label="Phone"
          placeholder="+91 98765 43210"
          error={errors.phone?.message}
          disabled={submitting}
          {...register("phone")}
        />
        <Checkbox
          label="Set as primary contact"
          checked={watch("is_primary")}
          onChange={(v) => setValue("is_primary", v)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" kind="primary" loading={submitting}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}
