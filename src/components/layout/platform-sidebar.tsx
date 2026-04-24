"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { useSidebar } from "@/components/layout/sidebar-context";
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  Activity,
  Users,
  LogOut,
  X,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Platform Sidebar — Tier 1 Service Provider Admin
// Dark theme, separate navigation from client sidebar
// ═══════════════════════════════════════════════════════════

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const PLATFORM_NAV: NavSection[] = [
  {
    label: "",
    items: [
      {
        id: "overview",
        label: "Platform Overview",
        icon: LayoutDashboard,
        href: "/platform/overview",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        id: "tenants",
        label: "Tenants",
        icon: Building2,
        href: "/platform/tenants",
      },
      {
        id: "users",
        label: "Platform Users",
        icon: Users,
        href: "/platform/users",
      },
    ],
  },
  {
    label: "Platform Data",
    items: [
      {
        id: "currencies",
        label: "Currencies",
        icon: DollarSign,
        href: "/platform/currencies",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "health",
        label: "System Health",
        icon: Activity,
        href: "/platform/health",
      },
    ],
  },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const brand = useBranding();
  const Logo = brand.LogoMark;
  const { isMobileOpen, closeMobile } = useSidebar();
  const [collapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar-bg text-sidebar-text transition-all duration-200",
        "fixed top-0 left-0 z-50 w-[260px] shadow-xl",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:static lg:translate-x-0 lg:shadow-none lg:z-auto lg:flex-shrink-0",
        collapsed ? "lg:w-[52px]" : "lg:w-[220px]"
      )}
      aria-label="Platform navigation"
    >
      {/* Logo + Platform badge */}
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-sidebar-border flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center flex-shrink-0 text-white">
          <Logo width="14" height="14" />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              {brand.name}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand/20 text-blue-400">
              Platform
            </span>
          </div>
        )}
        <button
          onClick={closeMobile}
          className="ml-auto lg:hidden text-sidebar-text-muted hover:text-sidebar-text p-1 -mr-1 rounded"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {PLATFORM_NAV.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? "mt-3" : ""}>
            {section.label && !collapsed && (
              <div className="text-[10px] font-medium uppercase tracking-wider text-sidebar-text-muted px-2.5 pt-3 pb-1.5">
                {section.label}
              </div>
            )}
            {section.label && collapsed && (
              <div className="h-px bg-sidebar-border mx-1 my-2" />
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
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
                        <span className="text-[10px] text-sidebar-text-muted tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {!collapsed && user && (
          <div className="mb-2">
            <div className="text-xs font-medium truncate">{user.full_name}</div>
            <div className="text-[10px] text-sidebar-text-muted truncate">
              Service Provider
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px]",
            "text-sidebar-text-muted hover:bg-sidebar-bg-hover hover:text-sidebar-text transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={14} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
