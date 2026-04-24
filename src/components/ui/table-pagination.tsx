"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  /** 1-indexed row range, inclusive. e.g. "Showing 1–10 of 47". */
  start?: number;
  end?: number;
  total: number;
  /** Current rows visible (distinct from `total` when filtering). */
  visible?: number;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
}

export function TablePagination({
  start,
  end,
  total,
  visible,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  className,
}: TablePaginationProps) {
  const hasRange = typeof start === "number" && typeof end === "number";
  const label = hasRange
    ? `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
    : typeof visible === "number" && visible !== total
      ? `${visible.toLocaleString()} of ${total.toLocaleString()}`
      : `${total.toLocaleString()} ${total === 1 ? "row" : "rows"}`;

  return (
    <div
      className={cn(
        // Stack on mobile, inline on sm+
        "border-t border-hairline px-3.5 py-2.5 gap-2",
        "flex flex-col sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="text-xs text-foreground-muted text-center sm:text-left">
        <span className="hidden sm:inline">Showing </span>
        {label}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2 sm:gap-1">
        <Button
          size="sm"
          icon={<ChevronLeft size={13} />}
          onClick={onPrev}
          disabled={prevDisabled}
          className="flex-1 sm:flex-initial justify-center"
        >
          Prev
        </Button>
        <Button
          size="sm"
          iconRight={<ChevronRight size={13} />}
          onClick={onNext}
          disabled={nextDisabled}
          className="flex-1 sm:flex-initial justify-center"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
