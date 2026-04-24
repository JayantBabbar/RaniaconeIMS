import React from "react";
import { cn } from "@/lib/utils";
import { HelpHint } from "./help-hint";

// ═══════════════════════════════════════════════════════════
// Form Elements — Input, Select, Checkbox, FormField
// ═══════════════════════════════════════════════════════════

// ── Shared label renderer ────────────────────────────────

interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  required?: boolean;
  help?: React.ReactNode;
}

function FieldLabel({ htmlFor, label, required, help }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted"
    >
      <span>
        {label}
        {required && (
          <span aria-hidden className="text-status-red ml-0.5">*</span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {help && <HelpHint size={11}>{help}</HelpHint>}
    </label>
  );
}

// ── Input ─────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: string;
  icon?: React.ReactNode;
  /** Visually marks the field with a red asterisk and annotates for a11y. */
  required?: boolean;
  /** Short explanation surfaced as a (?) tooltip next to the label. */
  help?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, suffix, icon, required, help, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <FieldLabel htmlFor={inputId} label={label} required={required} help={help} />
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "w-full h-9 md:h-[30px] px-2.5 text-sm font-medium",
              "bg-white border border-hairline rounded",
              "placeholder:text-foreground-muted placeholder:font-normal",
              "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
              "disabled:bg-surface-secondary disabled:text-foreground-muted disabled:cursor-not-allowed",
              "transition-colors duration-100",
              icon && "pl-8",
              suffix && "pr-24",
              error && "border-status-red focus:ring-status-red/20 focus:border-status-red",
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted font-mono">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-[11px] text-status-red-text">{error}</p>}
        {hint && !error && (
          <p className="text-[11px] text-foreground-muted">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ── Textarea ──────────────────────────────────────────────

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[10.5px] font-medium uppercase tracking-wider text-foreground-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-2.5 py-2 text-sm",
            "bg-white border border-hairline rounded",
            "placeholder:text-foreground-muted",
            "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
            "resize-y min-h-[60px]",
            error && "border-status-red",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-status-red-text">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ── Checkbox ──────────────────────────────────────────────

interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  label,
  checked = false,
  onChange,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div
        className={cn(
          "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors",
          checked
            ? "bg-brand border-brand"
            : "bg-white border-foreground-faint"
        )}
        onClick={() => !disabled && onChange?.(!checked)}
      >
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      {label && (
        <span className="text-[12.5px] text-foreground-secondary">{label}</span>
      )}
    </label>
  );
}

// ── FormField wrapper ─────────────────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  /** Short explanation surfaced as a (?) tooltip next to the label. */
  help?: React.ReactNode;
  /** Persistent hint shown under the control when there's no error. */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  error,
  help,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel label={label} required={required} help={help} />
      {children}
      {error && <p className="text-[11px] text-status-red-text">{error}</p>}
      {hint && !error && (
        <p className="text-[11px] text-foreground-muted">{hint}</p>
      )}
    </div>
  );
}
