import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { renderPdfConSesion } from "../../../../../../lib/pdf/render";
import { extraerCookieSesion } from "../../../../../../lib/pdf/session-cookie";

const TEMAS_VALIDOS = new Set(["clean", "night", "pink"]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const url = new URL(req.url);
  const temaParam = url.searchParams.get("tema") ?? "clean";
  const tema = TEMAS_VALIDOS.has(temaParam) ? temaParam : "clean";

  const cookie = extraerCookieSesion(req.headers.get("cookie"));
  if (!cookie) {
    return Response.json({ error: "No se pudo propagar la sesión al render del PDF" }, { status: 500 });
  }

  const origin = `${url.protocol}//${url.host}`;
  const previewUrl = `${origin}/coach/programas/${id}/pdf-preview?tema=${tema}`;
  const pdf = await renderPdfConSesion(previewUrl, cookie, origin);

  await prisma.asignacionPrograma.updateMany({ where: { programaId: id }, data: { temaPdf: tema } });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="programa-${id}-${tema}.pdf"`,
    },
  });
}