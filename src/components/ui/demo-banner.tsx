"use client";

import React, { useState } from "react";
import { DEMO_MODE } from "@/lib/api-client";
import { Info, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Demo banner — only renders when NEXT_PUBLIC_DEMO_MODE=true.
// Thin strip at the top of the page reminding the viewer this is a
// live demo against in-memory data. Dismissable per-session.
// ═══════════════════════════════════════════════════════════════════

const DISMISS_KEY = "demo_banner_dismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  if (!DEMO_MODE || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-[12px] text-amber-900"
    >
      <Info size={13} className="flex-shrink-0" />
      <span className="flex-1 leading-relaxed">
        <strong>Demo mode.</strong> Running against in-memory fixtures — your
        changes won&apos;t persist across refreshes. Sign-in with{" "}
        <code className="font-mono font-medium">admin@demo.com</code> /{" "}
        <code className="font-mono font-medium">demo123</code> (or{" "}
        <code className="font-mono">ops@</code>,{" "}
        <code className="font-mono">viewer@</code>,{" "}
        <code className="font-mono">superadmin@</code>).
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss demo banner"
        className="text-amber-700 hover:text-amber-900"
      >
        <X size={13} />
      </button>
    </div>
  );
}
