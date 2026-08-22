import * as argon2 from "argon2";
import { prisma } from "../db";
import { verifyPassword } from "./hash";
import { logAudit } from "./audit";
import { isRateLimited } from "./rate-limit";
import { normalizeEmail } from "./email";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash("dummy-timing-equalizer", {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
  return dummyHashPromise;
}

export async function credentialsLogin(params: {
  email: string;
  password: string;
  ip: string;
  userAgent?: string;
}): Promise<{ id: string; email: string; role: "CLIENTE" | "ADMIN"; sessionId: string } | null> {
  const email = normalizeEmail(params.email);
  const ip = params.ip;
  const userAgent = params.userAgent;

  if (await isRateLimited({ email, ip })) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.emailVerified) {
    await logAudit({ email, action: "LOGIN_FAILED", ip, userAgent });
    await verifyPassword(await getDummyHash(), params.password);
    return null;
  }

  const valid = await verifyPassword(user.passwordHash, params.password);
  if (!valid) {
    await logAudit({ email, userId: user.id, action: "LOGIN_FAILED", ip, userAgent });
    return null;
  }

  const dbSession = await prisma.session.create({
    data: {
      sessionToken: crypto.randomUUID(),
      userId: user.id,
      ip,
      userAgent,
      expires: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  await logAudit({ email, userId: user.id, action: "LOGIN_SUCCESS", ip, userAgent });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sessionId: dbSession.id,
  };
}