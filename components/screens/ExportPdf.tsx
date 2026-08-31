"use client";

import type { BetoVals } from "@/hooks/useBetoApp";
import type { TemaPdf } from "@/lib/types";

const TEMAS: { id: TemaPdf; nombre: string; sub: string; icono: string; fondo: string; texto: string; acento: string }[] = [
  { id: "black", nombre: "RegTrainer Black", sub: "Noche", icono: "ph-moon", fondo: "#0A0A0C", texto: "#F4F4F5", acento: "#E82828" },
  { id: "clean", nombre: "Clean Red", sub: "Claro", icono: "ph-file-text", fondo: "#FFFFFF", texto: "#17171A", acento: "#C4161C" },
  { id: "steel", nombre: "Steel", sub: "Gris técnico", icono: "ph-palette", fondo: "#F1F2F4", texto: "#1A1D22", acento: "#B3141A" },
];

export default function ExportPdf({ vals }: { vals: BetoVals }) {
  const descargar = () => {
    if (!vals.programaIdActivo) return;
    const clienteQuery = vals.fichaId ? `&clienteId=${vals.fichaId}` : "";
    // Navegación intencional a un endpoint que descarga el PDF (no una página interna).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/coach/programas/${vals.programaIdActivo}/pdf?tema=${vals.temaPdfSel}${clienteQuery}`;
    vals.showToast("PDF generado con la marca de RegTrainer");
  };

  return (
    <div style={{ padding: "32px 32px 72px" }}>
      <button onClick={() => vals.fichaId && vals.goFicha(vals.fichaId)} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Volver a la ficha
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 34, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Exportar con tu marca</h1>
          <p style={{ fontSize: 13.5, opacity: 0.6, margin: 0 }}>Tres temas para el PDF. El logo y el nombre son tuyos, no de la plataforma.</p>
        </div>
        <button onClick={descargar} className="btn btn-primary"><i className="ph ph-file-pdf" /> Descargar PDF</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {TEMAS.map((t) => {
          const elegido = vals.temaPdfSel === t.id;
          return (
            <div
              key={t.id}
              onClick={() => { vals.setTemaPdfSel(t.id); vals.showToast(`Tema ${t.nombre} seleccionado`); }}
              style={{ cursor: "pointer", padding: 18, borderRadius: 14, border: `1px solid ${elegido ? "var(--color-accent)" : "var(--color-divider)"}`, background: "var(--color-surface-sunken)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: "100%", maxWidth: 280, borderRadius: 14, padding: 16, fontSize: 11, background: t.fondo, color: t.texto }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.acento, color: t.fondo, display: "grid", placeItems: "center", fontFamily: "var(--font-heading)", fontStyle: "italic", fontSize: 12, fontWeight: 700 }}>R</div>
                  <div style={{ fontSize: 10 }}>RegTrainer</div>
                </div>
                <div style={{ fontSize: 8, textTransform: "uppercase", opacity: 0.6 }}>Plan de entrenamiento</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.acento }}>Fuerza & Motor</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[t.fondo, t.texto, t.acento].map((c, i) => (
                  <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,.2)" }} />
                ))}
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <i className={`ph ${t.icono}`} style={{ color: "var(--color-accent)" }} /> {t.nombre}
              </div>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", opacity: 0.45 }}>{t.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
        <button onClick={() => { vals.set({ cuentaTab: "rutina" }); vals.goCuenta(); }} className="btn btn-secondary">Ver cómo lo recibe el cliente</button>
        <button onClick={() => vals.programaIdActivo && vals.goBuilder(vals.programaIdActivo)} className="btn btn-ghost">Seguir editando el bloque</button>
      </div>
    </div>
  );
}