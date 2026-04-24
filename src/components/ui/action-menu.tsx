"use client";

import React from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// ActionMenu — Portaled dropdown for table row actions.
// Built on Radix so it escapes parent overflow/clipping.
// ═══════════════════════════════════════════════════════════

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: "start" | "end";
  triggerSize?: number;
  triggerClassName?: string;
  label?: string;
}

export function ActionMenu({
  items,
  align = "end",
  triggerSize = 14,
  triggerClassName,
  label = "Open actions menu",
}: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={label}
          className={cn(
            "p-1 rounded hover:bg-surface-secondary transition-colors inline-flex items-center justify-center",
            "data-[state=open]:bg-surface-secondary",
            triggerClassName,
          )}
        >
          <MoreHorizontal size={triggerSize} className="text-foreground-muted" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className={cn(
            "min-w-[160px] bg-white border border-hairline rounded-md shadow-raised py-1 z-[60]",
            "data-[state=open]:animate-scale-in",
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <DropdownMenu.Separator
                  key={`sep-${i}`}
                  className="h-px my-1 bg-hairline-light"
                />
              );
            }

            const baseClass = cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer outline-none",
              "data-[highlighted]:bg-surface",
              "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
              item.danger &&
                "text-status-red-text data-[highlighted]:bg-status-red-bg",
            );

            if (item.href && !item.disabled) {
              return (
                <DropdownMenu.Item key={item.label} asChild disabled={item.disabled}>
                  <Link
                    href={item.href}
                    className={baseClass}
                    onClick={item.onClick}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenu.Item>
              );
            }

            return (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={(e) => {
                  if (item.disabled) {
                    e.preventDefault();
                    return;
                  }
                  item.onClick?.();
                }}
                className={cn(baseClass, "w-full text-left")}
              >
                {item.icon}
                <span>{item.label}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
