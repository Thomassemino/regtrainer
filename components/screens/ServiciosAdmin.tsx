"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import Loader from "@/components/Loader";

interface HorarioApi { id: string; diaSemana: number; horaInicio: string }
interface ServicioApi {
  id: string;
  slug: string;
  nombre: string;
  tag: string;
  descripcion: string;
  imagenUrl: string;
  duracionMin: number;
  precioPesos: number;
  cupoMax: number;
  activo: boolean;
  horarios: HorarioApi[];
}
interface PlanApi {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precioPesos: number;
  unidad: string;
  badge: string;
  feats: string[];
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const FORM_VACIO = {
  slug: "", nombre: "", tag: "", descripcion: "", imagenUrl: "",
  duracionMin: 60, precioPesos: 0, cupoMax: 8, activo: true,
};

export default function ServiciosAdmin({ vals }: { vals: BetoVals }) {
  const [servicios, setServicios] = useState<ServicioApi[]>([]);
  const [planes, setPlanes] = useState<PlanApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [nuevoHorario, setNuevoHorario] = useState({ diaSemana: 1, horaInicio: "09:00" });
  const [mensaje, setMensaje] = useState("");

  const cargarServicios = () =>
    fetch("/api/coach/servicios").then((r) => r.json()).then((d) => setServicios(d.servicios ?? []));
  const cargarPlanes = () =>
    fetch("/api/coach/planes").then((r) => r.json()).then((d) => setPlanes(d.planes ?? []));

  useEffect(() => {
    Promise.all([cargarServicios(), cargarPlanes()]).finally(() => setCargando(false));
  }, []);

  const empezarEdicion = (s: ServicioApi) => {
    setEditandoId(s.id);
    setCreando(false);
    setForm({ slug: s.slug, nombre: s.nombre, tag: s.tag, descripcion: s.descripcion, imagenUrl: s.imagenUrl, duracionMin: s.duracionMin, precioPesos: s.precioPesos, cupoMax: s.cupoMax, activo: s.activo });
  };

  const empezarCreacion = () => {
    setCreando(true);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const cancelar = () => {
    setCreando(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const onArchivoImagen = (file: File) => {
    const lector = new FileReader();
    lector.onload = () => setForm((f) => ({ ...f, imagenUrl: String(lector.result) }));
    lector.readAsDataURL(file);
  };

  const guardar = async () => {
    setMensaje("");
    const body = { ...form };
    const res = creando
      ? await fetch("/api/coach/servicios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(`/api/coach/servicios/${editandoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setMensaje(data.error ?? "No pudimos guardar el servicio");
      return;
    }
    cancelar();
    await cargarServicios();
  };

  const borrar = async (id: string) => {
    if (!window.confirm("¿Borrar este servicio? Si tiene clases o reservas asociadas, mejor desactivalo.")) return;
    const res = await fetch(`/api/coach/servicios/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMensaje(data.error ?? "No se pudo borrar");
      return;
    }
    await cargarServicios();
  };

  const agregarHorario = async (servicioId: string) => {
    await fetch(`/api/coach/servicios/${servicioId}/horarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoHorario),
    });
    await cargarServicios();
  };

  const borrarHorario = async (horarioId: string) => {
    await fetch(`/api/coach/horarios/${horarioId}`, { method: "DELETE" });
    await cargarServicios();
  };

  const formVisible = creando || editandoId !== null;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 72px" }}>
      <button onClick={vals.goCoach} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Panel
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 24px", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Modo entrenador</div>
          <h1 style={{ fontSize: "clamp(28px,7vw,38px)", letterSpacing: "-0.03em", margin: "8px 0 0" }}>Servicios y precios</h1>
        </div>
        <button onClick={empezarCreacion} className="btn btn-primary"><i className="ph ph-plus" /> Nuevo servicio</button>
      </div>

      {mensaje && <div style={{ marginBottom: 16, fontSize: 13, color: "#e5a3a3" }}>{mensaje}</div>}

      {formVisible && (
        <div style={{ padding: 20, borderRadius: 14, background: "var(--color-surface)", marginBottom: 24, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>{creando ? "Nuevo servicio" : "Editar servicio"}</h3>
          {creando && (
            <div className="field"><label>Slug (identificador, sin espacios)</label><input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="ej: pilates" /></div>
          )}
          <div className="field"><label>Título</label><input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
          <div className="field"><label>Tag (ej: Grupal, Fuerza, Estrella)</label><input className="input" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} /></div>
          <div className="field"><label>Descripción</label><textarea className="input" rows={3} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></div>
          <div className="field">
            <label>Imagen — pegá una URL o subí un archivo</label>
            <input className="input" value={form.imagenUrl.startsWith("data:") ? "(archivo cargado)" : form.imagenUrl} onChange={(e) => setForm((f) => ({ ...f, imagenUrl: e.target.value }))} placeholder="https://..." />
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivoImagen(f); }} style={{ marginTop: 8 }} />
            {form.imagenUrl && (
              <img src={form.imagenUrl} alt="Vista previa" style={{ marginTop: 8, height: 90, maxWidth: "100%", borderRadius: 8, objectFit: "cover" }} />
            )}
          </div>
          <div className="rt-grid rt-cols-3" style={{ gap: 12 }}>
            <div className="field"><label>Duración (min)</label><input className="input" type="number" value={form.duracionMin} onChange={(e) => setForm((f) => ({ ...f, duracionMin: Number(e.target.value) }))} /></div>
            <div className="field"><label>Precio (pesos)</label><input className="input" type="number" value={form.precioPesos} onChange={(e) => setForm((f) => ({ ...f, precioPesos: Number(e.target.value) }))} /></div>
            <div className="field"><label>Cupo máximo</label><input className="input" type="number" value={form.cupoMax} onChange={(e) => setForm((f) => ({ ...f, cupoMax: Number(e.target.value) }))} /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
            Activo (visible en la web)
          </label>

          {!creando && editandoId && (
            <div>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6 }}>Horarios recurrentes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {servicios.find((s) => s.id === editandoId)?.horarios.map((h) => (
                  <span key={h.id} className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 5 }}>
                    {DIAS[h.diaSemana]} {h.horaInicio}
                    <button onClick={() => borrarHorario(h.id)} className="btn btn-ghost" style={{ padding: 0, minWidth: "auto" }}><i className="ph ph-x" /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <select className="input" style={{ width: 140 }} value={nuevoHorario.diaSemana} onChange={(e) => setNuevoHorario((n) => ({ ...n, diaSemana: Number(e.target.value) }))}>
                  {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
                <input className="input" style={{ width: 100 }} type="time" value={nuevoHorario.horaInicio} onChange={(e) => setNuevoHorario((n) => ({ ...n, horaInicio: e.target.value }))} />
                <button onClick={() => agregarHorario(editandoId)} className="btn btn-secondary">Agregar</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={guardar} className="btn btn-primary">Guardar</button>
            <button onClick={cancelar} className="btn btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      {cargando ? (
        <Loader label="Cargando…" />
      ) : (
        <div className="rt-table-wrap">
        <table className="table">
          <thead><tr><th>Servicio</th><th>Tag</th><th>Duración</th><th>Precio</th><th>Cupo</th><th>Estado</th><th style={{ textAlign: "right" }} /></tr></thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id}>
                <td style={{ fontSize: 13.5, fontWeight: 500 }}>{s.nombre}</td>
                <td><span className="tag tag-accent">{s.tag}</span></td>
                <td style={{ fontSize: 13 }}>{s.duracionMin === 0 ? "A tu ritmo" : `${s.duracionMin} min`}</td>
                <td style={{ fontSize: 13 }}>{s.precioPesos === 0 ? "Sin cargo" : "$" + s.precioPesos.toLocaleString("es-AR")}</td>
                <td style={{ fontSize: 13 }}>{s.cupoMax}</td>
                <td><span className={`tag ${s.activo ? "tag-accent" : "tag-outline"}`}>{s.activo ? "Activo" : "Oculto"}</span></td>
                <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => empezarEdicion(s)} className="btn btn-secondary">Editar</button>
                  <button onClick={() => borrar(s.id)} className="btn btn-ghost">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <h2 style={{ fontSize: "clamp(22px,5.5vw,26px)", letterSpacing: "-0.02em", margin: "40px 0 16px" }}>Precios</h2>
      <div className="rt-grid rt-cols-2">
        {planes.map((p) => (
          <PlanCard key={p.slug} plan={p} onGuardado={cargarPlanes} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, onGuardado }: { plan: PlanApi; onGuardado: () => void }) {
  const [f, setF] = useState(plan);

  const guardar = async () => {
    await fetch(`/api/coach/planes/${plan.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: f.nombre, descripcion: f.descripcion, precioPesos: f.precioPesos, unidad: f.unidad, badge: f.badge, feats: f.feats }),
    });
    onGuardado();
  };

  return (
    <div style={{ padding: 18, borderRadius: 14, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="field"><label>Nombre</label><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
      <div className="field"><label>Descripción</label><input className="input" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field"><label>Precio (pesos)</label><input className="input" type="number" value={f.precioPesos} onChange={(e) => setF({ ...f, precioPesos: Number(e.target.value) })} /></div>
        <div className="field"><label>Unidad</label><input className="input" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} /></div>
      </div>
      <div className="field"><label>Badge (opcional)</label><input className="input" value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} /></div>
      <div className="field">
        <label>Características (una por línea)</label>
        <textarea className="input" rows={3} value={f.feats.join("\n")} onChange={(e) => setF({ ...f, feats: e.target.value.split("\n") })} />
      </div>
      <button onClick={guardar} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Guardar</button>
    </div>
  );
}
