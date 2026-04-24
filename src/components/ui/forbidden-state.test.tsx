import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { RequireRead, ForbiddenState } from "./forbidden-state";
import {
  renderWithProviders,
  buildUseAuthReturn,
} from "@/test/render-helpers";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/providers/auth-provider";
const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe("<ForbiddenState>", () => {
  it("renders a clear title and description", () => {
    renderWithProviders(<ForbiddenState />);
    expect(
      screen.getByText(/you don't have access to this page/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/role doesn't include the permission/i),
    ).toBeInTheDocument();
  });

  it("surfaces the missing permission code and support email when given", () => {
    renderWithProviders(
      <ForbiddenState missingPerm="inventory.items.write" />,
    );
    expect(screen.getByText(/missing permission/i)).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("inventory.items.write"),
      ),
    ).toBeInTheDocument();
  });

  it("renders custom title/description overrides", () => {
    renderWithProviders(
      <ForbiddenState
        title="Nope"
        description="Try again after coffee"
      />,
    );
    expect(screen.getByText("Nope")).toBeInTheDocument();
    expect(screen.getByText("Try again after coffee")).toBeInTheDocument();
  });
});

describe("<RequireRead>", () => {
  it("renders children when the user has the permission", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ permissions: ["inventory.items.read"] }),
    );
    renderWithProviders(
      <RequireRead perm="inventory.items.read">
        <div>secret items</div>
      </RequireRead>,
    );
    expect(screen.getByText("secret items")).toBeInTheDocument();
  });

  it("renders ForbiddenState when the user lacks the permission", () => {
    mockedUseAuth.mockReturnValue(buildUseAuthReturn({ permissions: [] }));
    renderWithProviders(
      <RequireRead perm="inventory.items.read">
        <div>secret items</div>
      </RequireRead>,
    );
    expect(screen.queryByText("secret items")).not.toBeInTheDocument();
    expect(
      screen.getByText(/you don't have access to this page/i),
    ).toBeInTheDocument();
  });

  it("super admins always see children", () => {
    mockedUseAuth.mockReturnValue(
      buildUseAuthReturn({ isSuperAdmin: true, permissions: [] }),
    );
    renderWithProviders(
      <RequireRead perm="auth.tenants.read">
        <div>platform-only data</div>
      </RequireRead>,
    );
    expect(screen.getByText("platform-only data")).toBeInTheDocument();
  });
});
