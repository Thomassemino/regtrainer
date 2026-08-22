import { z } from "zod";
import { resetearPassword } from "../../../../lib/auth/reset-password";

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const ok = await resetearPassword(parsed.data.token, parsed.data.password);
  if (!ok) {
    return Response.json({ error: "El link venció o ya fue usado" }, { status: 400 });
  }
  return Response.json({ ok: true });
}