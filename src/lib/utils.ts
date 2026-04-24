import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PaginatedResponse } from "@/types";

/**
 * Normalise a backend list response into a plain array.
 * Some endpoints return `{data, pagination}`, others return `T[]` directly.
 * This helper accepts either shape and returns `T[]` so callers don't care.
 */
export function unwrapList<T>(
  resp: T[] | PaginatedResponse<T> | null | undefined,
): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (typeof resp === "object" && "data" in resp && Array.isArray(resp.data)) {
    return resp.data;
  }
  return [];
}

/**
 * Merge Tailwind classes with clsx. Use throughout the app for conditional classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency values consistently.
 */
export function formatCurrency(
  value: number | string,
  currency = "USD",
  locale = "en-US"
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format numbers with locale-aware separators.
 */
export function formatNumber(value: number | string, locale = "en-US"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format dates consistently.
 */
export function formatDate(
  date: string | Date,
  style: "short" | "medium" | "long" = "medium"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { month: "short", day: "numeric" }
      : style === "medium"
        ? { year: "numeric", month: "short", day: "numeric" }
        : { year: "numeric", month: "long", day: "numeric", weekday: "short" };
  return d.toLocaleDateString("en-US", options);
}

/**
 * Capitalize first letter.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate initials from a full name.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Debounce a function.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
