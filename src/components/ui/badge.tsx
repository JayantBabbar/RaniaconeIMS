import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Badge — Status badges with consistent color coding
// Matches R1_TOKENS: gray, green, red, amber, blue, neutral
// ═══════════════════════════════════════════════════════════

type BadgeTone = "gray" | "green" | "red" | "amber" | "blue" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

const toneStyles: Record<BadgeTone, string> = {
  gray: "bg-status-gray-bg text-status-gray-text",
  green: "bg-status-green-bg text-status-green-text",
  red: "bg-status-red-bg text-status-red-text",
  amber: "bg-status-amber-bg text-status-amber-text",
  blue: "bg-status-blue-bg text-status-blue-text",
  neutral: "bg-white text-foreground-secondary border border-hairline",
};

const dotColors: Record<BadgeTone, string> = {
  gray: "bg-status-gray",
  green: "bg-status-green",
  red: "bg-status-red",
  amber: "bg-status-amber",
  blue: "bg-status-blue",
  neutral: "bg-foreground-muted",
};

export function Badge({
  children,
  tone = "gray",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm",
        "text-xs font-medium leading-snug whitespace-nowrap",
        toneStyles[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn("w-[5px] h-[5px] rounded-full", dotColors[tone])}
        />
      )}
      {children}
    </span>
  );
}

// ── Status Badge shortcuts ────────────────────────────────

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const statusMap: Record<string, { tone: BadgeTone; label: string }> = {
    draft: { tone: "gray", label: "Draft" },
    active: { tone: "green", label: "Active" },
    posted: { tone: "green", label: "Posted" },
    cancelled: { tone: "red", label: "Cancelled" },
    expired: { tone: "amber", label: "Expired" },
    inactive: { tone: "gray", label: "Inactive" },
    trialing: { tone: "blue", label: "Trial" },
    suspended: { tone: "red", label: "Suspended" },
    invited: { tone: "blue", label: "Invited" },
    disabled: { tone: "gray", label: "Disabled" },
    in_stock: { tone: "green", label: "In Stock" },
    issued: { tone: "amber", label: "Issued" },
    returned: { tone: "blue", label: "Returned" },
    scrapped: { tone: "red", label: "Scrapped" },
    reserved: { tone: "blue", label: "Reserved" },
    fulfilled: { tone: "green", label: "Fulfilled" },
    open: { tone: "blue", label: "Open" },
    applied: { tone: "green", label: "Applied" },
  };

  const mapped = statusMap[status.toLowerCase()] || {
    tone: "gray" as BadgeTone,
    label: status,
  };

  return (
    <Badge tone={mapped.tone} dot className={className}>
      {mapped.label}
    </Badge>
  );
}
