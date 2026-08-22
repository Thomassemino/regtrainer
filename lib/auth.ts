import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { verifyPassword } from "./auth/hash";
import { logAudit } from "./auth/audit";
import { isRateLimited } from "./auth/rate-limit";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_DURATION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        const userAgent = request.headers.get("user-agent") ?? undefined;

        if (await isRateLimited({ email, ip })) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.emailVerified) {
          await logAudit({ email, action: "LOGIN_FAILED", ip, userAgent });
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, password);
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: "CLIENTE" | "ADMIN" }).role;
        token.sessionId = (user as { sessionId: string }).sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      const dbSession = await prisma.session.findUnique({
        where: { id: token.sessionId as string },
      });
      if (!dbSession || dbSession.expires < new Date()) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      session.user.role = token.role as "CLIENTE" | "ADMIN";
      session.user.sessionId = token.sessionId as string;
      session.user.id = token.sub as string;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});