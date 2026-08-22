import { prisma } from "../db";

const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS ?? 5);
const WINDOW_MINUTES = Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES ?? 15);

export function exceedsLimit(failedCount: number, max: number): boolean {
  return failedCount >= max;
}

export async function isRateLimited(params: { email: string; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILED",
      createdAt: { gt: since },
      OR: [{ email: params.email }, { ip: params.ip }],
    },
  });
  return exceedsLimit(count, MAX_ATTEMPTS);
}