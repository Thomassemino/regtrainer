"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi } from "@/lib/types";

interface KpisApi {
  ingresosMes: number;
  deltaIngresosTexto: string;
  clasesEstaSemana: number;
  ocupacionSemanaTexto: string;
  clientesActivos: number;
  clientesNuevosTexto: string;
  rutinasSinActualizar: number;
}
interface AgendaItemApi { id: string; hora: string; clase: string; gente: string; estado: string; tagClass: string }
interface OcupacionDiaApi { dia: string; pct: string; ocupacion: number }
interface ClienteAtencionApi { id: string; nombre: string; iniciales: string; motivo: string; cta: string }

const ALTURA_MAX_BARRA = 90;
const MARCA_POR_TAG: Record<string, string> = { "tag-neutral": "#3D3D42", "tag-accent": "#E82828", "tag-outline": "#E82828" };

export default function Coach({ vals }: { vals: BetoVals }) {
  const [clientesReales, setClientesReales] = useState<ClienteFilaApi[]>([]);
  const [kpis, setKpis] = useState<KpisApi | null>(null);
  const [agenda, setAgenda] = useState<AgendaItemApi[]>([]);
  const [ocupacionSemana, setOcupacionSemana] = useState<OcupacionDiaApi[]>([]);
  const [clientesAtencion, setClientesAtencion] = useState<ClienteAtencionApi[]>([]);

  useEffect(() => {
    fetch("/api/coach/clientes").then((r) => r.json()).then((d) => setClientesReales(d.clientes ?? []));
    fetch("/api/coach/dashboard").then((r) => r.json()).then((d) => {
      setKpis(d.kpis ?? null);
      setAgenda(d.agenda ?? []);
      setOcupacionSemana(d.ocupacionSemana ?? []);
      setClientesAtencion(d.clientesAtencion ?? []);
    });
  }, []);

  const idPorNombre = (nombre: string) => clientesReales.find((c) => c.nombre === nombre)?.id ?? null;

  const kpiTiles = kpis
    ? [
        { k: "Ingresos del mes", v: "$" + kpis.ingresosMes.toLocaleString("es-AR"), d: kpis.deltaIngresosTexto },
        { k: "Clases esta semana", v: String(kpis.clasesEstaSemana), d: kpis.ocupacionSemanaTexto },
        { k: "Clientes activos", v: String(kpis.clientesActivos), d: kpis.clientesNuevosTexto },
        { k: "Rutinas sin actualizar", v: String(kpis.rutinasSinActualizar), d: kpis.rutinasSinActualizar > 0 ? "Conviene revisarlas" : "Todo al día" },
      ]
    : [];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Modo entrenador</div>
          <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Panel de Beto</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={vals.goClientes} className="btn btn-primary"><i className="ph ph-squares-four" /> Constructor de rutinas</button>
          <button onClick={vals.goServiciosAdmin} className="btn btn-secondary"><i className="ph ph-tag" /> Servicios y precios</button>
          <button onClick={vals.goCuenta} className="btn btn-secondary">Volver a la vista cliente</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpiTiles.map((k) => (
          <div key={k.k} style={{ padding: 18, borderRadius: 14, background: "var(--color-surface)" }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", opacity: .5 }}>{k.k}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.03em", marginTop: 6 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "var(--color-accent)", marginTop: 3 }}>{k.d}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 24, marginTop: 28, alignItems: "start" }}>
        <div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Agenda de hoy</h3>
          {agenda.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.55 }}>No hay clases programadas para hoy.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {agenda.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--color-surface)", borderLeft: `2px solid ${MARCA_POR_TAG[a.tagClass] ?? "#E82828"}` }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, width: 52, flex: "none" }}>{a.hora}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{a.clase}</div>
                  <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{a.gente}</div>
                </div>
                <span className={`tag ${a.tagClass}`}>{a.estado}</span>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>Ocupación de la semana</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, padding: 16, borderRadius: 14, background: "var(--color-surface)" }}>
            {ocupacionSemana.map((b) => (
              <div key={b.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 11, opacity: .55 }}>{b.pct}</div>
                <div style={{ width: "100%", height: `${Math.max(4, (b.ocupacion / 100) * ALTURA_MAX_BARRA)}px`, background: "var(--color-accent)", borderRadius: "5px 5px 0 0" }} />
                <div style={{ fontSize: 11, opacity: .5 }}>{b.dia}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Necesitan atención</h3>
          {clientesAtencion.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.55 }}>Nada urgente por ahora.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientesAtencion.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", borderRadius: 12, background: "var(--color-surface)" }}>
                <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: "var(--color-accent-800)", color: "var(--color-accent-100)", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 500 }}>{c.iniciales}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</div>
                  <div style={{ fontSize: 12, opacity: .55 }}>{c.motivo}</div>
                </div>
                <button
                  onClick={() => { const id = idPorNombre(c.nombre) ?? c.id; vals.goFicha(id); }}
                  className="btn btn-secondary"
                >
                  {c.cta}
                </button>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>Últimos pagos</h3>
          <table className="table">
            <thead><tr><th>Cliente</th><th>Concepto</th><th style={{ textAlign: "right" }}>Importe</th><th /></tr></thead>
            <tbody>
              {vals.pagosCoach.map((p) => (
                <tr key={p.pagoId ?? p.cliente + p.concepto}>
                  <td>{p.cliente}</td>
                  <td>{p.concepto}</td>
                  <td style={{ textAlign: "right" }}>{p.importe}</td>
                  <td style={{ textAlign: "right" }}>
                    {p.pendienteEfectivo && (
                      <button className="btn btn-secondary" onClick={() => vals.marcarPagoRecibido(p.pagoId!)}>Marcar recibido</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
