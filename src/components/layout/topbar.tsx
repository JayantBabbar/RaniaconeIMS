"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useSidebar } from "@/components/layout/sidebar-context";
import { Avatar } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { Bell, Building2, ChevronRight, ChevronDown, LogOut, Lock, Menu } from "lucide-react";

interface TopBarProps {
  crumbs?: string[];
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ crumbs, right, className }: TopBarProps) {
  const { user, tenantName, logout } = useAuth();
  const { openMobile } = useSidebar();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  // On mobile, show only the deepest crumb so the breadcrumb doesn't wrap.
  // Desktop shows the full trail.
  const mobileCrumb = crumbs && crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 md:gap-3 h-12 px-3 md:px-5 border-b border-hairline bg-white flex-shrink-0",
        className
      )}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={openMobile}
        className="lg:hidden -ml-1 p-1.5 rounded text-foreground-secondary hover:bg-surface transition-colors"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs — mobile shows last crumb only, md+ shows full trail */}
      {crumbs && crumbs.length > 0 && (
        <>
          {/* Mobile */}
          <div className="md:hidden text-sm font-medium truncate min-w-0">
            {mobileCrumb}
          </div>
          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1.5 text-sm min-w-0">
            {crumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <ChevronRight
                    size={11}
                    className="text-foreground-muted flex-shrink-0"
                  />
                )}
                <span
                  className={cn(
                    "truncate",
                    i === crumbs.length - 1
                      ? "text-foreground font-medium"
                      : "text-foreground-secondary"
                  )}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Right side actions — hidden on very small screens if clutter */}
      {right && (
        <div className="hidden sm:flex items-center gap-2">{right}</div>
      )}

      {right && <div className="hidden sm:block w-px h-5 bg-hairline" />}

      {/* Tenant — hidden on mobile */}
      {tenantName && (
        <>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-foreground-secondary">
            <Building2 size={13} className="text-foreground-muted" />
            <span className="truncate max-w-[120px]">{tenantName}</span>
            <ChevronDown size={11} className="text-foreground-muted" />
          </div>
          <div className="hidden md:block w-px h-5 bg-hairline" />
        </>
      )}

      {/* Notifications */}
      <button
        className="relative text-foreground-secondary hover:text-foreground transition-colors p-1.5 -mr-1.5"
        aria-label="Notifications"
      >
        <Bell size={16} />
        <span className="absolute top-0.5 right-0.5 w-[7px] h-[7px] rounded-full bg-status-red border-[1.5px] border-white" />
      </button>

      {/* User avatar + menu */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 p-0.5 rounded-full"
          aria-label="User menu"
        >
          {user && (
            <Avatar name={user.full_name || user.email} size={24} />
          )}
        </button>

        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-hairline rounded-md shadow-raised z-50 py-1 animate-scale-in">
              {user && (
                <div className="px-3 py-2 border-b border-hairline">
                  <div className="text-sm font-medium truncate">
                    {user.full_name}
                  </div>
                  <div className="text-xs text-foreground-muted truncate">
                    {user.email}
                  </div>
                  {/* Tenant shown here too on mobile since it's hidden in the bar */}
                  {tenantName && (
                    <div className="md:hidden text-[11px] text-foreground-muted truncate mt-1 flex items-center gap-1">
                      <Building2 size={10} />
                      {tenantName}
                    </div>
                  )}
                </div>
              )}
              <Link
                href="/account/change-password"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:bg-surface transition-colors"
              >
                <Lock size={13} />
                Change password
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:bg-surface transition-colors border-t border-hairline-light"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
