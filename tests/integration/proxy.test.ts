import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

const { proxy, config } = await import("../../proxy");
const { auth } = await import("../../lib/auth");

const mockAuth = auth as unknown as {
  mockResolvedValue: (v: unknown) => void;
  mockReset: () => void;
};

describe("proxy config", () => {
  it("tiene un matcher que excluye assets estáticos", () => {
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
  });

  it("el matcher no incluye _next/static", () => {
    const matcherPattern = config.matcher[0] as string;
    expect(matcherPattern).toContain("_next/static");
  });
});

describe("proxy function", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it("redirige a /login cuando no hay sesión en /coach", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await proxy(new NextRequest("http://localhost/coach"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("devuelve 401 JSON en /api/coach sin sesión", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await proxy(new NextRequest("http://localhost/api/coach/resumen"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("No autorizado");
  });

  it("devuelve 403 JSON en /api/coach para un CLIENTE", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "c@x.com", role: "CLIENTE", sessionId: "s1" } });
    const res = await proxy(new NextRequest("http://localhost/api/coach/resumen"));
    expect(res.status).toBe(403);
  });

  it("deja pasar a un ADMIN en /api/coach", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", email: "a@x.com", role: "ADMIN", sessionId: "s2" } });
    const res = await proxy(new NextRequest("http://localhost/api/coach/resumen"));
    expect(res.status).toBe(200);
  });

  it("agrega headers de seguridad a rutas públicas", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await proxy(new NextRequest("http://localhost/test"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
    expect(res.headers.get("Content-Security-Policy")).toBeDefined();
  });
});