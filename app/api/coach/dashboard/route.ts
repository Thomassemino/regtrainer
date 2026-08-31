import { requireAdmin } from "../../../../lib/coach/guards";
import { obtenerKpis, obtenerAgendaDeHoy, obtenerOcupacionSemana, obtenerClientesQueNecesitanAtencion } from "../../../../lib/coach/dashboard";

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const [kpis, agenda, ocupacionSemana, clientesAtencion] = await Promise.all([
    obtenerKpis(),
    obtenerAgendaDeHoy(),
    obtenerOcupacionSemana(),
    obtenerClientesQueNecesitanAtencion(),
  ]);

  return Response.json({ kpis, agenda, ocupacionSemana, clientesAtencion });
}
