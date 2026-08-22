import { prisma } from "../db";
import type { AuditAction } from "@prisma/client";

const rawMax = process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS;
const MAX_ATTEMPTS =
  rawMax && Number.isFinite(Number(rawMax)) && Number(rawMax) > 0 ? Number(rawMax) : 5;
const rawWindow = process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES;
const WINDOW_MINUTES =
  rawWindow && Number.isFinite(Number(rawWindow)) && Number(rawWindow) > 0 ? Number(rawWindow) : 15;

export function exceedsLimit(failedCount: number, max: number): boolean {
  return failedCount >= max;
}

export function isUsableIp(ip?: string | null): ip is string {
  return !!ip && ip.trim() !== "" && ip !== "unknown";
}

export async function isRateLimited(params: {
  email: string;
  ip?: string | null;
  action?: AuditAction;
}): Promise<boolean> {
  const action = params.action ?? "LOGIN_FAILED";
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const ip = isUsableIp(params.ip) ? params.ip.trim() : null;
  const count = await prisma.auditLog.count({
    where: ip
      ? {
          action,
          createdAt: { gt: since },
          OR: [{ email: params.email }, { ip }],
        }
      : { action, createdAt: { gt: since }, email: params.email },
  });
  return exceedsLimit(count, MAX_ATTEMPTS);
}