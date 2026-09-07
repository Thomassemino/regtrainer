import type { BetoVals } from "@/hooks/useBetoApp";
import { PH } from "@/lib/data";
import { initials } from "@/lib/utils";
import ImageSlot from "@/components/ImageSlot";

export default function Landing({ vals }: { vals: BetoVals }) {
  return (
    <div>
      <style>{`
        .rt-landing-beto { display: grid; grid-template-columns: .9fr 1.1fr; gap: 48px; align-items: center; }
        @media (max-width: 900px) { .rt-landing-beto { grid-template-columns: 1fr; gap: 28px; } }
      `}</style>
      <div className="rt-split" style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 48px" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Entrenamiento personal · Lobos, Buenos Aires</div>
          <h1 style={{ fontSize: "clamp(38px, 9vw, 72px)", lineHeight: .94, letterSpacing: "-0.04em", margin: "16px 0 0" }}>No es magia.<br /><span style={{ color: "var(--color-accent)" }}>Es constancia.</span></h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, opacity: .75, maxWidth: "44ch", margin: "18px 0 0", textWrap: "pretty" }}>Entrenamiento personalizado, funcional, musculación y outdoor. Planificación por bloques, seguimiento real y clases en grupos de hasta 8 personas. Primera evaluación sin cargo.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
            <button onClick={vals.goReservar} className="btn btn-primary" style={{ height: 46, paddingInline: 22, fontSize: 15 }}>Reservar mi primera clase</button>
            <a href="#servicios" className="btn btn-secondary" style={{ height: 46, paddingInline: 20, fontSize: 15 }}>Ver qué ofrece</a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 34px", marginTop: 38 }}>
            {vals.heroStats.map((s) => (
              <div key={s.k}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 30, letterSpacing: "-0.03em", color: "var(--color-accent)" }}>{s.v}</div>
                <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: "clamp(320px, 60vw, 520px)", position: "relative" }}>
          <ImageSlot
            alt="Beto entrenando"
            radius={14}
            src={PH.hero.src}
            credit={PH.hero.credit}
            creditHref={PH.hero.href}
            imgStyle={{ filter: "grayscale(1) contrast(1.12) brightness(.72)" }}
            overlay={<div style={{ position: "absolute", inset: 0, background: "linear-gradient(200deg, rgba(232,40,40,.22), transparent 55%, rgba(0,0,0,.6))" }} />}
          />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-divider)", borderBottom: "1px solid var(--color-divider)", background: "linear-gradient(180deg,rgba(232,40,40,.07),transparent)" }}>
        <div className="rt-grid rt-cols-4" style={{ maxWidth: 1180, margin: "0 auto", padding: "26px clamp(16px,4vw,32px)", gap: 24 }}>
          {vals.bandas.map((b) => (
            <div key={b.t} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <i className={`ph ${b.icon}`} style={{ fontSize: 21, color: "var(--color-accent)", marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{b.t}</div>
                <div style={{ fontSize: 12.5, opacity: .55, marginTop: 2, lineHeight: 1.4, textWrap: "pretty" }}>{b.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="servicios" style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 0", scrollMarginTop: 70 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Servicios</div>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "10px 0 0" }}>Todo lo que podés entrenar con Beto</h2>
          </div>
          <button onClick={vals.goReservar} className="btn btn-ghost">Ver horarios disponibles →</button>
        </div>
        <div className="rt-grid rt-cols-3" style={{ marginTop: 28 }}>
          {vals.servicios.map((s) => (
            <div key={s.id} onClick={s.onClick} style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", background: "var(--color-surface)", border: "1px solid rgba(244,244,245,.09)", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 150 }}><ImageSlot alt={s.foto} shape="rect" src={s.src} credit={s.credit} creditHref={s.creditHref} /></div>
              <div style={{ padding: "16px 17px 18px", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19, letterSpacing: "-0.02em" }}>{s.nombre}</div>
                  <span className="tag tag-accent" style={{ fontSize: 10 }}>{s.tag}</span>
                </div>
                <div style={{ fontSize: 13, opacity: .65, lineHeight: 1.5, flex: 1, textWrap: "pretty" }}>{s.desc}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 11, borderTop: "1px solid var(--color-divider)" }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13, color: "var(--color-accent)" }}>{s.dur} · {s.precioFmt}</span>
                  <span style={{ fontSize: 12, opacity: .45 }}>{s.cupo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 0" }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Cómo funciona</div>
        <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "10px 0 28px" }}>Reservar y pagar lleva un minuto</h2>
        <div className="rt-grid rt-cols-4">
          {vals.pasos.map((p) => (
            <div key={p.n} style={{ padding: 20, borderRadius: 10, border: "1px solid var(--color-divider)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontWeight: 700, fontSize: 36, letterSpacing: "-0.04em", color: "var(--color-accent)", opacity: .55 }}>{p.n}</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 8 }}>{p.t}</div>
              <div style={{ fontSize: 13, opacity: .6, lineHeight: 1.5, marginTop: 5, textWrap: "pretty" }}>{p.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="precios" style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 0", scrollMarginTop: 70 }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Precios</div>
        <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "10px 0 6px" }}>Clase suelta o mensualidad</h2>
        <p style={{ fontSize: 14, opacity: .6, margin: "0 0 26px" }}>Todos los valores en pesos argentinos. Cancelás sin costo hasta 6 h antes.</p>
        <div className="rt-grid rt-cols-4" style={{ alignItems: "start" }}>
          {vals.packs.map((p) => (
            <div key={p.id} style={{ padding: 20, borderRadius: 10, border: `1px solid ${p.bd}`, background: p.bg, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, letterSpacing: "-0.02em", flex: 1 }}>{p.nombre}</div>
                <span className="tag tag-accent" style={{ fontSize: 10, display: p.badgeShow as "inline-flex" | "none" }}>{p.badge}</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 34, letterSpacing: "-0.035em" }}>{p.precioFmt}</div>
                <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{p.unit}</div>
              </div>
              <div style={{ fontSize: 13, opacity: .65, lineHeight: 1.45, textWrap: "pretty" }}>{p.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                {p.feats.map((f) => (
                  <div key={f.t} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, opacity: .8 }}>
                    <i className="ph ph-check" style={{ color: "var(--color-accent)", fontSize: 14, marginTop: 2 }} />{f.t}
                  </div>
                ))}
              </div>
              <button onClick={p.onClick} className="btn btn-primary btn-block" style={{ marginTop: "auto", height: 40 }}>{p.cta}</button>
            </div>
          ))}
        </div>
      </div>

      <div id="beto" className="rt-landing-beto" style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 0", scrollMarginTop: 70 }}>
        <div style={{ height: "clamp(300px, 55vw, 420px)" }}>
          <ImageSlot
            alt="Retrato de Beto"
            radius={14}
            src={PH.retrato.src}
            credit={PH.retrato.credit}
            creditHref={PH.retrato.href}
            overlay={
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,.75))", display: "flex", alignItems: "flex-end", padding: 16 }}>
                <span style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
                  <span style={{ color: "#FFFFFF" }}>REG</span><span style={{ color: "var(--color-accent)" }}>TRAINER</span>
                </span>
              </div>
            }
          />
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Sobre Beto</div>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "10px 0 14px" }}>Roberto Ghiglione </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, opacity: .78, textWrap: "pretty" }}>Profesor de Educación Física y Preparador Fisico de RegTrainer. Acompaño a personas que arrancan de cero y a atletas que buscan volver a competir. Trabajo con evaluación inicial, planificación por bloques de cuatro semanas y seguimiento semanal: nada de rutinas genéricas.</p>
          <div className="rt-grid rt-cols-3" style={{ gap: 12, marginTop: 22 }}>
            {vals.coachStats.map((s) => (
              <div key={s.k} style={{ padding: 14, borderRadius: 10, background: "var(--color-surface)" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em", color: "var(--color-accent)" }}>{s.v}</div>
                <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{s.k}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {vals.certs.map((c) => (
              <span key={c.t} className="tag tag-neutral">{c.t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(32px,6vw,64px) clamp(16px,4vw,32px) 0" }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Testimonios</div>
        <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", margin: "10px 0 24px" }}>Lo que dicen los que entrenan acá</h2>
        <div className="rt-grid rt-cols-3">
          {vals.testimonios.map((t) => (
            <div key={t.slot} style={{ padding: 20, borderRadius: 10, border: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--color-accent-300)", letterSpacing: ".12em" }}>{t.estrellas}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, flex: 1, textWrap: "pretty" }}>{t.texto}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 10, borderTop: "1px solid var(--color-divider)" }}>
                <ImageSlot alt={t.autor} shape="circle" style={{ width: 30, height: 30, flex: "none" }} initials={initials(t.autor)} />
                <span style={{ fontSize: 12.5, opacity: .65 }}>{t.autor}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "clamp(32px,6vw,64px) auto 0", padding: "0 clamp(16px,4vw,32px)" }}>
        <div style={{ borderRadius: 16, padding: "clamp(24px,5vw,44px)", background: "linear-gradient(115deg,#3A0A0C,#0C0C0E 62%)", border: "1px solid rgba(232,40,40,.35)", display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "min(100%, 320px)" }}>
            <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", letterSpacing: "-0.03em", margin: 0 }}>Tu primera evaluación esta a un click de distancia</h2>
            <p style={{ fontSize: 15, opacity: .75, margin: "10px 0 0", maxWidth: "56ch", textWrap: "pretty" }}>Charlamos, medimos de dónde partís y armamos el plan. Después decidís si seguís.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button onClick={vals.goReservar} className="btn btn-primary" style={{ height: 46, paddingInline: 22, fontSize: 15 }}>Agendar evaluación</button>
            <a href="#precios" className="btn btn-secondary" style={{ height: 46, paddingInline: 20, fontSize: 15 }}>Ver precios</a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px clamp(16px,4vw,32px) 56px", display: "flex", justifyContent: "space-between", gap: 32, flexWrap: "wrap", fontSize: 13, opacity: .6 }}>
        <div style={{ maxWidth: "34ch", lineHeight: 1.6 }}>Roberto Ghiglione | REGTRAINER · Lobos, BSAS<br />Lunes a sábados · +54 9 2227 489847</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 26 }}>
          <a href="#servicios">Servicios</a><a href="#precios">Precios</a><a href="#beto">Sobre Beto</a>
        </div>
        <a href="https://www.lambdacodestudio.com.ar/" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 11, padding: "12px 18px", borderRadius: 10, border: "1px solid rgba(232,40,40,.45)", background: "linear-gradient(120deg,var(--color-accent-900),transparent)", color: "var(--color-text)", textDecoration: "none", maxWidth: "100%" }}>
          <i className="ph ph-code" style={{ fontSize: 20, color: "#FF7A7A" }} />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <span style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", opacity: .6 }}>Desarrollado por</span>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", opacity: 1 }}>Lambda Code Studio</span>
          </span>
          <i className="ph ph-arrow-up-right" style={{ fontSize: 15, opacity: .6 }} />
        </a>
      </div>
    </div>
  );
}
