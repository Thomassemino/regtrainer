import { describe, expect, it } from "vitest";
import { config, proxy } from "../../proxy";

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

describe("proxy function", async () => {
  it("agrega headers de seguridad a todas las respuestas", async () => {
    const req = new Request("http://localhost/test") as any;
    const res = await proxy(req);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toBeDefined();
  });
});