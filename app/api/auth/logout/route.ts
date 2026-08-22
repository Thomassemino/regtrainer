import { auth, signOut } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { logAudit } from "../../../../lib/auth/audit";

export async function POST() {
  const session = await auth();
  if (session?.user?.sessionId) {
    await prisma.session.delete({ where: { id: session.user.sessionId } }).catch(() => {});
    await logAudit({ userId: session.user.id, action: "LOGOUT" });
  }
  await signOut({ redirect: false });
  return Response.json({ ok: true });
}