import { auth } from "../../../../../lib/auth";
import { cerrarTodasLasSesiones } from "../../../../../lib/auth/sesiones";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  await cerrarTodasLasSesiones(session.user.id);
  return Response.json({ ok: true });
}