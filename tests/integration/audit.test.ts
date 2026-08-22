import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { logAudit } from "../../lib/auth/audit";

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
});

describe("logAudit", () => {
  it("persiste un evento de login fallido con email e ip", async () => {
    await logAudit({ email: "test@example.com", action: "LOGIN_FAILED", ip: "1.2.3.4" });
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("LOGIN_FAILED");
    expect(rows[0].email).toBe("test@example.com");
  });
});