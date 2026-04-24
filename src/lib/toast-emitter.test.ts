import { describe, it, expect, vi, beforeEach } from "vitest";
import { toastEmitter, subscribeToasts } from "./toast-emitter";
import type { ApiError } from "./api-client";

describe("toastEmitter", () => {
  let captured: unknown[];
  let unsubscribe: () => void;

  beforeEach(() => {
    captured = [];
    unsubscribe = subscribeToasts((t) => captured.push(t));
    return () => unsubscribe();
  });

  it("emits simple success / error / warning / info toasts", () => {
    toastEmitter.success("Saved");
    toastEmitter.error("Nope");
    toastEmitter.warning("Careful");
    toastEmitter.info("FYI");
    expect(captured).toHaveLength(4);
    expect(captured[0]).toMatchObject({ type: "success", message: "Saved" });
    expect(captured[1]).toMatchObject({ type: "error", message: "Nope" });
    expect(captured[2]).toMatchObject({ type: "warning", message: "Careful" });
    expect(captured[3]).toMatchObject({ type: "info", message: "FYI" });
    unsubscribe();
  });

  it("apiError formats an ApiError with code, requestId, fieldErrors", () => {
    const err: ApiError = {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      fieldErrors: { email: "already in use" },
      requestId: "req-123",
    };
    toastEmitter.apiError(err);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      type: "error",
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      requestId: "req-123",
      fieldErrors: { email: "already in use" },
    });
    unsubscribe();
  });

  it("apiError silently swallows refresh-loop-handled codes", () => {
    const silent: ApiError = {
      status: 401,
      code: "TOKEN_EXPIRED",
      message: "expired",
      fieldErrors: {},
      requestId: "r",
    };
    toastEmitter.apiError(silent);
    expect(captured).toHaveLength(0);
    unsubscribe();
  });

  it("apiError falls back gracefully for Error instances", () => {
    toastEmitter.apiError(new Error("kaboom"));
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ type: "error", message: "kaboom" });
    unsubscribe();
  });

  it("apiError uses the fallback when given an unknown value", () => {
    toastEmitter.apiError({ weird: true }, "Generic fail");
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ message: "Generic fail" });
    unsubscribe();
  });

  it("subscribe returns an unsubscribe fn that actually unsubscribes", () => {
    const spy = vi.fn();
    const un = subscribeToasts(spy);
    toastEmitter.info("a");
    un();
    toastEmitter.info("b");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
