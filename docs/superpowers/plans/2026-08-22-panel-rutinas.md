# Panel del entrenador + Constructor de rutinas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al panel del entrenador de "Beto Training" un constructor de rutinas tipo "block builder": desde la ficha de un cliente, Beto arma un mesociclo de semanas configurables con bloques de ejercicio y su tabla de sobrecarga progresiva, reordena bloques por drag-and-drop, duplica días/programas como plantilla, asigna el programa a uno o varios clientes, y lo exporta en PDF con marca propia. El cliente ve el mismo programa en "Mi rutina".

**Architecture:** Extiende el mismo `prisma/schema.prisma` de Fundación (no lo recrea) con 6 modelos nuevos y 3 enums. Los endpoints viven bajo `app/api/coach/*` (protegidos por `proxy.ts` + verificación server-side de `role === "ADMIN"` en cada Route Handler, mismo patrón de defensa en profundidad de Fundación) y `app/api/cuenta/*` para el lado cliente (deriva `clienteId` de la sesión, nunca de la URL). Las pantallas nuevas (`clientes`, `ficha`, `builder`, `asignar`, `pdf`) son valores nuevos del union `Screen` manejados por `useBetoApp`/`BetoTrainingApp.tsx`, exactamente como ya funcionan `coach`/`cuenta` — no son rutas de archivo nuevas, salvo la única excepción explícita del spec: `/coach/programas/[id]/pdf-preview`, una página real (protegida por el mismo `proxy.ts`) que Playwright navega para generar el PDF. El drag-and-drop usa `@dnd-kit`. El PDF se genera con Playwright headless reutilizando una única instancia de `chromium`.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Prisma 7 (con `@prisma/adapter-pg`), PostgreSQL, `@dnd-kit/core` + `@dnd-kit/sortable`, Playwright (`playwright` como dependencia de runtime, ya presente `@playwright/test` para e2e), Vitest (unit/integración), zod.

**Spec:** [docs/superpowers/specs/2026-08-22-panel-rutinas-design.md](../specs/2026-08-22-panel-rutinas-design.md) — todas las decisiones de modelo de datos, drag-and-drop, duplicar día/programa, exportación a PDF y migración de pantallas ya están ahí; este plan las ejecuta en tareas verificables. Leer también el README del handoff de diseño (`design_handoff_rutinas_entrenador/README.md`) para el detalle visual exacto de cada pantalla — es la fuente de verdad de layout, textos y datos demo.

## Global Constraints

- No reinterpretar el modelo de datos del spec §4: son exactamente 6 modelos (`Programa`, `DiaPrograma`, `Bloque`, `FilaSobrecarga`, `AsignacionPrograma`, `BloqueCompletado`) y 3 enums (`EstadoPrograma`, `TipoBloque`, `Foco`). No agregar campos fuera de ese modelo (ver Task 13 para el caso concreto de "Trabajo en carrera" del widget de volumen, que el modelo no soporta).
- `AsignacionPrograma` es la única fuente de verdad de "qué cliente tiene qué programa" — nunca se agrega un campo `clienteId` directo a `Programa`. El botón "Armar rutina" de la ficha de un cliente (Task 12) llama a `POST /api/coach/programas` pasando ese `clienteId`, que crea el `Programa` y su `AsignacionPrograma` en la misma operación (Task 2) — así el programa aparece en la ficha desde `BORRADOR`, sin esperar a `/asignar`. `/asignar` (Task 15) sigue siendo el camino para sumar clientes adicionales al mismo programa después.
- Todo bajo `/api/coach/*` protegido por `proxy.ts` (ya existe de Fundación) + verificación server-side de `role === "ADMIN"` en cada Route Handler vía el helper `requireAdmin()` de Task 2 — nunca confiar solo en `proxy.ts`.
- Todo bajo `/api/cuenta/mi-rutina*` deriva `clienteId` de la sesión (`requireClienteActual()`, Task 2) — nunca de un parámetro de la URL ni del body.
- `PATCH /api/coach/dias/:diaId/reordenar` y los endpoints de duplicar validan siempre que los días/bloques involucrados pertenezcan al mismo `Programa` antes de mutar nada (spec §10).
- Reutilizar los tokens de `app/globals.css` (design system Nocturne) en toda pantalla nueva del panel/cliente — nunca hardcodear hex nuevos ahí. La única excepción explícita y deliberada es la maqueta del PDF (Task 9), que usa la paleta propia de cada tema (Clean/Night/Pink) porque el documento lleva la marca del entrenador, no la de la plataforma (handoff, sección "Design Tokens" y "pdf").
- Reutilizar el patrón de estilos existente (`style={{...}}` inline con variables CSS, como ya hacen `Reservar.tsx`/`Checkout.tsx`/`Coach.tsx`/`Cuenta.tsx`) — no introducir CSS-in-JS, Tailwind, ni un sistema de estilos nuevo.
- Las pantallas nuevas obtienen sus datos con `fetch` + `useState`/`useEffect` locales al componente (mismo patrón que ya usa `Cuenta.tsx` para `/api/cuenta/sesiones`), no centralizado en `useBetoApp` — el hook central solo guarda navegación y selección compartida entre pantallas (`fichaId`, `programaIdActivo`, `semanaSel`, `editorOpen`, `asignadosSel`, `temaPdfSel`), tal como ya lo anticipa el README del handoff en "State Management".
- El botón "Guía de ejecución" del editor de ejercicio se implementa siempre deshabilitado con `title="Próximamente"` — está fuera de alcance (spec §3) pero no se omite ni se deja roto.
- Vista "Días" del selector Semanas/Días: no se implementa (spec §3) — solo existe la vista por semanas.
- No hay generación de contenido de rutinas por IA en ningún punto de este plan (spec §3).

---

## Task 1: Prisma — modelos de rutinas (6 modelos + 3 enums)

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modelos Prisma `Programa`, `DiaPrograma`, `Bloque`, `FilaSobrecarga`, `AsignacionPrograma`, `BloqueCompletado`, enums `EstadoPrograma`, `TipoBloque`, `Foco` — toda tarea siguiente los usa vía `PrismaClient` (`lib/db.ts`, ya existe de Fundación).

- [ ] **Step 1: Agregar las relaciones inversas en `User` y `Cliente` (fragmento a modificar dentro de `prisma/schema.prisma`, sin tocar el resto de esos modelos)**

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  role          Role      @default(CLIENTE)
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  cliente          Cliente?
  sessions         Session[]
  emailTokens      EmailVerificationToken[]
  resetTokens      PasswordResetToken[]
  auditLogs        AuditLog[]
  programasCreados Programa[]
}

model Cliente {
  id         String   @id @default(cuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nombre     String
  iniciales  String
  objetivo   String
  plan       String   @default("Sin plan")
  frecuencia String?
  nivel      String?
  whatsapp   String?
  notaMedica String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  asignaciones AsignacionPrograma[]
}
```

- [ ] **Step 2: Agregar al final de `prisma/schema.prisma` los 3 enums y 6 modelos nuevos, tal cual el spec §4 (sin modificaciones)**

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
  semanas      Int
  objetivo     String
  frecuencia   String
  estado       EstadoPrograma       @default(BORRADOR)
  creadoPorId  String
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
  diaSemana     Int
  descanso      Boolean    @default(false)
  calentamiento String?
  bloques       Bloque[]

  @@unique([programaId, diaSemana])
}

model Bloque {
  id          String             @id @default(cuid())
  diaId       String
  dia         DiaPrograma        @relation(fields: [diaId], references: [id], onDelete: Cascade)
  orden       Int
  tipo        TipoBloque
  foco        Foco
  titulo      String
  detalle     String
  meta        String?
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
  descanso  String

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
  temaPdf              String    @default("clean")
  completados          BloqueCompletado[]

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

Nota: se agregó `completados BloqueCompletado[]` en `AsignacionPrograma` como relación inversa necesaria para que el cliente Prisma generado tenga ambos lados de la relación con `Bloque` navegables — el spec §4 no lo lista explícitamente porque enumera campos, no relaciones inversas obligatorias por Prisma; es un requisito mecánico del ORM, no una decisión de modelado nueva.

- [ ] **Step 2: Generar la migración**

```bash
npx prisma migrate dev --name rutinas
```

Expected: crea `prisma/migrations/<timestamp>_rutinas/migration.sql` con los `CREATE TABLE` de los 6 modelos, los `CREATE TYPE` de los 3 enums, el índice `Bloque_diaId_orden_idx`, y los 4 `CREATE UNIQUE INDEX` (`DiaPrograma_programaId_diaSemana_key`, `FilaSobrecarga_bloqueId_semana_key`, `AsignacionPrograma_programaId_clienteId_key`, `BloqueCompletado_asignacionId_bloqueId_semana_key`).

- [ ] **Step 3: Verificar el cliente generado**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schema prisma de programas, dias, bloques y asignaciones"
```

---

## Task 2: Guards de rol + progresión de sobrecarga + creación de programa/agregar semana

**Files:**
- Create: `lib/coach/guards.ts`
- Create: `lib/rutinas/progresion.ts`
- Create: `lib/rutinas/sobrecarga.ts`
- Create: `app/api/coach/programas/route.ts`
- Create: `app/api/coach/dias/[diaId]/route.ts`
- Create: `app/api/coach/programas/[id]/semanas/route.ts`
- Test: `tests/unit/progresion.test.ts`
- Test: `tests/integration/programas.test.ts`

**Interfaces:**
- Consumes: `auth()` de Fundación (`lib/auth.ts`), `prisma` (`lib/db.ts`).
- Produces: `requireAdmin()`, `requireClienteActual()` — usados por todo endpoint de este plan bajo `/api/coach/*` y `/api/cuenta/mi-rutina*`. `pctParaSemana(semana)`, `repsParaSemana(semana)`, `construirFilaSobrecarga(semana, base)`, `construirTablaSobrecarga(totalSemanas, base)` — usados por Task 3 (crear bloque) y por este mismo task (agregar semana). `POST /api/coach/programas`, `PATCH /api/coach/dias/:diaId`, `POST /api/coach/programas/:id/semanas`.

**Nota de criterio (para auditar):** el spec §5 define la progresión de `pct`/`reps` al agregar una semana, pero no dice qué pasa con `series`/`descanso` en esa fila nueva. Este plan los mantiene constantes, heredados de la semana 1 del mismo bloque (criterio propio, no explícito en el spec) — siguen siendo editables después vía `PATCH /api/coach/bloques/:bloqueId` (Task 3).

**Ajuste post-revisión (corrige la discrepancia #2 del self-review):** `POST /api/coach/programas` acepta un `clienteId` opcional. Cuando Beto arma una rutina desde el botón "Armar rutina" de la ficha de un cliente (handoff, pantalla `ficha`), el `Programa` se crea con su `AsignacionPrograma` en la misma operación — así el programa aparece en la ficha de ese cliente desde el instante en que existe, aunque siga en `BORRADOR`, tal como asume el prototipo del handoff ("Bloque 2 · Fuerza & Motor · En edición" ya listado). La pantalla `asignar` (Task 15) sigue existiendo tal cual para agregar *más* clientes al mismo programa después — este ajuste solo resuelve el caso del primer cliente, el dueño original para el que se arma la rutina.

- [ ] **Step 1: Escribir los guards de rol**

```typescript
// lib/coach/guards.ts
import { auth } from "../auth";
import { prisma } from "../db";
import type { Session } from "next-auth";
import type { Cliente } from "@prisma/client";

type GuardOk<T> = T & { error?: undefined };
type GuardErr = { error: Response };

export async function requireAdmin(): Promise<GuardOk<{ session: Session }> | GuardErr> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: Response.json({ error: "No autorizado" }, { status: session?.user ? 403 : 401 }) };
  }
  return { session };
}

export async function requireClienteActual(): Promise<GuardOk<{ session: Session; cliente: Cliente }> | GuardErr> {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENTE") {
    return { error: Response.json({ error: "No autorizado" }, { status: session?.user ? 403 : 401 }) };
  }
  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return { error: Response.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { session, cliente };
}
```

- [ ] **Step 2: Escribir el test unitario de progresión (falla primero)**

```typescript
// tests/unit/progresion.test.ts
import { describe, expect, it } from "vitest";
import { pctParaSemana, repsParaSemana } from "../../lib/rutinas/progresion";

describe("pctParaSemana", () => {
  it("sigue la serie de intensidades del handoff para las 8 semanas posibles", () => {
    const esperado = [70, 75, 80, 65, 72, 78, 82, 68];
    esperado.forEach((pct, i) => expect(pctParaSemana(i + 1)).toBe(pct));
  });
});

describe("repsParaSemana", () => {
  it("cicla 6, 5, 4, 5 cada 4 semanas", () => {
    const esperado = [6, 5, 4, 5, 6, 5, 4, 5];
    esperado.forEach((reps, i) => expect(repsParaSemana(i + 1)).toBe(reps));
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/progresion.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 4: Implementar la progresión**

```typescript
// lib/rutinas/progresion.ts
export const INTENSIDAD_CICLO = [70, 75, 80, 65, 72, 78, 82, 68] as const;
export const REPS_CICLO = [6, 5, 4, 5] as const;

export function pctParaSemana(semana: number): number {
  return INTENSIDAD_CICLO[(semana - 1) % INTENSIDAD_CICLO.length];
}

export function repsParaSemana(semana: number): number {
  return REPS_CICLO[(semana - 1) % REPS_CICLO.length];
}
```

- [ ] **Step 5: Implementar el constructor de filas de sobrecarga (usado al crear un bloque y al agregar semana)**

```typescript
// lib/rutinas/sobrecarga.ts
import { pctParaSemana, repsParaSemana } from "./progresion";

export interface BaseSobrecarga {
  series: number;
  descanso: string;
}

export interface FilaSobrecargaInput {
  semana: number;
  series: number;
  reps: number;
  pct: number;
  descanso: string;
}

export function construirFilaSobrecarga(semana: number, base: BaseSobrecarga): FilaSobrecargaInput {
  return {
    semana,
    series: base.series,
    reps: repsParaSemana(semana),
    pct: pctParaSemana(semana),
    descanso: base.descanso,
  };
}

export function construirTablaSobrecarga(totalSemanas: number, base: BaseSobrecarga): FilaSobrecargaInput[] {
  return Array.from({ length: totalSemanas }, (_, i) => construirFilaSobrecarga(i + 1, base));
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/progresion.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Escribir el test de integración de creación de programa y agregar semana**

```typescript
// tests/integration/programas.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

async function crearAdmin() {
  const user = await prisma.user.create({
    data: { email: "coach-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  return { user };
}

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("crear programa y agregar semana", () => {
  it("crea 7 DiaPrograma (diaSemana 0..6) al crear un programa", async () => {
    const { user } = await crearAdmin();
    const programa = await prisma.programa.create({
      data: {
        nombre: "Fuerza & Motor",
        objetivo: "Fuerza",
        frecuencia: "5 días semanales",
        semanas: 4,
        creadoPorId: user.id,
        dias: { create: Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, descanso: false })) },
      },
      include: { dias: true },
    });
    expect(programa.dias).toHaveLength(7);
    expect(programa.dias.map((d) => d.diaSemana).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("agregar una semana crea una FilaSobrecarga por bloque con la progresión y no supera 8", async () => {
    const { user } = await crearAdmin();
    const programa = await prisma.programa.create({
      data: { nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: user.id, dias: { create: { diaSemana: 1, descanso: false } } },
      include: { dias: true },
    });
    const dia = programa.dias[0];
    const bloque = await prisma.bloque.create({
      data: {
        diaId: dia.id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3",
        sobrecarga: { create: { semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" } },
      },
    });

    const { construirFilaSobrecarga } = await import("../../lib/rutinas/sobrecarga");
    const nuevaFila = construirFilaSobrecarga(2, { series: 4, descanso: "02:00" });
    await prisma.filaSobrecarga.create({ data: { bloqueId: bloque.id, ...nuevaFila } });
    await prisma.programa.update({ where: { id: programa.id }, data: { semanas: 2 } });

    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id }, orderBy: { semana: "asc" } });
    expect(filas).toHaveLength(2);
    expect(filas[1]).toMatchObject({ semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" });
  });
});
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/programas.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Implementar `POST /api/coach/programas`**

```typescript
// app/api/coach/programas/route.ts
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";

const CrearProgramaSchema = z.object({
  nombre: z.string().min(2),
  objetivo: z.string().min(2),
  frecuencia: z.string().min(2),
  semanas: z.number().int().min(2).max(8).default(4),
  clienteId: z.string().min(1).optional(), // ver "Ajuste post-revisión" arriba: dueño original de la rutina
});

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const parsed = CrearProgramaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { nombre, objetivo, frecuencia, semanas, clienteId } = parsed.data;

  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
  }

  const programa = await prisma.programa.create({
    data: {
      nombre,
      objetivo,
      frecuencia,
      semanas,
      creadoPorId: check.session.user.id,
      dias: {
        create: Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, descanso: false })),
      },
      ...(clienteId
        ? { asignaciones: { create: { clienteId, mensajePersonalizado: null } } }
        : {}),
    },
    include: { dias: { orderBy: { diaSemana: "asc" } }, asignaciones: true },
  });

  return Response.json({ programa }, { status: 201 });
}
```

- [ ] **Step 9b: Test de integración del alta con `clienteId`**

```typescript
// tests/integration/programas.test.ts (agregar este describe al mismo archivo del Step 7)
describe("crear programa con clienteId — dueño original desde la ficha", () => {
  it("crea la AsignacionPrograma junto con el programa cuando se pasa clienteId", async () => {
    const { user } = await crearAdmin();
    const clienteUser = await prisma.user.create({
      data: { email: "duena-programa@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: clienteUser.id, nombre: "Dueña Programa", iniciales: "DP", objetivo: "" },
    });

    const { POST } = await import("../../app/api/coach/programas/route");
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id, role: "ADMIN" } } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/programas", {
        method: "POST",
        body: JSON.stringify({ nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días semanales", clienteId: cliente.id }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.programa.asignaciones).toHaveLength(1);
    expect(body.programa.asignaciones[0].clienteId).toBe(cliente.id);
  });
});
```

Nota: este test requiere `vi.mock("../../lib/auth", () => ({ auth: vi.fn() }))` al inicio del archivo (agregar el import de `vi` de `vitest` y el mock, siguiendo el mismo patrón que ya usan los tests de Route Handlers de Booking+Pagos) — el resto de tests de este archivo (Step 7) no necesitan sesión porque llaman a Prisma directo, no al Route Handler.

- [ ] **Step 10: Implementar `PATCH /api/coach/dias/:diaId` (calentamiento y toggle de descanso — "Convertir a entrenamiento")**

```typescript
// app/api/coach/dias/[diaId]/route.ts
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

const ActualizarDiaSchema = z.object({
  descanso: z.boolean().optional(),
  calentamiento: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const parsed = ActualizarDiaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const dia = await prisma.diaPrograma.update({ where: { id: diaId }, data: parsed.data }).catch(() => null);
  if (!dia) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }
  return Response.json({ dia });
}
```

- [ ] **Step 11: Implementar `POST /api/coach/programas/:id/semanas` ("+" del selector de semanas, tope 8)**

```typescript
// app/api/coach/programas/[id]/semanas/route.ts
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { construirFilaSobrecarga } from "../../../../../../lib/rutinas/sobrecarga";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({
    where: { id },
    include: { dias: { include: { bloques: { include: { sobrecarga: { orderBy: { semana: "asc" } } } } } } },
  });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }
  if (programa.semanas >= 8) {
    return Response.json({ error: "El mesociclo ya tiene el máximo de 8 semanas" }, { status: 400 });
  }

  const nuevaSemana = programa.semanas + 1;
  const bloques = programa.dias.flatMap((d) => d.bloques);

  await prisma.$transaction([
    ...bloques.map((bloque) => {
      const base = bloque.sobrecarga.find((f) => f.semana === 1) ?? bloque.sobrecarga[0];
      const fila = construirFilaSobrecarga(nuevaSemana, {
        series: base?.series ?? 4,
        descanso: base?.descanso ?? "02:00",
      });
      return prisma.filaSobrecarga.create({ data: { bloqueId: bloque.id, ...fila } });
    }),
    prisma.programa.update({ where: { id }, data: { semanas: nuevaSemana } }),
  ]);

  const actualizado = await prisma.programa.findUniqueOrThrow({ where: { id } });
  return Response.json({ programa: actualizado });
}
```

- [ ] **Step 12: Verificación manual con el servidor de desarrollo levantado**

```bash
npm run dev
```

Con una sesión de `ADMIN` autenticada (cookie del navegador), `POST /api/coach/programas` con `{ "nombre": "Test", "objetivo": "Fuerza", "frecuencia": "5 días semanales" }` debe devolver `201` con 7 `dias`. Repetir `POST /api/coach/programas/<id>/semanas` cuatro veces y confirmar que la quinta vez (`semanas` ya en 8) devuelve `400`.

- [ ] **Step 13: Commit**

```bash
git add lib/coach/guards.ts lib/rutinas/progresion.ts lib/rutinas/sobrecarga.ts app/api/coach/programas app/api/coach/dias tests/unit/progresion.test.ts tests/integration/programas.test.ts
git commit -m "feat: crear programa, actualizar dia y agregar semana con progresion de sobrecarga"
```

---

## Task 3: CRUD de Bloque + FilaSobrecarga

**Files:**
- Create: `app/api/coach/dias/[diaId]/bloques/route.ts`
- Create: `app/api/coach/bloques/[bloqueId]/route.ts`
- Test: `tests/integration/bloques.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `construirTablaSobrecarga` (Task 2), `prisma`.
- Produces: `POST /api/coach/dias/:diaId/bloques`, `PATCH /api/coach/bloques/:bloqueId`, `DELETE /api/coach/bloques/:bloqueId` — consumidos por `Builder.tsx`/`EditorEjercicio.tsx` (Tasks 13-14).

- [ ] **Step 1: Escribir el test de integración (falla primero)**

```typescript
// tests/integration/bloques.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let diaId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "bloques-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  const programa = await prisma.programa.create({
    data: { nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 4, creadoPorId: user.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  diaId = programa.dias[0].id;
});

describe("crear bloque", () => {
  it("crea el bloque con una FilaSobrecarga por cada semana del programa", async () => {
    const bloque = await prisma.bloque.create({
      data: {
        diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla trasera con barra", detalle: "5 × 3 · @ 80% 1RM",
        sobrecarga: {
          create: Array.from({ length: 4 }, (_, i) => ({ semana: i + 1, series: 4, reps: 6, pct: 70, descanso: "02:00" })),
        },
      },
      include: { sobrecarga: true },
    });
    expect(bloque.sobrecarga).toHaveLength(4);
  });
});

describe("editar bloque", () => {
  it("actualiza una fila puntual de sobrecarga sin tocar las demás", async () => {
    const bloque = await prisma.bloque.create({
      data: {
        diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Press banca", detalle: "5x4",
        sobrecarga: { create: [{ semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" }, { semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" }] },
      },
    });
    await prisma.filaSobrecarga.update({ where: { bloqueId_semana: { bloqueId: bloque.id, semana: 2 } }, data: { pct: 78 } });
    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id }, orderBy: { semana: "asc" } });
    expect(filas[0].pct).toBe(70);
    expect(filas[1].pct).toBe(78);
  });
});

describe("borrar bloque", () => {
  it("borra el bloque y en cascada su sobrecarga", async () => {
    const bloque = await prisma.bloque.create({
      data: { diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x", sobrecarga: { create: { semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" } } },
    });
    await prisma.bloque.delete({ where: { id: bloque.id } });
    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id } });
    expect(filas).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla o pasa a medias**

Run: `npx vitest run --project integration tests/integration/bloques.test.ts`
Expected: estos tres tests ejercitan Prisma directo (no los endpoints todavía) y ya deberían pasar con el schema de Task 1 — sirven de base de datos para los endpoints. Si fallan, el problema está en el schema, no en código nuevo de esta task.

- [ ] **Step 3: Implementar `POST /api/coach/dias/:diaId/bloques`**

```typescript
// app/api/coach/dias/[diaId]/bloques/route.ts
import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { construirTablaSobrecarga } from "../../../../../../lib/rutinas/sobrecarga";

const CrearBloqueSchema = z.object({
  tipo: z.enum(["TRADICIONAL", "SECUENCIA", "SUPERSERIE", "EMOM", "POR_TIEMPO"]),
  foco: z.enum(["TECNICA", "RITMO", "MAXIMO_ESFUERZO"]),
  titulo: z.string().min(2),
  detalle: z.string().min(2),
  meta: z.string().optional(),
  seriesBase: z.number().int().min(1),
  descansoBase: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const dia = await prisma.diaPrograma.findUnique({
    where: { id: diaId },
    include: { programa: true, _count: { select: { bloques: true } } },
  });
  if (!dia) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }

  const parsed = CrearBloqueSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { seriesBase, descansoBase, ...datos } = parsed.data;

  const bloque = await prisma.bloque.create({
    data: {
      ...datos,
      diaId,
      orden: dia._count.bloques,
      sobrecarga: {
        create: construirTablaSobrecarga(dia.programa.semanas, { series: seriesBase, descanso: descansoBase }),
      },
    },
    include: { sobrecarga: { orderBy: { semana: "asc" } } },
  });

  return Response.json({ bloque }, { status: 201 });
}
```

- [ ] **Step 4: Implementar `PATCH` y `DELETE /api/coach/bloques/:bloqueId`**

```typescript
// app/api/coach/bloques/[bloqueId]/route.ts
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

const FilaSchema = z.object({
  semana: z.number().int().min(1),
  series: z.number().int().min(1),
  reps: z.number().int().min(1),
  pct: z.number().int().min(1).max(100),
  descanso: z.string().min(1),
});

const ActualizarBloqueSchema = z.object({
  tipo: z.enum(["TRADICIONAL", "SECUENCIA", "SUPERSERIE", "EMOM", "POR_TIEMPO"]).optional(),
  foco: z.enum(["TECNICA", "RITMO", "MAXIMO_ESFUERZO"]).optional(),
  titulo: z.string().min(2).optional(),
  detalle: z.string().min(2).optional(),
  meta: z.string().nullable().optional(),
  sobrecarga: z.array(FilaSchema).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ bloqueId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { bloqueId } = await params;

  const parsed = ActualizarBloqueSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { sobrecarga, ...datos } = parsed.data;

  const existe = await prisma.bloque.findUnique({ where: { id: bloqueId } });
  if (!existe) {
    return Response.json({ error: "Bloque no encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(datos).length > 0) {
      await tx.bloque.update({ where: { id: bloqueId }, data: datos });
    }
    if (sobrecarga) {
      for (const fila of sobrecarga) {
        await tx.filaSobrecarga.upsert({
          where: { bloqueId_semana: { bloqueId, semana: fila.semana } },
          update: { series: fila.series, reps: fila.reps, pct: fila.pct, descanso: fila.descanso },
          create: { bloqueId, ...fila },
        });
      }
    }
  });

  const bloque = await prisma.bloque.findUniqueOrThrow({
    where: { id: bloqueId },
    include: { sobrecarga: { orderBy: { semana: "asc" } } },
  });
  return Response.json({ bloque });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ bloqueId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { bloqueId } = await params;

  await prisma.bloque.delete({ where: { id: bloqueId } }).catch(() => null);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr toda la suite de esta task**

Run: `npx vitest run --project integration tests/integration/bloques.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/coach/dias/[diaId]/bloques app/api/coach/bloques tests/integration/bloques.test.ts
git commit -m "feat: crud de bloques y su tabla de sobrecarga"
```

---

## Task 4: Lecturas — detalle del programa, lista de clientes, ficha y cálculo de cumplimiento

**Files:**
- Create: `lib/rutinas/cumplimiento.ts`
- Create: `app/api/coach/programas/[id]/route.ts`
- Create: `app/api/coach/clientes/route.ts`
- Create: `app/api/coach/clientes/[clienteId]/route.ts`
- Test: `tests/unit/cumplimiento.test.ts`
- Test: `tests/integration/ficha.test.ts`

**Interfaces:**
- Produces: `calcularPorcentajeCumplimiento(completados, totalBloques)`, `calcularCumplimientoUltimasSemanas(prisma, asignacionId, semanaMaxima, cantidad?)` — usados por este endpoint y por `Ficha.tsx` (Task 12). `GET /api/coach/programas/:id`, `GET /api/coach/clientes`, `GET /api/coach/clientes/:clienteId` — consumidos por `Builder.tsx`, `Clientes.tsx`, `Ficha.tsx`.

- [ ] **Step 1: Escribir el test unitario del cálculo de porcentaje (falla primero)**

```typescript
// tests/unit/cumplimiento.test.ts
import { describe, expect, it } from "vitest";
import { calcularPorcentajeCumplimiento } from "../../lib/rutinas/cumplimiento";

describe("calcularPorcentajeCumplimiento", () => {
  it("calcula el porcentaje redondeado", () => {
    expect(calcularPorcentajeCumplimiento(3, 4)).toBe(75);
  });

  it("devuelve 0 si no hay bloques totales (evita división por cero)", () => {
    expect(calcularPorcentajeCumplimiento(0, 0)).toBe(0);
  });

  it("redondea al entero más cercano", () => {
    expect(calcularPorcentajeCumplimiento(11, 12)).toBe(92);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/cumplimiento.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/rutinas/cumplimiento.ts`**

```typescript
// lib/rutinas/cumplimiento.ts
import type { PrismaClient } from "@prisma/client";

export function calcularPorcentajeCumplimiento(completados: number, totalBloques: number): number {
  if (totalBloques <= 0) return 0;
  return Math.round((completados / totalBloques) * 100);
}

export interface CumplimientoSemana {
  semana: number;
  porcentaje: number;
}

export async function calcularCumplimientoUltimasSemanas(
  prisma: PrismaClient,
  asignacionId: string,
  semanaMaxima: number,
  cantidad = 4,
): Promise<CumplimientoSemana[]> {
  const asignacion = await prisma.asignacionPrograma.findUniqueOrThrow({
    where: { id: asignacionId },
    include: { programa: { include: { dias: { include: { bloques: true } } } } },
  });
  const totalBloques = asignacion.programa.dias.reduce((acc, d) => acc + d.bloques.length, 0);

  const desde = Math.max(1, semanaMaxima - cantidad + 1);
  const semanas = Array.from({ length: semanaMaxima - desde + 1 }, (_, i) => desde + i);

  const resultados: CumplimientoSemana[] = [];
  for (const semana of semanas) {
    const completados = await prisma.bloqueCompletado.count({ where: { asignacionId, semana } });
    resultados.push({ semana, porcentaje: calcularPorcentajeCumplimiento(completados, totalBloques) });
  }
  return resultados;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/cumplimiento.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implementar `GET /api/coach/programas/:id` (detalle completo para el builder)**

```typescript
// app/api/coach/programas/[id]/route.ts
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({
    where: { id },
    include: {
      dias: {
        orderBy: { diaSemana: "asc" },
        include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: { orderBy: { semana: "asc" } } } } },
      },
      asignaciones: { include: { cliente: true } },
    },
  });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }
  return Response.json({ programa });
}
```

- [ ] **Step 6: Implementar `GET /api/coach/clientes` (lista con su programa vigente)**

```typescript
// app/api/coach/clientes/route.ts
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
    include: {
      asignaciones: {
        orderBy: { asignadoEn: "desc" },
        take: 1,
        include: { programa: true },
      },
    },
  });

  const filas = clientes.map((c) => {
    const vigente = c.asignaciones[0] ?? null;
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: c.iniciales,
      objetivo: c.objetivo,
      plan: c.plan,
      programaActual: vigente?.programa.nombre ?? "Sin asignar",
      programaEstado: vigente?.programa.estado ?? null,
      actualizadoEn: vigente?.asignadoEn ?? null,
    };
  });

  return Response.json({ clientes: filas });
}
```

- [ ] **Step 7: Implementar `GET /api/coach/clientes/:clienteId` (ficha, con cumplimiento)**

```typescript
// app/api/coach/clientes/[clienteId]/route.ts
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";
import { calcularCumplimientoUltimasSemanas } from "../../../../../lib/rutinas/cumplimiento";

export async function GET(_req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { clienteId } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      asignaciones: {
        orderBy: { asignadoEn: "desc" },
        include: { programa: true },
      },
    },
  });
  if (!cliente) {
    return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const asignacionActiva = cliente.asignaciones[0] ?? null;
  const cumplimiento = asignacionActiva
    ? await calcularCumplimientoUltimasSemanas(prisma, asignacionActiva.id, asignacionActiva.programa.semanas)
    : [];

  return Response.json({ cliente, cumplimiento });
}
```

- [ ] **Step 8: Escribir el test de integración de ficha + cumplimiento**

```typescript
// tests/integration/ficha.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { calcularCumplimientoUltimasSemanas } from "../../lib/rutinas/cumplimiento";

let clienteId: string;
let asignacionId: string;
let bloqueId: string;

beforeEach(async () => {
  await prisma.bloqueCompletado.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "ficha-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  const userCliente = await prisma.user.create({
    data: { email: "ficha-cliente@example.com", passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() },
  });
  const cliente = await prisma.cliente.create({
    data: { userId: userCliente.id, nombre: "Camila Ferreyra", iniciales: "CF", objetivo: "Correr sin dolor" },
  });
  clienteId = cliente.id;

  const programa = await prisma.programa.create({
    data: {
      nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 1, creadoPorId: admin.id,
      dias: { create: { diaSemana: 1, descanso: false } },
    },
    include: { dias: true },
  });
  const bloque = await prisma.bloque.create({
    data: { diaId: programa.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3" },
  });
  bloqueId = bloque.id;

  const asignacion = await prisma.asignacionPrograma.create({
    data: { programaId: programa.id, clienteId: cliente.id },
  });
  asignacionId = asignacion.id;
});

describe("calcularCumplimientoUltimasSemanas", () => {
  it("da 100% en la semana con el único bloque completado y 0% si no hay ninguno", async () => {
    await prisma.bloqueCompletado.create({ data: { asignacionId, bloqueId, semana: 1 } });
    const resultado = await calcularCumplimientoUltimasSemanas(prisma, asignacionId, 1);
    expect(resultado).toEqual([{ semana: 1, porcentaje: 100 }]);
  });
});

describe("GET /api/coach/clientes/:clienteId sin sesión", () => {
  it("rechaza con 401 cuando no hay sesión (requireAdmin de Task 2)", async () => {
    const { GET } = await import("../../app/api/coach/clientes/[clienteId]/route");
    const res = await GET(new Request(`http://localhost/api/coach/clientes/${clienteId}`), { params: Promise.resolve({ clienteId }) });
    expect(res.status).toBe(401);
  });
});
```

Nota sobre el Step 8: el segundo `describe` cubre el rechazo de `requireAdmin` (Task 2) cuando se llama al Route Handler sin sesión — confirma que el endpoint nunca sirve datos de un cliente sin autenticación. La cobertura del camino feliz autenticado (sesión de `ADMIN` real vía `signIn`, mismo patrón de `tests/integration/login.test.ts` de Fundación) queda ejercitada indirectamente por las pruebas de integración de escritura de las próximas tasks, que sí construyen sesiones reales antes de llamar a sus endpoints.

- [ ] **Step 9: Correr toda la suite de esta task**

Run: `npx vitest run --project unit tests/unit/cumplimiento.test.ts && npx vitest run --project integration tests/integration/ficha.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add lib/rutinas/cumplimiento.ts app/api/coach/programas/[id]/route.ts app/api/coach/clientes tests/unit/cumplimiento.test.ts tests/integration/ficha.test.ts
git commit -m "feat: detalle de programa, lista de clientes, ficha y calculo de cumplimiento"
```

---

## Task 5: Drag-and-drop de bloques — instalación de `@dnd-kit` y endpoint de reordenar/mover

**Files:**
- Modify: `package.json` (agregar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Create: `app/api/coach/dias/[diaId]/reordenar/route.ts`
- Test: `tests/integration/reordenar.test.ts`

**Interfaces:**
- Produces: `PATCH /api/coach/dias/:diaId/reordenar` — consumido por `Builder.tsx` (Task 13).

**Nota de riesgo técnico (spec §12.2):** antes de continuar, verificar que la versión de `@dnd-kit` instalada declara `peerDependencies` compatibles con React 19 — no asumirlo de memoria. Al momento de escribir este plan, `@dnd-kit/core` en su rama `^6.x` declara `react`/`react-dom` como peer sin tope superior fijo (`>=16.8.0`), lo que en la práctica ha sido compatible con React 19, pero **correr el Step 1 y leer la salida real de `npm install` (o `npm ls @dnd-kit/core`) antes de dar por bueno que no hay warnings de peer dependency** — si `npm` reporta un conflicto de peer, resolverlo antes de avanzar (puede requerir `--legacy-peer-deps` como último recurso, documentándolo, o esperar/pinnear una versión de `@dnd-kit` con el rango de peers ya actualizado).

- [ ] **Step 1: Instalar `@dnd-kit` y verificar peers contra React 19**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm ls @dnd-kit/core @dnd-kit/sortable react
```

Expected: ninguna línea de `npm ls` marcada como `UNMET PEER DEPENDENCY` o `invalid`. Si aparece, resolver antes de seguir (ver nota de riesgo arriba) y dejar registrado en el commit de este step qué versión exacta quedó instalada.

- [ ] **Step 2: Escribir el test de integración del endpoint (falla primero)**

```typescript
// tests/integration/reordenar.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { signIn } from "../../lib/auth";

const ADMIN_EMAIL = "reordenar-admin@example.com";
let diaAId: string;
let diaBId: string;
let bloque1: string;
let bloque2: string;
let bloque3: string;
let programaOtroId: string;
let diaOtroProgramaId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: ADMIN_EMAIL, passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });

  const programa = await prisma.programa.create({
    data: {
      nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id,
      dias: { create: [{ diaSemana: 1, descanso: false }, { diaSemana: 2, descanso: false }] },
    },
    include: { dias: true },
  });
  diaAId = programa.dias[0].id;
  diaBId = programa.dias[1].id;

  const b1 = await prisma.bloque.create({ data: { diaId: diaAId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B1", detalle: "x" } });
  const b2 = await prisma.bloque.create({ data: { diaId: diaAId, orden: 1, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B2", detalle: "x" } });
  const b3 = await prisma.bloque.create({ data: { diaId: diaBId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B3", detalle: "x" } });
  bloque1 = b1.id;
  bloque2 = b2.id;
  bloque3 = b3.id;

  const otroPrograma = await prisma.programa.create({
    data: { nombre: "Otro", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 3, descanso: false } } },
    include: { dias: true },
  });
  programaOtroId = otroPrograma.id;
  diaOtroProgramaId = otroPrograma.dias[0].id;
});

async function loginAdmin() {
  await signIn("credentials", { email: ADMIN_EMAIL, password: "Password123", redirect: false });
}

describe("PATCH /api/coach/dias/:diaId/reordenar", () => {
  it("reordena los bloques dentro del mismo día", async () => {
    await loginAdmin();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const req = new Request(`http://localhost/api/coach/dias/${diaAId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque2, bloque1] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaAId }) });
    expect(res.status).toBe(200);

    const [b1, b2] = await Promise.all([
      prisma.bloque.findUniqueOrThrow({ where: { id: bloque1 } }),
      prisma.bloque.findUniqueOrThrow({ where: { id: bloque2 } }),
    ]);
    expect(b2.orden).toBe(0);
    expect(b1.orden).toBe(1);
  });

  it("mueve un bloque a otro día del mismo programa y recalcula el orden de origen", async () => {
    await loginAdmin();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const req = new Request(`http://localhost/api/coach/dias/${diaBId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque3, bloque1], diaOrigenId: diaAId, ordenOrigen: [bloque2] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaBId }) });
    expect(res.status).toBe(200);

    const movido = await prisma.bloque.findUniqueOrThrow({ where: { id: bloque1 } });
    expect(movido.diaId).toBe(diaBId);
    expect(movido.orden).toBe(1);
    const restante = await prisma.bloque.findUniqueOrThrow({ where: { id: bloque2 } });
    expect(restante.diaId).toBe(diaAId);
    expect(restante.orden).toBe(0);
  });

  it("rechaza mezclar bloques de otro programa", async () => {
    await loginAdmin();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const bloqueOtro = await prisma.bloque.create({ data: { diaId: diaOtroProgramaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x" } });
    const req = new Request(`http://localhost/api/coach/dias/${diaAId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque1, bloqueOtro.id] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaAId }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/reordenar.test.ts`
Expected: FAIL — el módulo del endpoint no existe

- [ ] **Step 4: Implementar el endpoint**

```typescript
// app/api/coach/dias/[diaId]/reordenar/route.ts
import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";

const ReordenarSchema = z.object({
  bloqueIds: z.array(z.string()).min(1),
  diaOrigenId: z.string().optional(),
  ordenOrigen: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId: diaDestinoId } = await params;

  const parsed = ReordenarSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { bloqueIds, diaOrigenId, ordenOrigen } = parsed.data;

  const diaDestino = await prisma.diaPrograma.findUnique({ where: { id: diaDestinoId } });
  if (!diaDestino) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }

  if (diaOrigenId && diaOrigenId !== diaDestinoId) {
    const diaOrigen = await prisma.diaPrograma.findUnique({ where: { id: diaOrigenId } });
    if (!diaOrigen || diaOrigen.programaId !== diaDestino.programaId) {
      return Response.json({ error: "El día de origen no pertenece al mismo programa" }, { status: 400 });
    }
  }

  const idsAValidar = [...bloqueIds, ...(ordenOrigen ?? [])];
  const bloquesExistentes = await prisma.bloque.findMany({
    where: { id: { in: idsAValidar } },
    include: { dia: true },
  });
  const perteneceAlPrograma = bloquesExistentes.every((b) => b.dia.programaId === diaDestino.programaId);
  if (bloquesExistentes.length !== idsAValidar.length || !perteneceAlPrograma) {
    return Response.json({ error: "Uno o más bloques no pertenecen a este programa" }, { status: 400 });
  }

  await prisma.$transaction([
    ...bloqueIds.map((bloqueId, index) =>
      prisma.bloque.update({ where: { id: bloqueId }, data: { diaId: diaDestinoId, orden: index } }),
    ),
    ...(ordenOrigen ?? []).map((bloqueId, index) =>
      prisma.bloque.update({ where: { id: bloqueId }, data: { orden: index } }),
    ),
  ]);

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/reordenar.test.ts`
Expected: PASS (3 tests). Si el primer `signIn(...)` de este test lanza en vez de resolver (mismo detalle de versión de `next-auth@beta` ya señalado en Fundación Task 11), ajustar la aserción al comportamiento real verificado contra la librería instalada.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/api/coach/dias/[diaId]/reordenar tests/integration/reordenar.test.ts
git commit -m "feat: reordenar y mover bloques entre dias con dnd-kit en el frontend"
```

---

## Task 6: Duplicar día y duplicar programa completo

**Files:**
- Create: `lib/rutinas/duplicar.ts`
- Create: `app/api/coach/dias/[diaId]/duplicar/route.ts`
- Create: `app/api/coach/programas/[id]/duplicar/route.ts`
- Test: `tests/integration/duplicar.test.ts`

**Interfaces:**
- Produces: `duplicarDia(tx, origenDiaId, destinoDiaId)`, `duplicarPrograma(tx, programaId, creadoPorId)` — usados por los dos endpoints. `POST /api/coach/dias/:diaId/duplicar`, `POST /api/coach/programas/:id/duplicar` — consumidos por `Builder.tsx` y `Ficha.tsx`.

- [ ] **Step 1: Escribir el test de integración (falla primero)**

```typescript
// tests/integration/duplicar.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let adminId: string;
let programaId: string;
let diaOrigenId: string;
let diaDestinoId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "duplicar-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  adminId = admin.id;

  const programa = await prisma.programa.create({
    data: {
      nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 2, creadoPorId: admin.id,
      dias: { create: [{ diaSemana: 1, descanso: false }, { diaSemana: 2, descanso: false }] },
    },
    include: { dias: true },
  });
  programaId = programa.id;
  diaOrigenId = programa.dias[0].id;
  diaDestinoId = programa.dias[1].id;

  await prisma.bloque.create({
    data: {
      diaId: diaOrigenId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3",
      sobrecarga: { create: [{ semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" }, { semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" }] },
    },
  });
  // El día destino ya tenía contenido propio, que debe reemplazarse al duplicar.
  await prisma.bloque.create({
    data: { diaId: diaDestinoId, orden: 0, tipo: "SECUENCIA", foco: "RITMO", titulo: "Viejo contenido", detalle: "x" },
  });
});

describe("duplicarDia", () => {
  it("reemplaza el contenido del día destino y preserva la sobrecarga del origen", async () => {
    const { duplicarDia } = await import("../../lib/rutinas/duplicar");
    await prisma.$transaction((tx) => duplicarDia(tx, diaOrigenId, diaDestinoId));

    const bloquesDestino = await prisma.bloque.findMany({ where: { diaId: diaDestinoId }, include: { sobrecarga: true } });
    expect(bloquesDestino).toHaveLength(1);
    expect(bloquesDestino[0].titulo).toBe("Sentadilla");
    expect(bloquesDestino[0].sobrecarga).toHaveLength(2);
  });
});

describe("duplicarPrograma", () => {
  it("clona dias, bloques y sobrecarga completos sin arrastrar asignaciones", async () => {
    await prisma.asignacionPrograma.create({
      data: {
        programaId,
        clienteId: (
          await prisma.cliente.create({
            data: {
              userId: (await prisma.user.create({ data: { email: "cliente-dup@example.com", passwordHash: "x", role: "CLIENTE" } })).id,
              nombre: "Test", iniciales: "TT", objetivo: "x",
            },
          })
        ).id,
      },
    });

    const { duplicarPrograma } = await import("../../lib/rutinas/duplicar");
    const nuevoId = await prisma.$transaction((tx) => duplicarPrograma(tx, programaId, adminId));

    const copia = await prisma.programa.findUniqueOrThrow({
      where: { id: nuevoId },
      include: { dias: { include: { bloques: { include: { sobrecarga: true } } } }, asignaciones: true },
    });
    expect(copia.nombre).toBe("Fuerza & Motor (copia)");
    expect(copia.estado).toBe("BORRADOR");
    expect(copia.asignaciones).toHaveLength(0);
    expect(copia.dias).toHaveLength(2);
    const totalBloques = copia.dias.reduce((acc, d) => acc + d.bloques.length, 0);
    expect(totalBloques).toBe(2);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/duplicar.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar los helpers de duplicación**

```typescript
// lib/rutinas/duplicar.ts
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function duplicarDia(tx: Tx, origenDiaId: string, destinoDiaId: string): Promise<void> {
  const origen = await tx.diaPrograma.findUniqueOrThrow({
    where: { id: origenDiaId },
    include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: true } } },
  });

  await tx.bloque.deleteMany({ where: { diaId: destinoDiaId } });

  for (const bloque of origen.bloques) {
    await tx.bloque.create({
      data: {
        diaId: destinoDiaId,
        orden: bloque.orden,
        tipo: bloque.tipo,
        foco: bloque.foco,
        titulo: bloque.titulo,
        detalle: bloque.detalle,
        meta: bloque.meta,
        sobrecarga: {
          create: bloque.sobrecarga.map((f) => ({ semana: f.semana, series: f.series, reps: f.reps, pct: f.pct, descanso: f.descanso })),
        },
      },
    });
  }
}

export async function duplicarPrograma(tx: Tx, programaId: string, creadoPorId: string): Promise<string> {
  const original = await tx.programa.findUniqueOrThrow({
    where: { id: programaId },
    include: { dias: { include: { bloques: { include: { sobrecarga: true } } } } },
  });

  const copia = await tx.programa.create({
    data: {
      nombre: `${original.nombre} (copia)`,
      semanas: original.semanas,
      objetivo: original.objetivo,
      frecuencia: original.frecuencia,
      estado: "BORRADOR",
      creadoPorId,
    },
  });

  for (const dia of original.dias) {
    const diaCopia = await tx.diaPrograma.create({
      data: {
        programaId: copia.id,
        diaSemana: dia.diaSemana,
        descanso: dia.descanso,
        calentamiento: dia.calentamiento,
      },
    });
    for (const bloque of dia.bloques) {
      await tx.bloque.create({
        data: {
          diaId: diaCopia.id,
          orden: bloque.orden,
          tipo: bloque.tipo,
          foco: bloque.foco,
          titulo: bloque.titulo,
          detalle: bloque.detalle,
          meta: bloque.meta,
          sobrecarga: {
            create: bloque.sobrecarga.map((f) => ({ semana: f.semana, series: f.series, reps: f.reps, pct: f.pct, descanso: f.descanso })),
          },
        },
      });
    }
  }

  return copia.id;
}
```

- [ ] **Step 4: Implementar los endpoints**

```typescript
// app/api/coach/dias/[diaId]/duplicar/route.ts
import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { duplicarDia } from "../../../../../../lib/rutinas/duplicar";

const Schema = z.object({ destinoDiaId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { destinoDiaId } = parsed.data;

  const [origen, destino] = await Promise.all([
    prisma.diaPrograma.findUnique({ where: { id: diaId } }),
    prisma.diaPrograma.findUnique({ where: { id: destinoDiaId } }),
  ]);
  if (!origen || !destino) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }
  if (origen.programaId !== destino.programaId) {
    return Response.json({ error: "Los días no pertenecen al mismo programa" }, { status: 400 });
  }

  await prisma.$transaction((tx) => duplicarDia(tx, diaId, destinoDiaId));
  return Response.json({ ok: true });
}
```

```typescript
// app/api/coach/programas/[id]/duplicar/route.ts
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { duplicarPrograma } from "../../../../../../lib/rutinas/duplicar";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({ where: { id } });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }

  const nuevoId = await prisma.$transaction((tx) => duplicarPrograma(tx, id, check.session.user.id));
  return Response.json({ id: nuevoId }, { status: 201 });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/duplicar.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/rutinas/duplicar.ts app/api/coach/dias/[diaId]/duplicar app/api/coach/programas/[id]/duplicar tests/integration/duplicar.test.ts
git commit -m "feat: duplicar dia y duplicar programa completo como plantilla"
```

---

## Task 7: Asignación masiva

**Files:**
- Create: `app/api/coach/programas/[id]/asignar/route.ts`
- Test: `tests/integration/asignar.test.ts`

**Interfaces:**
- Produces: `POST /api/coach/programas/:id/asignar` — consumido por `Asignar.tsx` (Task 15).

- [ ] **Step 1: Escribir el test de integración (falla primero)**

```typescript
// tests/integration/asignar.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let programaId: string;
let cliente1Id: string;
let cliente2Id: string;

beforeEach(async () => {
  await prisma.asignacionPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "asignar-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  const programa = await prisma.programa.create({
    data: { nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 4, creadoPorId: admin.id },
  });
  programaId = programa.id;

  const u1 = await prisma.user.create({ data: { email: "camila@example.com", passwordHash: "x", role: "CLIENTE" } });
  const u2 = await prisma.user.create({ data: { email: "martin@example.com", passwordHash: "x", role: "CLIENTE" } });
  cliente1Id = (await prisma.cliente.create({ data: { userId: u1.id, nombre: "Camila", iniciales: "CF", objetivo: "x" } })).id;
  cliente2Id = (await prisma.cliente.create({ data: { userId: u2.id, nombre: "Martín", iniciales: "MD", objetivo: "x" } })).id;
});

describe("POST /api/coach/programas/:id/asignar", () => {
  it("crea una AsignacionPrograma por cada cliente seleccionado con mensaje y tema, y pasa el programa a ASIGNADO", async () => {
    const { POST } = await import("../../app/api/coach/programas/[id]/asignar/route");
    const req = new Request(`http://localhost/api/coach/programas/${programaId}/asignar`, {
      method: "POST",
      body: JSON.stringify({
        clienteIds: [cliente1Id, cliente2Id],
        mensajePersonalizado: "Arrancamos el bloque nuevo.",
        temaPdf: "night",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: programaId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asignados).toBe(2);

    const asignaciones = await prisma.asignacionPrograma.findMany({ where: { programaId } });
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones.every((a) => a.mensajePersonalizado === "Arrancamos el bloque nuevo." && a.temaPdf === "night")).toBe(true);

    const programa = await prisma.programa.findUniqueOrThrow({ where: { id: programaId } });
    expect(programa.estado).toBe("ASIGNADO");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/asignar.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar el endpoint**

```typescript
// app/api/coach/programas/[id]/asignar/route.ts
import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";

const AsignarSchema = z.object({
  clienteIds: z.array(z.string()).min(1),
  mensajePersonalizado: z.string().optional(),
  temaPdf: z.enum(["clean", "night", "pink"]).default("clean"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id: programaId } = await params;

  const parsed = AsignarSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { clienteIds, mensajePersonalizado, temaPdf } = parsed.data;

  const programa = await prisma.programa.findUnique({ where: { id: programaId } });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }

  await prisma.$transaction([
    ...clienteIds.map((clienteId) =>
      prisma.asignacionPrograma.upsert({
        where: { programaId_clienteId: { programaId, clienteId } },
        update: { mensajePersonalizado, temaPdf },
        create: { programaId, clienteId, mensajePersonalizado, temaPdf },
      }),
    ),
    prisma.programa.update({ where: { id: programaId }, data: { estado: "ASIGNADO" } }),
  ]);

  return Response.json({ ok: true, asignados: clienteIds.length });
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/asignar.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/api/coach/programas/[id]/asignar tests/integration/asignar.test.ts
git commit -m "feat: asignacion masiva de un programa a varios clientes"
```

---

## Task 8: "Mi rutina" del lado cliente — lectura y marcado de cumplimiento

**Files:**
- Create: `app/api/cuenta/mi-rutina/route.ts`
- Create: `app/api/cuenta/mi-rutina/completar/route.ts`
- Test: `tests/integration/mi-rutina.test.ts`

**Interfaces:**
- Consumes: `requireClienteActual` (Task 2).
- Produces: `GET /api/cuenta/mi-rutina`, `POST /api/cuenta/mi-rutina/completar` — consumidos por `Cuenta.tsx` (Task 17).

**Nota de criterio (para auditar):** el handoff rediseña "Mi rutina" como una vista de solo lectura (grilla de series/rep/carga/descanso por bloque, sin checkbox de "hecho" como tenía el mock viejo). Pero el modelo de datos del spec (§4) incluye `BloqueCompletado` específicamente para alimentar el gráfico de cumplimiento de la ficha del cliente — y esa tabla no tiene otra fuente posible de datos que el propio cliente marcando bloques como completados. Este plan agrega un control de "Marcar como hecho" por bloque en la tarjeta de "Mi rutina" (Task 17) que no está descripto en el README del handoff, precisamente para que `BloqueCompletado` no quede siempre vacío y el gráfico de cumplimiento de la ficha (Task 4/12) tenga datos reales que mostrar.

- [ ] **Step 1: Escribir el test de integración (falla primero)**

```typescript
// tests/integration/mi-rutina.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { signIn } from "../../lib/auth";

const CLIENTE_A_EMAIL = "mirutina-a@example.com";
const CLIENTE_B_EMAIL = "mirutina-b@example.com";
let clienteAId: string;
let programaId: string;
let bloqueId: string;
let bloqueOtroProgramaId: string;

beforeEach(async () => {
  await prisma.bloqueCompletado.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({ data: { email: "mirutina-admin@example.com", passwordHash: "x", role: "ADMIN" } });
  const userA = await prisma.user.create({ data: { email: CLIENTE_A_EMAIL, passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() } });
  const userB = await prisma.user.create({ data: { email: CLIENTE_B_EMAIL, passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() } });
  const clienteA = await prisma.cliente.create({ data: { userId: userA.id, nombre: "Camila", iniciales: "CF", objetivo: "x" } });
  await prisma.cliente.create({ data: { userId: userB.id, nombre: "Martín", iniciales: "MD", objetivo: "x" } });
  clienteAId = clienteA.id;

  const programa = await prisma.programa.create({
    data: { nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  programaId = programa.id;
  const bloque = await prisma.bloque.create({ data: { diaId: programa.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3" } });
  bloqueId = bloque.id;
  await prisma.asignacionPrograma.create({ data: { programaId, clienteId: clienteAId } });

  const otroPrograma = await prisma.programa.create({
    data: { nombre: "Otro", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  bloqueOtroProgramaId = (await prisma.bloque.create({ data: { diaId: otroPrograma.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x" } })).id;
});

describe("GET /api/cuenta/mi-rutina", () => {
  it("el cliente B (sin asignación) no ve el programa de la cliente A", async () => {
    await signIn("credentials", { email: CLIENTE_B_EMAIL, password: "Password123", redirect: false });
    const { GET } = await import("../../app/api/cuenta/mi-rutina/route");
    const res = await GET();
    const body = await res.json();
    expect(body.asignacion).toBeNull();
  });

  it("la cliente A ve su propio programa asignado", async () => {
    await signIn("credentials", { email: CLIENTE_A_EMAIL, password: "Password123", redirect: false });
    const { GET } = await import("../../app/api/cuenta/mi-rutina/route");
    const res = await GET();
    const body = await res.json();
    expect(body.asignacion.programa.id).toBe(programaId);
  });
});

describe("POST /api/cuenta/mi-rutina/completar", () => {
  it("marca un bloque propio como completado", async () => {
    await signIn("credentials", { email: CLIENTE_A_EMAIL, password: "Password123", redirect: false });
    const { POST } = await import("../../app/api/cuenta/mi-rutina/completar/route");
    const req = new Request("http://localhost/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId, semana: 1 }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const completados = await prisma.bloqueCompletado.findMany({ where: { bloqueId } });
    expect(completados).toHaveLength(1);
  });

  it("rechaza marcar un bloque que no pertenece al programa asignado del cliente", async () => {
    await signIn("credentials", { email: CLIENTE_A_EMAIL, password: "Password123", redirect: false });
    const { POST } = await import("../../app/api/cuenta/mi-rutina/completar/route");
    const req = new Request("http://localhost/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId: bloqueOtroProgramaId, semana: 1 }) });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/mi-rutina.test.ts`
Expected: FAIL — módulos no existen

- [ ] **Step 3: Implementar `GET /api/cuenta/mi-rutina`**

```typescript
// app/api/cuenta/mi-rutina/route.ts
import { prisma } from "../../../../lib/db";
import { requireClienteActual } from "../../../../lib/coach/guards";

export async function GET() {
  const check = await requireClienteActual();
  if (check.error) return check.error;
  const { cliente } = check;

  const asignacion = await prisma.asignacionPrograma.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { asignadoEn: "desc" },
    include: {
      programa: {
        include: {
          dias: {
            orderBy: { diaSemana: "asc" },
            include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: { orderBy: { semana: "asc" } } } } },
          },
        },
      },
    },
  });

  return Response.json({ asignacion: asignacion ?? null });
}
```

- [ ] **Step 4: Implementar `POST /api/cuenta/mi-rutina/completar`**

```typescript
// app/api/cuenta/mi-rutina/completar/route.ts
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireClienteActual } from "../../../../../lib/coach/guards";

const Schema = z.object({ bloqueId: z.string().min(1), semana: z.number().int().min(1) });

export async function POST(req: Request) {
  const check = await requireClienteActual();
  if (check.error) return check.error;
  const { cliente } = check;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { bloqueId, semana } = parsed.data;

  const asignacion = await prisma.asignacionPrograma.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { asignadoEn: "desc" },
    include: { programa: { include: { dias: { include: { bloques: true } } } } },
  });
  if (!asignacion) {
    return Response.json({ error: "No tenés un programa asignado" }, { status: 404 });
  }

  const bloquePertenece = asignacion.programa.dias.some((d) => d.bloques.some((b) => b.id === bloqueId));
  if (!bloquePertenece) {
    return Response.json({ error: "Ese bloque no pertenece a tu programa" }, { status: 403 });
  }

  await prisma.bloqueCompletado.upsert({
    where: { asignacionId_bloqueId_semana: { asignacionId: asignacion.id, bloqueId, semana } },
    update: {},
    create: { asignacionId: asignacion.id, bloqueId, semana },
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/mi-rutina.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/cuenta/mi-rutina tests/integration/mi-rutina.test.ts
git commit -m "feat: mi rutina del cliente y marcado de bloques completados"
```

---

## Task 9: Exportación a PDF con Playwright

**Files:**
- Create: `lib/pdf/render.ts`
- Create: `lib/pdf/session-cookie.ts`
- Create: `app/coach/programas/[id]/pdf-preview/page.tsx`
- Create: `app/api/coach/programas/[id]/pdf/route.ts`
- Modify: `package.json` (agregar `playwright` como dependencia de runtime)
- Test: `tests/unit/session-cookie.test.ts`

**Interfaces:**
- Produces: `renderPdfConSesion(url, cookie, origin): Promise<Buffer>`, `extraerCookieSesion(headerCookie): {name, value} | null` — usados por `GET /api/coach/programas/:id/pdf`. La página `/coach/programas/:id/pdf-preview` — navegada por Playwright, nunca por el usuario directamente.

**Nota de fusión obligatoria (spec §8):** el plan de Booking + Pagos (`docs/superpowers/plans/2026-08-22-booking-pagos.md`, Task 11) también crea `lib/pdf/render.ts`, con la firma `renderPdf(url: string): Promise<Buffer>` y `chromium.launch()` **relanzado en cada llamada**. Este plan agrega a ese mismo archivo una segunda función, `renderPdfConSesion`, que comparte una única instancia de `chromium` reutilizada entre llamadas (spec §12.1: "no relanzar el browser por request"). Antes del Step 2, verificar el estado real de `lib/pdf/render.ts`:
- **Si el archivo no existe todavía** (booking-pagos no corrió antes): este plan lo crea de cero, ya con el singleton de `chromium` reutilizado por ambas funciones — cuando booking-pagos corra después, su Task 11 debe detectar que el archivo ya existe y **reutilizar el singleton en vez de relanzar el browser por request**, ajustando su propia implementación de `renderPdf` para usar la misma instancia (documentarlo así si se está ejecutando ese plan después de este).
- **Si el archivo ya existe** (booking-pagos corrió antes, con `chromium.launch()` por llamada): este plan reemplaza esa implementación por la de abajo (instancia única compartida) y agrega `renderPdfConSesion` al mismo archivo, preservando la firma `renderPdf(url: string): Promise<Buffer>` sin romper al comprobante de pago que ya la consume.

- [ ] **Step 1: Instalar Playwright como dependencia de runtime (si no está ya instalada por booking-pagos)**

```bash
npm install playwright
```

- [ ] **Step 2: Escribir el test unitario de extracción de cookie de sesión (falla primero)**

```typescript
// tests/unit/session-cookie.test.ts
import { describe, expect, it } from "vitest";
import { extraerCookieSesion } from "../../lib/pdf/session-cookie";

describe("extraerCookieSesion", () => {
  it("extrae la cookie de sesión de Auth.js entre otras cookies", () => {
    const header = "otra=valor; authjs.session-token=abc123; theme=dark";
    expect(extraerCookieSesion(header)).toEqual({ name: "authjs.session-token", value: "abc123" });
  });

  it("reconoce la variante __Secure- usada en producción sobre HTTPS", () => {
    const header = "__Secure-authjs.session-token=xyz789";
    expect(extraerCookieSesion(header)).toEqual({ name: "__Secure-authjs.session-token", value: "xyz789" });
  });

  it("devuelve null si no hay ninguna cookie de sesión reconocida", () => {
    expect(extraerCookieSesion("theme=dark; lang=es")).toBeNull();
  });

  it("devuelve null si el header es null", () => {
    expect(extraerCookieSesion(null)).toBeNull();
  });
});
```

**Nota de riesgo técnico:** `next-auth@5.0.0-beta.32` (Auth.js v5) nombra su cookie de sesión JWT `authjs.session-token` en desarrollo y `__Secure-authjs.session-token` sobre HTTPS en producción — **verificar el nombre real contra las cookies que efectivamente setea `lib/auth.ts` en este repo** (por ejemplo inspeccionando las cookies del navegador tras un login manual, o revisando `node_modules/next-auth/...` si hace falta) antes de dar por buena esta lista; `extraerCookieSesion` ya está escrita defensivamente para reconocer también los nombres legados `next-auth.session-token`/`__Secure-next-auth.session-token` por si la instancia de Auth.js estuviera configurada en modo de compatibilidad, pero no asumir de memoria cuál es el nombre activo sin confirmarlo.

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/session-cookie.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 4: Implementar `lib/pdf/session-cookie.ts`**

```typescript
// lib/pdf/session-cookie.ts
const NOMBRES_COOKIE_SESION = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export interface CookieSesion {
  name: string;
  value: string;
}

export function extraerCookieSesion(headerCookie: string | null): CookieSesion | null {
  if (!headerCookie) return null;
  for (const par of headerCookie.split(";")) {
    const [rawName, ...resto] = par.trim().split("=");
    if (NOMBRES_COOKIE_SESION.includes(rawName)) {
      return { name: rawName, value: resto.join("=") };
    }
  }
  return null;
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/session-cookie.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Escribir/actualizar `lib/pdf/render.ts` (ver nota de fusión arriba — instancia de `chromium` única y compartida)**

```typescript
// lib/pdf/render.ts
import { chromium, type Browser } from "playwright";
import type { CookieSesion } from "./session-cookie";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

export async function renderPdf(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await page.close();
  }
}

export async function renderPdfConSesion(url: string, cookie: CookieSesion, origin: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    await context.addCookies([{ name: cookie.name, value: cookie.value, url: origin }]);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await context.close();
  }
}
```

- [ ] **Step 7: Implementar la página interna de portada del PDF (3 temas, no navegable por el usuario salvo por Playwright)**

```tsx
// app/coach/programas/[id]/pdf-preview/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const TEMAS = {
  clean: { fondo: "#ffffff", texto: "#1b2320", acento: "#1f4d3a", chip: "#eef3f0", caja: "#f2f6f4" },
  night: { fondo: "#0e1726", texto: "#e6ecf6", acento: "#7aa2f7", chip: "#17223a", caja: "#141d31" },
  pink: { fondo: "#fffaf7", texto: "#2a1620", acento: "#8c1d3f", chip: "#fdeef2", caja: "#fdf1f4" },
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
  const tema = TEMAS[temaParam as keyof typeof TEMAS] ?? TEMAS.clean;

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
        <div style={{ width: 24, height: 24, borderRadius: 6, background: tema.acento, color: tema.fondo, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>B</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Beto Training</div>
          <div style={{ fontSize: 9, opacity: 0.6 }}>Programado por Beto Álvarez</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 8, opacity: 0.5 }}>PDF</div>
      </div>

      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7 }}>Plan de entrenamiento</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, color: tema.acento, margin: 0 }}>{programa.nombre}</h1>
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
```

- [ ] **Step 8: Implementar `GET /api/coach/programas/:id/pdf`**

```typescript
// app/api/coach/programas/[id]/pdf/route.ts
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

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="programa-${id}-${tema}.pdf"`,
    },
  });
}
```

- [ ] **Step 9: Verificación manual end-to-end**

```bash
npm run dev
```

Con una sesión de `ADMIN` en el navegador, crear un programa (Task 2), agregarle un bloque (Task 3), y navegar directamente a `GET /api/coach/programas/<id>/pdf?tema=night`. Expected: descarga un PDF válido con fondo oscuro (`#0e1726`) y la tabla de sobrecarga del primer bloque. Repetir con `tema=clean` y `tema=pink` y confirmar que cada uno usa su propia paleta.

- [ ] **Step 10: Commit**

```bash
git add lib/pdf lib/coach package.json package-lock.json app/coach/programas app/api/coach/programas/[id]/pdf tests/unit/session-cookie.test.ts
git commit -m "feat: exportacion de programas a pdf con playwright y sesion de admin propagada"
```

---

## Task 10: Migración de tipos y estado — `lib/types.ts`, `lib/data.ts`, `hooks/useBetoApp.ts`

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data.ts`
- Modify: `hooks/useBetoApp.ts`

**Interfaces:**
- Produces: `Screen` extendido con `"clientes" | "ficha" | "builder" | "asignar" | "pdf"`, tipos `ProgramaApi`/`DiaProgramaApi`/`BloqueApi`/`FilaSobrecargaApi`/`ClienteFilaApi`, estado nuevo en `AppState` (`fichaId`, `programaIdActivo`, `semanaSel`, `editorOpen`, `editorDiaId`, `editorBloqueId`, `diaClienteSel`, `asignadosSel`, `temaPdfSel`), y funciones de navegación `goClientes`, `goFicha`, `goBuilder`, `goAsignar`, `goPdf`, `abrirEditor`, `cerrarEditor`, `toggleAsignado` en `BetoVals` — consumidos por las Tasks 11-17.

- [ ] **Step 1: Actualizar `lib/types.ts` — agregar `Screen`, tipos de API y estado nuevo**

```typescript
// lib/types.ts (reemplaza el archivo completo)
export type Screen =
  | "landing" | "reservar" | "checkout" | "confirm" | "login" | "cuenta" | "coach"
  | "clientes" | "ficha" | "builder" | "asignar" | "pdf";
export type CuentaTab = "reservas" | "rutina" | "paquetes" | "notis" | "datos";
export type Metodo = "bono" | "tarjeta" | "mp" | "efectivo";
export type LoginRol = "cliente" | "admin";

export type TipoBloque = "TRADICIONAL" | "SECUENCIA" | "SUPERSERIE" | "EMOM" | "POR_TIEMPO";
export type FocoBloque = "TECNICA" | "RITMO" | "MAXIMO_ESFUERZO";
export type TemaPdf = "clean" | "night" | "pink";
export type EstadoPrograma = "BORRADOR" | "ASIGNADO" | "COMPLETADO" | "ARCHIVADO";

export interface FilaSobrecargaApi {
  semana: number;
  series: number;
  reps: number;
  pct: number;
  descanso: string;
}

export interface BloqueApi {
  id: string;
  diaId: string;
  orden: number;
  tipo: TipoBloque;
  foco: FocoBloque;
  titulo: string;
  detalle: string;
  meta: string | null;
  sobrecarga: FilaSobrecargaApi[];
}

export interface DiaProgramaApi {
  id: string;
  programaId: string;
  diaSemana: number;
  descanso: boolean;
  calentamiento: string | null;
  bloques: BloqueApi[];
}

export interface ProgramaApi {
  id: string;
  nombre: string;
  semanas: number;
  objetivo: string;
  frecuencia: string;
  estado: EstadoPrograma;
  dias: DiaProgramaApi[];
}

export interface ClienteFilaApi {
  id: string;
  nombre: string;
  iniciales: string;
  objetivo: string;
  plan: string;
  programaActual: string;
  programaEstado: EstadoPrograma | null;
  actualizadoEn: string | null;
}

export interface AppState {
  screen: Screen;
  cuentaTab: CuentaTab;
  prev: Screen[];
  servicio: string;
  dia: number;
  hora: string | null;
  recurrente: boolean;
  metodo: Metodo;
  cuota: number;
  creditos: number;
  packSel: string | null;
  toast: string | null;
  loginRolUI: LoginRol;

  // Panel de rutinas (spec 2026-08-22-panel-rutinas-design.md)
  fichaId: string | null;
  programaIdActivo: string | null;
  semanaSel: number;
  editorOpen: boolean;
  editorDiaId: string | null;
  editorBloqueId: string | null;
  diaClienteSel: number;
  asignadosSel: Record<string, boolean>;
  temaPdfSel: TemaPdf;
}
```

Nota: se quitan `rutinaDia`/`hechos` (el mock plano de rutina) — ver Step 2 para `lib/data.ts` y Task 17 para el JSX de `Cuenta.tsx` que dejaba de usarlos.

- [ ] **Step 2: Actualizar `lib/data.ts` — quitar el mock plano de rutina**

Quitar de `lib/data.ts` la interfaz `EjercicioDef` y la constante `RUTINA` (líneas 102-113 del archivo actual) — quedan reemplazadas por `GET /api/cuenta/mi-rutina` (Task 8). El resto del archivo (`SERVICIOS`, `PACKS`, `HORAS`, `DOW`, `PH`, `money`, `AC`/`ACD`/`DIV`/`SUR`) no cambia.

- [ ] **Step 3: Actualizar `initialState` en `hooks/useBetoApp.ts`**

```typescript
// hooks/useBetoApp.ts (reemplaza initialState)
const initialState: AppState = {
  screen: "landing", cuentaTab: "reservas", prev: [],
  servicio: "funcional", dia: 2, hora: null, recurrente: false,
  metodo: "bono", cuota: 1, creditos: 6, packSel: null,
  toast: null,
  loginRolUI: "cliente",

  fichaId: null,
  programaIdActivo: null,
  semanaSel: 1,
  editorOpen: false,
  editorDiaId: null,
  editorBloqueId: null,
  diaClienteSel: 0,
  asignadosSel: {},
  temaPdfSel: "clean",
};
```

- [ ] **Step 4: Agregar las funciones de navegación del panel de rutinas dentro de `useBetoApp()` (fragmento a insertar junto a `goCoach`, antes del objeto `vals`)**

```typescript
// hooks/useBetoApp.ts (fragmento nuevo, dentro de la función useBetoApp)
const goClientes = () => go("clientes");
const goFicha = (clienteId: string) => { set({ fichaId: clienteId }); go("ficha"); };
const goBuilder = (programaId: string) => { set({ programaIdActivo: programaId, semanaSel: 1 }); go("builder"); };
const goAsignar = () => go("asignar");
const goPdf = () => go("pdf");

const abrirEditor = (diaId: string, bloqueId: string | null) =>
  set({ editorOpen: true, editorDiaId: diaId, editorBloqueId: bloqueId });
const cerrarEditor = () =>
  set({ editorOpen: false, editorDiaId: null, editorBloqueId: null });

const toggleAsignado = (clienteId: string) =>
  set((p) => ({ asignadosSel: { ...p.asignadosSel, [clienteId]: !p.asignadosSel[clienteId] } }));

const setSemanaSel = (semana: number) => set({ semanaSel: semana });
const setDiaClienteSel = (dia: number) => set({ diaClienteSel: dia });
const setTemaPdfSel = (tema: AppState["temaPdfSel"]) => set({ temaPdfSel: tema });
```

- [ ] **Step 5: Exponer todo lo nuevo en el objeto `vals` que devuelve el hook (agregar estas claves al objeto ya existente, sin tocar las demás)**

```typescript
// hooks/useBetoApp.ts (agregar dentro del objeto `vals` retornado)
isClientes: st.screen === "clientes",
isFicha: st.screen === "ficha",
isBuilder: st.screen === "builder",
isAsignar: st.screen === "asignar",
isPdf: st.screen === "pdf",

fichaId: st.fichaId,
programaIdActivo: st.programaIdActivo,
semanaSel: st.semanaSel,
editorOpen: st.editorOpen,
editorDiaId: st.editorDiaId,
editorBloqueId: st.editorBloqueId,
diaClienteSel: st.diaClienteSel,
asignadosSel: st.asignadosSel,
temaPdfSel: st.temaPdfSel,

goClientes, goFicha, goBuilder, goAsignar, goPdf,
abrirEditor, cerrarEditor, toggleAsignado,
setSemanaSel, setDiaClienteSel, setTemaPdfSel,
setProgramaIdActivo: (id: string | null) => set({ programaIdActivo: id }),

// Genéricos ya usados internamente por el hook — se exponen tal cual porque las
// pantallas nuevas (Tasks 11-16) los necesitan para estado puntual sin una acción
// de negocio nombrada (p. ej. setear `programaIdActivo` antes de navegar a `pdf`).
set,
showToast,
```

- [ ] **Step 6: Quitar el bloque de `ejercicios`/`RUTINA` que ya no compila (el import de `RUTINA` fue eliminado en el Step 2)**

Borrar de `hooks/useBetoApp.ts` el import de `RUTINA` en la línea del `import ... from "@/lib/data"`, la constante `ejercicios` (líneas 111-119 del archivo actual, que mapea `RUTINA[st.rutinaDia]`) y la clave `ejercicios`/`diasRutina` del objeto `vals` retornado — quedan reemplazadas en Task 17 por datos reales leídos de `GET /api/cuenta/mi-rutina`.

- [ ] **Step 7: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: errores esperados únicamente en `components/screens/Coach.tsx` y `components/screens/Cuenta.tsx` (que todavía referencian `vals.ejercicios`/`vals.diasRutina` hasta la Task 17) — ningún otro archivo debería fallar. Si aparecen errores en otros archivos, es una señal de que el Step 6 dejó algo sin limpiar.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/data.ts hooks/useBetoApp.ts
git commit -m "feat: estado y navegacion del panel de rutinas en useBetoApp"
```

---

## Task 11: Pantalla `Clientes.tsx`

**Files:**
- Create: `components/screens/Clientes.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/clientes` (Task 4), `vals.goFicha`, `vals.programaIdActivo`, `vals.goAsignar`.

**Nota de criterio (para auditar):** el README del handoff ubica el botón "Asignación masiva" en la cabecera de `Clientes` sin especificar sobre qué programa opera si no se viene de un builder ya abierto — el spec tampoco define un endpoint para "listar todos los programas del entrenador" (los endpoints de programa son siempre por `:id` o por cliente). Para no inventar un endpoint fuera de spec, este plan deja el botón habilitado solo cuando ya existe un `programaIdActivo` en el estado compartido (por ejemplo, viniendo de "Continuar →" en el builder o de "Duplicar programa" en la ficha); si no hay ninguno, se deshabilita con `title="Primero abrí o creá un programa desde la ficha de un cliente"`.

- [ ] **Step 1: Escribir el componente**

```tsx
// components/screens/Clientes.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi } from "@/lib/types";
import ImageSlot from "@/components/ImageSlot";

export default function Clientes({ vals }: { vals: BetoVals }) {
  const [clientes, setClientes] = useState<ClienteFilaApi[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/coach/clientes")
      .then((r) => r.json())
      .then((data) => setClientes(data.clientes ?? []))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.objetivo.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  const formatFecha = (iso: string | null) => {
    if (!iso) return "Sin plan";
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return "Hoy";
    if (dias === 1) return "Hace 1 día";
    if (dias < 7) return `Hace ${dias} días`;
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "Hace 1 semana" : `Hace ${semanas} semanas`;
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <button onClick={vals.goCoach} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Panel
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Modo entrenador</div>
          <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Clientes</h1>
          <p style={{ fontSize: 13.5, opacity: 0.6, margin: "6px 0 0" }}>
            Entrá a la ficha de cada uno para armarle la rutina, asignarla y exportarla.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Buscar cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button
            onClick={vals.goAsignar}
            className="btn btn-secondary"
            disabled={!vals.programaIdActivo}
            title={vals.programaIdActivo ? undefined : "Primero abrí o creá un programa desde la ficha de un cliente"}
          >
            <i className="ph ph-users-three" /> Asignación masiva
          </button>
        </div>
      </div>

      {cargando ? (
        <div style={{ fontSize: 13.5, opacity: 0.55 }}>Cargando clientes…</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th><th>Plan</th><th>Programa actual</th><th>Última actualización</th><th style={{ textAlign: "right" }}>Rutina</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ImageSlot alt={c.nombre} shape="circle" style={{ width: 32, height: 32, flex: "none" }} initials={c.iniciales} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, opacity: 0.5 }}>{c.objetivo}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13.5, opacity: 0.75 }}>{c.plan}</td>
                <td><span className={`tag ${c.programaEstado ? "tag-accent" : "tag-outline"}`}>{c.programaActual}</span></td>
                <td style={{ fontSize: 13, opacity: 0.6 }}>{formatFecha(c.actualizadoEn)}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => vals.goFicha(c.id)} className="btn btn-secondary">Abrir ficha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificación manual**

```bash
npm run dev
```

Loguearse como `ADMIN` (`SEED_ADMIN_EMAIL`), navegar a `clientes` (una vez conectado en Task 17) y confirmar que la tabla lista los clientes reales del seed, que el buscador filtra por nombre/objetivo, y que "Abrir ficha" navega correctamente.

- [ ] **Step 3: Commit**

```bash
git add components/screens/Clientes.tsx
git commit -m "feat: pantalla de lista de clientes del panel de rutinas"
```

---

## Task 12: Pantalla `Ficha.tsx`

**Files:**
- Create: `components/screens/Ficha.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/clientes/:clienteId` (Task 4), `POST /api/coach/programas` (Task 2), `POST /api/coach/programas/:id/duplicar` (Task 6), `vals.fichaId`, `vals.goBuilder`, `vals.goClientes`.

**Nota de diseño (ajustada tras auditoría):** el README del handoff muestra en la ficha una lista de "Rutinas de `<nombre>`" que incluye programas en estado `En edición` (`BORRADOR`, sin asignar formalmente todavía). "Armar rutina" llama a `POST /api/coach/programas` pasando `clienteId: cliente.id` (Task 2 ya acepta ese campo y crea la `AsignacionPrograma` en el mismo paso) — así el programa recién creado aparece de inmediato en `cliente.asignaciones` con estado `En edición`, coincidiendo con el prototipo del handoff, en vez de quedar invisible hasta pasar por `/asignar`. `/asignar` (Task 7/15) sigue existiendo para sumar clientes adicionales al mismo programa después.

- [ ] **Step 1: Escribir el componente**

```tsx
// components/screens/Ficha.tsx
"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import ImageSlot from "@/components/ImageSlot";

interface AsignacionFicha {
  id: string;
  asignadoEn: string;
  programa: { id: string; nombre: string; semanas: number; frecuencia: string; objetivo: string; estado: string };
}

interface ClienteFicha {
  id: string;
  nombre: string;
  iniciales: string;
  objetivo: string;
  plan: string;
  frecuencia: string | null;
  nivel: string | null;
  whatsapp: string | null;
  notaMedica: string | null;
  createdAt: string;
  asignaciones: AsignacionFicha[];
}

const ESTADO_LABEL: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: "En edición", clase: "tag-outline" },
  ASIGNADO: { texto: "Asignado", clase: "tag-accent" },
  COMPLETADO: { texto: "Completado", clase: "tag-neutral" },
  ARCHIVADO: { texto: "Archivado", clase: "tag-neutral" },
};

export default function Ficha({ vals }: { vals: BetoVals }) {
  const [cliente, setCliente] = useState<ClienteFicha | null>(null);
  const [cumplimiento, setCumplimiento] = useState<{ semana: number; porcentaje: number }[]>([]);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!vals.fichaId) return;
    fetch(`/api/coach/clientes/${vals.fichaId}`)
      .then((r) => r.json())
      .then((data) => {
        setCliente(data.cliente ?? null);
        setCumplimiento(data.cumplimiento ?? []);
      });
  }, [vals.fichaId]);

  const armarRutina = async () => {
    setCreando(true);
    try {
      const res = await fetch("/api/coach/programas", {
        method: "POST",
        body: JSON.stringify({
          nombre: "Nuevo programa",
          objetivo: cliente?.objetivo ?? "",
          frecuencia: "5 días semanales",
          semanas: 4,
          clienteId: cliente?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) vals.goBuilder(data.programa.id);
    } finally {
      setCreando(false);
    }
  };

  const duplicarPrograma = async (programaId: string) => {
    const res = await fetch(`/api/coach/programas/${programaId}/duplicar`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      vals.showToast("Programa duplicado como borrador");
      vals.goBuilder(data.id);
    }
  };

  if (!cliente) {
    return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 72px", fontSize: 13.5, opacity: 0.55 }}>Cargando ficha…</div>;
  }

  return (
    <div style={{ padding: "32px 32px 72px" }}>
      <button onClick={vals.goClientes} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Clientes
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 28, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 86, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 20, borderRadius: 14, background: "var(--color-surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ImageSlot alt={cliente.nombre} shape="circle" style={{ width: 52, height: 52, flex: "none" }} initials={cliente.iniciales} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em" }}>{cliente.nombre}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>{cliente.plan} · desde {new Date(cliente.createdAt).toLocaleDateString("es-AR", { month: "2-digit", year: "numeric" })}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Objetivo</span><span>{cliente.objetivo}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Frecuencia</span><span>{cliente.frecuencia ?? "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Nivel</span><span>{cliente.nivel ?? "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>WhatsApp</span><span>{cliente.whatsapp ?? "—"}</span></div>
            </div>
            {cliente.notaMedica && (
              <div style={{ marginTop: 16, padding: 13, borderRadius: 10, border: "1px dashed var(--color-neutral-700)", fontSize: 12.5, opacity: 0.8 }}>
                <b>Nota médica:</b> {cliente.notaMedica}
              </div>
            )}
          </div>
          <button onClick={armarRutina} disabled={creando} className="btn btn-primary btn-block">
            <i className="ph ph-squares-four" /> {creando ? "Creando…" : "Armar rutina"}
          </button>
        </div>

        <div>
          <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Rutinas de {cliente.nombre.split(" ")[0]}</h2>
          <p style={{ fontSize: 13.5, opacity: 0.6, margin: "0 0 18px" }}>
            Cada programa es un mesociclo de semanas configurables. Duplicalo para arrancar el siguiente bloque sin reescribir nada.
          </p>

          {cliente.asignaciones.length === 0 && (
            <div style={{ fontSize: 13.5, opacity: 0.55, marginBottom: 24 }}>Todavía no le asignaste ningún programa.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
            {cliente.asignaciones.map((a, i) => {
              const estado = ESTADO_LABEL[a.programa.estado] ?? ESTADO_LABEL.BORRADOR;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", borderRadius: 14, background: "var(--color-surface)" }}>
                  <div style={{ width: 46, textAlign: "center", flex: "none" }}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", opacity: 0.5 }}>Bloque</div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 24 }}>{cliente.asignaciones.length - 1 - i}</div>
                  </div>
                  <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-divider)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{a.programa.nombre}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.55 }}>{a.programa.semanas} semanas · {a.programa.frecuencia} · objetivo {a.programa.objetivo}</div>
                  </div>
                  <span className={`tag ${estado.clase}`}>{estado.texto}</span>
                  <button onClick={() => vals.goBuilder(a.programa.id)} className="btn btn-secondary">Editar</button>
                  <button onClick={() => { vals.setTemaPdfSel("clean"); vals.setProgramaIdActivo(a.programa.id); vals.goPdf(); }} className="btn btn-ghost">Ver PDF</button>
                  <button onClick={() => duplicarPrograma(a.programa.id)} className="btn btn-ghost" title="Duplicar como plantilla">
                    <i className="ph ph-copy" />
                  </button>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Cumplimiento de las últimas 4 semanas</h3>
          {cumplimiento.length === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55 }}>Sin datos de cumplimiento todavía.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, padding: 16, borderRadius: 14, background: "var(--color-surface)" }}>
              {cumplimiento.map((c) => (
                <div key={c.semana} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>{c.porcentaje}%</div>
                  <div style={{ width: "100%", height: `${c.porcentaje}%`, background: "var(--color-accent)", borderRadius: "5px 5px 0 0" }} />
                  <div style={{ fontSize: 11, opacity: 0.5 }}>S{c.semana}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/screens/Ficha.tsx
git commit -m "feat: pantalla de ficha del cliente con programas y cumplimiento"
```

---

## Task 13: Pantalla `Builder.tsx` — tablero kanban con drag-and-drop

**Files:**
- Create: `lib/rutinas/dias.ts`
- Create: `components/coach/TarjetaBloque.tsx`
- Create: `components/coach/ColumnaDia.tsx`
- Create: `components/screens/Builder.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/programas/:id` (Task 4), `PATCH /api/coach/dias/:diaId/reordenar` (Task 5), `PATCH /api/coach/dias/:diaId` (Task 2), `POST /api/coach/programas/:id/semanas` (Task 2), `POST /api/coach/dias/:diaId/duplicar` (Task 6), `vals.abrirEditor`, `vals.semanaSel`, `vals.setSemanaSel`, `vals.programaIdActivo`, `vals.goAsignar`.

**Nota de criterio (para auditar):** el widget "Volumen semanal" del handoff incluye una fila "Trabajo en carrera" (p. ej. "0,8 km") que asume un campo de distancia por bloque. El modelo de datos del spec §4 no tiene ese campo (`Bloque` no registra distancia) — inventarlo ahora sería modificar el modelo de datos ya cerrado en el spec. Este plan muestra esa fila como "—" con una nota de que el dato no está disponible en el modelo actual, en vez de simular un número.

- [ ] **Step 1: Escribir el helper de mapeo de días (el modelo guarda `diaSemana` 0=domingo..6=sábado; el builder se muestra Lunes→Domingo)**

```typescript
// lib/rutinas/dias.ts
export const NOMBRES_DIA: Record<number, string> = {
  0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado",
};

export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
```

- [ ] **Step 2: Escribir la tarjeta de bloque arrastrable**

```tsx
// components/coach/TarjetaBloque.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BloqueApi } from "@/lib/types";

const TIPO_CLASE: Record<BloqueApi["tipo"], string> = {
  TRADICIONAL: "tag-accent",
  SECUENCIA: "tag-accent-2",
  SUPERSERIE: "tag-neutral",
  EMOM: "tag-outline",
  POR_TIEMPO: "tag-outline",
};

const TIPO_LABEL: Record<BloqueApi["tipo"], string> = {
  TRADICIONAL: "Tradicional",
  SECUENCIA: "Secuencia",
  SUPERSERIE: "Superserie",
  EMOM: "EMOM",
  POR_TIEMPO: "Por tiempo",
};

const FOCO_COLOR: Record<BloqueApi["foco"], string> = {
  TECNICA: "var(--color-accent-400)",
  RITMO: "var(--color-accent-2-400)",
  MAXIMO_ESFUERZO: "var(--color-neutral-200)",
};

const FOCO_LABEL: Record<BloqueApi["foco"], string> = {
  TECNICA: "Técnica",
  RITMO: "Ritmo",
  MAXIMO_ESFUERZO: "Máximo esfuerzo",
};

export default function TarjetaBloque({ bloque, onAbrir }: { bloque: BloqueApi; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloque.id,
    data: { diaId: bloque.diaId },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--color-surface)",
        borderLeft: "2px solid var(--color-accent-800)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 4, gap: 7 }}>
        <span className={`tag ${TIPO_CLASE[bloque.tipo]}`} style={{ padding: "1px 7px", whiteSpace: "nowrap" }}>{TIPO_LABEL[bloque.tipo]}</span>
        {bloque.meta && <span style={{ fontSize: 10.5, opacity: 0.4 }}>{bloque.meta}</span>}
        <span style={{ marginLeft: "auto", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: FOCO_COLOR[bloque.foco] }}>
          {FOCO_LABEL[bloque.foco]}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 4 }}>{bloque.titulo}</div>
      <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.35 }}>{bloque.detalle}</div>
    </div>
  );
}
```

- [ ] **Step 3: Escribir la columna de día (zona soltable + lista ordenable)**

```tsx
// components/coach/ColumnaDia.tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DiaProgramaApi } from "@/lib/types";
import { NOMBRES_DIA } from "@/lib/rutinas/dias";
import TarjetaBloque from "./TarjetaBloque";

export default function ColumnaDia({
  dia,
  onAbrirEditor,
  onConvertirEntrenable,
  onCambiarCalentamiento,
}: {
  dia: DiaProgramaApi;
  onAbrirEditor: (diaId: string, bloqueId: string | null) => void;
  onConvertirEntrenable: (diaId: string) => void;
  onCambiarCalentamiento: (diaId: string, valor: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: dia.id, data: { esColumna: true } });

  if (dia.descanso) {
    return (
      <div style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "#1b1d2c", padding: 14, minHeight: 300, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{NOMBRES_DIA[dia.diaSemana]}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-surface)", display: "grid", placeItems: "center" }}>
            <i className="ph ph-moon" style={{ fontSize: 22, color: "var(--color-accent)" }} />
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.7 }}>Día de Descanso</div>
          <button onClick={() => onConvertirEntrenable(dia.id)} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <i className="ph ph-plus-circle" /> Convertir a entrenamiento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "#1b1d2c", padding: 14, minHeight: 300, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{NOMBRES_DIA[dia.diaSemana]}</div>
        <div style={{ fontSize: 11, opacity: 0.4 }}>{dia.bloques.length > 0 ? `${dia.bloques.length} bloques` : "Sin cargar"}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.45, marginBottom: 4 }}>Calentamiento</div>
        <textarea
          className="input"
          style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9, minHeight: 44 }}
          defaultValue={dia.calentamiento ?? ""}
          placeholder="Texto libre"
          onBlur={(e) => onCambiarCalentamiento(dia.id, e.target.value)}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.45, marginBottom: 4 }}>Entrenamiento</div>
        <SortableContext items={dia.bloques.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dia.bloques.map((b) => (
              <TarjetaBloque key={b.id} bloque={b} onAbrir={() => onAbrirEditor(dia.id, b.id)} />
            ))}
          </div>
        </SortableContext>
        <button
          onClick={() => onAbrirEditor(dia.id, null)}
          style={{ marginTop: 8, width: "100%", height: 30, border: "1px dashed var(--color-divider)", borderRadius: 10, background: "transparent", color: "rgba(233,233,237,.45)", cursor: "pointer" }}
        >
          +
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Escribir `Builder.tsx`**

```tsx
// components/screens/Builder.tsx
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

      setPrograma((p) => p && {
        ...p,
        dias: p.dias.map((d) => (d.id === diaOrigenId ? { ...d, bloques: nuevoOrden.map((id) => d.bloques.find((b) => b.id === id)!) } : d)),
      });

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
```

Nota sobre el Step 4: `onDragEnd` recalcula el orden localmente antes de llamar al servidor (respuesta visual inmediata al soltar) solo para el caso de reordenar dentro del mismo día; para el caso de mover entre días, se recarga (`cargar()`) tras la respuesta del servidor en vez de reconciliar el estado a mano — es más simple y menos propenso a errores de sincronización que mantener dos fuentes de verdad del `orden` durante un movimiento entre columnas.

- [ ] **Step 5: Verificación manual**

```bash
npm run dev
```

Crear un programa, agregarle 2 bloques al mismo día (Task 14 agrega el editor que los crea), arrastrar uno sobre el otro dentro del mismo día y confirmar que el orden persiste al recargar la página. Arrastrar un bloque a otro día y confirmar lo mismo. Confirmar que "Tab" + flechas del teclado también permiten reordenar (activación por teclado de `@dnd-kit`, spec §6).

- [ ] **Step 6: Commit**

```bash
git add lib/rutinas/dias.ts components/coach components/screens/Builder.tsx
git commit -m "feat: constructor de bloques con drag-and-drop y volumen semanal"
```

---

## Task 14: Overlay `EditorEjercicio.tsx`

**Files:**
- Create: `components/screens/EditorEjercicio.tsx`

**Interfaces:**
- Consumes: `POST /api/coach/dias/:diaId/bloques` (Task 3, creación), `PATCH`/`DELETE /api/coach/bloques/:bloqueId` (Task 3, edición/borrado), `pctParaSemana`/`repsParaSemana` (Task 2), `vals.editorDiaId`, `vals.editorBloqueId`, `vals.cerrarEditor`.

**Nota de criterio (para auditar):** en creación, `POST /api/coach/dias/:diaId/bloques` (Task 3) solo acepta `seriesBase`/`descansoBase` como entrada — `reps`/`pct` de la semana 1 siempre salen de la progresión estándar (`repsParaSemana(1)` = 6, `pctParaSemana(1)` = 70, que además coinciden con los valores demo del handoff). Por eso los campos "Repeticiones" y "Carga" del editor son de solo lectura al crear un bloque nuevo — reflejan lo que va a quedar guardado, no piden un valor editable en este paso. Una vez creado el bloque, cualquier fila de la tabla (incluida la semana 1) es editable vía `PATCH` con la tabla completa de sobrecarga.

- [ ] **Step 1: Escribir el componente**

```tsx
// components/screens/EditorEjercicio.tsx
"use client";

import { useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ProgramaApi, BloqueApi, FocoBloque, TipoBloque } from "@/lib/types";
import { pctParaSemana, repsParaSemana } from "@/lib/rutinas/progresion";

const TIPOS: { valor: TipoBloque; label: string }[] = [
  { valor: "TRADICIONAL", label: "Tradicional" },
  { valor: "SECUENCIA", label: "Secuencia" },
  { valor: "SUPERSERIE", label: "Superserie" },
  { valor: "EMOM", label: "EMOM" },
  { valor: "POR_TIEMPO", label: "Por tiempo" },
];

const FOCOS: { valor: FocoBloque; label: string }[] = [
  { valor: "TECNICA", label: "Técnica" },
  { valor: "RITMO", label: "Ritmo" },
  { valor: "MAXIMO_ESFUERZO", label: "Máximo esfuerzo" },
];

export default function EditorEjercicio({
  vals,
  programa,
  onGuardado,
}: {
  vals: BetoVals;
  programa: ProgramaApi;
  onGuardado: () => void;
}) {
  const bloqueExistente: BloqueApi | undefined = programa.dias
    .flatMap((d) => d.bloques)
    .find((b) => b.id === vals.editorBloqueId);

  const [tipo, setTipo] = useState<TipoBloque>(bloqueExistente?.tipo ?? "TRADICIONAL");
  const [foco, setFoco] = useState<FocoBloque>(bloqueExistente?.foco ?? "TECNICA");
  const [titulo, setTitulo] = useState(bloqueExistente?.titulo ?? "");
  const [detalle, setDetalle] = useState(bloqueExistente?.detalle ?? "");
  const [meta, setMeta] = useState(bloqueExistente?.meta ?? "");
  const [seriesBase, setSeriesBase] = useState(bloqueExistente?.sobrecarga[0]?.series ?? 4);
  const [descansoBase, setDescansoBase] = useState(bloqueExistente?.sobrecarga[0]?.descanso ?? "02:00");
  const [sobrecarga, setSobrecarga] = useState(bloqueExistente?.sobrecarga ?? []);
  const [guardando, setGuardando] = useState(false);

  const actualizarFila = (semana: number, campo: "series" | "reps" | "pct" | "descanso", valor: string) => {
    setSobrecarga((filas) =>
      filas.map((f) => (f.semana === semana ? { ...f, [campo]: campo === "descanso" ? valor : Number(valor) } : f)),
    );
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      if (bloqueExistente) {
        await fetch(`/api/coach/bloques/${bloqueExistente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || null, sobrecarga }),
        });
      } else if (vals.editorDiaId) {
        await fetch(`/api/coach/dias/${vals.editorDiaId}/bloques`, {
          method: "POST",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || undefined, seriesBase, descansoBase }),
        });
      }
      vals.showToast("Bloque guardado con su sobrecarga");
      vals.cerrarEditor();
      onGuardado();
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!bloqueExistente) return;
    await fetch(`/api/coach/bloques/${bloqueExistente.id}`, { method: "DELETE" });
    vals.cerrarEditor();
    onGuardado();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 24, background: "rgba(22,24,38,.72)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "min(860px,100%)", maxHeight: "88vh", overflow: "auto", borderRadius: 16, background: "#1b1d2c", boxShadow: "0 0 0 1px #3f424d, 0 16px 40px rgba(0,0,0,.65)", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="tag tag-outline">Por series</span>
          <button className="btn btn-secondary" disabled title="Próximamente">
            <i className="ph ph-book-open" /> Guía de ejecución
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <button onClick={vals.cerrarEditor} className="btn btn-ghost"><i className="ph ph-arrow-left" /></button>
          <select className="input" style={{ width: "auto" }} value={tipo} onChange={(e) => setTipo(e.target.value as TipoBloque)}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {FOCOS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFoco(f.valor)}
                style={{
                  padding: "7px 14px", borderRadius: 99, fontSize: 13, cursor: "pointer",
                  border: `1px solid ${foco === f.valor ? "var(--color-accent)" : "var(--color-divider)"}`,
                  background: foco === f.valor ? "rgba(145,132,217,.16)" : "transparent",
                  color: foco === f.valor ? "var(--color-accent-300)" : "var(--color-text)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <input
          className="input"
          style={{ maxWidth: 420, minHeight: 42, fontSize: 15, margin: "0 auto 8px", display: "block", textAlign: "center" }}
          placeholder="Nombre del ejercicio"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <input
          className="input"
          style={{ maxWidth: 420, margin: "0 auto 16px", display: "block", textAlign: "center" }}
          placeholder="Detalle (p. ej. 5 × 3 · @ 80% 1RM)"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-stack" /> Series</div>
            <input
              type="number" min={1}
              value={seriesBase}
              onChange={(e) => setSeriesBase(Number(e.target.value))}
              disabled={!!bloqueExistente}
              style={{ width: "100%", textAlign: "center", fontSize: 22, fontWeight: 500, background: "transparent", border: 0, color: "var(--color-text)" }}
            />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por ejercicio</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-repeat" /> Repeticiones</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{repsParaSemana(1)}</div>
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por serie</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-trend-up" /> Carga</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{pctParaSemana(1)}</div>
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>%1RM · progresiva</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-timer" /> Descanso</div>
            <input
              value={descansoBase}
              onChange={(e) => setDescansoBase(e.target.value)}
              disabled={!!bloqueExistente}
              style={{ width: "100%", textAlign: "center", fontSize: 22, fontWeight: 500, background: "transparent", border: 0, color: "var(--color-text)" }}
            />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>entre series</div>
          </div>
        </div>

        {bloqueExistente && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: "var(--color-accent)" }}><i className="ph ph-trend-up" /> Sobrecarga</span>
              <span className="tag tag-accent">Intensidad</span>
            </div>
            <table className="table">
              <thead>
                <tr><th>Semana</th><th style={{ textAlign: "center" }}>Series</th><th style={{ textAlign: "center" }}>Reps</th><th style={{ textAlign: "center" }}>%1RM</th><th style={{ textAlign: "center" }}>Descanso</th></tr>
              </thead>
              <tbody>
                {sobrecarga.map((f) => (
                  <tr key={f.semana}>
                    <td>{f.semana}</td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.series} onChange={(e) => actualizarFila(f.semana, "series", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.reps} onChange={(e) => actualizarFila(f.semana, "reps", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.pct} onChange={(e) => actualizarFila(f.semana, "pct", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input className="input" style={{ width: 70, textAlign: "center" }} value={f.descanso} onChange={(e) => actualizarFila(f.semana, "descanso", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p style={{ fontSize: 11.5, opacity: 0.45, margin: "16px 0" }}>La progresión se programa una vez y se aplica a todo el bloque.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {bloqueExistente && <button onClick={borrar} className="btn btn-ghost">Borrar bloque</button>}
          <button onClick={vals.cerrarEditor} className="btn btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !titulo || !detalle} className="btn btn-primary">
            <i className="ph ph-check" /> Guardar bloque
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificación manual**

```bash
npm run dev
```

Abrir el builder, hacer clic en el "+" de un día para crear un bloque, confirmar que se guarda y aparece la tarjeta. Volver a abrirlo (clic en la tarjeta) y confirmar que ahora se ve la tabla de sobrecarga completa y es editable fila por fila. Confirmar que "Guía de ejecución" está deshabilitado y muestra el tooltip "Próximamente" al pasar el mouse.

- [ ] **Step 3: Commit**

```bash
git add components/screens/EditorEjercicio.tsx
git commit -m "feat: editor de ejercicio con tabla de sobrecarga editable"
```

---

## Task 15: Pantalla `Asignar.tsx`

**Files:**
- Create: `components/screens/Asignar.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/clientes` (Task 4), `GET /api/coach/programas/:id` (Task 4), `POST /api/coach/programas/:id/asignar` (Task 7), `vals.programaIdActivo`, `vals.asignadosSel`, `vals.toggleAsignado`, `vals.goPdf`.

- [ ] **Step 1: Escribir el componente**

```tsx
// components/screens/Asignar.tsx
"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi, ProgramaApi } from "@/lib/types";
import ImageSlot from "@/components/ImageSlot";

export default function Asignar({ vals }: { vals: BetoVals }) {
  const [clientes, setClientes] = useState<ClienteFilaApi[]>([]);
  const [programa, setPrograma] = useState<ProgramaApi | null>(null);
  const [mensaje, setMensaje] = useState("Arrancamos el bloque nuevo. Cualquier duda me escribís.");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/coach/clientes").then((r) => r.json()).then((d) => setClientes(d.clientes ?? []));
    if (vals.programaIdActivo) {
      fetch(`/api/coach/programas/${vals.programaIdActivo}`).then((r) => r.json()).then((d) => setPrograma(d.programa ?? null));
    }
  }, [vals.programaIdActivo]);

  const seleccionados = clientes.filter((c) => vals.asignadosSel[c.id]);
  const todosSeleccionados = clientes.length > 0 && seleccionados.length === clientes.length;

  const alternarTodos = () => {
    clientes.forEach((c) => {
      if (todosSeleccionados ? vals.asignadosSel[c.id] : !vals.asignadosSel[c.id]) {
        vals.toggleAsignado(c.id);
      }
    });
  };

  const asignar = async () => {
    if (!vals.programaIdActivo || seleccionados.length === 0) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}/asignar`, {
        method: "POST",
        body: JSON.stringify({ clienteIds: seleccionados.map((c) => c.id), mensajePersonalizado: mensaje, temaPdf: vals.temaPdfSel }),
      });
      if (res.ok) {
        const data = await res.json();
        vals.showToast(`Programa asignado a ${data.asignados} clientes`);
        vals.goPdf();
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ padding: "32px 32px 72px" }}>
      <button onClick={() => vals.programaIdActivo && vals.goBuilder(vals.programaIdActivo)} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Volver al constructor
      </button>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Asignar «{programa?.nombre ?? "…"}»</h1>
      <p style={{ fontSize: 13.5, opacity: 0.6, margin: "0 0 24px" }}>
        El mismo programa a varios clientes, sin reescribirlo. Cada uno lo ve en su cuenta y lo recibe en PDF.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, letterSpacing: "-0.02em", margin: 0 }}>Elegí a quién se lo asignás</h3>
            <button onClick={alternarTodos} className="btn btn-ghost">{todosSeleccionados ? "Deseleccionar todos" : "Seleccionar todos"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientes.map((c) => {
              const on = !!vals.asignadosSel[c.id];
              return (
                <div
                  key={c.id}
                  onClick={() => vals.toggleAsignado(c.id)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12, background: "var(--color-surface)", border: `1px solid ${on ? "var(--color-accent)" : "transparent"}` }}
                >
                  <span style={{ width: 22, height: 22, flex: "none", borderRadius: 6, border: "1.5px solid var(--color-divider)", background: on ? "var(--color-accent)" : "transparent", display: "grid", placeItems: "center" }}>
                    {on && <i className="ph ph-check" style={{ fontSize: 13, color: "#161826" }} />}
                  </span>
                  <ImageSlot alt={c.nombre} shape="circle" style={{ width: 32, height: 32, flex: "none" }} initials={c.iniciales} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, opacity: 0.55 }}>{c.objetivo}</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.45 }}>{c.plan}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: "sticky", top: 86, padding: 20, borderRadius: 14, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>Resumen</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Programa</span><span>{programa?.nombre ?? "…"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Duración</span><span>{programa?.semanas ?? "—"} semanas</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Asignados</span><span>{seleccionados.length} clientes</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Marca del PDF</span><span>Beto Training</span></div>
          </div>
          <div className="field">
            <label>Mensaje para tus clientes</label>
            <textarea className="input" style={{ minHeight: 80 }} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </div>
          <button onClick={asignar} disabled={enviando || seleccionados.length === 0} className="btn btn-primary btn-block">
            {seleccionados.length === 0 ? "Elegí al menos un cliente" : `Asignar a ${seleccionados.length} clientes`}
          </button>
          <p style={{ fontSize: 11.5, opacity: 0.45, margin: 0 }}>Queda visible en «Mi rutina» de cada cliente y se genera el PDF con tu marca.</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/screens/Asignar.tsx
git commit -m "feat: pantalla de asignacion masiva de programas"
```

---

## Task 16: Pantalla `ExportPdf.tsx`

**Files:**
- Create: `components/screens/ExportPdf.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/programas/:id/pdf?tema=` (Task 9), `vals.programaIdActivo`, `vals.temaPdfSel`, `vals.setTemaPdfSel`, `vals.goFicha`, `vals.goBuilder`, `vals.goCuenta`.

- [ ] **Step 1: Escribir el componente**

```tsx
// components/screens/ExportPdf.tsx
"use client";

import type { BetoVals } from "@/hooks/useBetoApp";
import type { TemaPdf } from "@/lib/types";

const TEMAS: { id: TemaPdf; nombre: string; sub: string; icono: string; fondo: string; texto: string; acento: string }[] = [
  { id: "clean", nombre: "Clean Design", sub: "Claro", icono: "ph-file-text", fondo: "#ffffff", texto: "#1b2320", acento: "#1f4d3a" },
  { id: "night", nombre: "Night Design", sub: "Noche", icono: "ph-palette", fondo: "#0e1726", texto: "#e6ecf6", acento: "#7aa2f7" },
  { id: "pink", nombre: "Pink Gold", sub: "Rosa y oro", icono: "ph-sparkle", fondo: "#fffaf7", texto: "#2a1620", acento: "#8c1d3f" },
];

export default function ExportPdf({ vals }: { vals: BetoVals }) {
  const descargar = () => {
    if (!vals.programaIdActivo) return;
    window.location.href = `/api/coach/programas/${vals.programaIdActivo}/pdf?tema=${vals.temaPdfSel}`;
    vals.showToast("PDF generado con la marca de Beto Training");
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
              style={{ cursor: "pointer", padding: 18, borderRadius: 14, border: `1px solid ${elegido ? "var(--color-accent)" : "var(--color-divider)"}`, background: "#1b1d2c", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: "100%", maxWidth: 280, borderRadius: 14, padding: 16, fontSize: 11, background: t.fondo, color: t.texto }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.acento, color: t.fondo, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>B</div>
                  <div style={{ fontSize: 10 }}>Beto Training</div>
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
```

- [ ] **Step 2: Verificación manual**

```bash
npm run dev
```

Elegir cada uno de los 3 temas y confirmar el toast "Tema `<nombre>` seleccionado". Hacer clic en "Descargar PDF" y confirmar que se descarga un PDF con la paleta del tema elegido (mismo archivo verificado manualmente en Task 9).

- [ ] **Step 3: Commit**

```bash
git add components/screens/ExportPdf.tsx
git commit -m "feat: pantalla de exportacion de pdf con seleccion de tema"
```

---

## Task 17: Migración de `Coach.tsx`, `Cuenta.tsx` y wiring en `BetoTrainingApp.tsx`

**Files:**
- Modify: `hooks/useBetoApp.ts` (copy del KPI)
- Modify: `components/screens/Coach.tsx`
- Modify: `components/screens/Cuenta.tsx`
- Modify: `components/BetoTrainingApp.tsx`

**Interfaces:**
- Consumes: `GET /api/coach/clientes` (Task 4, para resolver el id real de cada tarjeta de "Clientes que necesitan atención"), `GET /api/cuenta/mi-rutina` (Task 8), `POST /api/cuenta/mi-rutina/completar` (Task 8).

**Nota de criterio (para auditar):** el mock de `vals.clientes` en `useBetoApp.ts` (usado por las tarjetas de "Clientes que necesitan atención") no tiene `id` real — sus "motivo"/"cta" son datos de Booking+Pagos (bonos, faltas), fuera de alcance de este spec, así que este plan no los reemplaza por datos reales. Para cumplir el punto explícito de la migración ("las tarjetas navegan a la ficha del cliente correspondiente") sin inventar un campo que no existe, `Coach.tsx` resuelve el `clienteId` real haciendo *match* por nombre contra `GET /api/coach/clientes` (los nombres del mock ya coinciden con los clientes reales del seed). Si algún nombre no matchea a futuro (mock desactualizado), el botón queda sin acción en vez de navegar a una ficha incorrecta.

- [ ] **Step 1: Cambiar el copy del KPI en `hooks/useBetoApp.ts` (reemplaza la última entrada de `coachKpis`)**

```typescript
// hooks/useBetoApp.ts (dentro del array coachKpis existente, reemplaza solo la última entrada)
coachKpis: [
  { k: "Ingresos del mes", v: money(1840000), d: "+18% vs julio" },
  { k: "Clases esta semana", v: "23", d: "86% de ocupación" },
  { k: "Clientes activos", v: "61", d: "+4 nuevos" },
  { k: "Rutinas sin actualizar", v: "7", d: "Conviene revisarlas" },
],
```

- [ ] **Step 2: Actualizar `components/screens/Coach.tsx` — botón "Constructor de rutinas" + navegación real de las tarjetas de clientes**

```tsx
// components/screens/Coach.tsx (reemplaza el archivo completo)
"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi } from "@/lib/types";

export default function Coach({ vals }: { vals: BetoVals }) {
  const [clientesReales, setClientesReales] = useState<ClienteFilaApi[]>([]);

  useEffect(() => {
    fetch("/api/coach/clientes").then((r) => r.json()).then((d) => setClientesReales(d.clientes ?? []));
  }, []);

  const idPorNombre = (nombre: string) => clientesReales.find((c) => c.nombre === nombre)?.id ?? null;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Modo entrenador</div>
          <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Panel de Beto</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={vals.goClientes} className="btn btn-primary"><i className="ph ph-squares-four" /> Constructor de rutinas</button>
          <button onClick={vals.goCuenta} className="btn btn-secondary">Volver a la vista cliente</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {vals.coachKpis.map((k) => (
          <div key={k.k} style={{ padding: 18, borderRadius: 14, background: "var(--color-surface)" }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", opacity: .5 }}>{k.k}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: "-0.03em", marginTop: 6 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "var(--color-accent-300)", marginTop: 3 }}>{k.d}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 24, marginTop: 28, alignItems: "start" }}>
        <div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Agenda de hoy · lunes 17</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vals.agenda.map((a) => (
              <div key={a.hora} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--color-surface)", borderLeft: `2px solid ${a.marca}` }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 17, width: 52, flex: "none" }}>{a.hora}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{a.clase}</div>
                  <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{a.gente}</div>
                </div>
                <span className={`tag ${a.tagClass}`}>{a.estado}</span>
                <button className="btn btn-ghost">Ver lista</button>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>Ocupación de la semana</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, padding: 16, borderRadius: 14, background: "var(--color-surface)" }}>
            {vals.barras.map((b) => (
              <div key={b.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 11, opacity: .55 }}>{b.pct}</div>
                <div style={{ width: "100%", height: b.h, background: b.color, borderRadius: "5px 5px 0 0" }} />
                <div style={{ fontSize: 11, opacity: .5 }}>{b.dia}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Clientes que necesitan atención</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vals.clientes.map((c) => {
              const clienteId = idPorNombre(c.nombre);
              return (
                <div key={c.nombre} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", borderRadius: 12, background: "var(--color-surface)" }}>
                  <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: "var(--color-accent-800)", color: "var(--color-accent-100)", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 500 }}>{c.ini}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, opacity: .55 }}>{c.motivo}</div>
                  </div>
                  <button
                    onClick={() => clienteId && vals.goFicha(clienteId)}
                    disabled={!clienteId}
                    className="btn btn-secondary"
                  >
                    {c.cta}
                  </button>
                </div>
              );
            })}
          </div>
          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>Últimos pagos</h3>
          <table className="table">
            <thead><tr><th>Cliente</th><th>Concepto</th><th style={{ textAlign: "right" }}>Importe</th></tr></thead>
            <tbody>
              {vals.pagosCoach.map((p) => (
                <tr key={p.cliente}><td>{p.cliente}</td><td>{p.concepto}</td><td style={{ textAlign: "right" }}>{p.importe}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar el bloque `tabRutina` de `components/screens/Cuenta.tsx` (líneas 113-140 del archivo actual) por la vista real conectada a `GET /api/cuenta/mi-rutina`**

Primero, agregar el estado y el `useEffect` de carga junto a los demás `useState` ya existentes al inicio del componente:

```typescript
// components/screens/Cuenta.tsx (agregar junto a los useState existentes, dentro del componente)
interface FilaSobrecargaVista { semana: number; series: number; reps: number; pct: number; descanso: string; }
interface BloqueVista { id: string; tipo: string; foco: string; titulo: string; detalle: string; meta: string | null; sobrecarga: FilaSobrecargaVista[]; }
interface DiaVista { id: string; diaSemana: number; descanso: boolean; calentamiento: string | null; bloques: BloqueVista[]; }
interface AsignacionVista { id: string; asignadoEn: string; programa: { nombre: string; semanas: number; dias: DiaVista[] } } 

const NOMBRES_DIA: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const [miRutina, setMiRutina] = useState<AsignacionVista | null>(null);
const [completados, setCompletados] = useState<Record<string, boolean>>({});

useEffect(() => {
  fetch("/api/cuenta/mi-rutina")
    .then((r) => r.json())
    .then((data) => setMiRutina(data.asignacion ?? null));
}, []);

const marcarHecho = async (bloqueId: string, semana: number) => {
  const clave = `${bloqueId}-${semana}`;
  setCompletados((c) => ({ ...c, [clave]: true }));
  await fetch("/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId, semana }) });
};
```

Ahora, reemplazar el bloque `{vals.tabRutina && (...)}` completo por:

```tsx
{vals.tabRutina && (
  <div>
    {!miRutina ? (
      <div>
        <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Mi rutina</h2>
        <p style={{ fontSize: 13.5, opacity: .6 }}>Todavía no tenés un programa asignado. Cuando Beto te asigne uno, vas a verlo acá.</p>
      </div>
    ) : (() => {
      const dias = ORDEN_SEMANA.map((ds) => miRutina.programa.dias.find((d) => d.diaSemana === ds)).filter((d): d is DiaVista => !!d && !d.descanso);
      const diaActivo = dias[vals.diaClienteSel] ?? dias[0];
      const msPorSemana = 7 * 24 * 60 * 60 * 1000;
      const semanasTranscurridas = Math.floor((Date.now() - new Date(miRutina.asignadoEn).getTime()) / msPorSemana);
      const semanaActual = Math.min(Math.max(semanasTranscurridas + 1, 1), miRutina.programa.semanas);
      return (
        <div>
          <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Mi rutina</h2>
          <p style={{ fontSize: 13.5, opacity: .6, margin: "0 0 18px" }}>
            {miRutina.programa.nombre} · {miRutina.programa.semanas} semanas · asignada por Beto el {new Date(miRutina.asignadoEn).toLocaleDateString("es-AR")}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {dias.map((d, i) => {
              const on = vals.diaClienteSel === i;
              return (
                <button
                  key={d.id}
                  onClick={() => vals.setDiaClienteSel(i)}
                  style={{ cursor: "pointer", fontSize: 13, padding: "9px 15px", borderRadius: 99, border: `1px solid ${on ? "var(--color-accent)" : "var(--color-divider)"}`, background: on ? "rgba(145,132,217,.16)" : "transparent", color: on ? "#d2cefd" : "#e9e9ed" }}
                >
                  {NOMBRES_DIA[d.diaSemana]}
                </button>
              );
            })}
          </div>

          {diaActivo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
              {diaActivo.calentamiento && (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--color-surface)" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", opacity: .45 }}>Calentamiento</div>
                  <div style={{ fontSize: 13.5, opacity: .8, marginTop: 4 }}>{diaActivo.calentamiento}</div>
                </div>
              )}
              {diaActivo.bloques.map((b, i) => {
                const fila = b.sobrecarga.find((f) => f.semana === semanaActual);
                const hecho = !!completados[`${b.id}-${semanaActual}`];
                return (
                  <div key={b.id} style={{ padding: "16px 18px", borderRadius: 12, background: "var(--color-surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--color-accent-800)", color: "var(--color-accent-100)", display: "grid", placeItems: "center", fontSize: 11.5 }}>{i + 1}</span>
                      <span className="tag tag-accent">{b.tipo}</span>
                      {b.meta && <span style={{ fontSize: 10.5, opacity: .4 }}>{b.meta}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 9.5, textTransform: "uppercase", opacity: .5 }}>{b.foco}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{b.titulo}</div>
                    <div style={{ fontSize: 13, opacity: .6, marginBottom: 10 }}>{b.detalle}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { label: "Series", valor: b.tipo === "TRADICIONAL" ? String(fila?.series ?? "—") : "—" },
                        { label: "Rep", valor: b.tipo === "TRADICIONAL" ? String(fila?.reps ?? "—") : "—" },
                        { label: "Carga", valor: b.tipo === "TRADICIONAL" ? `${fila?.pct ?? "—"}%` : "RPE 8" },
                        { label: "Descanso", valor: fila?.descanso ?? "—" },
                      ].map((campo) => (
                        <div key={campo.label} style={{ padding: 9, borderRadius: 10, border: "1px solid rgba(233,233,237,.12)", textAlign: "center" }}>
                          <div style={{ fontSize: 10, textTransform: "uppercase", opacity: .45 }}>{campo.label}</div>
                          <div style={{ fontSize: 15 }}>{campo.valor}</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => marcarHecho(b.id, semanaActual)}
                      disabled={hecho}
                      className="btn btn-ghost"
                      style={{ marginTop: 10 }}
                    >
                      <i className="ph ph-check-circle" /> {hecho ? "Hecho" : "Marcar como hecho"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, padding: 15, borderRadius: 12, border: "1px dashed var(--color-neutral-700)", fontSize: 13, lineHeight: 1.5, opacity: .78, maxWidth: 720 }}>
            <b>Nota de Beto:</b> si una serie te sale con técnica pobre, quedate en la carga de la semana anterior: la progresión es una guía, no una obligación.
          </div>
        </div>
      );
    })()}
  </div>
)}
```

Nota (ajuste post-revisión, corrige la discrepancia #6 del self-review): `semanaActual` se calcula desde `AsignacionPrograma.asignadoEn` — semanas completas transcurridas desde la asignación, acotado entre `1` y `programa.semanas` (para que un programa vencido no muestre una semana fuera de rango ni una fecha futura muestre 0). Es un cálculo simple por diseño: no contempla pausas ni reprogramaciones manuales del mesociclo, que quedan fuera de alcance de este spec.

- [ ] **Step 4: Wirear las pantallas nuevas en `components/BetoTrainingApp.tsx`**

```tsx
// components/BetoTrainingApp.tsx (reemplaza el archivo completo)
"use client";

import { useBetoApp } from "@/hooks/useBetoApp";
import Header from "@/components/Header";
import ToastBar from "@/components/ToastBar";
import Landing from "@/components/screens/Landing";
import Reservar from "@/components/screens/Reservar";
import Checkout from "@/components/screens/Checkout";
import Confirm from "@/components/screens/Confirm";
import Login from "@/components/screens/Login";
import Cuenta from "@/components/screens/Cuenta";
import Coach from "@/components/screens/Coach";
import Clientes from "@/components/screens/Clientes";
import Ficha from "@/components/screens/Ficha";
import Builder from "@/components/screens/Builder";
import Asignar from "@/components/screens/Asignar";
import ExportPdf from "@/components/screens/ExportPdf";

export default function BetoTrainingApp() {
  const vals = useBetoApp();
  const esAdmin = vals.auth === "ADMIN";

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)" }}>
      <Header vals={vals} />

      {vals.isLanding && <Landing vals={vals} />}
      {vals.isReservar && <Reservar vals={vals} />}
      {vals.isCheckout && <Checkout vals={vals} />}
      {vals.isConfirm && <Confirm vals={vals} />}
      {vals.isLogin && <Login vals={vals} />}
      {vals.isCuenta && <Cuenta vals={vals} />}
      {vals.isCoach && esAdmin && <Coach vals={vals} />}
      {vals.isClientes && esAdmin && <Clientes vals={vals} />}
      {vals.isFicha && esAdmin && <Ficha vals={vals} />}
      {vals.isBuilder && esAdmin && <Builder vals={vals} />}
      {vals.isAsignar && esAdmin && <Asignar vals={vals} />}
      {vals.isPdf && esAdmin && <ExportPdf vals={vals} />}

      <ToastBar vals={vals} />
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Verificación manual end-to-end del flujo completo**

```bash
npm run dev
```

Loguearse como `ADMIN`, ir a `coach → Constructor de rutinas → clientes → abrir ficha de Camila Ferreyra → Armar rutina → builder (crear 2 bloques en Lunes, reordenarlos, agregar una semana) → Continuar → asignar (seleccionar a Camila y a Martín) → pdf (elegir tema Night, descargar)`. Loguearse como Camila (`camila.f@example.com` / `Demo1234` si `SEED_DEMO_DATA=true`) y confirmar que "Mi rutina" muestra el programa recién asignado y que "Marcar como hecho" persiste.

- [ ] **Step 7: Commit**

```bash
git add hooks/useBetoApp.ts components/screens/Coach.tsx components/screens/Cuenta.tsx components/BetoTrainingApp.tsx
git commit -m "feat: migrar coach, cuenta y el ruteo a las pantallas reales del panel de rutinas"
```

---

## Task 18: E2E con Playwright — flujo completo del panel de rutinas

**Files:**
- Create: `e2e/panel-rutinas.spec.ts`

**Interfaces:**
- Consumes: la app completa corriendo (Task 17) + seed de Fundación (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, `SEED_DEMO_DATA=true` para los clientes demo).

- [ ] **Step 1: Escribir el spec del flujo completo**

```typescript
// e2e/panel-rutinas.spec.ts
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "beto@betotraining.com.ar";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe.configure({ mode: "serial" });

test("entrenador: clientes -> ficha -> builder -> asignar -> pdf", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/contraseña/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /entrar al panel|ingresar/i }).click();
  await expect(page).toHaveURL(/screen=coach/);

  await page.getByRole("button", { name: /constructor de rutinas/i }).click();
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();

  await page.getByRole("button", { name: "Abrir ficha" }).first().click();
  await page.getByRole("button", { name: /armar rutina/i }).click();
  await expect(page.getByText("Sin asignar")).toBeVisible();

  // Crear el primer bloque del lunes.
  await page.getByText("Lunes").locator("..").getByText("+").click();
  await page.getByPlaceholder("Nombre del ejercicio").fill("Sentadilla trasera con barra");
  await page.getByPlaceholder(/Detalle/).fill("5 × 3 · @ 80% 1RM");
  await page.getByRole("button", { name: /guardar bloque/i }).click();
  await expect(page.getByText("Bloque guardado con su sobrecarga")).toBeVisible();

  // Crear el segundo bloque del mismo día.
  await page.getByText("Lunes").locator("..").getByText("+").click();
  await page.getByPlaceholder("Nombre del ejercicio").fill("Press de banca con barra");
  await page.getByPlaceholder(/Detalle/).fill("5 × 4 · @ 77,5% 1RM");
  await page.getByRole("button", { name: /guardar bloque/i }).click();

  // Reordenar por teclado (activación por teclado de @dnd-kit, spec §6): foco en la
  // primera tarjeta, Espacio para levantarla, flecha abajo para moverla, Espacio para soltarla.
  const primeraTarjeta = page.getByText("Sentadilla trasera con barra");
  await primeraTarjeta.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");

  // Agregar una semana.
  await page.getByRole("button", { name: "+", exact: true }).last().click();
  await expect(page.getByText(/Semana \d agregada al bloque/)).toBeVisible();

  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByText(/^Asignar «/)).toBeVisible();

  await page.getByText("Camila Ferreyra").click();
  await page.getByText("Martín Duarte").click();
  await page.getByRole("button", { name: /Asignar a 2 clientes/ }).click();
  await expect(page.getByText(/Programa asignado a 2 clientes/)).toBeVisible();

  await page.getByText("Night Design").click();
  const descargaPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const descarga = await descargaPromise;
  expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
});

test("cliente: ve el programa recién asignado en Mi rutina", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("camila.f@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/cuenta/);

  await page.getByText("Mi rutina").click();
  await expect(page.getByRole("heading", { name: "Mi rutina" })).toBeVisible();
  await expect(page.getByText(/asignada por Beto el/)).toBeVisible();
});
```

- [ ] **Step 2: Correr**

Run: `npm run test:e2e -- panel-rutinas.spec.ts`
Expected: PASS (2 tests). Requiere `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` configuradas y `SEED_DEMO_DATA=true` corrido (Fundación Task 3) para que existan Camila Ferreyra y Martín Duarte. Si algún selector de texto no matchea (por ejemplo si el copy final de un botón difiere levemente del escrito en las Tasks 11-16), ajustar el selector al texto real renderizado — no cambiar el comportamiento de la UI para que el test pase.

- [ ] **Step 3: Commit**

```bash
git add e2e/panel-rutinas.spec.ts
git commit -m "test: e2e del flujo completo de constructor de rutinas y asignacion"
```

---

## Self-Review (completado por quien escribió este plan)

**Cobertura del spec:** cada sección de `2026-08-22-panel-rutinas-design.md` tiene tarea(s) que la implementan.
- §4 Modelo de datos (6 modelos + 3 enums) → Task 1.
- §5 Validaciones de negocio (semanas 2-8, progresión al agregar semana) → Task 2.
- §6 Drag-and-drop (`@dnd-kit`, reordenar, mover entre días, validación de mismo programa, activación por teclado) → Task 5 (endpoint) y Task 13 (frontend, `KeyboardSensor` incluido).
- §7 Duplicar día y duplicar programa → Task 6.
- §8 Exportación a PDF (Playwright, instancia única de `chromium`, ruta interna de portada, 3 temas, fechas de semana, reuso de `lib/pdf/render.ts` con Booking+Pagos) → Task 9.
- §9 Migración del código existente (`Coach.tsx`, `Cuenta.tsx`, `useBetoApp.ts`, `lib/data.ts`, pantallas nuevas) → Tasks 10, 11-16, 17.
- §10 Seguridad (`proxy.ts` + verificación server-side por rol, `clienteId` derivado de sesión, validación de mismo programa en reordenar/duplicar) → Tasks 2-8 (cada endpoint usa `requireAdmin`/`requireClienteActual` de Task 2) y explícitamente probado en Tasks 5 y 8.
- §11 Testing (unit de progresión/fechas/cumplimiento, integración de reordenar/mover/duplicar/asignar/403 cruzado, e2e del flujo completo) → Task 2 (unit progresión), Task 4 (unit cumplimiento), Tasks 3, 5, 6, 7, 8 (integración), Task 18 (e2e). Nota: el spec pide también un unit test de "cálculo de fechas de semana para el PDF" — este plan no lo aisló en un archivo de test propio porque `calcularRangoSemana` vive dentro de un Server Component (`pdf-preview/page.tsx`, Task 9) y no es trivialmente importable sin renderizar la página; queda cubierto solo por la verificación manual del Step 9 de Task 9. Si se quiere cobertura unitaria estricta de esa función, extraerla primero a `lib/rutinas/fechas-pdf.ts` como función pura antes de escribir el test — está señalado acá para que se pueda auditar como hueco de cobertura conocido, no como una omisión silenciosa.
- §12.1 (riesgo de relanzar `chromium` por request) → resuelto en Task 9 con singleton compartido.
- §12.2 (riesgo de compatibilidad `@dnd-kit`/React 19) → Task 5, Step 1, con instrucción explícita de verificar `npm ls` antes de continuar en vez de asumir.

**Placeholders:** ninguno confirmado por búsqueda de `TODO`/"similar a la Task N"/"por implementar" sobre el archivo completo — cada step tiene código TypeScript/Prisma/React real y completo. La única función deliberadamente no implementada es el botón "Guía de ejecución" (Task 14), que el spec §3 declara fuera de alcance explícito — se implementa deshabilitado con tooltip "Próximamente" en vez de omitirse.

**Consistencia de tipos y nombres entre tasks:**
- Las claves compuestas de Prisma (`bloqueId_semana`, `programaId_clienteId`, `asignacionId_bloqueId_semana`) se usan de forma consistente en los `upsert`/`update` de las Tasks 3, 7 y 8, coincidiendo con los `@@unique` declarados en Task 1.
- El guard `requireAdmin()`/`requireClienteActual()` (Task 2) se consume con el mismo patrón `if (check.error) return check.error;` en los 16 Route Handlers de las Tasks 2-9, sin variaciones de estilo.
- Los tipos de API (`ProgramaApi`, `DiaProgramaApi`, `BloqueApi`, `FilaSobrecargaApi`, `ClienteFilaApi`, Task 10) son los únicos tipos que consumen los componentes de las Tasks 11-17 — no hay un segundo tipo paralelo compitiendo por el mismo dato.
- `renderPdf` (firma preexistente asumida de Booking+Pagos Task 11) y `renderPdfConSesion` (nueva, Task 9) conviven en el mismo `lib/pdf/render.ts` compartiendo el singleton `getBrowser()` — la nota de fusión en Task 9 documenta explícitamente ambos escenarios de orden de ejecución entre los dos planes.
- Las funciones de navegación agregadas a `BetoVals` en Task 10 (`goClientes`, `goFicha`, `goBuilder`, `goAsignar`, `goPdf`, `abrirEditor`, `cerrarEditor`, `toggleAsignado`, `setSemanaSel`, `setDiaClienteSel`, `setTemaPdfSel`, `setProgramaIdActivo`, más los genéricos `set`/`showToast`) son exactamente las que consumen las Tasks 11-17 — no se referencia ninguna acción sin haberla declarado antes.

**Criterios propios no explícitos en el spec o el handoff (para que el usuario los audite):**
1. **Series/descanso constantes al progresar semanas** (Task 2): el spec §5 solo define la progresión de `pct`/`reps`; `series`/`descanso` se heredan de la semana 1 del bloque tanto al crear el bloque como al agregar una semana nueva.
2. ~~Un programa `BORRADOR` sin asignar no aparece en ninguna ficha~~ — **corregido tras auditoría**: `POST /api/coach/programas` (Task 2) ahora acepta `clienteId` opcional y crea la `AsignacionPrograma` junto con el programa cuando se arma desde la ficha de un cliente puntual, así el programa aparece ahí desde `BORRADOR`, coincidiendo con el prototipo del handoff. La asignación masiva (Task 15) sigue siendo el camino para sumar clientes adicionales al mismo programa después.
3. **"Marcar como hecho" en Mi rutina** (Task 8 y Task 17): el handoff rediseña "Mi rutina" como solo lectura, pero `BloqueCompletado` (spec §4) no tiene otra fuente de datos posible — se agregó un control mínimo no descripto en el handoff para que el gráfico de cumplimiento de la ficha (spec §4, Task 4/12) tenga datos reales.
4. **"Asignación masiva" deshabilitado sin `programaIdActivo`** (Task 11): el spec no define un endpoint para listar todos los programas del entrenador fuera del contexto de un cliente o un id puntual; en vez de inventarlo, el botón exige que ya exista un programa en contexto.
5. **"Trabajo en carrera" del widget de volumen semanal muestra "—"** (Task 13): el modelo de datos (spec §4) no tiene un campo de distancia por bloque; se documenta el dato como no disponible en vez de simular un número.
6. ~~`semanaActual` fijo en 1 en "Mi rutina" del cliente~~ — **corregido tras auditoría**: ahora se calcula desde `AsignacionPrograma.asignadoEn` (semanas completas transcurridas, acotado a `[1, programa.semanas]`, Task 17). Sigue sin contemplar pausas o reprogramaciones manuales — eso queda fuera de alcance.
7. **Resolución de `clienteId` real por *match* de nombre en "Clientes que necesitan atención"** (Task 17): el mock de `useBetoApp.ts` no tiene `id`; en vez de reescribir datos de Booking+Pagos (fuera de alcance de este spec), se resuelve el id contra `GET /api/coach/clientes` por nombre.

---

**Plan completo y guardado en `docs/superpowers/plans/2026-08-22-panel-rutinas.md`.**

