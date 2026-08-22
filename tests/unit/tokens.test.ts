import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../../lib/auth/tokens";

describe("generateToken / hashToken", () => {
  it("genera un token raw de al menos 32 bytes en base64url", () => {
    const { raw } = generateToken();
    expect(raw.length).toBeGreaterThanOrEqual(40);
  });

  it("el hash del raw coincide con hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(hashToken(raw)).toBe(hash);
  });

  it("dos tokens generados son distintos", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
  });

  it("hashToken es determinístico", () => {
    expect(hashToken("mismo-valor")).toBe(hashToken("mismo-valor"));
  });
});