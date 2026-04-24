import { describe, it, expect } from "vitest";
import { decodeAccessToken } from "./auth.service";

// A minimally-valid RS256 JWT is just "header.payload.signature" where we only
// care about the payload base64url. We don't verify the signature.

function makeToken(payload: Record<string, unknown>): string {
  const toB64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = toB64Url({ alg: "RS256", typ: "JWT" });
  const body = toB64Url(payload);
  return `${header}.${body}.sig`;
}

describe("decodeAccessToken", () => {
  it("decodes a well-formed JWT", () => {
    const token = makeToken({
      typ: "access",
      sub: "user-1",
      tid: "tenant-1",
      sa: false,
      tz: "Asia/Kolkata",
      mods: ["inventory"],
      perms: ["inventory.items.read"],
      iat: 123,
      exp: 456,
      jti: "j",
      roles: ["admin"],
    });
    const claims = decodeAccessToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("user-1");
    expect(claims?.tid).toBe("tenant-1");
    expect(claims?.mods).toEqual(["inventory"]);
    expect(claims?.perms).toContain("inventory.items.read");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeAccessToken("not.a.jwt")).toBeNull();
    expect(decodeAccessToken("only-one-part")).toBeNull();
    expect(decodeAccessToken("")).toBeNull();
  });

  it("returns null when the payload is not valid JSON", () => {
    const token = `header.${Buffer.from("not json").toString("base64")}.sig`;
    expect(decodeAccessToken(token)).toBeNull();
  });
});
