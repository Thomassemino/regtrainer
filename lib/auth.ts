import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { credentialsLogin } from "./auth/authorize";
import { getClientIpFrom } from "./auth/ip";
import type { Session } from "next-auth";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_DURATION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const ip = getClientIpFrom(request.headers);
        const userAgent = request.headers.get("user-agent") ?? undefined;
        return credentialsLogin({ email, password, ip, userAgent });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = (user as { email?: string }).email;
        token.role = (user as { role: "CLIENTE" | "ADMIN" }).role;
        token.sessionId = (user as { sessionId: string }).sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      const revoked = { ...session, user: null, expires: new Date(0).toISOString() } as Session;
      if (!token.sessionId) {
        return revoked;
      }
      const dbSession = await prisma.session.findUnique({
        where: { id: token.sessionId as string },
      });
      if (!dbSession || dbSession.expires < new Date()) {
        return revoked;
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true },
      });
      if (!dbUser || !session.user) {
        return revoked;
      }
      session.user.role = dbUser.role;
      await prisma.session.updateMany({
        where: { id: dbSession.id, expires: { gt: new Date() } },
        data: { expires: new Date(Date.now() + SESSION_DURATION_MS) },
      });
      session.user.email = token.email as string;
      session.user.sessionId = token.sessionId as string;
      session.user.id = token.sub as string;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});