import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";

export { useTableFilters } from "./useTableFilters";
export type {
  ColumnDef,
  SortState,
  ColumnFilterValue,
  ColumnFilterState,
  FilterType,
} from "./useTableFilters";

// ═══════════════════════════════════════════════════════════
// Custom Hooks
// ═══════════════════════════════════════════════════════════

/**
 * Permission check hook — returns boolean for a given permission code.
 */
export function usePermission(code: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(code);
}

/**
 * Multiple permission check — returns true if user has ANY of the given permissions.
 */
export function useAnyPermission(...codes: string[]): boolean {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(...codes);
}

/**
 * Debounced state — for search inputs.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Toggle hook — for modals, dropdowns, etc.
 */
export function useToggle(
  initial = false
): [boolean, () => void, (val: boolean) => void] {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

/**
 * Clipboard copy hook.
 */
export function useCopyToClipboard(): [
  boolean,
  (text: string) => Promise<void>,
] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }, []);

  return [copied, copy];
}
