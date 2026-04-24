import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw";

// ═══════════════════════════════════════════════════════════
// Global test setup — matchers, cleanup, shims, MSW.
// ═══════════════════════════════════════════════════════════

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  server.resetHandlers();
  vi.restoreAllMocks();
});

// jsdom doesn't implement window.matchMedia or scrollTo — stub them.
beforeEach(() => {
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    window.scrollTo = vi.fn() as typeof window.scrollTo;
  }
});
