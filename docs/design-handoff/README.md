# Handoff: Constructor de rutinas para el entrenador (Beto Training)

## Overview

Beto Training es una app web de un entrenador personal en Palermo (CABA): landing pública, reserva de turnos, pago, cuenta del cliente y panel del entrenador. Este handoff agrega al panel del entrenador un **constructor de rutinas tipo "block builder"** (inspirado en el flujo de AI Coach): desde la ficha de cada cliente, Beto arma un mesociclo de semanas configurables, edita cada bloque de ejercicio con su tabla de sobrecarga, lo asigna a uno o varios clientes y lo exporta en PDF con su marca. El cliente ve el mismo programa en la pestaña "Mi rutina" de su cuenta.

El código base existente es un proyecto **Next.js (App Router) + React + TypeScript**, con estado centralizado en un hook (`hooks/useBetoApp.ts`) y una pantalla por archivo en `components/screens/`. Los estilos son tokens CSS en `app/globals.css` (design system **Nocturne**) más estilos inline.

## About the Design Files

Los archivos `.dc.html` de este bundle son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y el comportamiento buscados, **no código de producción para copiar tal cual**. La tarea es **recrear estos diseños dentro del codebase existente** (Next.js + React + TypeScript, tokens de `globals.css`, íconos Phosphor), siguiendo sus patrones actuales: un componente de pantalla por vista en `components/screens/`, datos y helpers en `lib/`, estado y handlers en `hooks/useBetoApp.ts`.

Los prototipos usan una capa propia de plantillas (`support.js`, tags `sc-for` / `sc-if` / `{{ }}`). **Ignorar esa capa**: es el motor del prototipo. Lo que importa es el marcado, los valores de estilo, los textos y la lógica de estado.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, espaciados y estados finales. Los valores están tomados literalmente de `app/globals.css` del proyecto, por lo que deben implementarse con las variables CSS existentes (`var(--color-accent)`, `var(--color-surface)`, etc.), no re-hardcodeando hexadecimales. En los prototipos los hex aparecen literales sólo porque el HTML se abre fuera del proyecto.

## Archivos de diseño en este bundle

| Archivo | Qué contiene |
|---|---|
| `Beto Training - App completa.dc.html` | **La referencia principal.** Toda la app navegable: landing, reservar, checkout, confirmación, login, cuenta (5 pestañas), panel del entrenador, clientes, ficha, constructor de bloques, editor de ejercicio, asignación masiva y exportación PDF. |
| `Panel Beto - Rutinas.dc.html` | Versión previa, sólo el flujo nuevo del entrenador. Redundante; útil como segunda lectura. |
| `_ds/nocturne-.../styles.css` | Hoja del design system Nocturne (equivalente a `app/globals.css` del repo). |
| `support.js` | Runtime del prototipo. **No portar.** |

Para verlos: abrir el `.dc.html` en un navegador (necesita conexión: fuentes, Phosphor y fotos de Unsplash se cargan por CDN).

### Capturas (`screenshots/`)

Cada pantalla, modal y toast del prototipo, en orden de recorrido. Tomadas a 1560 px de ancho de layout (escaladas para la captura), tema oscuro Nocturne. Algunas etiquetas cortas se ven superpuestas en las imágenes: es un artefacto del capturador con texto que envuelve, no un defecto del diseño — el HTML es la fuente de verdad.

| # | Archivo | Qué muestra |
|---|---|---|
| 01 | `01-landing-hero.png` | Landing: hero + banda de beneficios |
| 02 | `02-landing-servicios.png` | Landing: grilla de servicios |
| 03 | `03-landing-como-funciona.png` | Landing: pasos 01–04 |
| 04 | `04-landing-precios.png` | Landing: paquetes y precios |
| 05 | `05-landing-sobre-beto.png` | Landing: sobre Beto, testimonios, blog, footer |
| 06 | `06-reservar.png` | Reservar: clase / día / horario |
| 07 | `07-reservar-horario-elegido.png` | Reservar con horario seleccionado y resumen actualizado |
| 08 | `08-checkout-bono.png` | Checkout con crédito de bono |
| 09 | `09-checkout-tarjeta.png` | Checkout con tarjeta: formulario y cuotas |
| 10 | `10-confirmacion.png` | Confirmación de turno |
| 11 | `11-login-cliente.png` | Login, rol cliente |
| 12 | `12-login-entrenador.png` | Login, rol entrenador (con campo 2FA) |
| 13 | `13-login-error-validacion.png` | **Alerta de validación** del login (campos vacíos) |
| 14 | `14-cuenta-reservas.png` | Cuenta del cliente: Mis reservas |
| 15 | `15-cuenta-historial.png` | Cuenta: tabla de historial |
| 16 | `16-cuenta-mi-rutina-lunes.png` | **Mi rutina** (rediseñada) — día lunes |
| 17 | `17-cuenta-mi-rutina-miercoles.png` | Mi rutina — cambio de día a miércoles |
| 18 | `18-cuenta-paquetes.png` | Cuenta: paquetes y pagos |
| 19 | `19-cuenta-notificaciones.png` | Cuenta: notificaciones (incluye el aviso de rutina asignada) |
| 20 | `20-cuenta-datos.png` | Cuenta: mis datos |
| 21 | `21-panel-entrenador.png` | Panel de Beto con el botón "Constructor de rutinas" |
| 22 | `22-panel-ocupacion-pagos.png` | Panel: ocupación semanal y últimos pagos |
| 23 | `23-clientes.png` | **Lista de clientes** (pantalla nueva) |
| 24 | `24-ficha-cliente.png` | **Ficha del cliente** con sus programas |
| 25 | `25-ficha-cumplimiento.png` | Ficha: gráfico de cumplimiento |
| 26 | `26-builder-semana.png` | **Constructor de bloques** — fila superior (Lun–Jue) |
| 27 | `27-builder-fila-inferior.png` | Constructor — fila inferior (Vie–Dom + volumen semanal) |
| 28 | `28-builder-semana-agregada.png` | Constructor con una 5.ª semana agregada (selector actualizado) |
| 29 | `29-editor-ejercicio.png` | **Modal editor de ejercicio** con la tabla de sobrecarga |
| 30 | `30-editor-foco-ritmo.png` | Editor con la etiqueta de foco "Ritmo" seleccionada |
| 31 | `31-toast-bloque-guardado.png` | **Toast** "Bloque guardado con su sobrecarga" |
| 32 | `32-asignacion-masiva.png` | **Asignación masiva** con 2 clientes preseleccionados |
| 33 | `33-asignacion-todos.png` | Asignación con "Seleccionar todos" y CTA actualizado |
| 34 | `34-exportar-pdf-temas.png` | **Exportar PDF**: los 3 temas + toast de asignación |
| 35 | `35-exportar-pdf-toast-descarga.png` | Toast "PDF generado con la marca de Beto Training" |
| 36 | `36-vista-cliente-rutina-asignada.png` | Vuelta a la vista del cliente con la rutina ya asignada |

---

## Pantallas existentes (ya implementadas en el repo, sin cambios)

`landing`, `reservar`, `checkout`, `confirm`, `login`, `cuenta` (pestañas `reservas`, `paquetes`, `notis`, `datos`) y `coach`. Están recreadas en el prototipo únicamente para que el flujo completo se pueda recorrer; su fuente de verdad sigue siendo el repo (`components/screens/*.tsx`).

Cambios menores sobre lo existente:

1. **`coach` (Panel de Beto)**: en la cabecera se suma un botón primario **"Constructor de rutinas"** (ícono `ph-squares-four`) que navega a la nueva pantalla `clientes`. El KPI "Bonos por vencer / 7 / Conviene avisar" pasa a **"Rutinas sin actualizar / 7 / Conviene revisarlas"**. Las tarjetas de "Clientes que necesitan atención" ahora navegan a la ficha del cliente correspondiente.
2. **`cuenta` → pestaña `rutina`**: se reemplaza la lista plana de ejercicios por la vista por bloques (ver más abajo).
3. **Notificaciones**: se agrega una entrada nueva al tope — ícono `ph-barbell`, título "Beto te asignó «Fuerza & Motor»", texto "Bloque de 4 semanas. Ya podés verlo en Mi rutina y descargar el PDF.", "Hace 5 min", fondo `rgba(145,132,217,.10)`.

---

## Pantallas nuevas

Todas viven dentro del shell existente (header sticky de 57 px de alto + `ToastBar`). Salvo el constructor, todas usan el contenedor estándar: `max-width: 1180px; margin: 0 auto; padding: 40px 32px 72px`.

### 1. `clientes` — Lista de clientes

**Propósito:** punto de entrada al constructor. Beto elige a quién le va a armar la rutina.

**Layout:**
- Botón ghost "← Panel" arriba (`margin-bottom: 14px`).
- Fila de cabecera `display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px`:
  - Izquierda: kicker "MODO ENTRENADOR" (11 px, `letter-spacing:.16em`, uppercase, `--color-accent`), `h1` "Clientes" (38 px, `letter-spacing:-0.03em`, peso 500, `margin:8px 0 0`), bajada 13.5 px `opacity:.6`: "Entrá a la ficha de cada uno para armarle la rutina, asignarla y exportarla."
  - Derecha: `input.input` de 240 px con placeholder "Buscar cliente" + botón `.btn.btn-secondary` "Asignación masiva" (ícono `ph-users-three`) → pantalla `asignar`.
- `table.table` a ancho completo. Columnas: **Cliente** (avatar circular de 32 px con iniciales sobre `--color-accent-800`, texto `--color-accent-100`, 12 px peso 500 + nombre en peso 500 + objetivo en 12 px `opacity:.5`), **Plan** (13.5 px `opacity:.75`), **Programa actual** (`span.tag`), **Última actualización** (13 px `opacity:.6`), **Rutina** (alineada a la derecha, `.btn.btn-secondary` "Abrir ficha").

**Datos demo (6 filas):**

| Ini | Nombre | Objetivo | Plan | Programa | Tag | Actualización |
|---|---|---|---|---|---|---|
| CF | Camila Ferreyra | Volver a correr sin dolor de rodilla | Bono 8 · 6 clases | Fuerza & Motor | `tag-accent` | Hoy |
| MD | Martín Duarte | Ganar fuerza en tren superior | Mensualidad | Sin asignar | `tag-outline` | Hace 5 semanas |
| SL | Sofía Lema | Bajar grasa y sostener la rutina | Bono 4 · 2 clases | Base metabólica | `tag-accent` | Hace 6 días |
| LG | Lucía Giménez | Primera vez en el gimnasio | Evaluación inicial | Sin asignar | `tag-outline` | Sin plan |
| NP | Nicolás Pereyra | Bajar la marca en 10K | Mensualidad | Ritmo 10K | `tag-accent` | Hace 2 días |
| JR | Julieta Ríos | Rehabilitación de hombro | Bono 8 · 4 clases | Hombro seguro | `tag-accent` | Hace 9 días |

### 2. `ficha` — Ficha del cliente

**Propósito:** contexto del cliente y sus programas; desde acá se entra al constructor.

**Layout:** `padding: 32px 32px 72px`; botón ghost "← Clientes"; grid `300px 1fr`, `gap: 28px`, `align-items: start`.

**Columna izquierda** (sticky, `top: 86px`, `gap: 16px`):
- Tarjeta `padding:20px; border-radius:14px; background: var(--color-surface)`:
  - Avatar 52 px (iniciales, 17 px) + nombre 17 px peso 500 `letter-spacing:-0.02em` + subtítulo 12 px `opacity:.5` con "`<plan>` · desde 02/2025".
  - Lista de 4 filas `display:flex; justify-content:space-between; gap:10px`, 13 px, etiqueta `opacity:.55`: Objetivo (del cliente), Frecuencia "4 días semanales", Nivel "Intermedio", WhatsApp "+54 9 11 6123-4488".
  - Caja de nota: `margin-top:16px; padding:13px; border-radius:10px; border:1px dashed var(--color-neutral-700)`, 12.5 px, `opacity:.8` — "**Nota médica:** condromalacia rotuliana leve (2024). Sin impacto alto en días consecutivos."
- `.btn.btn-primary.btn-block` **"Armar rutina"** (ícono `ph-squares-four`) → `builder`.

**Columna derecha:**
- `h2` 30 px "Rutinas de `<nombre de pila>`" + bajada 13.5 px `opacity:.6`: "Cada programa es un mesociclo de semanas configurables. Duplicalo para arrancar el siguiente bloque sin reescribir nada."
- Lista de programas (mismo patrón visual que "Mis reservas"): fila `display:flex; align-items:center; gap:18px; padding:16px 18px; border-radius:14px; background: var(--color-surface)` — bloque numérico de 46 px (label "BLOQUE" 10.5 px uppercase `opacity:.5` + número 24 px peso 500), separador vertical de 1 px `--color-divider`, título 15 px peso 500 + detalle 12.5 px `opacity:.55`, `span.tag` de estado, botones "Editar" (secondary → `builder`) y "Ver PDF" (ghost → `pdf`).
  - Bloque 2 · "Fuerza & Motor" · "4 semanas · 5 días semanales · objetivo fuerza" · En edición (`tag-outline`)
  - Bloque 1 · "Base de fuerza" · "4 semanas · terminado el 21/08 · 92% de cumplimiento" · Completado (`tag-neutral`)
  - Bloque 0 · "Vuelta a correr" · "6 semanas · progresión de impacto controlada" · Archivado (`tag-neutral`)
- `h3` 20 px "Cumplimiento de las últimas 4 semanas" + gráfico de barras idéntico al de "Ocupación de la semana" del panel (`height:150px; padding:16px; border-radius:14px; background: var(--color-surface)`; barras `--color-accent`, `border-radius: 5px 5px 0 0`): S1 92%, S2 88%, S3 75%, S4 96%.

### 3. `builder` — Constructor de bloques (pantalla central)

**Propósito:** programar la semana. Tablero kanban con una columna por día.

**Toolbar** sticky bajo el header (`top: 57px`, `z-index: 20`, fondo `rgba(22,24,38,.92)`, `backdrop-filter: blur(14px)`, borde inferior `--color-divider`). Contenido en `max-width:1560px; padding:11px 24px; display:flex; align-items:center; gap:14px`:
- Botón ghost "←" → `ficha`.
- Nombre del programa "Fuerza & Motor" (15 px peso 500, `white-space:nowrap`).
- Cliente: 12 px `opacity:.5`, ícono `ph-user` + nombre.
- `span.tag.tag-outline` "Sin asignar".
- Spacer `flex:1`.
- **Selector de semanas**: contenedor `display:flex; gap:4px; padding:3px; border-radius:8px; border:1px solid var(--color-divider)`; un botón de 28×24 px por semana (`border-radius:6px`, 13 px); la activa `background: rgba(145,132,217,.18)`, color `--color-accent-300`; las demás transparentes con `rgba(233,233,237,.6)`. Último botón **"+"** agrega una semana (máximo 8) y la selecciona, con toast "Semana N agregada al bloque".
- Botón ghost con ícono `ph-gear`.
- `.btn.btn-primary` "Continuar →" → `asignar`.

**Tablero:** `max-width:1560px; padding:18px 24px; display:grid; grid-template-columns:repeat(4,1fr); gap:14px; align-items:start`. 7 columnas de día + 1 widget de volumen (8 celdas = 2 filas de 4).

**Columna de día** — `border:1px solid var(--color-divider); border-radius:14px; background:#1b1d2c; padding:14px; min-height:300px; display:flex; flex-direction:column; gap:12px`:
- Cabecera: nombre del día (15 px peso 500) + resumen a la derecha (11 px `opacity:.4`): "N bloques" o "Sin cargar".
- **Calentamiento**: label 11 px uppercase `letter-spacing:.1em` `opacity:.45` + caja `padding:10px 12px; border-radius:10px; background: var(--color-surface)`, 12 px, `line-height:1.45`, `opacity:.75`. Es texto libre editable.
- **Entrenamiento**: label igual + lista de tarjetas de bloque con `gap:8px`, y al final un botón "+" (`height:30px; border:1px dashed var(--color-divider); border-radius:10px`, texto `rgba(233,233,237,.45)`) que abre el editor de ejercicio vacío.

**Tarjeta de bloque** — `padding:10px 12px; border-radius:10px; background: var(--color-surface); border-left:2px solid var(--color-accent-800)`; hover: `background:#2a2d3d; border-left-color: var(--color-accent)`. Al hacer clic abre el **editor de ejercicio**. Contenido:
- Fila superior `display:flex; align-items:center; flex-wrap:wrap; row-gap:4px; gap:7px`: `span.tag` del tipo (10 px, `padding:1px 7px`, `white-space:nowrap`), meta "N ejercicios" (10.5 px `opacity:.4`), spacer, y etiqueta de foco a la derecha (9.5 px, uppercase, `letter-spacing:.08em`).
- Título 13 px peso 500 `line-height:1.3`.
- Detalle 11.5 px `opacity:.55` `line-height:1.35`.

**Tipos de bloque → clase de tag** (paleta mono de Nocturne; no inventar colores nuevos):

| Tipo | Clase | Uso |
|---|---|---|
| Tradicional | `tag-accent` | Series × reps clásico |
| Secuencia | `tag-accent-2` | Ejercicios encadenados por serie |
| Superserie | `tag-neutral` | Dos o más ejercicios con descanso conjunto |
| EMOM | `tag-outline` | Every minute on the minute, con duración total |
| Por tiempo | `tag-outline` | AMRAP / for time, con vueltas |

**Etiquetas de foco → color de texto:** Técnica `--color-accent-400` (#b5abfc) · Ritmo `--color-accent-2-400` (#b5afe8) · Máximo esfuerzo `--color-neutral-200` (#e4e7f5).

**Día de descanso** — la columna muestra, centrado y con `flex:1`: círculo de 52 px (`background: var(--color-surface)`, ícono `ph-moon` 22 px en `--color-accent`), texto "Día de Descanso" (13.5 px `opacity:.7`) y botón ghost 12 px "Convertir a entrenamiento" (ícono `ph-plus-circle`) que convierte el día en entrenable.

**Widget "Volumen semanal"** (última celda, mismo estilo de columna): kicker 10.5 px uppercase en `--color-accent`; valor 28 px peso 500 "0,8 km"; a la derecha un cuadro de 28 px con borde e ícono `ph-arrows-clockwise`; luego 4 filas `display:flex; justify-content:space-between; gap:10px`, 12.5 px (etiqueta `opacity:.55; min-width:0`, valor `white-space:nowrap`): Días de entrenamiento "5 de 7", Bloques cargados "15", Series totales "62", Trabajo en carrera "0,8 km"; separador de 1 px; nota 11.5 px `opacity:.5`: "Se recalcula solo con lo que cargás en cada día del bloque." **Se recalcula desde el contenido de los días, no se carga a mano.**

**Contenido demo de la semana** (todos los `detalle` usan " · " como separador):

- **Lunes** — calentamiento: "Movilidad de cadera y tobillo 5' + 2 series progresivas con barra vacía."
  1. Tradicional · Técnica · "Sentadilla trasera con barra" · "5 × 3 · @ 80% 1RM"
  2. Secuencia (4 ejercicios) · Técnica · "4 series · @ 70% 1RM · Rest 150s" · "Clean pull 3 rep · Power clean 2 rep · Sentadilla frontal 2 rep"
  3. Superserie (2 ejercicios) · Técnica · "4 series" · "Peso muerto rumano con barra 8 rep · Sentadilla búlgara 10 rep"
  4. EMOM (3 ejercicios) · Ritmo · "12 min" · "Wall ball 12 rep · Toes to bar 8 rep · Remo en ergómetro 12 cal"
- **Martes** — "Remo suave 500 m en zona 1, escapulares y banda para hombro."
  1. Tradicional · Técnica · "Dominadas estrictas pronas" · "5 × 5 · @ RPE 8"
  2. Por tiempo (3 ejercicios) · Ritmo · "AMRAP 14 min" · "Burpee sobre barra 10 rep · Remo 200 mts · Kettlebell swing 15 rep"
  3. Superserie (2 ejercicios) · Técnica · "4 series" · "Remo con mancuerna 10 rep · Face pull con banda 15 rep"
- **Miércoles** — "Flexiones escapulares 2×10 y colgado pasivo 2×30\" antes de la primera serie pesada."
  1. Tradicional · Técnica · "Press de banca con barra" · "5 × 4 · @ 77,5% 1RM"
  2. Tradicional · Técnica · "Fondos en paralelas" · "4 × 8 · @ RPE 8"
  3. EMOM (2 ejercicios) · Ritmo · "10 min" · "Plancha frontal 40 s · GHD sit-up 12 rep"
  4. Por tiempo (3 ejercicios) · Máximo esfuerzo · "1 vuelta" · "Wall ball 21 rep · Burpee 15 rep · Salto patinador 9 rep"
- **Jueves** — descanso.
- **Viernes** — "Buenos días con banda 2×12, sentadilla overhead con caño 2×8 y 60 saltos a la soga."
  1. Tradicional · Técnica · "Peso muerto convencional" · "5 × 3 · @ 82,5% 1RM"
  2. Secuencia (3 ejercicios) · Técnica · "4 series · @ 62,5% 1RM · Rest 150s" · "Snatch pull 3 rep · Power snatch 2 rep · Sentadilla overhead 2 rep"
  3. Tradicional · Ritmo · "Hip thrust con barra" · "4 × 8 · 110 kg"
  4. Superserie (2 ejercicios) · Técnica · "3 series" · "Curl femoral sentado 12 rep · Extensión de rodilla 12 rep"
- **Sábado** — "Trote de entrada 800 m nasal en zona 1 y movilidad general 5'." Sin bloques ("Sin cargar").
- **Domingo** — descanso.

### 4. Editor de ejercicio (overlay sobre el constructor)

**Propósito:** definir un bloque y **programar su sobrecarga una sola vez para todo el mesociclo**.

**Overlay:** `position:fixed; inset:0; z-index:80; display:grid; place-items:center; padding:24px; background: rgba(22,24,38,.72); backdrop-filter: blur(4px)`.
**Panel:** `width:min(860px,100%); max-height:88vh; overflow:auto; border-radius:16px; background:#1b1d2c; box-shadow: var(--shadow-lg-ish) (0 0 0 1px #3f424d, 0 16px 40px rgba(0,0,0,.65)); padding:20px 22px`.

De arriba abajo:
1. Fila: `span.tag.tag-outline` "Por series" a la izquierda; `.btn.btn-secondary` "Guía de ejecución" (ícono `ph-book-open`) a la derecha. El botón abre el contenido técnico del ejercicio (pendiente de definir; en el prototipo no navega).
2. Fila (`gap:12px`, `flex-wrap:wrap`): botón ghost "←" (cierra), pill del tipo de bloque — `padding:7px 18px; border-radius:99px; border:1px solid var(--color-divider)`, 15 px peso 500 — botón icónico `.btn.btn-secondary.btn-icon` (`ph-file-text`), spacer, y **selector de foco**: tres pills (`padding:7px 14px; border-radius:99px`, 13 px). Seleccionado: `border-color: var(--color-accent)`, `background: rgba(145,132,217,.16)`, `color: var(--color-accent-300)`. No seleccionado: `border-color: var(--color-divider)`, fondo transparente, `color: var(--color-text)`.
3. Nombre del ejercicio: `input.input` centrado, `max-width:420px; min-height:42px; font-size:15px`, más una "Aa" a la derecha (13 px `opacity:.45`) para el tamaño de texto.
4. **Cuatro campos base**, `display:grid; grid-template-columns:repeat(4,1fr); gap:12px`; cada uno `padding:12px; border-radius:12px; border:1px solid rgba(233,233,237,.14); background: var(--color-surface); text-align:center`: label 10 px uppercase `letter-spacing:.12em` `opacity:.5` con un ícono de 12 px en `--color-accent`, valor 22 px peso 500, sub 10.5 px `opacity:.4`.
   - Series · 4 · "por ejercicio" · `ph-stack`
   - Repeticiones · 6 · "por serie" · `ph-repeat`
   - Carga · 70 · "%1RM · progresiva" · `ph-trend-up`
   - Descanso · 02:00 · "entre series" · `ph-timer`
5. Fila de sección: "Sobrecarga" (14 px, `--color-accent`, ícono `ph-trend-up`) y `span.tag.tag-accent` "Intensidad" a la derecha.
6. **Tabla de sobrecarga** (`table.table`): columnas Semana / Series / Reps / %1RM / Descanso (las cuatro últimas centradas). Una fila por semana del bloque; el número de semana va en un círculo de 24 px (`border-radius:50%`, borde de 1 px); la semana activa lleva borde `--color-accent` y texto `--color-accent-300`, el resto borde `--color-divider` y texto `rgba(233,233,237,.7)`.
   Progresión demo (4 semanas): S1 4×6 70% 02:00 · S2 4×5 75% 02:00 · S3 5×4 80% 02:00 · S4 3×5 65% 02:00. Con más semanas se sigue la serie de intensidades 70, 75, 80, 65, 72, 78, 82, 68 y las reps ciclan 6, 5, 4, 5. **En producción, series/reps/%/descanso son editables por semana.**
7. Pie: nota 11.5 px `opacity:.45` "La progresión se programa una vez y se aplica a todo el bloque." + botones "Cancelar" (secondary, cierra) y "Guardar bloque" (primary, ícono `ph-check`; cierra y dispara toast "Bloque guardado con su sobrecarga").

### 5. `asignar` — Asignación masiva

**Propósito:** asignar el mismo programa a varios clientes de una vez.

**Layout:** `padding:32px 32px 72px`; botón ghost "← Volver al constructor"; `h1` 34 px "Asignar «Fuerza & Motor»"; bajada 13.5 px `opacity:.6`: "El mismo programa a varios clientes, sin reescribirlo. Cada uno lo ve en su cuenta y lo recibe en PDF."; grid `1fr 340px`, `gap:24px`.

**Izquierda:** fila con `h3` 18 px "Elegí a quién se lo asignás" y botón ghost que alterna entre "Seleccionar todos" / "Deseleccionar todos". Debajo, una fila por cliente: `padding:13px 15px; border-radius:12px; background: var(--color-surface); border:1px solid <acento si está seleccionado, si no transparente>`, con checkbox cuadrado de 22 px (`border-radius:6px`, borde 1.5 px; marcado: fondo `--color-accent` con `ph-check` de 13 px en `#161826`), avatar de 32 px, nombre 14 px peso 500 + objetivo 12 px `opacity:.55`, y plan a la derecha (12 px `opacity:.45`). Toda la fila es clickeable. Preseleccionados por defecto: Camila Ferreyra y Martín Duarte.

**Derecha (sticky, `top:86px`, `padding:20px; border-radius:14px; background: var(--color-surface); gap:14px`):** kicker "RESUMEN"; cuatro filas 13 px (Programa "Fuerza & Motor", Duración "N semanas", Asignados "N clientes", Marca del PDF "Beto Training"); campo "Mensaje para tus clientes" (`textarea.input`, `min-height:80px`, valor por defecto "Arrancamos el bloque nuevo. Cualquier duda me escribís."); botón primary block cuyo label es "Asignar a N clientes" (o "Elegí al menos un cliente" si no hay selección) — navega a `pdf` y dispara el toast "Programa asignado a N clientes"; nota final 11.5 px `opacity:.45`: "Queda visible en «Mi rutina» de cada cliente y se genera el PDF con tu marca."

### 6. `pdf` — Exportación con marca propia

**Propósito:** elegir el tema visual del PDF que reciben los clientes.

**Layout:** botón ghost "← Volver a la ficha"; cabecera con `h1` 34 px "Exportar con tu marca" + bajada "Tres temas para el PDF. El logo y el nombre son tuyos, no de la plataforma." y, a la derecha, `.btn.btn-primary` "Descargar PDF" (ícono `ph-file-pdf`). Grid `repeat(3,1fr)`, `gap:20px`.

**Tarjeta de tema:** `padding:18px; border-radius:14px; border:1px solid <acento si está elegido, si no divider>; background:#1b1d2c; display:flex; flex-direction:column; align-items:center; gap:14px`. Contiene la **maqueta de la portada del PDF** (ancho máximo 280 px, `border-radius:14px`, `padding:16px`, 11 px base) con: cabecera de marca (cuadro de 24 px con la inicial + "Beto Training" 12 px peso 600 + "Programado por Beto Álvarez" 9 px `opacity:.6` + "PDF" 8 px), kicker "PLAN DE ENTRENAMIENTO", título "Fuerza & Motor" 19 px peso 600 en el color del tema, duración alineada a la derecha, fila Frecuencia "5 días semanales" / Objetivo principal "Fuerza", grilla de 4 chips de semana con sus fechas (SEM 1 24 Ago–30 Ago, SEM 2 31 Ago–06 Sep, SEM 3 07 Sep–13 Sep, SEM 4 14 Sep–20 Sep), caja "INTRODUCCIÓN" con el racional del mesociclo, y caja "SOBRECARGA SEMANAL" con la tabla del ejercicio (SEM / SERIES / REP / CARGA / DESC). Debajo de la maqueta: tres swatches circulares de 13 px, el nombre del tema (16 px peso 500, con ícono en `--color-accent`) y el subtítulo en uppercase 10.5 px `opacity:.45`.

**Temas** (colores del documento exportado, deliberadamente fuera de la paleta Nocturne porque el PDF lleva la marca del entrenador, no la de la plataforma):

| Tema | Sub | Ícono | Fondo | Texto | Acento | Chips | Cajas | Swatches |
|---|---|---|---|---|---|---|---|---|
| Clean Design | Claro | `ph-file-text` | `#ffffff` | `#1b2320` | `#1f4d3a` | `#eef3f0` | `#f2f6f4` | #ffffff, #12241d, #1f9d67 |
| Night Design | Noche | `ph-palette` | `#0e1726` | `#e6ecf6` | `#7aa2f7` | `#17223a` | `#141d31` | #0e1726, #ffffff, #7aa2f7 |
| Pink Gold | Rosa y oro | `ph-sparkle` | `#fffaf7` | `#2a1620` | `#8c1d3f` | `#fdeef2` | `#fdf1f4` | #fffaf7, #6d1327, #e0b25c |

Texto de la introducción: "Cuatro semanas para levantar más sin perder motor. Las semanas 1 a 3 suben la carga y la cuarta afloja, para que llegues entera al test."

Pie de pantalla: `.btn.btn-secondary` "Ver cómo lo recibe el cliente" (lleva a `cuenta` con la pestaña `rutina` activa) y `.btn.btn-ghost` "Seguir editando el bloque" (vuelve a `builder`).

**Nota de implementación:** en el prototipo el PDF es sólo una maqueta. En producción hay que generar el documento real (portada, línea de tiempo de semanas, introducción, objetivos, tabla de sobrecarga por ejercicio, detalle de bloques y guías de ejecución) con los tres temas.

### 7. `cuenta` → pestaña "Mi rutina" (rediseñada)

**Propósito:** el cliente ve el programa asignado, por día.

- `h2` 30 px "Mi rutina" + bajada 13.5 px `opacity:.6`: "Fuerza & Motor · 4 semanas · asignada por Beto el 22/08".
- Chips de día (`padding:9px 15px; border-radius:99px; border:1px solid`, 13 px, mismos estados de selección que el selector de foco) — sólo los días que entrenan: Lunes, Martes, Miércoles, Viernes, Sábado.
- Contenido, `max-width:760px`, `gap:10px`:
  - Caja de **Calentamiento**: `padding:14px 16px; border-radius:12px; background: var(--color-surface)`; label 11 px uppercase `opacity:.45` y texto 13.5 px `opacity:.8`.
  - Una tarjeta por bloque: `padding:16px 18px; border-radius:12px; background: var(--color-surface)`. Cabecera con número en cuadro de 22 px, `span.tag` del tipo, meta y etiqueta de foco a la derecha; título 15 px peso 500; detalle 13 px `opacity:.6`; y una grilla de 4 campos (`repeat(4,1fr)`, `gap:8px`, cada uno `padding:9px; border-radius:10px; border:1px solid rgba(233,233,237,.12); text-align:center`, label 10 px uppercase `opacity:.45`, valor 15 px): Series, Rep, Carga, Descanso. En bloques no tradicionales, Series y Rep muestran "—" y Carga "RPE 8".
  - Nota final: `padding:15px; border-radius:12px; border:1px dashed var(--color-neutral-700)`, 13 px, `opacity:.78` — "**Nota de Beto:** si una serie te sale con técnica pobre, quedate en la carga de la semana anterior: la progresión es una guía, no una obligación."

---

## Interactions & Behavior

**Navegación nueva:** `coach → clientes → ficha → builder → asignar → pdf`, más los retrocesos explícitos de cada pantalla. Toda navegación hace `window.scrollTo(0,0)` y apila la pantalla anterior en `prev` (ya existe en el hook). El acceso al panel exige `auth === "admin"`; si no, se redirige a `login` con el rol "admin" preseleccionado (comportamiento ya presente en `goCoach`).

**Toasts** (patrón existente: `showToast`, 2400 ms): "Semana N agregada al bloque", "Bloque guardado con su sobrecarga", "Programa asignado a N clientes", "PDF generado con la marca de Beto Training", "Tema `<nombre>` seleccionado".

**Interacciones del constructor:** clic en tarjeta de bloque o en "+" abre el editor; hover de la tarjeta cambia fondo y color del borde izquierdo; "+" en el selector de semanas agrega semana (tope 8) y agrega su fila en la tabla de sobrecarga; "Convertir a entrenamiento" transforma un día de descanso.

**Pendiente para producción (no está en el prototipo, pero el diseño lo asume):** arrastrar bloques dentro de un día y entre días; duplicar un día o una semana; guardar como plantilla; toggle "Semanas / Días" de la barra (en el prototipo la vista "Días" no está diseñada).

**Estados no diseñados aún:** carga, error de guardado, y vacío de la lista de clientes. Resolverlos con los patrones existentes del repo.

## State Management

Extender `AppState` en `lib/types.ts` y el hook `useBetoApp`:

```ts
type Screen = "landing" | "reservar" | "checkout" | "confirm" | "login" | "cuenta" | "coach"
            | "clientes" | "ficha" | "builder" | "asignar" | "pdf";

interface AppState {
  // ...lo existente
  fichaId: number;                       // índice del cliente abierto
  semanas: number;                       // largo del mesociclo (2–8), default 4
  semanaSel: number;                     // pestaña de semana activa, default 1
  editorOpen: boolean;                   // overlay del editor de ejercicio
  editorFoco: "Técnica" | "Ritmo" | "Máximo esfuerzo";
  editorNombre: string;                  // nombre del ejercicio
  diaCliente: number;                    // día activo en "Mi rutina"
  asignados: Record<string, boolean>;    // selección de la asignación masiva
  temaPdf: "clean" | "night" | "pink";
}
```

Modelo de datos sugerido para `lib/data.ts` (hoy el prototipo lo tiene hardcodeado):

```ts
type TipoBloque = "Tradicional" | "Secuencia" | "Superserie" | "EMOM" | "Por tiempo";
type Foco = "Técnica" | "Ritmo" | "Máximo esfuerzo";

interface FilaSobrecarga { semana: number; series: number; reps: number; pct: number; descanso: string; }
interface Bloque { id: string; tipo: TipoBloque; foco: Foco; titulo: string; detalle: string;
                   meta?: string; sobrecarga: FilaSobrecarga[]; }
interface DiaPrograma { dia: string; descanso: boolean; calentamiento?: string; bloques: Bloque[]; }
interface Programa { id: string; nombre: string; semanas: number; dias: DiaPrograma[];
                     objetivo: string; frecuencia: string; estado: "borrador" | "asignado" | "completado";
                     asignadoA: string[]; }
interface Cliente { id: string; nombre: string; iniciales: string; objetivo: string; plan: string;
                    programas: Programa[]; }
```

El volumen semanal y los contadores del widget son **derivados** de `dias[]`, nunca estado propio.

## Design Tokens

Todos ya existen en `app/globals.css`. Los que usa este diseño:

- **Fondo/superficies:** `--color-bg` #161826 · `--color-surface` #232532 · fondo de columna del constructor **#1b1d2c** (único valor nuevo: un paso entre bg y surface; conviene agregarlo como token, p. ej. `--color-surface-sunken`).
- **Texto:** `--color-text` #e9e9ed · `--color-divider` `color-mix(in srgb, #e9e9ed 16%, transparent)`.
- **Acento:** `--color-accent` #9184d9 · ramp `--color-accent-100…900` (usados: 100 #f5f4ff, 300 #d2cefd, 400 #b5abfc, 700 #5d5294, 800 #423a6a, 900 #2b2741) · `--color-accent-2-400` #b5afe8 · `--color-neutral-200` #e4e7f5, `--color-neutral-700` #595d6c, `--color-neutral-800` #3f424d, `--color-neutral-900` #292b31.
- **Tintes de estado:** seleccionado `rgba(145,132,217,.16)`; pestaña activa `rgba(145,132,217,.14)`; semana activa `rgba(145,132,217,.18)`; método de pago activo `rgba(145,132,217,.10)`.
- **Tipografía:** Inter 400/500/600/700 (`--font-heading` = `--font-body`). Títulos con peso **500** (no más) y `letter-spacing` negativo: h1 38–40 px `-0.03em`, h2 30 px `-0.03em`, h3 18–20 px `-0.02em`. Cuerpo 13–15 px, metadatos 10–12.5 px, kickers 10–11 px uppercase `letter-spacing:.12–.16em`.
- **Radios:** 6 px chips internos · 8 px `--radius-md` · 10–12 px tarjetas chicas · 14 px `--radius-lg` tarjetas y columnas · 16 px overlay · 99 px pills.
- **Espaciado:** escala densa 0.7× (`--space-1…8`); gaps reales usados 4/7/8/9/10/12/14/18/24/28 px.
- **Sombras:** `--shadow-sm` `0 0 0 1px #3f424d` · `--shadow-md` `0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,.55)` · overlay `0 0 0 1px #3f424d, 0 16px 40px rgba(0,0,0,.65)`.
- **Componentes del sistema:** `.btn` (`.btn-primary` = contorno acento, nunca relleno · `.btn-secondary` · `.btn-ghost` · `.btn-icon` · `.btn-block`), `.tag` (`.tag-accent`, `.tag-accent-2`, `.tag-neutral`, `.tag-outline`), `.field` + `.input`, `.table`, `.card`, `.seg`. Foco de teclado: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.

## Assets

- **Íconos:** Phosphor Icons 2.1.1, ya cargado en `app/layout.tsx` (regular + fill). Usados en las pantallas nuevas: `ph-squares-four`, `ph-users-three`, `ph-user`, `ph-arrow-left`, `ph-arrow-right`, `ph-gear`, `ph-moon`, `ph-plus-circle`, `ph-arrows-clockwise`, `ph-book-open`, `ph-file-text`, `ph-file-pdf`, `ph-check`, `ph-check-circle`, `ph-trend-up`, `ph-stack`, `ph-repeat`, `ph-timer`, `ph-palette`, `ph-sparkle`, `ph-barbell`, `ph-shield-check`.
- **Fotos:** las de la landing son de Unsplash y ya están en `lib/data.ts` (`PH`). Las pantallas nuevas **no usan fotografías**; los avatares son iniciales sobre `--color-accent-800`.
- **Faltante:** las **guías de ejecución ilustradas** (secuencias de imágenes por ejercicio, tipo "Prepará → Bajá → Frená → Subí") no están diseñadas ni provistas. Hay que definir de dónde salen esas ilustraciones antes de implementar el botón "Guía de ejecución".

## Files

En este bundle:
- `Beto Training - App completa.dc.html` — prototipo completo (referencia principal).
- `Panel Beto - Rutinas.dc.html` — prototipo del flujo del entrenador solo.
- `_ds/nocturne-2a70e832-3c29-4337-b5ca-c11ca4aad783/styles.css` — hoja del design system.
- `support.js` — runtime del prototipo, no portar.

En el codebase destino, los archivos a tocar:
- `lib/types.ts` — `Screen`, `AppState` y los tipos de programa.
- `lib/data.ts` — datos demo de clientes, programas, bloques y sobrecarga.
- `hooks/useBetoApp.ts` — estado y handlers nuevos.
- `components/BetoTrainingApp.tsx` — ruteo de las pantallas nuevas.
- `components/screens/Clientes.tsx`, `Ficha.tsx`, `Builder.tsx`, `Asignar.tsx`, `ExportPdf.tsx` (nuevos) y `EditorEjercicio.tsx` (overlay).
- `components/screens/Coach.tsx` y `Cuenta.tsx` — ajustes descritos arriba.
