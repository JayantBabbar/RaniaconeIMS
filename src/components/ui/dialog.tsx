"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Dialog / Modal — confirmation dialogs, quick creates
// ═══════════════════════════════════════════════════════════

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const widthStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full mx-4 bg-white rounded-lg shadow-overlay animate-scale-in",
          widthStyles[width],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-5 pt-5 pb-0">
            {title && (
              <h2 className="text-base font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-foreground-secondary">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 pb-4 pt-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded flex items-center justify-center text-foreground-muted hover:bg-surface-secondary transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Confirm Dialog shorthand ──────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmKind?: "primary" | "danger" | "success";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmKind = "primary",
  loading,
}: ConfirmDialogProps) {
  const kindClass =
    confirmKind === "danger"
      ? "bg-status-red text-white border-status-red hover:bg-red-700"
      : confirmKind === "success"
        ? "bg-status-green text-white border-status-green hover:bg-green-700"
        : "bg-brand text-white border-brand hover:bg-brand-dark";

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} width="sm">
      <div />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={onClose}
          className="h-[30px] px-3 text-sm font-medium bg-white border border-hairline rounded hover:bg-surface transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "h-[30px] px-3 text-sm font-medium border rounded transition-colors disabled:opacity-50",
            kindClass
          )}
        >
          {loading ? "Processing…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
