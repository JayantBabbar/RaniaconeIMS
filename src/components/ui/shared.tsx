import React from "react";
import { cn, getInitials } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Shared UI Components — Avatar, Pill, FilterChip, KPICard
// ═══════════════════════════════════════════════════════════

// ── Avatar ────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

export function Avatar({
  name,
  color = "#6366f1",
  size = 22,
  className,
}: AvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        fontSize: size * 0.42,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Pill (toggle chip) ────────────────────────────────────

interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Pill({ children, active, onClick, className }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
        active
          ? "bg-foreground text-white border-foreground"
          : "bg-white text-foreground-secondary border-hairline hover:bg-surface",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── FilterChip ────────────────────────────────────────────

interface FilterChipProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function FilterChip({ children, onClick, className }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5",
        "bg-white border border-hairline rounded",
        "text-[12.5px] text-foreground-secondary font-medium",
        "hover:bg-surface cursor-pointer transition-colors",
        className
      )}
    >
      {children}
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-foreground-muted ml-0.5"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

// ── KPI Card ──────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({
  label,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-hairline rounded-md p-3.5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] text-foreground-muted font-medium uppercase tracking-wider">
          {label}
        </div>
        {icon && <div className="text-foreground-muted">{icon}</div>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {trend && trendValue && (
          <span
            className={cn(
              "text-[11px] font-medium flex items-center gap-0.5",
              trend === "up" && "text-status-green-text",
              trend === "down" && "text-status-red-text",
              trend === "flat" && "text-foreground-muted"
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trendValue}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[11px] text-foreground-muted">
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-8 text-center",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-lg bg-surface-secondary flex items-center justify-center text-foreground-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-foreground-secondary max-w-[280px]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────

export function Spinner({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={cn("animate-spin text-brand", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-20"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Page Loading ──────────────────────────────────────────

export function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={28} />
        <span className="text-xs text-foreground-muted">Loading…</span>
      </div>
    </div>
  );
}
