import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const TEMAS = {
  black: { fondo: "#0A0A0C", texto: "#F4F4F5", acento: "#E82828", chip: "#17171C", caja: "#131317" },
  clean: { fondo: "#FFFFFF", texto: "#17171A", acento: "#C4161C", chip: "#F1F1F3", caja: "#F6F6F7" },
  steel: { fondo: "#F1F2F4", texto: "#1A1D22", acento: "#B3141A", chip: "#E2E4E8", caja: "#E7E9EC" },
} as const;

function calcularRangoSemana(inicio: Date, semana: number): string {
  const desde = new Date(inicio);
  desde.setDate(desde.getDate() + (semana - 1) * 7);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  return `${fmt(desde)}–${fmt(hasta)}`;
}

export default async function PdfPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tema?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    notFound();
  }

  const { id } = await params;
  const { tema: temaParam } = await searchParams;
  const tema = TEMAS[temaParam as keyof typeof TEMAS] ?? TEMAS.black;

  const programa = await prisma.programa.findUnique({
    where: { id },
    include: {
      dias: { include: { bloques: { include: { sobrecarga: { orderBy: { semana: "asc" } } } } } },
      asignaciones: { orderBy: { asignadoEn: "desc" }, take: 1 },
    },
  });
  if (!programa) notFound();

  const inicio = programa.asignaciones[0]?.asignadoEn ?? new Date();
  const primerBloqueConSobrecarga = programa.dias.flatMap((d) => d.bloques).find((b) => b.sobrecarga.length > 0);
  const semanasAMostrar = Array.from({ length: programa.semanas }, (_, i) => i + 1);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: tema.fondo, color: tema.texto, padding: 32, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: tema.acento, color: tema.fondo, display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", fontStyle: "italic", fontSize: 13, fontWeight: 700 }}>R</div>
        <div>
          <div style={{ fontSize: 12, fontStyle: "italic", fontWeight: 700 }}>REGTRAINER</div>
          <div style={{ fontSize: 8.5, opacity: 0.6 }}>Programado por Roberto Ghiglione</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 8, opacity: 0.5 }}>PDF</div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7 }}>Plan de entrenamiento</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <h1 style={{ fontSize: 16, fontStyle: "italic", fontWeight: 700, color: tema.acento, margin: 0, flex: 1, minWidth: 0 }}>{programa.nombre}</h1>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{programa.semanas} semanas</div>
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11, margin: "12px 0" }}>
        <div><b>Frecuencia</b><div style={{ opacity: 0.7 }}>{programa.frecuencia}</div></div>
        <div><b>Objetivo principal</b><div style={{ opacity: 0.7 }}>{programa.objetivo}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(programa.semanas, 4)}, 1fr)`, gap: 8, margin: "16px 0" }}>
        {semanasAMostrar.map((semana) => (
          <div key={semana} style={{ background: tema.chip, borderRadius: 8, padding: 8, fontSize: 9, textAlign: "center" }}>
            <div style={{ fontWeight: 600 }}>SEM {semana}</div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>{calcularRangoSemana(inicio, semana)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: tema.caja, borderRadius: 10, padding: 12, fontSize: 10.5, lineHeight: 1.5, marginBottom: 12 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, marginBottom: 4 }}>Introducción</div>
        Cuatro semanas para levantar más sin perder motor. Las semanas 1 a 3 suben la carga y la cuarta afloja, para que llegues entera al test.
      </div>

      <div style={{ background: tema.caja, borderRadius: 10, padding: 12, fontSize: 10.5 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, marginBottom: 6 }}>Sobrecarga semanal</div>
        {primerBloqueConSobrecarga && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
            <thead>
              <tr style={{ opacity: 0.6 }}>
                <th style={{ textAlign: "left" }}>SEM</th><th>SERIES</th><th>REP</th><th>CARGA</th><th>DESC</th>
              </tr>
            </thead>
            <tbody>
              {primerBloqueConSobrecarga.sobrecarga.map((f) => (
                <tr key={f.semana}>
                  <td>{f.semana}</td>
                  <td style={{ textAlign: "center" }}>{f.series}</td>
                  <td style={{ textAlign: "center" }}>{f.reps}</td>
                  <td style={{ textAlign: "center" }}>{f.pct}%</td>
                  <td style={{ textAlign: "center" }}>{f.descanso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}