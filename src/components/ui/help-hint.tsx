"use client";

import React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════
// HelpHint — a small (?) icon that shows a tooltip on hover/focus.
//
// Use next to a form-field label, section title, or anywhere the user
// might want a one-liner explanation without cluttering the UI.
//
//   <label>
//     Workspace Code
//     <HelpHint>Your company's short identifier, set when the
//        workspace was created. Ask your admin if unsure.</HelpHint>
//   </label>
//
// Longer help should live in a page description block or a dedicated
// explainer card — not in a tooltip.
// ═══════════════════════════════════════════════════════════════════

interface HelpHintProps {
  children: React.ReactNode;
  size?: number;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Override the default ring/icon colour, e.g. for dark backgrounds. */
  tone?: "muted" | "brand";
}

export function HelpHint({
  children,
  size = 12,
  className,
  side = "top",
  align = "center",
  tone = "muted",
}: HelpHintProps) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="More information"
            className={cn(
              "inline-flex items-center justify-center rounded-full p-0.5 align-middle",
              "focus:outline-none focus:ring-2 focus:ring-brand/40",
              tone === "muted"
                ? "text-foreground-muted hover:text-foreground-secondary"
                : "text-brand hover:text-brand-dark",
              className,
            )}
          >
            <HelpCircle size={size} strokeWidth={1.75} />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            className={cn(
              "max-w-[260px] z-[70] rounded-md bg-foreground px-2.5 py-1.5 text-[11.5px] leading-relaxed text-white shadow-raised",
              "data-[state=delayed-open]:animate-fade-in",
            )}
          >
            {children}
            <Tooltip.Arrow className="fill-foreground" width={10} height={5} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
