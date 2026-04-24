import React from "react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Button — All variants from the design system
// primary, secondary, ghost, danger, success, dark
// ═══════════════════════════════════════════════════════════

type ButtonKind = "primary" | "secondary" | "ghost" | "danger" | "success" | "dark";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonKind;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const kindStyles: Record<ButtonKind, string> = {
  primary:
    "bg-brand text-white border-brand shadow-btn-primary hover:bg-brand-dark active:bg-brand-700",
  secondary:
    "bg-white text-foreground border-hairline shadow-card hover:bg-surface active:bg-surface-secondary",
  ghost:
    "bg-transparent text-foreground-secondary border-transparent hover:bg-surface-secondary active:bg-hairline",
  danger:
    "bg-white text-status-red-text border-red-200 shadow-card hover:bg-status-red-bg active:bg-red-100",
  success:
    "bg-status-green text-white border-status-green shadow-btn-success hover:bg-green-700 active:bg-green-800",
  dark:
    "bg-foreground text-white border-foreground shadow-btn-dark hover:bg-neutral-800 active:bg-neutral-900",
};

// Mobile uses a taller hit area (min ~32–40px) then collapses to design-system
// density on md+. Text + padding stay the same across breakpoints.
const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 md:h-[26px] px-2.5 text-xs gap-1.5",
  md: "h-9 md:h-[30px] px-3 text-sm gap-1.5",
  lg: "h-10 md:h-9 px-3.5 text-sm gap-2",
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 12,
  md: 13,
  lg: 14,
};

export function Button({
  children,
  kind = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded whitespace-nowrap",
        "border transition-colors duration-100 cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        kindStyles[kind],
        sizeStyles[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin"
          width={iconSizes[size]}
          height={iconSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </button>
  );
}
