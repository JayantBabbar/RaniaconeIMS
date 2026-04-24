import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Can, useCan } from "./can";
import {
  renderWithProviders,
  buildUseAuthReturn,
} from "@/test/render-helpers";

// Mock useAuth for every test in this file. The concrete return value is
// set per-test via `mockedUseAuth.mockReturnValue(...)`.
vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/providers/auth-provider";
const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe("<Can>", () => {
  it("renders children when the user has the permission", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ permissions: ["inventory.items.write"] }),
    );
    renderWithProviders(
      <Can perm="inventory.items.write">
        <button>New Item</button>
      </Can>,
    );
    expect(screen.getByRole("button", { name: /new item/i })).toBeInTheDocument();
  });

  it("renders nothing when the user lacks the permission", () => {
    mockedUseAuth.mockReturnValue(buildUseAuthReturn({ permissions: [] }));
    renderWithProviders(
      <Can perm="inventory.items.write">
        <button>New Item</button>
      </Can>,
    );
    expect(screen.queryByRole("button", { name: /new item/i })).not.toBeInTheDocument();
  });

  it("renders fallback when supplied and permission is missing", () => {
    mockedUseAuth.mockReturnValue(buildUseAuthReturn({ permissions: [] }));
    renderWithProviders(
      <Can perm="inventory.items.write" fallback={<span>read-only</span>}>
        <button>New Item</button>
      </Can>,
    );
    expect(screen.getByText("read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new item/i })).not.toBeInTheDocument();
  });

  it("super admins see children regardless of permission set", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ isSuperAdmin: true, permissions: [] }),
    );
    renderWithProviders(
      <Can perm="inventory.items.write">
        <button>New Item</button>
      </Can>,
    );
    expect(screen.getByRole("button", { name: /new item/i })).toBeInTheDocument();
  });

  it("anyOf renders children when the user has at least one code", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ permissions: ["inventory.documents.cancel"] }),
    );
    renderWithProviders(
      <Can anyOf={["inventory.documents.post", "inventory.documents.cancel"]}>
        <button>Manage</button>
      </Can>,
    );
    expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
  });
});

describe("useCan()", () => {
  it("exposes hasPermission as `can` and hasAnyPermission as `canAny`", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ permissions: ["inventory.items.read"] }),
    );
    let captured: ReturnType<typeof useCan> | null = null;
    function Probe() {
      captured = useCan();
      return null;
    }
    renderWithProviders(<Probe />);
    expect(captured!.can("inventory.items.read")).toBe(true);
    expect(captured!.can("inventory.items.write")).toBe(false);
    expect(
      captured!.canAny("inventory.items.read", "inventory.items.write"),
    ).toBe(true);
    expect(captured!.canAny("auth.users.write", "auth.roles.write")).toBe(false);
  });
});
