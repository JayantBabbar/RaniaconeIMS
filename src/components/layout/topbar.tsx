"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Avatar } from "@/components/ui/shared";
import { cn } from "@/lib/utils";
import { Bell, Building2, ChevronRight, ChevronDown, LogOut, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TopBar — Breadcrumbs, tenant info, notifications, avatar
// ═══════════════════════════════════════════════════════════

interface TopBarProps {
  crumbs?: string[];
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ crumbs, right, className }: TopBarProps) {
  const { user, tenantName, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-3 h-12 px-5 border-b border-hairline bg-white flex-shrink-0",
        className
      )}
    >
      {/* Breadcrumbs */}
      {crumbs && crumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <ChevronRight
                  size={11}
                  className="text-foreground-muted"
                />
              )}
              <span
                className={cn(
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
      )}

      <div className="flex-1" />

      {/* Right side actions */}
      {right && (
        <div className="flex items-center gap-2">{right}</div>
      )}

      {right && <div className="w-px h-5 bg-hairline" />}

      {/* Tenant */}
      {tenantName && (
        <>
          <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
            <Building2 size={13} className="text-foreground-muted" />
            <span>{tenantName}</span>
            <ChevronDown size={11} className="text-foreground-muted" />
          </div>
          <div className="w-px h-5 bg-hairline" />
        </>
      )}

      {/* Notifications */}
      <button className="relative text-foreground-secondary hover:text-foreground transition-colors">
        <Bell size={15} />
        <span className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] rounded-full bg-status-red border-[1.5px] border-white" />
      </button>

      {/* User avatar + menu */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2"
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
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-hairline rounded-md shadow-raised z-50 py-1 animate-scale-in">
              {user && (
                <div className="px-3 py-2 border-b border-hairline">
                  <div className="text-sm font-medium truncate">
                    {user.full_name}
                  </div>
                  <div className="text-xs text-foreground-muted truncate">
                    {user.email}
                  </div>
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
