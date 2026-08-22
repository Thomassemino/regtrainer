import { auth, signOut } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { logAudit } from "../../../../lib/auth/audit";

export async function POST() {
  const session = await auth();
  if (session?.user?.sessionId) {
    await prisma.session.delete({ where: { id: session.user.sessionId } }).catch(() => {});
    await logAudit({ userId: session.user.id, action: "LOGOUT" });
  }
  const out = await signOut({ redirect: false });
  const res = Response.json({ ok: true });
  const seen = new Set<string>();
  for (const cookie of out.headers.getSetCookie()) {
    const name = cookie.split("=")[0].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}