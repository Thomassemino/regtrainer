import { prisma } from "../db";
import type { Prisma, AuditAction } from "@prisma/client";

export async function logAudit(input: {
  userId?: string;
  email?: string;
  action: AuditAction;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      email: input.email,
      action: input.action,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}