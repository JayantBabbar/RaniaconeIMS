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

const NAVIGATION: NavSection[] = [
  {
    label: "",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    label: "Master Data",
    module: "inventory",
    items: [
      { id: "status-master", label: "Status Master", icon: Flag, href: "/master-data/status-master", permission: "inventory.status_master.read" },
      { id: "number-series", label: "Number Series", icon: Hash, href: "/master-data/number-series", permission: "inventory.number_series.read" },
      { id: "uom-categories", label: "UoM Categories", icon: Ruler, href: "/master-data/uom-categories", permission: "inventory.uoms.read" },
      { id: "uoms", label: "UoMs", icon: Scale, href: "/master-data/uoms", permission: "inventory.uoms.read" },
      { id: "uom-conversions", label: "UoM Conversions", icon: ArrowLeftRight, href: "/master-data/uom-conversions", permission: "inventory.uoms.read" },
      { id: "brands", label: "Brands", icon: Tag, href: "/master-data/brands", permission: "inventory.brands.read" },
      { id: "categories", label: "Categories", icon: Folder, href: "/master-data/categories", permission: "inventory.categories.read" },
      { id: "doc-types", label: "Document Types", icon: FileCode, href: "/master-data/document-types", permission: "inventory.documents.read" },
    ],
  },
  {
    label: "Inventory",
    module: "inventory",
    items: [
      { id: "items", label: "Items", icon: Box, href: "/items", permission: "inventory.items.read" },
      { id: "lots", label: "Lots", icon: Layers, href: "/items/lots", permission: "inventory.lots.read" },
      { id: "serials", label: "Serials", icon: Fingerprint, href: "/items/serials", permission: "inventory.serials.read" },
      { id: "locations", label: "Locations & Bins", icon: MapPin, href: "/locations", permission: "inventory.locations.read" },
      { id: "balances", label: "Stock Balances", icon: BarChart3, href: "/balances", permission: "inventory.balances.read" },
      { id: "movements", label: "Movements", icon: ArrowLeftRight, href: "/movements", permission: "inventory.movements.read" },
      { id: "reservations", label: "Reservations", icon: Lock, href: "/reservations", permission: "inventory.reservations.read" },
      { id: "valuation", label: "Valuation Layers", icon: Layers, href: "/valuation", permission: "inventory.balances.read" },
      { id: "alerts", label: "Low Stock Alerts", icon: AlertTriangle, href: "/alerts", permission: "inventory.items.read" },
      { id: "attachments", label: "Attachments", icon: Paperclip, href: "/attachments" },
    ],
  },
  {
    label: "Documents",
    module: "inventory",
    items: [
      { id: "pos", label: "Purchase Orders", icon: ShoppingCart, href: "/documents/purchase-orders", permission: "inventory.documents.read" },
      { id: "sos", label: "Sales Orders", icon: FileText, href: "/documents/sales-orders", permission: "inventory.documents.read" },
      { id: "transfers", label: "Transfers", icon: Truck, href: "/documents/transfers", permission: "inventory.documents.read" },
    ],
  },
  {
    label: "Operations",
    module: "inventory",
    items: [
      { id: "counts", label: "Stock Counts", icon: ClipboardList, href: "/counts", permission: "inventory.counts.read" },
      { id: "parties", label: "Parties", icon: Building2, href: "/parties", permission: "inventory.parties.read" },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "users", label: "Users", icon: Users, href: "/admin/users", permission: "auth.users.read" },
      { id: "roles", label: "Roles", icon: Shield, href: "/admin/roles", permission: "auth.roles.read" },
      { id: "permissions", label: "Permissions", icon: Lock, href: "/admin/permissions", permission: "auth.roles.read" },
      { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
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
