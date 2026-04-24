import React from "react";
import { cn } from "@/lib/utils";
import { HelpHint } from "./help-hint";

// ═══════════════════════════════════════════════════════════════════
// PageHeader — standard page intro block.
//
// Pattern every admin page should follow:
//   <PageHeader
//     title="Units of Measure"
//     description="Define the units (kg, litre, box, each) your team
//        uses to quantify items. Add conversions so 1 box = 24 pieces."
//     learnMore="These are reused every time you add an item, receive
//        stock, or ship an order — keep the list tight and meaningful."
//     actions={<Button kind="primary">Add UoM</Button>}
//   />
//
// The description should be ONE sentence in plain language — explain
// *why* the page exists, not *how* to use it. Put deeper context in
// `learnMore` (surfaces as a tooltip) or in per-field `help` props.
// ═══════════════════════════════════════════════════════════════════

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Longer explanation, surfaces as a tooltip on a (?) icon. */
  learnMore?: string;
  /** Buttons/links slot (right-aligned). */
  actions?: React.ReactNode;
  /** Extra badge (e.g. item count) next to the title. */
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  learnMore,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 flex-wrap",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {badge}
          {learnMore && (
            <HelpHint size={13} tone="muted">
              {learnMore}
            </HelpHint>
          )}
        </div>
        {description && (
          <p className="text-sm text-foreground-secondary mt-1 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
