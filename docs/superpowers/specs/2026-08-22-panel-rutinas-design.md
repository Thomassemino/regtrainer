# Panel del entrenador + Constructor de rutinas (Beto Training)

- **Fecha**: 2026-08-22
- **Estado**: Aprobado para implementación
- **Subsistema**: 3 de 3 (depende de Fundación; se implementa en paralelo con Booking + Pagos)
- **Autor del spec**: Claude (arquitectura/auditoría) — implementación a cargo de un agente de IA externo
- **Repo**: `beto` (Next.js 16.3.1 App Router, React 19.2.8, TypeScript)
- **Fuente de producto**: `design_handoff_rutinas_entrenador/README.md` (del zip "Funciones de entrenador") — ese documento ya define con alta fidelidad toda la UI, copy, datos demo e interacciones. Este spec no repite ese detalle visual, lo referencia y se enfoca en la arquitectura técnica que el handoff explícitamente deja "pendiente para producción".

## 1. Contexto

El handoff agrega al panel del entrenador un constructor de rutinas tipo "block builder": desde la ficha de un cliente, Beto arma un mesociclo de semanas configurables, cada bloque de ejercicio con su tabla de sobrecarga progresiva, lo asigna a uno o varios clientes, y lo exporta en PDF con su propia marca. El cliente ve el mismo programa en "Mi rutina".

El handoff es un prototipo HTML de referencia visual (`.dc.html`, no código de producción) con datos hardcodeados. Este spec define el modelo de datos real, la generación de PDF real, y dos piezas que el propio handoff marca como **"pendiente para producción"** y que el usuario pidió incluir ya en esta primera versión: **drag-and-drop de bloques** (reordenar y mover entre días) y **duplicar día/programa como plantilla**.

Depende de la Fundación: usa `User`/`Cliente` ya existentes, misma infraestructura Docker/Postgres/Prisma/Auth, mismas reglas de defensa en profundidad (`proxy.ts` + verificación server-side por rol en cada Route Handler bajo `/api/coach/*`).

## 2. Decisiones confirmadas con el usuario

| Decisión | Valor | Motivo |
|---|---|---|
| Drag-and-drop de bloques (reordenar dentro de un día, mover entre días) | **Incluido en esta v1** | El handoff lo marca como pendiente; el usuario pidió meterlo ya |
| Duplicar día / programa completo como plantilla | **Incluido en esta v1** | Ídem — el propio copy del handoff en la ficha del cliente ("Duplicalo para arrancar el siguiente bloque sin reescribir nada") lo asume como flujo real |
| Todo lo demás (tipos de bloque, focos, temas de PDF, textos, layout) | Tal cual el handoff | Ya es alta fidelidad, decidido con el usuario en una iteración de diseño previa a este proyecto |

## 3. Fuera de alcance

- Todo lo de Fundación y de Booking+Pagos (specs propios).
- **Guía de ejecución ilustrada** por ejercicio: el propio handoff la marca como "Faltante — no está diseñada ni provista". El botón "Guía de ejecución" del editor de bloque se implementa pero deshabilitado, con tooltip "Próximamente" — no se inventa contenido ni se deja un botón muerto sin explicación.
- Toggle "Semanas / Días" de la barra del constructor: el handoff dice explícitamente que la vista "Días" no está diseñada. Se implementa únicamente la vista por semanas.
- Generación de contenido de rutinas por IA (sugerencias automáticas de ejercicios/progresión): no mencionado en ningún momento por el usuario ni el handoff, no se agrega.

## 4. Modelo de datos (extiende Fundación)

```prisma
enum EstadoPrograma {
  BORRADOR
  ASIGNADO
  COMPLETADO
  ARCHIVADO
}

enum TipoBloque {
  TRADICIONAL
  SECUENCIA
  SUPERSERIE
  EMOM
  POR_TIEMPO
}

enum Foco {
  TECNICA
  RITMO
  MAXIMO_ESFUERZO
}

model Programa {
  id           String               @id @default(cuid())
  nombre       String
  semanas      Int                  // 2-8, ver §5 validación
  objetivo     String
  frecuencia   String               // "5 días semanales" — texto libre, coherente con el handoff
  estado       EstadoPrograma       @default(BORRADOR)
  creadoPorId  String               // User (ADMIN) que lo creó
  creadoPor    User                 @relation(fields: [creadoPorId], references: [id])
  dias         DiaPrograma[]
  asignaciones AsignacionPrograma[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt
}

model DiaPrograma {
  id            String     @id @default(cuid())
  programaId    String
  programa      Programa   @relation(fields: [programaId], references: [id], onDelete: Cascade)
  diaSemana     Int        // 0=domingo ... 6=sábado
  descanso      Boolean    @default(false)
  calentamiento String?
  bloques       Bloque[]

  @@unique([programaId, diaSemana])
}

model Bloque {
  id          String            @id @default(cuid())
  diaId       String
  dia         DiaPrograma       @relation(fields: [diaId], references: [id], onDelete: Cascade)
  orden       Int               // posición dentro del día — la clave que hace posible el drag-and-drop (§6)
  tipo        TipoBloque
  foco        Foco
  titulo      String
  detalle     String
  meta        String?           // "4 ejercicios", texto libre igual que el handoff
  sobrecarga  FilaSobrecarga[]
  completados BloqueCompletado[]

  @@index([diaId, orden])
}

model FilaSobrecarga {
  id        String @id @default(cuid())
  bloqueId  String
  bloque    Bloque @relation(fields: [bloqueId], references: [id], onDelete: Cascade)
  semana    Int
  series    Int
  reps      Int
  pct       Int
  descanso  String // "02:00", texto libre igual que el handoff (no todos los bloques miden descanso en segundos numéricos limpios)

  @@unique([bloqueId, semana])
}

model AsignacionPrograma {
  id                   String    @id @default(cuid())
  programaId           String
  programa             Programa  @relation(fields: [programaId], references: [id], onDelete: Cascade)
  clienteId            String
  cliente              Cliente   @relation(fields: [clienteId], references: [id])
  asignadoEn           DateTime  @default(now())
  mensajePersonalizado String?
  temaPdf              String    @default("clean") // "clean" | "night" | "pink", último tema exportado para este cliente+programa

  @@unique([programaId, clienteId])
}

model BloqueCompletado {
  id           String             @id @default(cuid())
  asignacionId String
  asignacion   AsignacionPrograma @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  bloqueId     String
  bloque       Bloque             @relation(fields: [bloqueId], references: [id], onDelete: Cascade)
  semana       Int
  completadoEn DateTime           @default(now())

  @@unique([asignacionId, bloqueId, semana])
}
```

Cambios sobre `Cliente`/`User` de Fundación: agregan relaciones inversas `asignaciones AsignacionPrograma[]` en `Cliente`, `programasCreados Programa[]` en `User`. No cambia ningún campo existente.

**Por qué una tabla de unión (`AsignacionPrograma`) y no `asignadoA: string[]` como sugiere el borrador del handoff**: el handoff es un prototipo, no un diseño de base de datos — un array de ids no permite guardar `mensajePersonalizado` por cliente (el handoff sí lo pide: "Mensaje para tus clientes" en la pantalla de asignación masiva) ni el `temaPdf` elegido por cliente, ni indexar `BloqueCompletado` de forma limpia. La tabla de unión es el modelo normal para "N a M con datos propios de la relación".

**Por qué `BloqueCompletado` en vez de guardar cumplimiento en el `Bloque` mismo**: un `Bloque` es una definición compartida por todos los clientes asignados a ese `Programa` — el cumplimiento es individual por cliente y por semana. Esto es lo que alimenta el gráfico "Cumplimiento de las últimas 4 semanas" de la ficha del cliente (§ handoff, pantalla `ficha`): `% = BloqueCompletado de esa semana / total de Bloque de esa semana para ese Programa`.

## 5. Validaciones de negocio

- `Programa.semanas`: entre 2 y 8 (tal como el selector de semanas del handoff, tope 8).
- Un `Programa` en estado `BORRADOR` puede editarse libremente. Uno en `ASIGNADO` también puede seguir editándose (el handoff no distingue "programa cerrado" de "programa en edición" — el estado `ASIGNADO` es informativo para la lista de clientes, no un lock).
- Agregar una semana (`+` en el selector) crea, para cada `Bloque` existente del `Programa`, una nueva `FilaSobrecarga` con `semana = semanas + 1`, siguiendo la progresión de intensidades sugerida en el handoff (70, 75, 80, 65, 72, 78, 82, 68 — ciclo de 4) y reps (6, 5, 4, 5 — ciclo de 4) como valores iniciales editables, luego incrementa `Programa.semanas`.

## 6. Drag-and-drop de bloques

Usar `@dnd-kit/core` + `@dnd-kit/sortable` (no `react-beautiful-dnd` — sin mantenimiento activo y con problemas de compatibilidad documentados con el modo concurrente de React 18+; `@dnd-kit` es la opción vigente y mantenida para este caso).

- **Reordenar dentro de un día**: arrastrar una tarjeta de bloque cambia su `orden` relativo a los demás bloques del mismo `DiaPrograma`. `PATCH /api/coach/dias/:diaId/reordenar` recibe el array completo de `bloqueId` en el nuevo orden y actualiza `orden` de todos en una transacción (más simple y sin condiciones de carrera que recalcular deltas).
- **Mover entre días**: arrastrar un bloque a otro día del mismo `Programa` actualiza `Bloque.diaId` (y su `orden` al final o donde se soltó) — mismo endpoint, generalizado a recibir `diaOrigenId`/`diaDestinoId` opcional.
- El servidor vuelve a validar que el `diaId` destino pertenezca al mismo `Programa` que el bloque de origen — un `PATCH` con ids de otro programa nunca debe poder mezclar contenido entre mesociclos distintos.
- Accesibilidad: `@dnd-kit` soporta activación por teclado nativamente (`KeyboardSensor`) — no lo desactivar, es la única forma de reordenar sin mouse.

## 7. Duplicar día y duplicar programa

- **Duplicar día** (dentro del builder, acción sobre una columna de día): `POST /api/coach/dias/:diaId/duplicar` con `{ destinoDiaId }`. Borra los `Bloque` existentes del día destino (con confirmación explícita en la UI — "esto reemplaza lo que tenga cargado") y clona cada `Bloque` del día origen junto con todas sus `FilaSobrecarga`, preservando `orden`.
- **Duplicar programa completo** (desde la ficha del cliente, el copy exacto del handoff: "Duplicalo para arrancar el siguiente bloque sin reescribir nada"): `POST /api/coach/programas/:id/duplicar`. Crea un `Programa` nuevo en estado `BORRADOR` (nombre sugerido: `"<nombre original> (copia)"`, editable), clonando `DiaPrograma` → `Bloque` → `FilaSobrecarga` completos, sin `AsignacionPrograma` (el nuevo programa arranca sin asignar, tal como cualquier programa nuevo).

## 8. Exportación a PDF

**Mecanismo**: Playwright headless (`chromium.launch()`, ya se instala como dependencia de testing en Fundación — se reutiliza la misma dependencia en vez de sumar Puppeteer, evita dos librerías de control de navegador en el mismo proyecto). El endpoint `GET /api/coach/programas/:id/pdf?tema=clean|night|pink`:

1. Renderiza server-side una ruta interna no navegable directamente por el usuario (`/coach/programas/:id/pdf-preview?tema=...`, protegida igual que el resto de `/coach`) que reproduce en HTML/CSS exactamente la maqueta de portada descrita en el handoff (§ handoff "Temas") — cabecera de marca, kicker, título, chips de semana con fechas reales calculadas desde la fecha de asignación, introducción, tabla de sobrecarga.
2. Playwright navega a esa ruta con la sesión de admin ya autenticada (contexto de browser con la cookie de sesión inyectada, no un login interactivo) y llama `page.pdf({ format: "a4" })`.
3. Devuelve el PDF como `application/pdf` — no se persiste en disco ni en la base, se regenera on-demand en cada descarga (evita gestionar storage de archivos para algo barato de recomputar).

**Reuso**: Booking+Pagos (spec 2, §7.4) reutiliza este mismo mecanismo Playwright→PDF para el comprobante simple de pago, en vez de introducir una segunda dependencia — un `lib/pdf/render.ts` compartido entre ambos specs, con una función `renderPdf(url: string): Promise<Buffer>` genérica.

**Fechas de semana**: el handoff muestra "SEM 1 24 Ago–30 Ago" — se calculan desde `AsignacionPrograma.asignadoEn` (o la fecha de generación del PDF si el programa aún no está asignado a ningún cliente — en ese caso, desde "hoy").

## 9. Migración del código existente

| Archivo actual | Cambio |
|---|---|
| `components/screens/Coach.tsx` | Se agrega el botón primario "Constructor de rutinas" en la cabecera (ícono `ph-squares-four`) → navega a `clientes`. El KPI "Bonos por vencer" se reemplaza por "Rutinas sin actualizar" (ver spec de Booking+Pagos §10 — el KPI de bonos desaparece de raíz porque el concepto de bono ya no existe). Las tarjetas de "Clientes que necesitan atención" navegan a la ficha del cliente. |
| `components/screens/Cuenta.tsx` | La pestaña "Mi rutina" reemplaza la lista plana mockeada (`RUTINA`/`ejercicios` de `lib/data.ts`/`useBetoApp.ts`) por la vista por bloques real, leyendo la `AsignacionPrograma` activa del cliente logueado. |
| `hooks/useBetoApp.ts` | Se elimina `rutinaDia`/`hechos`/`ejercicios`/`diasRutina` (mock plano) y las funciones de navegación (`goCoach` ya migrado en Fundación) se extienden con los nuevos screens: `clientes`, `ficha`, `builder`, `asignar`, `pdf`. Estado nuevo: `fichaId`, `programaIdActivo`, `semanaSel`, `editorOpen`, `editorBloqueId`, `diaClienteSel`, `asignadosSel: Record<string, boolean>`, `temaPdfSel` — igual que sugiere el handoff §"State Management", pero como datos derivados de queries reales en vez de mock. |
| `lib/data.ts` | `RUTINA` (mock plano) se elimina — reemplazado por queries a `Programa`/`DiaPrograma`/`Bloque`. |
| Nuevos archivos de pantalla | `components/screens/Clientes.tsx`, `Ficha.tsx`, `Builder.tsx`, `Asignar.tsx`, `ExportPdf.tsx`, `EditorEjercicio.tsx` (overlay) — construidos siguiendo el detalle visual exacto del handoff (layout, tokens, textos, datos demo de referencia), con los datos conectados a las queries reales en vez de hardcodeados. |

## 10. Seguridad

- Todo bajo `/api/coach/*` protegido por `proxy.ts` (Fundación) + verificación server-side de `role === "ADMIN"` en cada Route Handler.
- El cliente solo puede leer su propia `AsignacionPrograma` (vía `GET /api/cuenta/mi-rutina`, que deriva el `clienteId` de la sesión, nunca de un parámetro de la URL) — nunca puede pedir el programa de otro cliente por id.
- `POST /api/coach/dias/:diaId/reordenar` y `.../duplicar` validan que ambos días/bloques pertenezcan al mismo `Programa` antes de mutar nada (§6, §7) — previene mezclar contenido entre mesociclos de clientes distintos vía manipulación de la request.

## 11. Testing

- Unit: cálculo de progresión de intensidad/reps al agregar semana (§5); cálculo de fechas de semana para el PDF (§8).
- Integración: reordenar bloques dentro de un día persiste el nuevo orden; mover un bloque a otro día actualiza `diaId` y `orden`; duplicar día reemplaza el contenido del destino preservando sobrecarga; duplicar programa clona todo sin arrastrar asignaciones; asignación masiva crea una `AsignacionPrograma` por cliente seleccionado; un cliente no puede leer la asignación de otro (403); reordenar con un `diaId` de otro programa es rechazado.
- E2E: flujo completo `clientes → ficha → builder (crear 2 bloques, reordenarlos, agregar semana) → asignar a 2 clientes → pdf (descargar tema Night)`, y desde el lado cliente: login → "Mi rutina" muestra el programa recién asignado.

## 12. Riesgos y decisiones abiertas para quien implemente

1. **Playwright para PDF en el mismo proceso que sirve requests de usuarios**: lanzar un browser headless por request es costoso. Para esta escala (un entrenador, exportaciones esporádicas) es aceptable, pero conviene reusar una sola instancia de `chromium` lanzada una vez (no por request) y abrir una `page` nueva por PDF — documentarlo así en la implementación, no relanzar el browser en cada descarga.
2. **`@dnd-kit` y Next.js 16 / React 19**: verificar la versión compatible al momento de instalar (`@dnd-kit/core` ha tenido releases dirigidas a React 19 — confirmar contra su changelog, no asumir que cualquier versión funciona con los nuevos tipos de React 19).
