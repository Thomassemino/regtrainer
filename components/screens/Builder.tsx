"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ProgramaApi } from "@/lib/types";
import { ORDEN_SEMANA } from "@/lib/rutinas/dias";
import ColumnaDia from "@/components/coach/ColumnaDia";
import EditorEjercicio from "@/components/screens/EditorEjercicio";

export default function Builder({ vals }: { vals: BetoVals }) {
  const [programa, setPrograma] = useState<ProgramaApi | null>(null);

  const cargar = async () => {
    if (!vals.programaIdActivo) return;
    const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}`);
    const data = await res.json();
    setPrograma(data.programa ?? null);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals.programaIdActivo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const diasOrdenados = useMemo(() => {
    if (!programa) return [];
    return ORDEN_SEMANA.map((diaSemana) => programa.dias.find((d) => d.diaSemana === diaSemana)).filter((d): d is NonNullable<typeof d> => !!d);
  }, [programa]);

  const volumen = useMemo(() => {
    if (!programa) return { diasEntrenamiento: 0, bloquesCargados: 0, seriesTotales: 0 };
    const diasEntrenamiento = programa.dias.filter((d) => !d.descanso).length;
    const todosLosBloques = programa.dias.flatMap((d) => d.bloques);
    const seriesTotales = todosLosBloques.reduce((acc, b) => {
      const fila = b.sobrecarga.find((f) => f.semana === vals.semanaSel);
      return acc + (fila?.series ?? 0);
    }, 0);
    return { diasEntrenamiento, bloquesCargados: todosLosBloques.length, seriesTotales };
  }, [programa, vals.semanaSel]);

  const agregarSemana = async () => {
    if (!vals.programaIdActivo) return;
    const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}/semanas`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      vals.showToast(`Semana ${data.programa.semanas} agregada al bloque`);
      vals.setSemanaSel(data.programa.semanas);
      await cargar();
    }
  };

  const convertirEntrenable = async (diaId: string) => {
    await fetch(`/api/coach/dias/${diaId}`, { method: "PATCH", body: JSON.stringify({ descanso: false }) });
    await cargar();
  };

  const cambiarCalentamiento = async (diaId: string, calentamiento: string) => {
    await fetch(`/api/coach/dias/${diaId}`, { method: "PATCH", body: JSON.stringify({ calentamiento }) });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !programa) return;

    const diaOrigenId = (active.data.current as { diaId?: string } | undefined)?.diaId;
    if (!diaOrigenId) return;

    const overEsColumna = (over.data.current as { esColumna?: boolean } | undefined)?.esColumna === true;
    const diaDestinoId = overEsColumna ? String(over.id) : (over.data.current as { diaId?: string } | undefined)?.diaId;
    if (!diaDestinoId) return;

    const diaOrigen = programa.dias.find((d) => d.id === diaOrigenId);
    const diaDestino = programa.dias.find((d) => d.id === diaDestinoId);
    if (!diaOrigen || !diaDestino) return;

    if (diaOrigenId === diaDestinoId) {
      const ids = diaOrigen.bloques.map((b) => b.id);
      const desde = ids.indexOf(String(active.id));
      const hasta = overEsColumna ? ids.length - 1 : ids.indexOf(String(over.id));
      if (desde === -1 || hasta === -1 || desde === hasta) return;
      const nuevoOrden = [...ids];
      nuevoOrden.splice(desde, 1);
      nuevoOrden.splice(hasta, 0, String(active.id));

      setPrograma((p) => p && ({
        ...p,
        dias: p.dias.map((d) => (d.id === diaOrigenId ? { ...d, bloques: nuevoOrden.map((id) => d.bloques.find((b) => b.id === id)!) } : d)),
      }));

      await fetch(`/api/coach/dias/${diaOrigenId}/reordenar`, { method: "PATCH", body: JSON.stringify({ bloqueIds: nuevoOrden }) });
      return;
    }

    const idsDestino = diaDestino.bloques.map((b) => b.id).filter((id) => id !== String(active.id));
    idsDestino.push(String(active.id));
    const idsOrigen = diaOrigen.bloques.map((b) => b.id).filter((id) => id !== String(active.id));

    await fetch(`/api/coach/dias/${diaDestinoId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: idsDestino, diaOrigenId, ordenOrigen: idsOrigen }),
    });
    await cargar();
  };

  if (!programa) {
    return <div style={{ padding: "40px 32px", fontSize: 13.5, opacity: 0.55 }}>Cargando constructor…</div>;
  }

  return (
    <div>
      <div style={{ position: "sticky", top: 57, zIndex: 20, background: "rgba(22,24,38,.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto", padding: "11px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={vals.goClientes} className="btn btn-ghost"><i className="ph ph-arrow-left" /></button>
          <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap" }}>{programa.nombre}</div>
          <span className="tag tag-outline">{programa.estado === "ASIGNADO" ? "Asignado" : "Sin asignar"}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 8, border: "1px solid var(--color-divider)" }}>
            {Array.from({ length: programa.semanas }, (_, i) => i + 1).map((semana) => (
              <button
                key={semana}
                onClick={() => vals.setSemanaSel(semana)}
                style={{
                  width: 28, height: 24, borderRadius: 6, fontSize: 13, border: 0, cursor: "pointer",
                  background: vals.semanaSel === semana ? "rgba(145,132,217,.18)" : "transparent",
                  color: vals.semanaSel === semana ? "#d2cefd" : "rgba(233,233,237,.6)",
                }}
              >
                {semana}
              </button>
            ))}
            {programa.semanas < 8 && (
              <button onClick={agregarSemana} style={{ width: 28, height: 24, borderRadius: 6, fontSize: 13, border: 0, cursor: "pointer", background: "transparent", color: "rgba(233,233,237,.6)" }}>
                +
              </button>
            )}
          </div>
          <button onClick={vals.goAsignar} className="btn btn-primary">Continuar →</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div style={{ maxWidth: 1560, margin: "0 auto", padding: "18px 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, alignItems: "start" }}>
          {diasOrdenados.map((dia) => (
            <ColumnaDia
              key={dia.id}
              dia={dia}
              onAbrirEditor={vals.abrirEditor}
              onConvertirEntrenable={convertirEntrenable}
              onCambiarCalentamiento={cambiarCalentamiento}
            />
          ))}
          {diasOrdenados.length < 7 && <div style={{ width: "100%", maxWidth: 320, minHeight: 300 }} />}

          <div style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "#1b1d2c", padding: 14, minHeight: 300 }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--color-accent)" }}>Volumen semanal</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 500, marginTop: 6 }}>{volumen.seriesTotales} series</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Días de entrenamiento</span><span>{volumen.diasEntrenamiento} de 7</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Bloques cargados</span><span>{volumen.bloquesCargados}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Series totales (semana {vals.semanaSel})</span><span>{volumen.seriesTotales}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Trabajo en carrera</span><span>—</span></div>
            </div>
            <div className="hr" />
            <div style={{ fontSize: 11.5, opacity: 0.5 }}>Se recalcula solo con lo que cargás en cada día del bloque.</div>
          </div>
        </div>
      </DndContext>

      {vals.editorOpen && <EditorEjercicio vals={vals} programa={programa} onGuardado={cargar} />}
    </div>
  );
}