"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { useSidebar } from "@/components/layout/sidebar-context";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  Box,
  MapPin,
  BarChart3,
  ArrowLeftRight,
  Lock,
  Layers,
  ShoppingCart,
  FileText,
  Truck,
  ClipboardList,
  Users,
  Settings,
  Building2,
  Tag,
  Folder,
  Ruler,
  Scale,
  Hash,
  Flag,
  FileCode,
  Fingerprint,
  AlertTriangle,
  Shield,
  Paperclip,
  ReceiptText,
  ScrollText,
  Wallet,
  Banknote,
  CircleDollarSign,
  Landmark,
  UserCircle,
  HandCoins,
  Receipt,
  Coins,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  AlarmClock,
  Hourglass,
  PiggyBank,
  BookOpenText,
  FileJson,
  Lock as LockIcon,
  Sparkles,
  Upload,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Sidebar — Client Admin / Employee navigation
// ═══════════════════════════════════════════════════════════

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  /** Module-prefixed permission code, e.g. "inventory.items.read". */
  permission?: string;
}

interface NavSection {
  label: string;
  /** Module code this section requires. If the tenant isn't subscribed,
   *  the entire section is hidden (unless the user is a super admin). */
  module?: string;
  items: NavItem[];
}

// ════════════════════════════════════════════════════════════════════
// Sidebar order — designed around the day-to-day flow of Mr. Arpit
// (admin) and his Operator. Top of the bar = things touched daily;
// bottom = setup / one-time / advanced.
//
// Within each group the order also reflects frequency of use:
//   – Money     starts with "Debtors" because checking who owes us
//                is the first thing every morning.
//   – Inventory starts with Items + Stock Balances because those are
//                looked up dozens of times a day.
//
// The old "Documents" + "Billing" + "Operations" groups have been
// dissolved. Sales-side and purchase-side documents now live with
// their natural workflow groups (Sales / Purchases). Stock Counts
// joins Inventory; Parties stands on its own (used by both sides).
// ════════════════════════════════════════════════════════════════════

const NAVIGATION: NavSection[] = [
  // ── 1. Dashboard ──
  {
    label: "",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },

  // ── 2. Sales (most frequently created docs — customer side) ──
  {
    label: "Sales",
    module: "inventory",
    items: [
      { id: "challans", label: "Challans",      icon: ScrollText,  href: "/challans",                permission: "inventory.challans.read" },
      { id: "invoices", label: "Invoices",      icon: ReceiptText, href: "/invoices",                permission: "inventory.invoices.read" },
      { id: "sos",      label: "Sales Orders",  icon: FileText,    href: "/documents/sales-orders",  permission: "inventory.documents.read" },
    ],
  },

  // ── 3. Purchases (vendor side — receive goods, post bills) ──
  {
    label: "Purchases",
    module: "inventory",
    items: [
      { id: "grn",   label: "Goods Receipts",   icon: Truck,           href: "/documents/goods-receipts", permission: "inventory.documents.read" },
      { id: "bills", label: "Vendor Bills",     icon: FileSpreadsheet, href: "/bills",                    permission: "inventory.bills.read" },
      { id: "pos",   label: "Purchase Orders",  icon: ShoppingCart,    href: "/documents/purchase-orders", permission: "inventory.documents.read" },
    ],
  },

  // ── 4. Money (Admin's daily focus — collections, payments, payroll) ──
  // Order: cash-position-first, then receivables, then outflows, then ledger
  // reference data at the bottom.
  {
    label: "Money",
    module: "inventory",
    items: [
      { id: "money",         label: "Overview",       icon: Wallet,           href: "/money",              permission: "inventory.ledger.read" },
      { id: "debtors",       label: "Debtors",        icon: Building2,        href: "/money/debtors",      permission: "inventory.ledger.read" },
      { id: "receipts",      label: "Receipts",       icon: HandCoins,        href: "/money/receipts",     permission: "inventory.payments.read" },
      { id: "payments",      label: "Payments",       icon: CircleDollarSign, href: "/money/payments",     permission: "inventory.payments.read" },
      { id: "cheques",       label: "Cheques",        icon: Banknote,         href: "/money/cheques",      permission: "inventory.payments.read" },
      { id: "expenses",      label: "Expenses",       icon: Receipt,          href: "/money/expenses",     permission: "inventory.expenses.read" },
      { id: "salary",        label: "Salary",         icon: Coins,            href: "/money/salary",       permission: "inventory.salary.read" },
      { id: "payroll-batch", label: "Payroll batch",  icon: Sparkles,         href: "/money/salary/batch", permission: "inventory.salary.read" },
      { id: "accounts",      label: "Accounts",       icon: Landmark,         href: "/money/accounts",     permission: "inventory.accounts.read" },
    ],
  },

  // ── 5. Inventory (reference data — looked up daily, edited rarely) ──
  // Stock Balances + Items at the top because they're checked constantly.
  // Advanced items (Reservations, Serials, Valuation Layers, Attachments)
  // pushed to the bottom.
  {
    label: "Inventory",
    module: "inventory",
    items: [
      { id: "items",        label: "Items",            icon: Box,            href: "/items",          permission: "inventory.items.read" },
      { id: "balances",     label: "Stock Balances",   icon: BarChart3,      href: "/balances",       permission: "inventory.balances.read" },
      { id: "lots",         label: "Lots",             icon: Layers,         href: "/items/lots",     permission: "inventory.lots.read" },
      { id: "movements",    label: "Movements",        icon: ArrowLeftRight, href: "/movements",      permission: "inventory.movements.read" },
      { id: "counts",       label: "Stock Counts",     icon: ClipboardList,  href: "/counts",         permission: "inventory.counts.read" },
      { id: "transfers",    label: "Transfers",        icon: ArrowLeftRight, href: "/documents/transfers", permission: "inventory.documents.read" },
      { id: "locations",    label: "Locations & Bins", icon: MapPin,         href: "/locations",      permission: "inventory.locations.read" },
      { id: "alerts",       label: "Low Stock Alerts", icon: AlertTriangle,  href: "/alerts",         permission: "inventory.items.read" },
      // Advanced — rarely touched by Operator or Admin in day-to-day flow
      { id: "reservations", label: "Reservations",     icon: Lock,           href: "/reservations",   permission: "inventory.reservations.read" },
      { id: "serials",      label: "Serials",          icon: Fingerprint,    href: "/items/serials",  permission: "inventory.serials.read" },
      { id: "valuation",    label: "Valuation Layers", icon: Layers,         href: "/valuation",      permission: "inventory.cost.read" },
      { id: "attachments",  label: "Attachments",      icon: Paperclip,      href: "/attachments" },
    ],
  },

  // ── 6. Parties (customers + vendors + employees — the people side) ──
  // Standalone because Sales, Purchases, and Money all reference it.
  // Employees moved here from Money — they're "people" not money.
  {
    label: "Parties",
    module: "inventory",
    items: [
      { id: "parties",   label: "Customers & Vendors", icon: Building2,  href: "/parties",          permission: "inventory.parties.read" },
      { id: "employees", label: "Employees",           icon: UserCircle, href: "/money/employees",  permission: "inventory.employees.read" },
    ],
  },

  // ── 7. Reports (weekly / monthly / period-end) ──
  // Order matches the cadence of when each report gets opened:
  // monthly registers → aging → P&L/cash → GSTR filings.
  {
    label: "Reports",
    module: "inventory",
    items: [
      { id: "reports",          label: "Overview",          icon: BookOpenText, href: "/reports",                 permission: "inventory.reports.read" },
      { id: "report-sales",     label: "Sales register",    icon: TrendingUp,   href: "/reports/sales",           permission: "inventory.reports.read" },
      { id: "report-purchases", label: "Purchase register", icon: TrendingDown, href: "/reports/purchases",       permission: "inventory.reports.read" },
      { id: "report-debtors",   label: "Debtors aging",     icon: AlarmClock,   href: "/reports/debtors-aging",   permission: "inventory.reports.read" },
      { id: "report-creditors", label: "Creditors aging",   icon: Hourglass,    href: "/reports/creditors-aging", permission: "inventory.reports.read" },
      { id: "report-pl",        label: "Profit & loss",     icon: PiggyBank,    href: "/reports/profit-loss",     permission: "inventory.reports.read" },
      { id: "report-cashflow",  label: "Cash flow",         icon: PiggyBank,    href: "/reports/cash-flow",       permission: "inventory.reports.read" },
      { id: "report-gstr1",     label: "GSTR-1",            icon: FileJson,     href: "/reports/gstr-1",          permission: "inventory.reports.read" },
      { id: "report-gstr3b",    label: "GSTR-3B",           icon: FileJson,     href: "/reports/gstr-3b",         permission: "inventory.reports.read" },
    ],
  },

  // ── 8. Master Data (one-time setup; rarely touched after onboarding) ──
  // Pushed to second-to-last because Mr. Arpit visits these screens once
  // at go-live and almost never afterwards. Operator never visits — the
  // entire group is gated on `inventory.master_data.read` which only
  // Admin holds (per fixtures.ts COST_AND_FINANCIAL_READS exclusion).
  // The underlying entity-level read perms (brands/categories/uoms
  // etc.) stay granted to Operator so /items can still render brand
  // and category names alongside an item.
  {
    label: "Master Data",
    module: "inventory",
    items: [
      { id: "item-pricing",    label: "Item Pricing",    icon: Coins,          href: "/master-data/item-pricing",    permission: "inventory.master_data.read" },
      { id: "brands",          label: "Brands",          icon: Tag,            href: "/master-data/brands",          permission: "inventory.master_data.read" },
      { id: "categories",      label: "Categories",      icon: Folder,         href: "/master-data/categories",      permission: "inventory.master_data.read" },
      { id: "uoms",            label: "UoMs",            icon: Scale,          href: "/master-data/uoms",            permission: "inventory.master_data.read" },
      { id: "uom-categories",  label: "UoM Categories",  icon: Ruler,          href: "/master-data/uom-categories",  permission: "inventory.master_data.read" },
      { id: "uom-conversions", label: "UoM Conversions", icon: ArrowLeftRight, href: "/master-data/uom-conversions", permission: "inventory.master_data.read" },
      { id: "doc-types",       label: "Document Types",  icon: FileCode,       href: "/master-data/document-types",  permission: "inventory.master_data.read" },
      { id: "status-master",   label: "Status Master",   icon: Flag,           href: "/master-data/status-master",   permission: "inventory.master_data.read" },
      { id: "number-series",   label: "Number Series",   icon: Hash,           href: "/master-data/number-series",   permission: "inventory.master_data.read" },
    ],
  },

  // ── 9. Admin (rarely; period close, imports, users, settings) ──
  {
    label: "Admin",
    items: [
      { id: "users",        label: "Users",        icon: Users,    href: "/admin/users",          permission: "auth.users.read" },
      { id: "roles",        label: "Roles",        icon: Shield,   href: "/admin/roles",          permission: "auth.roles.read" },
      { id: "permissions",  label: "Permissions",  icon: Lock,     href: "/admin/permissions",    permission: "auth.roles.read" },
      { id: "imports",      label: "Bulk imports", icon: Upload,   href: "/settings/imports",     permission: "inventory.imports.read" },
      { id: "period-close", label: "Period close", icon: LockIcon, href: "/settings/period-close", permission: "inventory.period_close.read" },
      { id: "audit-log",    label: "Audit log",    icon: ScrollText, href: "/admin/audit-log",    permission: "inventory.audit_log.read" },
      { id: "settings",     label: "Settings",     icon: Settings, href: "/settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, isModuleSubscribed } = useAuth();
  const brand = useBranding();
  const Logo = brand.LogoMark;
  const { isMobileOpen, closeMobile } = useSidebar();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (label: string) => {
    setCollapsedSections((s) => {
      const n = new Set(s);
      if (n.has(label)) n.delete(label); else n.add(label);
      return n;
    });
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar-bg text-sidebar-text transition-all duration-200",
        // Mobile: absolute drawer, slides in from left
        "fixed top-0 left-0 z-50 w-[260px] shadow-xl",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop (lg+): static, part of flex row, no transform
        "lg:static lg:translate-x-0 lg:shadow-none lg:z-auto lg:flex-shrink-0",
        collapsed ? "lg:w-[52px]" : "lg:w-[220px]"
      )}
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-sidebar-border flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center flex-shrink-0 text-white">
          <Logo width="14" height="14" />
        </div>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">{brand.name}</span>}
        {/* Close button — mobile only */}
        <button
          onClick={closeMobile}
          className="ml-auto lg:hidden text-sidebar-text-muted hover:text-sidebar-text p-1 -mr-1 rounded"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAVIGATION.map((section, sIdx) => {
          // Whole-section gate: if the section belongs to a module the
          // tenant isn't subscribed to, hide it (super admins bypass).
          if (section.module && !isModuleSubscribed(section.module)) return null;

          const visibleItems = section.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (visibleItems.length === 0) return null;

          const sectionCollapsed = section.label && collapsedSections.has(section.label);

          return (
            <div key={sIdx} className={sIdx > 0 ? "mt-3" : ""}>
              {section.label && !collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="sidebar-section text-sidebar-text-muted w-full text-left hover:text-sidebar-text transition-colors cursor-pointer flex items-center gap-1"
                >
                  {section.label}
                </button>
              )}
              {section.label && collapsed && <div className="h-px bg-sidebar-border mx-1 my-2" />}
              {!sectionCollapsed && visibleItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium",
                      "transition-colors duration-100",
                      isActive
                        ? "bg-sidebar-bg-hover text-sidebar-text"
                        : "text-sidebar-text-muted hover:bg-sidebar-bg-hover hover:text-sidebar-text",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] text-sidebar-text-muted tabular-nums">{item.badge}</span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="border-t border-sidebar-border px-2 py-2 hidden lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-sidebar-text-muted hover:bg-sidebar-bg-hover hover:text-sidebar-text transition-colors"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
