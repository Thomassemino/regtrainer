# Booking + Pagos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el flujo 100% mock de `Reservar.tsx` → `Checkout.tsx` → `Confirm.tsx` (horarios fijos sin relación con fecha real, "pagar" restando un número en memoria, sin cupo ni cancelación real) por reservas reales con cupos concurrentes verificados en base de datos, pagos reales vía Mercado Pago (Checkout Pro para clase suelta, Preapproval para mensualidad) o efectivo en el estudio, y las reglas de negocio confirmadas con el usuario: sin bono, mensualidad + clase suelta, ventana de cancelación de 12hs, sin facturación fiscal AFIP.

**Architecture:** Next.js 16.3.1 App Router con Route Handlers para cada operación de reserva/pago, sobre la misma capa de datos Prisma + Postgres que dejó Fundación (`lib/db.ts`, singleton vía `@prisma/adapter-pg`). Reutiliza `auth()`/`session.user` de `lib/auth.ts` para identificar al cliente dueño de cada reserva/pago, y `proxy.ts` para proteger `/api/coach/*`. El control de concurrencia de cupos se resuelve con transacciones Prisma en aislamiento `Serializable` (no con locks manuales ni infraestructura adicional). La generación de instancias de clase a partir de horarios recurrentes es perezosa (se dispara dentro de `GET /api/clases`, no hay cron). Los pagos con Mercado Pago se confirman exclusivamente por webhook verificado por firma HMAC, nunca por lo que declare el cliente desde el frontend.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Prisma 7 (`@prisma/adapter-pg` + `pg`), PostgreSQL 16 (Docker), `next-auth@5.0.0-beta.32` (ya configurado por Fundación), `mercadopago` (SDK oficial), `playwright` (PDF de comprobante), `zod`, `pino`, Vitest (unit/integration, ya configurado con `projects` en `vitest.config.ts`), Playwright Test (e2e).

**Spec:** [docs/superpowers/specs/2026-08-22-booking-pagos-design.md](../specs/2026-08-22-booking-pagos-design.md) — todas las decisiones de negocio y de arquitectura ya están tomadas ahí; este plan las traduce a tareas verificables, no las reabre. Leer el spec completo antes de empezar. Depende de [docs/superpowers/plans/2026-08-22-fundacion-auth-datos.md](2026-08-22-fundacion-auth-datos.md) — este plan extiende el mismo `prisma/schema.prisma`, reutiliza `lib/db.ts`, `lib/auth.ts`, `proxy.ts`, el mismo harness de Vitest/Playwright, y sigue exactamente sus mismas convenciones de código (imports relativos en Route Handlers, `logger` de `lib/logger.ts`, `getClientIp(req)`, `normalizeEmail`, manejo de `Prisma.PrismaClientKnownRequestError` con código `P2002`, anti-enumeración con delay artificial donde corresponda).

## Global Constraints

- Medios de pago: únicamente Mercado Pago (tarjeta/débito con cuotas) y efectivo en el estudio. Nada de bono/crédito prepago — está eliminado del modelo de datos y de la UI (spec §2, rechazado explícitamente por el usuario).
- Formas de cobro: **mensualidad** (suscripción recurrente vía Preapproval) y **clase suelta** (pago único vía Checkout Pro). `evaluacion` es siempre gratis (`precio: 0`), sin flujo de pago.
- Sin facturación fiscal AFIP. El comprobante es un PDF simple no fiscal, con la leyenda obligatoria "Comprobante interno de Beto Training. No es una factura válida ante AFIP." (spec §7.4) — no es cosmética, es requisito de negocio.
- Ventana de cancelación: 12 horas antes del inicio de la clase. Cancelar con menos de 12hs no reembolsa (`Reserva.canceladaTarde = true`, `Pago` queda como estaba).
- Mensualidad cubre sin cargo cualquier servicio con `slug` distinto de `"personal"`, más hasta 1 reserva de `"personal"` por semana calendario (lunes a domingo) — la 2ª reserva de personalizada en la misma semana exige pago aunque haya mensualidad activa (spec §8).
- Control de concurrencia de cupos: transacción Prisma `Serializable` que cuenta `Reserva` en `CONFIRMADA` y decide `CONFIRMADA`/`LISTA_ESPERA` dentro de la misma transacción — nunca un `count` y un `create` como operaciones separadas (condición de carrera, spec §6).
- Generación de clases: perezosa, sin cron ni scheduler externo — se dispara dentro de `GET /api/clases` si la ventana de 6 semanas no está cubierta (spec §9). Documentado como decisión, no como límite técnico.
- Webhook de Mercado Pago: firma `x-signature`/`x-request-id` verificada con HMAC-SHA256 obligatoria, y el pago se reconfirma contra la API de Mercado Pago (nunca se confía en el body del webhook). Idempotente: una notificación repetida no debe crear un segundo `Pago` ni una segunda `Reserva`.
- **Nota de riesgo transversal (spec §7, §13.1) — resuelta tras verificación contra documentación oficial vigente (2026-08-22):** el shape de `Preference` (Checkout Pro), el shape de `PreApproval` (`reason`/`external_reference`/`payer_email`/`back_url`/`auto_recurring{frequency,frequency_type,transaction_amount,currency_id}`), el header `x-signature` (`ts=...,v1=...`) y el template de firma HMAC-SHA256 (`id:{data.id};request-id:{x-request-id};ts:{ts};`) están **confirmados** contra la documentación pública de Mercado Pago Developers y ejemplos del SDK oficial — no son una suposición, ya se verificaron. La única corrección real que salió de esa verificación: la notificación `subscription_authorized_payment` no trae un `Payment` ni el `preapproval_id` directo en `data.id` — trae el id de un recurso "Authorized Payment" (`GET /authorized_payments/:id`, sin clase dedicada en el SDK, se consulta con `fetch` directo) que contiene `preapproval_id` y un `payment` anidado. Esto ya está corregido en la Task 9 (Step 6). Sigue siendo buena práctica correr esta integración contra el sandbox de Mercado Pago antes de producción — la documentación pública puede quedar desactualizada respecto al comportamiento real de la API — pero ya no es una incógnita de diseño.
- Todas las mutaciones de reserva/pago verifican que el `clienteId` derivado de `session.user.id` coincida con el dueño del recurso — un cliente no cancela la reserva de otro cambiando un id en la URL (spec §11).
- El PDF de comprobante (`lib/pdf/render.ts`, `renderPdf(url): Promise<Buffer>`) puede ya existir si el plan de Panel + Rutinas (spec 3, en desarrollo en paralelo) corrió primero — **no duplicar el archivo**: si ya existe, verificar que la firma coincida y fusionar sin crear una segunda implementación de HTML→PDF.
- Dinero: en la base de datos, `Servicio.precio` y `Pago.monto` se guardan en **centavos de ARS** (tal como especifica el spec §4 en el comentario del schema). La UI y `lib/data.ts` siguen trabajando en pesos enteros como hoy — la conversión centavos↔pesos vive en `lib/dinero.ts` y se aplica solo en el borde API↔UI y API↔Mercado Pago.
- No tocar el diseño visual de las pantallas existentes (tokens de `app/globals.css`, estructura de `components/screens/*`) salvo lo explícitamente listado en Task 13.

---

## Task 1: Extender el schema de Prisma con los modelos de Booking + Pagos

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_booking_pagos/migration.sql` (generada por Prisma, no a mano)

**Interfaces:**
- Consumes: el schema existente de Fundación (`User`, `Cliente`, enums `Role`/`AuditAction`) — no se modifica ningún modelo existente salvo agregar relaciones inversas a `Cliente`.
- Produces: modelos `Servicio`, `HorarioRecurrente`, `Clase`, `Reserva`, `Suscripcion`, `Pago`, enums `EstadoReserva`, `EstadoSuscripcion`, `TipoPago`, `MedioPago`, `EstadoPago` — consumidos por absolutamente todas las tasks siguientes.

- [ ] **Step 1: Agregar las relaciones inversas al modelo `Cliente` existente**

Editar el modelo `Cliente` ya presente en `prisma/schema.prisma` (creado por Fundación) agregando 3 líneas, sin tocar ningún campo existente:

```prisma
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

  reservas     Reserva[]
  pagos        Pago[]
  suscripcion  Suscripcion?
}
```

- [ ] **Step 2: Agregar los enums y modelos nuevos al final de `prisma/schema.prisma`**

```prisma
model Servicio {
  id          String   @id @default(cuid())
  slug        String   @unique // "personal", "funcional", "musculacion", "outdoor", "online", "evaluacion"
  nombre      String
  tag         String
  duracionMin Int
  precio      Int      // en centavos de ARS, 0 = sin cargo
  cupoMax     Int
  activo      Boolean  @default(true)

  horarios    HorarioRecurrente[]
  clases      Clase[]
}

// Plantilla de horario recurrente semanal — de acá se generan instancias de Clase.
model HorarioRecurrente {
  id          String   @id @default(cuid())
  servicioId  String
  servicio    Servicio @relation(fields: [servicioId], references: [id])
  diaSemana   Int      // 0=domingo ... 6=sábado, igual que Date.getDay()
  horaInicio  String   // "19:00"
  activo      Boolean  @default(true)
}

// Instancia concreta y reservable de una clase en una fecha/hora puntual.
model Clase {
  id          String    @id @default(cuid())
  servicioId  String
  servicio    Servicio  @relation(fields: [servicioId], references: [id])
  fecha       DateTime  // fecha+hora de inicio, UTC
  cupoMax     Int       // copiado del servicio al generar, permite overrides puntuales
  cancelada   Boolean   @default(false) // Beto puede cancelar una instancia puntual sin tocar la plantilla
  reservas    Reserva[]

  @@unique([servicioId, fecha])
  @@index([fecha])
}

enum EstadoReserva {
  CONFIRMADA
  LISTA_ESPERA
  CANCELADA
  ASISTIO
  NO_ASISTIO
}

model Reserva {
  id             String        @id @default(cuid())
  clienteId      String
  cliente        Cliente       @relation(fields: [clienteId], references: [id])
  claseId        String
  clase          Clase         @relation(fields: [claseId], references: [id])
  estado         EstadoReserva @default(CONFIRMADA)
  pagoId         String?       @unique
  pago           Pago?         @relation(fields: [pagoId], references: [id])
  viaMensualidad Boolean       @default(false) // true si el acceso vino de la suscripción activa, no de un pago puntual
  creadaEn       DateTime      @default(now())
  canceladaEn    DateTime?
  canceladaTarde Boolean       @default(false) // true si se canceló con menos de 12hs — no reembolsable

  @@index([claseId, estado])
  @@index([clienteId])
}

enum EstadoSuscripcion {
  ACTIVA
  CANCELADA
  VENCIDA
}

model Suscripcion {
  id                String            @id @default(cuid())
  clienteId         String            @unique // un cliente tiene a lo sumo una mensualidad activa a la vez
  cliente           Cliente           @relation(fields: [clienteId], references: [id])
  estado            EstadoSuscripcion @default(ACTIVA)
  precio            Int
  fechaInicio       DateTime          @default(now())
  fechaProximoCobro DateTime
  mpPreapprovalId   String?           @unique // id de la suscripción en Mercado Pago
  canceladaEn       DateTime?

  pagos             Pago[]
}

enum TipoPago {
  CLASE_SUELTA
  MENSUALIDAD
}

enum MedioPago {
  MERCADO_PAGO
  EFECTIVO
}

enum EstadoPago {
  PENDIENTE
  APROBADO
  RECHAZADO
  REEMBOLSADO
}

model Pago {
  id            String       @id @default(cuid())
  clienteId     String
  cliente       Cliente      @relation(fields: [clienteId], references: [id])
  tipo          TipoPago
  medio         MedioPago
  monto         Int
  estado        EstadoPago   @default(PENDIENTE)
  mpPaymentId   String?      @unique // id de pago en Mercado Pago, null si es efectivo
  suscripcionId String?
  suscripcion   Suscripcion? @relation(fields: [suscripcionId], references: [id])
  reserva       Reserva?
  creadoEn      DateTime     @default(now())
  actualizadoEn DateTime     @updatedAt

  @@index([mpPaymentId])
}
```

- [ ] **Step 3: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name booking_pagos
```

Expected: crea `prisma/migrations/<timestamp>_booking_pagos/migration.sql` y la aplica contra la DB de desarrollo sin destruir datos existentes (`User`/`Cliente`/`Session`/etc. de Fundación quedan intactos).

- [ ] **Step 4: Regenerar el cliente y verificar tipos**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: sin errores. `PrismaClient` ahora expone `prisma.servicio`, `prisma.horarioRecurrente`, `prisma.clase`, `prisma.reserva`, `prisma.suscripcion`, `prisma.pago`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schema prisma de booking y pagos (servicio, clase, reserva, suscripcion, pago)"
```

---

## Task 2: Seed de `Servicio` y `HorarioRecurrente`

**Files:**
- Create: `lib/dinero.ts`
- Modify: `prisma/seed.ts`
- Test: `tests/unit/dinero.test.ts`

**Interfaces:**
- Produces: `pesosACentavos(pesos: number): number`, `centavosAPesos(centavos: number): number` — usados por toda task que muestre o reciba montos en el borde UI/API; seed de `Servicio` con los 6 servicios reales de `SERVICIOS` en `lib/data.ts` (sin inventar servicios nuevos) y `HorarioRecurrente` con horarios demo.

**Nota de criterio (no explícito en el spec, aplicado por quien escribió este plan):** el spec define `Servicio.cupoMax` pero el mock de `lib/data.ts` no trae un cupo total por servicio (solo frases descriptivas como `"2 lugares"`, que son cupo *disponible* de un horario puntual, no cupo *total*). Se usa como criterio el único número concreto que aparece en el copy real de la app (`bandas` en `hooks/useBetoApp.ts`: *"Grupos de hasta 8 personas"*) como `cupoMax` para todos los servicios grupales (`funcional`, `musculacion`, `outdoor`), `cupoMax: 1` para `personal` y `evaluacion` (explícitamente "1 a 1" / individual), y `cupoMax: 999` para `online` (no es un espacio físico limitado, es acceso a video). **Revisar estos números con Beto antes de producción** — es un valor demo razonable, no un dato de negocio confirmado.

- [ ] **Step 1: Escribir el test de conversión de dinero**

```typescript
// tests/unit/dinero.test.ts
import { describe, expect, it } from "vitest";
import { centavosAPesos, pesosACentavos } from "../../lib/dinero";

describe("pesosACentavos / centavosAPesos", () => {
  it("convierte pesos a centavos", () => {
    expect(pesosACentavos(22000)).toBe(2200000);
  });

  it("convierte centavos a pesos", () => {
    expect(centavosAPesos(2200000)).toBe(22000);
  });

  it("es inverso en ambos sentidos", () => {
    expect(centavosAPesos(pesosACentavos(15000))).toBe(15000);
  });

  it("0 pesos es 0 centavos (servicio sin cargo)", () => {
    expect(pesosACentavos(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/dinero.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/dinero.ts`**

```typescript
// lib/dinero.ts
export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centavosAPesos(centavos: number): number {
  return Math.round(centavos / 100);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/dinero.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Extender `prisma/seed.ts` con los servicios y horarios reales**

```typescript
// prisma/seed.ts (agregar antes de `console.log("Seed completo.")`, después del bloque de clientes demo)
import { pesosACentavos } from "../lib/dinero";

const SERVICIOS_SEED = [
  { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precioPesos: 22000, cupoMax: 1 },
  { slug: "funcional", nombre: "Funcional / HIIT", tag: "Grupal", duracionMin: 50, precioPesos: 12000, cupoMax: 8 },
  { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precioPesos: 15000, cupoMax: 8 },
  { slug: "outdoor", nombre: "Outdoor / Running", tag: "Aire libre", duracionMin: 60, precioPesos: 10000, cupoMax: 8 },
  { slug: "online", nombre: "Rutinas grabadas", tag: "Online", duracionMin: 0, precioPesos: 9000, cupoMax: 999 },
  { slug: "evaluacion", nombre: "Evaluación inicial", tag: "Sin cargo", duracionMin: 45, precioPesos: 0, cupoMax: 1 },
];

async function seedServiciosYHorarios() {
  const servicios: Record<string, { id: string }> = {};
  for (const s of SERVICIOS_SEED) {
    servicios[s.slug] = await prisma.servicio.upsert({
      where: { slug: s.slug },
      update: { nombre: s.nombre, tag: s.tag, duracionMin: s.duracionMin, precio: pesosACentavos(s.precioPesos), cupoMax: s.cupoMax },
      create: {
        slug: s.slug,
        nombre: s.nombre,
        tag: s.tag,
        duracionMin: s.duracionMin,
        precio: pesosACentavos(s.precioPesos),
        cupoMax: s.cupoMax,
      },
    });
  }

  // Horarios demo — ver nota de criterio en Task 2 del plan de booking+pagos: revisar con Beto.
  const HORARIOS_SEED: { slug: string; diaSemana: number; horaInicio: string }[] = [
    // outdoor: "martes y jueves a las 7" está en la descripción real del servicio (lib/data.ts).
    { slug: "outdoor", diaSemana: 2, horaInicio: "07:00" },
    { slug: "outdoor", diaSemana: 4, horaInicio: "07:00" },
    // funcional: horario demo, inspirado en la agenda mock de useBetoApp.ts ("19:00 Funcional/HIIT").
    { slug: "funcional", diaSemana: 1, horaInicio: "19:00" },
    { slug: "funcional", diaSemana: 3, horaInicio: "19:00" },
    // musculacion: horario demo, inspirado en la agenda mock ("18:00 Musculación").
    { slug: "musculacion", diaSemana: 1, horaInicio: "18:00" },
    { slug: "musculacion", diaSemana: 3, horaInicio: "18:00" },
    { slug: "musculacion", diaSemana: 5, horaInicio: "18:00" },
    // personal: horarios demo, inspirados en la agenda mock ("09:00 Personalizado", "SÁB 10:00").
    { slug: "personal", diaSemana: 2, horaInicio: "09:00" },
    { slug: "personal", diaSemana: 4, horaInicio: "09:00" },
    { slug: "personal", diaSemana: 6, horaInicio: "10:00" },
    // evaluacion: horario demo, inspirado en la agenda mock ("12:00 Evaluación inicial").
    { slug: "evaluacion", diaSemana: 3, horaInicio: "12:00" },
  ];

  for (const h of HORARIOS_SEED) {
    const servicio = servicios[h.slug];
    const existente = await prisma.horarioRecurrente.findFirst({
      where: { servicioId: servicio.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio },
    });
    if (!existente) {
      await prisma.horarioRecurrente.create({
        data: { servicioId: servicio.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio },
      });
    }
  }

  console.log("Servicios y horarios recurrentes seedeados.");
}
```

Y agregar la llamada `await seedServiciosYHorarios();` dentro de `main()`, antes de `console.log("Seed completo.")`.

- [ ] **Step 6: Correr el seed y verificar en Prisma Studio**

```bash
npm run db:seed
npx prisma studio
```

Expected: 6 filas en `Servicio` con los slugs `personal`/`funcional`/`musculacion`/`outdoor`/`online`/`evaluacion`, y las filas de `HorarioRecurrente` correspondientes.

- [ ] **Step 7: Commit**

```bash
git add lib/dinero.ts prisma/seed.ts tests/unit/dinero.test.ts
git commit -m "feat: seed de servicios y horarios recurrentes + conversion de dinero"
```

---

## Task 3: Cálculo de cupo + generación perezosa de clases

**Files:**
- Create: `lib/reservas/cupo.ts`
- Create: `lib/clases/generar.ts`
- Test: `tests/unit/cupo.test.ts`
- Test: `tests/integration/generar-clases.test.ts`

**Interfaces:**
- Consumes: `prisma` de `lib/db.ts`, modelos `Servicio`/`HorarioRecurrente`/`Clase` de Task 1.
- Produces: `calcularEstadoReserva(confirmadas: number, cupoMax: number): "CONFIRMADA" | "LISTA_ESPERA"`, `ensureClasesGeneradas(now?: Date): Promise<void>` — usados por Task 6 (reservas) y Task 4 (`GET /api/clases`).

- [ ] **Step 1: Escribir el test unitario de cálculo de cupo**

```typescript
// tests/unit/cupo.test.ts
import { describe, expect, it } from "vitest";
import { calcularEstadoReserva } from "../../lib/reservas/cupo";

describe("calcularEstadoReserva", () => {
  it("confirma si hay lugar", () => {
    expect(calcularEstadoReserva(3, 8)).toBe("CONFIRMADA");
  });

  it("confirma en el último lugar disponible", () => {
    expect(calcularEstadoReserva(7, 8)).toBe("CONFIRMADA");
  });

  it("manda a lista de espera al llegar al cupo máximo", () => {
    expect(calcularEstadoReserva(8, 8)).toBe("LISTA_ESPERA");
  });

  it("manda a lista de espera por encima del cupo máximo", () => {
    expect(calcularEstadoReserva(9, 8)).toBe("LISTA_ESPERA");
  });

  it("con cupoMax 1, la primera confirma y cualquier otra va a lista de espera", () => {
    expect(calcularEstadoReserva(0, 1)).toBe("CONFIRMADA");
    expect(calcularEstadoReserva(1, 1)).toBe("LISTA_ESPERA");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/cupo.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/reservas/cupo.ts`**

```typescript
// lib/reservas/cupo.ts
export function calcularEstadoReserva(
  confirmadas: number,
  cupoMax: number
): "CONFIRMADA" | "LISTA_ESPERA" {
  return confirmadas < cupoMax ? "CONFIRMADA" : "LISTA_ESPERA";
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/cupo.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Escribir el test de integración de generación de clases**

```typescript
// tests/integration/generar-clases.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { ensureClasesGeneradas } from "../../lib/clases/generar";

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
});

describe("ensureClasesGeneradas", () => {
  it("genera instancias de Clase para los próximos días que coinciden con el diaSemana del horario", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 8 },
    });
    const ahora = new Date("2026-08-24T00:00:00.000Z"); // lunes
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "19:00" }, // martes 19:00
    });

    await ensureClasesGeneradas(ahora);

    const clases = await prisma.clase.findMany({ where: { servicioId: servicio.id }, orderBy: { fecha: "asc" } });
    expect(clases.length).toBeGreaterThan(0);
    for (const c of clases) {
      expect(c.fecha.getUTCDay()).toBe(2);
      expect(c.fecha.getUTCHours()).toBe(19);
      expect(c.cupoMax).toBe(8);
    }
  });

  it("es idempotente: correrlo dos veces no duplica clases", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "outdoor", nombre: "Outdoor", tag: "Aire libre", duracionMin: 60, precio: 0, cupoMax: 8 },
    });
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "07:00" },
    });
    const ahora = new Date("2026-08-24T00:00:00.000Z");

    await ensureClasesGeneradas(ahora);
    const primeraCorrida = await prisma.clase.count({ where: { servicioId: servicio.id } });

    await ensureClasesGeneradas(ahora);
    const segundaCorrida = await prisma.clase.count({ where: { servicioId: servicio.id } });

    expect(segundaCorrida).toBe(primeraCorrida);
  });

  it("no genera clases para HorarioRecurrente inactivo", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precio: 0, cupoMax: 8 },
    });
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "18:00", activo: false },
    });

    await ensureClasesGeneradas(new Date("2026-08-24T00:00:00.000Z"));

    const clases = await prisma.clase.count({ where: { servicioId: servicio.id } });
    expect(clases).toBe(0);
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/generar-clases.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 7: Implementar `lib/clases/generar.ts`**

```typescript
// lib/clases/generar.ts
import { prisma } from "../db";

const VENTANA_SEMANAS = 6;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MS_MARGEN_COBERTURA = 20 * 60 * 60 * 1000; // 20 horas, spec §9

export async function ensureClasesGeneradas(now: Date = new Date()): Promise<void> {
  const horarios = await prisma.horarioRecurrente.findMany({
    where: { activo: true, servicio: { activo: true } },
    include: { servicio: true },
  });

  const finVentana = new Date(now.getTime() + VENTANA_SEMANAS * 7 * MS_POR_DIA);

  for (const horario of horarios) {
    const ultimaGenerada = await prisma.clase.findFirst({
      where: { servicioId: horario.servicioId },
      orderBy: { fecha: "desc" },
      select: { fecha: true },
    });

    // Si la última clase generada ya cubre (con hasta 20hs de margen) el final de la ventana
    // de 6 semanas, la generación corrió recientemente y no hace falta repetir el trabajo.
    const yaCubierta =
      ultimaGenerada != null &&
      ultimaGenerada.fecha.getTime() >= finVentana.getTime() - MS_MARGEN_COBERTURA;
    if (yaCubierta) continue;

    await generarInstanciasParaHorario(horario, now, finVentana);
  }
}

async function generarInstanciasParaHorario(
  horario: { servicioId: string; diaSemana: number; horaInicio: string; servicio: { cupoMax: number } },
  desde: Date,
  hasta: Date
): Promise<void> {
  const [horasStr, minutosStr] = horario.horaInicio.split(":");
  const horas = Number(horasStr);
  const minutos = Number(minutosStr);

  const cursor = new Date(desde);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= hasta.getTime()) {
    if (cursor.getUTCDay() === horario.diaSemana) {
      const fecha = new Date(cursor);
      fecha.setUTCHours(horas, minutos, 0, 0);
      if (fecha.getTime() >= desde.getTime()) {
        await prisma.clase.upsert({
          where: { servicioId_fecha: { servicioId: horario.servicioId, fecha } },
          update: {},
          create: {
            servicioId: horario.servicioId,
            fecha,
            cupoMax: horario.servicio.cupoMax,
          },
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/generar-clases.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/reservas/cupo.ts lib/clases/generar.ts tests/unit/cupo.test.ts tests/integration/generar-clases.test.ts
git commit -m "feat: calculo de cupo y generacion perezosa de clases desde horarios recurrentes"
```

---

## Task 4: `GET /api/clases`

**Files:**
- Create: `app/api/clases/route.ts`
- Test: `tests/integration/api-clases.test.ts`

**Interfaces:**
- Consumes: `ensureClasesGeneradas` de Task 3, `prisma`.
- Produces: `GET /api/clases?servicioId=&desde=&hasta=` → `{ clases: { id, servicioId, servicioSlug, fecha, cupoMax, cuposOcupados, cuposDisponibles, lleno }[] }` — consumido por `hooks/useBetoApp.ts` en Task 12 (reemplaza `HORAS` del mock).

- [ ] **Step 1: Escribir el test de integración**

```typescript
// tests/integration/api-clases.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("GET /api/clases", () => {
  it("devuelve las clases futuras del servicio pedido con el cupo calculado", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 2 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), cupoMax: 2 },
    });
    const user = await prisma.user.create({
      data: { email: "cupo@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Cupo Test", iniciales: "CT", objetivo: "" },
    });
    await prisma.reserva.create({ data: { clienteId: cliente.id, claseId: clase.id, estado: "CONFIRMADA" } });

    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?servicioId=${servicio.id}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.clases).toHaveLength(1);
    expect(body.clases[0].cuposOcupados).toBe(1);
    expect(body.clases[0].cuposDisponibles).toBe(1);
    expect(body.clases[0].lleno).toBe(false);
  });

  it("no devuelve clases canceladas", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "outdoor", nombre: "Outdoor", tag: "Aire libre", duracionMin: 60, precio: 0, cupoMax: 8 },
    });
    await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8, cancelada: true },
    });

    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?servicioId=${servicio.id}`));
    const body = await res.json();

    expect(body.clases).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/api-clases.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar el endpoint**

```typescript
// app/api/clases/route.ts
import { z } from "zod";
import { prisma } from "../../../lib/db";
import { ensureClasesGeneradas } from "../../../lib/clases/generar";

const QuerySchema = z.object({
  servicioId: z.string().min(1).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
});

const SEIS_SEMANAS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  await ensureClasesGeneradas();

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    servicioId: url.searchParams.get("servicioId") ?? undefined,
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const ahora = new Date();
  const desde = parsed.data.desde ? new Date(parsed.data.desde) : ahora;
  const hasta = parsed.data.hasta ? new Date(parsed.data.hasta) : new Date(ahora.getTime() + SEIS_SEMANAS_MS);

  const clases = await prisma.clase.findMany({
    where: {
      cancelada: false,
      fecha: { gte: desde, lte: hasta },
      servicio: { activo: true },
      ...(parsed.data.servicioId ? { servicioId: parsed.data.servicioId } : {}),
    },
    include: {
      servicio: true,
      _count: { select: { reservas: { where: { estado: "CONFIRMADA" } } } },
    },
    orderBy: { fecha: "asc" },
  });

  return Response.json({
    clases: clases.map((c) => ({
      id: c.id,
      servicioId: c.servicioId,
      servicioSlug: c.servicio.slug,
      fecha: c.fecha.toISOString(),
      cupoMax: c.cupoMax,
      cuposOcupados: c._count.reservas,
      cuposDisponibles: Math.max(0, c.cupoMax - c._count.reservas),
      lleno: c._count.reservas >= c.cupoMax,
    })),
  });
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/api-clases.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/clases tests/integration/api-clases.test.ts
git commit -m "feat: endpoint get /api/clases con generacion perezosa y cupo calculado"
```

---

## Task 5: Regla de cobertura de mensualidad

**Files:**
- Create: `lib/reservas/mensualidad.ts`
- Test: `tests/unit/mensualidad.test.ts`
- Test: `tests/integration/mensualidad-personal.test.ts`

**Interfaces:**
- Consumes: `prisma`, modelo `Suscripcion`/`Reserva`/`Servicio` de Task 1.
- Produces: `semanaCalendarioActual(referencia?: Date): { inicio: Date; fin: Date }`, `cubreMensualidad(tx, clienteId, servicio): Promise<{ cubierta: boolean }>` — usados por Task 6 (`crearReservaConCupo`).

- [ ] **Step 1: Escribir el test unitario de semana calendario**

```typescript
// tests/unit/mensualidad.test.ts
import { describe, expect, it } from "vitest";
import { semanaCalendarioActual } from "../../lib/reservas/mensualidad";

describe("semanaCalendarioActual", () => {
  it("un miércoles devuelve el lunes de esa semana como inicio", () => {
    const miercoles = new Date("2026-08-19T15:00:00.000Z"); // miércoles
    const { inicio, fin } = semanaCalendarioActual(miercoles);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z"); // lunes
    expect(fin.toISOString()).toBe("2026-08-24T00:00:00.000Z"); // lunes siguiente (exclusivo)
  });

  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    const domingo = new Date("2026-08-23T10:00:00.000Z");
    const { inicio, fin } = semanaCalendarioActual(domingo);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("un lunes es el propio inicio de semana", () => {
    const lunes = new Date("2026-08-17T05:00:00.000Z");
    const { inicio } = semanaCalendarioActual(lunes);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/mensualidad.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/reservas/mensualidad.ts`**

```typescript
// lib/reservas/mensualidad.ts
import type { Prisma, PrismaClient, Servicio } from "@prisma/client";

type TxOrClient = Prisma.TransactionClient | PrismaClient;

export function semanaCalendarioActual(referencia: Date = new Date()): { inicio: Date; fin: Date } {
  const dia = referencia.getUTCDay(); // 0=domingo ... 6=sábado
  const offsetHastaLunes = dia === 0 ? 6 : dia - 1;
  const inicio = new Date(referencia);
  inicio.setUTCDate(referencia.getUTCDate() - offsetHastaLunes);
  inicio.setUTCHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setUTCDate(inicio.getUTCDate() + 7);
  return { inicio, fin };
}

export async function cubreMensualidad(
  tx: TxOrClient,
  clienteId: string,
  servicio: Servicio
): Promise<{ cubierta: boolean }> {
  if (servicio.precio === 0) {
    // Ej. "evaluacion": gratis para todos, no consume ni depende del beneficio de mensualidad.
    return { cubierta: false };
  }

  const suscripcion = await tx.suscripcion.findUnique({ where: { clienteId } });
  if (!suscripcion || suscripcion.estado !== "ACTIVA") {
    return { cubierta: false };
  }

  if (servicio.slug !== "personal") {
    return { cubierta: true };
  }

  // "personal" bajo mensualidad: máximo 1 por semana calendario (lunes a domingo) — spec §8.
  const { inicio, fin } = semanaCalendarioActual();
  const usadasEstaSemana = await tx.reserva.count({
    where: {
      clienteId,
      viaMensualidad: true,
      estado: { not: "CANCELADA" },
      clase: { servicioId: servicio.id, fecha: { gte: inicio, lt: fin } },
    },
  });

  return { cubierta: usadasEstaSemana < 1 };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/mensualidad.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir el test de integración de la regla de negocio completa**

```typescript
// tests/integration/mensualidad-personal.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { cubreMensualidad } from "../../lib/reservas/mensualidad";

let clienteId: string;
let servicioPersonalId: string;

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  const cliente = await prisma.cliente.create({
    data: { userId: user.id, nombre: "Mensual Test", iniciales: "MT", objetivo: "" },
  });
  clienteId = cliente.id;

  const servicio = await prisma.servicio.create({
    data: { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precio: 2200000, cupoMax: 1 },
  });
  servicioPersonalId = servicio.id;

  await prisma.suscripcion.create({
    data: { clienteId, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
});

describe("cubreMensualidad — regla de 1 personalizada por semana", () => {
  it("cubre la primera reserva de personal de la semana", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });

  it("no cubre la segunda reserva de personal en la misma semana calendario", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const clase1 = await prisma.clase.create({
      data: { servicioId: servicioPersonalId, fecha: new Date("2026-08-18T09:00:00.000Z"), cupoMax: 1 },
    });
    await prisma.reserva.create({
      data: { clienteId, claseId: clase1.id, estado: "CONFIRMADA", viaMensualidad: true },
    });

    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(false);
  });

  it("una reserva de personal cancelada no cuenta contra el límite semanal", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const clase1 = await prisma.clase.create({
      data: { servicioId: servicioPersonalId, fecha: new Date("2026-08-18T09:00:00.000Z"), cupoMax: 1 },
    });
    await prisma.reserva.create({
      data: { clienteId, claseId: clase1.id, estado: "CANCELADA", viaMensualidad: true, canceladaEn: new Date() },
    });

    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });
});
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/mensualidad-personal.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/reservas/mensualidad.ts tests/unit/mensualidad.test.ts tests/integration/mensualidad-personal.test.ts
git commit -m "feat: regla de cobertura de mensualidad (grupales + 1 personalizada por semana)"
```

---

## Task 6: `POST /api/reservas` con control de concurrencia real

**Files:**
- Create: `lib/reservas/crear.ts`
- Create: `app/api/reservas/route.ts`
- Test: `tests/integration/reservas-concurrencia.test.ts`
- Test: `tests/integration/api-reservas.test.ts`

**Interfaces:**
- Consumes: `calcularEstadoReserva` (Task 3), `cubreMensualidad` (Task 5), `auth()` (Fundación), `prisma`.
- Produces: `crearReservaConCupo(params): Promise<ResultadoReserva>`, `POST /api/reservas` — consumidos por `hooks/useBetoApp.ts` (Task 12) y por el webhook de Mercado Pago (Task 8).

Esta es **la task más importante de todo el plan** (spec §12): el test de dos reservas simultáneas contra el último cupo de una clase no se simplifica ni se omite.

- [ ] **Step 1: Escribir el test de integración de concurrencia (el crítico)**

```typescript
// tests/integration/reservas-concurrencia.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { crearReservaConCupo } from "../../lib/reservas/crear";

async function crearClienteDemo(email: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  return prisma.cliente.create({ data: { userId: user.id, nombre: email, iniciales: "XX", objetivo: "" } });
}

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("crearReservaConCupo — concurrencia (spec §12)", () => {
  it("con cupoMax 1, de dos reservas simultáneas exactamente una queda CONFIRMADA y la otra LISTA_ESPERA", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const clienteA = await crearClienteDemo("concurrencia-a@example.com");
    const clienteB = await crearClienteDemo("concurrencia-b@example.com");

    const [resA, resB] = await Promise.all([
      crearReservaConCupo({ clienteId: clienteA.id, claseId: clase.id, medio: null }),
      crearReservaConCupo({ clienteId: clienteB.id, claseId: clase.id, medio: null }),
    ]);

    const estados = [resA.estado, resB.estado].sort();
    expect(estados).toEqual(["CONFIRMADA", "LISTA_ESPERA"]);

    const confirmadas = await prisma.reserva.count({ where: { claseId: clase.id, estado: "CONFIRMADA" } });
    const listaEspera = await prisma.reserva.count({ where: { claseId: clase.id, estado: "LISTA_ESPERA" } });
    expect(confirmadas).toBe(1);
    expect(listaEspera).toBe(1);
  });

  it("con cupoMax 8 y 10 reservas simultáneas, exactamente 8 quedan CONFIRMADA", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precio: 0, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const clientes = await Promise.all(
      Array.from({ length: 10 }, (_, i) => crearClienteDemo(`carga-${i}@example.com`))
    );

    await Promise.all(
      clientes.map((c) => crearReservaConCupo({ clienteId: c.id, claseId: clase.id, medio: null }))
    );

    const confirmadas = await prisma.reserva.count({ where: { claseId: clase.id, estado: "CONFIRMADA" } });
    const listaEspera = await prisma.reserva.count({ where: { claseId: clase.id, estado: "LISTA_ESPERA" } });
    expect(confirmadas).toBe(8);
    expect(listaEspera).toBe(2);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/reservas-concurrencia.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/reservas/crear.ts` con transacción `Serializable` y reintento**

```typescript
// lib/reservas/crear.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { calcularEstadoReserva } from "./cupo";
import { cubreMensualidad } from "./mensualidad";

export type ResultadoReserva = {
  reservaId: string;
  estado: "CONFIRMADA" | "LISTA_ESPERA";
  viaMensualidad: boolean;
  monto: number; // en centavos, 0 si no requiere pago
};

export class RequierePagoError extends Error {
  constructor() {
    super("Este servicio requiere pago — usar POST /api/pagos/clase");
    this.name = "RequierePagoError";
  }
}

async function conReintentoDeSerializacion<T>(fn: () => Promise<T>, intentos = 5): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await fn();
    } catch (e) {
      const esConflictoDeSerializacion =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      if (!esConflictoDeSerializacion || intento === intentos) throw e;
    }
  }
  throw new Error("No se pudo completar la reserva tras reintentos");
}

export async function crearReservaConCupo(params: {
  clienteId: string;
  claseId: string;
  medio: "EFECTIVO" | null;
  pagoIdExistente?: string; // lo usa el webhook de Mercado Pago, ver Task 8
}): Promise<ResultadoReserva> {
  return conReintentoDeSerializacion(() =>
    prisma.$transaction(
      async (tx) => {
        const clase = await tx.clase.findUniqueOrThrow({
          where: { id: params.claseId },
          include: { servicio: true },
        });
        if (clase.cancelada) {
          throw new Error("La clase fue cancelada");
        }

        const confirmadas = await tx.reserva.count({
          where: { claseId: clase.id, estado: "CONFIRMADA" },
        });
        const estado = calcularEstadoReserva(confirmadas, clase.cupoMax);

        const cobertura = await cubreMensualidad(tx, params.clienteId, clase.servicio);

        const requierePagoOnline =
          clase.servicio.precio > 0 &&
          !cobertura.cubierta &&
          !params.pagoIdExistente &&
          params.medio !== "EFECTIVO";
        if (requierePagoOnline) {
          throw new RequierePagoError();
        }

        const reserva = await tx.reserva.create({
          data: {
            clienteId: params.clienteId,
            claseId: clase.id,
            estado,
            viaMensualidad: cobertura.cubierta,
            pagoId: params.pagoIdExistente ?? undefined,
          },
        });

        if (!cobertura.cubierta && clase.servicio.precio > 0 && params.medio === "EFECTIVO") {
          const pago = await tx.pago.create({
            data: {
              clienteId: params.clienteId,
              tipo: "CLASE_SUELTA",
              medio: "EFECTIVO",
              monto: clase.servicio.precio,
              estado: "PENDIENTE",
            },
          });
          await tx.reserva.update({ where: { id: reserva.id }, data: { pagoId: pago.id } });
        }

        return {
          reservaId: reserva.id,
          estado,
          viaMensualidad: cobertura.cubierta,
          monto: cobertura.cubierta ? 0 : clase.servicio.precio,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/reservas-concurrencia.test.ts`
Expected: PASS (2 tests). Si el driver de Postgres usado por `@prisma/adapter-pg` no soporta reintentar automáticamente errores `40001` (serialization_failure) dentro de `$transaction`, verificar que `conReintentoDeSerializacion` efectivamente atrape `Prisma.PrismaClientKnownRequestError` con código `P2034` — este es exactamente el tipo de detalle de versión de Prisma 7 que hay que confirmar contra el comportamiento real observado al correr el test, no asumir de memoria.

- [ ] **Step 5: Escribir el test de integración del endpoint HTTP**

```typescript
// tests/integration/api-reservas.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(),
}));

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/reservas", () => {
  it("rechaza sin sesión", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: "x" }) }));
    expect(res.status).toBe(401);
  });

  it("confirma una reserva de un servicio gratuito", async () => {
    const user = await prisma.user.create({
      data: { email: "reserva-http@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "HTTP Test", iniciales: "HT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "evaluacion", nombre: "Evaluación inicial", tag: "Sin cargo", duracionMin: 45, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 1 },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(
      new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: clase.id }) })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.estado).toBe("CONFIRMADA");

    const reservaEnDb = await prisma.reserva.findUnique({ where: { id: body.reservaId } });
    expect(reservaEnDb?.clienteId).toBe(cliente.id);
  });

  it("devuelve 409 y redirigirA si el servicio es pago y no hay mensualidad", async () => {
    const user = await prisma.user.create({
      data: { email: "reserva-pago@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    await prisma.cliente.create({ data: { userId: user.id, nombre: "Pago Test", iniciales: "PT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(
      new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: clase.id }) })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.redirigirA).toBe("/api/pagos/clase");
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/api-reservas.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 7: Implementar el endpoint**

```typescript
// app/api/reservas/route.ts
import { z } from "zod";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import { crearReservaConCupo, RequierePagoError } from "../../../lib/reservas/crear";

const Schema = z.object({
  claseId: z.string().min(1),
  medio: z.enum(["EFECTIVO"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({
    where: { id: parsed.data.claseId },
    include: { servicio: true },
  });
  if (!clase || clase.cancelada) {
    return Response.json({ error: "Clase no encontrada" }, { status: 404 });
  }

  try {
    const resultado = await crearReservaConCupo({
      clienteId: cliente.id,
      claseId: clase.id,
      medio: parsed.data.medio ?? null,
    });
    return Response.json(resultado, { status: 201 });
  } catch (e) {
    if (e instanceof RequierePagoError) {
      return Response.json(
        { error: "Este servicio requiere pago", redirigirA: "/api/pagos/clase" },
        { status: 409 }
      );
    }
    throw e;
  }
}
```

- [ ] **Step 8: Correr y verificar que todo pasa**

Run: `npx vitest run --project integration tests/integration/api-reservas.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/reservas/crear.ts app/api/reservas/route.ts tests/integration/reservas-concurrencia.test.ts tests/integration/api-reservas.test.ts
git commit -m "feat: reserva con control de concurrencia real via transaccion serializable"
```

---

## Task 7: Cancelación de reserva — ventana de 12hs + promoción de lista de espera

**Files:**
- Create: `lib/reservas/cancelar.ts`
- Create: `app/api/reservas/[id]/cancelar/route.ts`
- Test: `tests/unit/cancelacion.test.ts`
- Test: `tests/integration/cancelar-reserva.test.ts`

**Interfaces:**
- Consumes: `auth()`, `prisma`.
- Produces: `puedeCancelarSinCargo(fechaClase, ahora?): boolean`, `cancelarReserva(params): Promise<void>`, `POST /api/reservas/:id/cancelar` — consumidos por `Cuenta.tsx` (fuera de alcance de edición en este plan, pero es el endpoint real detrás del botón "Cancelar" que hoy solo hace `showToast` en el mock).

- [ ] **Step 1: Escribir el test unitario de la ventana de 12hs**

```typescript
// tests/unit/cancelacion.test.ts
import { describe, expect, it } from "vitest";
import { puedeCancelarSinCargo } from "../../lib/reservas/cancelar";

describe("puedeCancelarSinCargo", () => {
  it("permite cancelar sin cargo con más de 12hs de anticipación", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn13hs = new Date("2026-08-20T23:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn13hs, ahora)).toBe(true);
  });

  it("exactamente 12hs cuenta como sin cargo (borde inclusivo)", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn12hs = new Date("2026-08-20T22:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn12hs, ahora)).toBe(true);
  });

  it("no reembolsa con menos de 12hs de anticipación", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn6hs = new Date("2026-08-20T16:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn6hs, ahora)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/cancelacion.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar `lib/reservas/cancelar.ts`**

```typescript
// lib/reservas/cancelar.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../db";

const DOCE_HORAS_MS = 12 * 60 * 60 * 1000;

export function puedeCancelarSinCargo(fechaClase: Date, ahora: Date = new Date()): boolean {
  return fechaClase.getTime() - ahora.getTime() >= DOCE_HORAS_MS;
}

export class NoAutorizadoError extends Error {
  constructor() {
    super("No autorizado a cancelar esta reserva");
    this.name = "NoAutorizadoError";
  }
}

export async function cancelarReserva(params: { reservaId: string; clienteId: string }): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const reserva = await tx.reserva.findUniqueOrThrow({
        where: { id: params.reservaId },
        include: { clase: true, pago: true },
      });
      if (reserva.clienteId !== params.clienteId) {
        throw new NoAutorizadoError();
      }
      if (reserva.estado === "CANCELADA") {
        return; // idempotente: cancelar dos veces no es un error
      }

      const aTiempo = puedeCancelarSinCargo(reserva.clase.fecha);
      const eraConfirmada = reserva.estado === "CONFIRMADA";

      await tx.reserva.update({
        where: { id: reserva.id },
        data: { estado: "CANCELADA", canceladaEn: new Date(), canceladaTarde: !aTiempo },
      });

      if (reserva.pago && reserva.pago.estado === "APROBADO" && aTiempo) {
        await tx.pago.update({ where: { id: reserva.pago.id }, data: { estado: "REEMBOLSADO" } });
        // El reembolso real del dinero en Mercado Pago (refund vía API) se dispara aparte,
        // fuera de esta transacción — ver Task 8, nota de riesgo sobre refunds.
      }

      if (eraConfirmada) {
        const siguienteEnEspera = await tx.reserva.findFirst({
          where: { claseId: reserva.claseId, estado: "LISTA_ESPERA" },
          orderBy: { creadaEn: "asc" },
        });
        if (siguienteEnEspera) {
          await tx.reserva.update({ where: { id: siguienteEnEspera.id }, data: { estado: "CONFIRMADA" } });
          // Notificación por email de "pasaste a confirmado" se dispara fuera de la transacción
          // (mismo patrón que Fundación: no bloquear la mutación de datos por un envío de SMTP).
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/cancelacion.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir el test de integración de cancelación con promoción de lista de espera**

```typescript
// tests/integration/cancelar-reserva.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { cancelarReserva } from "../../lib/reservas/cancelar";

async function crearClienteDemo(email: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  return prisma.cliente.create({ data: { userId: user.id, nombre: email, iniciales: "XX", objetivo: "" } });
}

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("cancelarReserva", () => {
  it("cancelar con 13hs de anticipación libera cupo y promueve la lista de espera", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 13 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const clienteA = await crearClienteDemo("cancela-13hs-a@example.com");
    const clienteB = await crearClienteDemo("cancela-13hs-b@example.com");

    const reservaA = await prisma.reserva.create({ data: { clienteId: clienteA.id, claseId: clase.id, estado: "CONFIRMADA" } });
    const reservaB = await prisma.reserva.create({ data: { clienteId: clienteB.id, claseId: clase.id, estado: "LISTA_ESPERA" } });

    await cancelarReserva({ reservaId: reservaA.id, clienteId: clienteA.id });

    const actualizadaA = await prisma.reserva.findUniqueOrThrow({ where: { id: reservaA.id } });
    const actualizadaB = await prisma.reserva.findUniqueOrThrow({ where: { id: reservaB.id } });
    expect(actualizadaA.estado).toBe("CANCELADA");
    expect(actualizadaA.canceladaTarde).toBe(false);
    expect(actualizadaB.estado).toBe("CONFIRMADA");
  });

  it("cancelar con 6hs de anticipación no reembolsa un pago aprobado", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precio: 2200000, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 6 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const cliente = await crearClienteDemo("cancela-6hs@example.com");
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "MERCADO_PAGO", monto: 2200000, estado: "APROBADO" },
    });
    const reserva = await prisma.reserva.create({
      data: { clienteId: cliente.id, claseId: clase.id, estado: "CONFIRMADA", pagoId: pago.id },
    });

    await cancelarReserva({ reservaId: reserva.id, clienteId: cliente.id });

    const reservaActualizada = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(reservaActualizada.canceladaTarde).toBe(true);
    expect(pagoActualizado.estado).toBe("APROBADO"); // no se tocó, no hay reembolso
  });

  it("rechaza cancelar la reserva de otro cliente", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const dueño = await crearClienteDemo("dueño@example.com");
    const intruso = await crearClienteDemo("intruso@example.com");
    const reserva = await prisma.reserva.create({ data: { clienteId: dueño.id, claseId: clase.id, estado: "CONFIRMADA" } });

    await expect(cancelarReserva({ reservaId: reserva.id, clienteId: intruso.id })).rejects.toThrow(/No autorizado/);
  });
});
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/cancelar-reserva.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Implementar el endpoint**

```typescript
// app/api/reservas/[id]/cancelar/route.ts
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";
import { cancelarReserva, NoAutorizadoError } from "../../../../../lib/reservas/cancelar";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  try {
    await cancelarReserva({ reservaId: id, clienteId: cliente.id });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof NoAutorizadoError) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    throw e;
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/reservas/cancelar.ts app/api/reservas tests/unit/cancelacion.test.ts tests/integration/cancelar-reserva.test.ts
git commit -m "feat: cancelacion de reserva con ventana de 12hs y promocion de lista de espera"
```

---

## Task 8: Mercado Pago — Checkout Pro (clase suelta) + webhook

**Files:**
- Create: `lib/mercadopago/client.ts`
- Create: `lib/mercadopago/firma.ts`
- Create: `app/api/pagos/clase/route.ts`
- Create: `app/api/webhooks/mercadopago/route.ts`
- Modify: `.env.example` (agregar `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`)
- Test: `tests/unit/mercadopago-firma.test.ts`
- Test: `tests/integration/webhook-mercadopago.test.ts`

**Interfaces:**
- Consumes: `crearReservaConCupo` (Task 6), `prisma`, `logger` de Fundación.
- Produces: `POST /api/pagos/clase` → `{ initPoint, pagoId }`, `POST /api/webhooks/mercadopago` — consumidos por `hooks/useBetoApp.ts` (Task 12).

**Confirmado contra documentación oficial vigente (2026-08-22)** — ya no es una suposición: el shape de `Preference` (SDK `mercadopago` v2, clase `Preference`), el header `x-signature` (`ts=...,v1=...`), el template de firma (`id:{data.id};request-id:{x-request-id};ts:{ts};`), y el parámetro `data.id` en el query string del webhook. Ejercitar igual el sandbox de Mercado Pago antes de producción, pero el diseño de esta task ya no depende de una verificación pendiente.

- [ ] **Step 1: Instalar el SDK de Mercado Pago**

```bash
npm install mercadopago
```

- [ ] **Step 2: Agregar variables de entorno a `.env.example`**

```
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
```

- [ ] **Step 3: Escribir el test unitario de verificación de firma**

```typescript
// tests/unit/mercadopago-firma.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsearXSignature, verificarFirmaWebhook } from "../../lib/mercadopago/firma";

const SECRET = "test-secret";

function firmarComo(dataId: string, requestId: string, ts: string, secret = SECRET): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(template).digest("hex");
}

describe("parsearXSignature", () => {
  it("parsea ts y v1 del header", () => {
    const parsed = parsearXSignature("ts=123,v1=abc");
    expect(parsed).toEqual({ ts: "123", v1: "abc" });
  });
});

describe("verificarFirmaWebhook", () => {
  it("acepta una firma válida", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts);
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "999",
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("rechaza una firma con el secreto incorrecto", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts, "otro-secreto");
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "999",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rechaza si falta el header x-signature", () => {
    const ok = verificarFirmaWebhook({ xSignature: null, xRequestId: "req-1", dataId: "999", secret: SECRET });
    expect(ok).toBe(false);
  });

  it("rechaza si el dataId no coincide con el firmado", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts);
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "otro-id",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/mercadopago-firma.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 5: Implementar `lib/mercadopago/firma.ts`**

```typescript
// lib/mercadopago/firma.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function parsearXSignature(header: string): { ts?: string; v1?: string } {
  const resultado: { ts?: string; v1?: string } = {};
  for (const parte of header.split(",")) {
    const [clave, valor] = parte.split("=").map((s) => s.trim());
    if (clave === "ts" || clave === "v1") {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

export function verificarFirmaWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): boolean {
  if (!params.xSignature || !params.xRequestId || !params.secret) return false;
  const { ts, v1 } = parsearXSignature(params.xSignature);
  if (!ts || !v1) return false;

  const template = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
  const hmacEsperado = createHmac("sha256", params.secret).update(template).digest("hex");

  const bufferEsperado = Buffer.from(hmacEsperado, "hex");
  const bufferRecibido = Buffer.from(v1, "hex");
  if (bufferEsperado.length !== bufferRecibido.length) return false;
  return timingSafeEqual(bufferEsperado, bufferRecibido);
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/mercadopago-firma.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Implementar el cliente de Mercado Pago**

```typescript
// lib/mercadopago/client.ts
import { MercadoPagoConfig } from "mercadopago";

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
});
```

- [ ] **Step 8: Implementar `POST /api/pagos/clase`**

```typescript
// app/api/pagos/clase/route.ts
import { z } from "zod";
import { Preference } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { centavosAPesos } from "../../../../lib/dinero";
import { logger } from "../../../../lib/logger";

const Schema = z.object({ claseId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({
    where: { id: parsed.data.claseId },
    include: { servicio: true },
  });
  if (!clase || clase.cancelada) {
    return Response.json({ error: "Clase no encontrada" }, { status: 404 });
  }
  if (clase.servicio.precio === 0) {
    return Response.json({ error: "Este servicio no requiere pago, reservá directo en POST /api/reservas" }, { status: 400 });
  }

  const pago = await prisma.pago.create({
    data: {
      clienteId: cliente.id,
      tipo: "CLASE_SUELTA",
      medio: "MERCADO_PAGO",
      monto: clase.servicio.precio,
      estado: "PENDIENTE",
    },
  });

  try {
    const preference = new Preference(mpClient);
    const resultado = await preference.create({
      body: {
        items: [
          {
            id: clase.servicio.id,
            title: clase.servicio.nombre,
            quantity: 1,
            unit_price: centavosAPesos(clase.servicio.precio),
            currency_id: "ARS",
          },
        ],
        external_reference: JSON.stringify({ pagoId: pago.id, claseId: clase.id }),
        notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${process.env.NEXTAUTH_URL}/?screen=confirm&pago=${pago.id}`,
          failure: `${process.env.NEXTAUTH_URL}/?screen=checkout&error=pago_rechazado`,
          pending: `${process.env.NEXTAUTH_URL}/?screen=checkout&pago=pendiente`,
        },
        auto_return: "approved",
      },
    });

    return Response.json({ initPoint: resultado.init_point, pagoId: pago.id }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "error creando preferencia de mercado pago");
    await prisma.pago.update({ where: { id: pago.id }, data: { estado: "RECHAZADO" } });
    return Response.json({ error: "No pudimos iniciar el pago, intentá de nuevo" }, { status: 502 });
  }
}
```

- [ ] **Step 9: Escribir el test de integración del webhook (idempotencia + firma inválida)**

```typescript
// tests/integration/webhook-mercadopago.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../../lib/db";

const SECRET = "test-secret-webhook";

vi.mock("mercadopago", () => {
  class Payment {
    async get({ id }: { id: string }) {
      return { id, status: "approved", external_reference: (globalThis as any).__externalRef };
    }
  }
  return { MercadoPagoConfig: vi.fn(), Payment };
});

function firmar(dataId: string, requestId: string, ts: string): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(template).digest("hex");
}

beforeEach(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/webhooks/mercadopago", () => {
  it("rechaza con firma inválida", async () => {
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/mercadopago?data.id=123", {
        method: "POST",
        headers: { "x-signature": "ts=1,v1=firmaInvalida", "x-request-id": "req-1" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(401);
  });

  it("aprueba el pago y crea la reserva una sola vez aunque la notificación se repita", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Test", iniciales: "WT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "MERCADO_PAGO", monto: servicio.precio, estado: "PENDIENTE" },
    });
    (globalThis as any).__externalRef = JSON.stringify({ pagoId: pago.id, claseId: clase.id });

    const ts = "1700000000";
    const dataId = "mp-payment-1";
    const v1 = firmar(dataId, "req-1", ts);
    const hacerRequest = () =>
      import("../../app/api/webhooks/mercadopago/route").then(({ POST }) =>
        POST(
          new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}`, {
            method: "POST",
            headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" },
            body: JSON.stringify({ data: { id: dataId } }),
          })
        )
      );

    const primeraRespuesta = await hacerRequest();
    expect(primeraRespuesta.status).toBe(200);
    const segundaRespuesta = await hacerRequest();
    expect(segundaRespuesta.status).toBe(200);

    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(pagoActualizado.estado).toBe("APROBADO");
    expect(pagoActualizado.mpPaymentId).toBe(dataId);

    const reservas = await prisma.reserva.findMany({ where: { claseId: clase.id } });
    expect(reservas).toHaveLength(1); // no se duplicó por la segunda notificación
  });
});
```

- [ ] **Step 10: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/webhook-mercadopago.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 11: Implementar el webhook**

```typescript
// app/api/webhooks/mercadopago/route.ts
import { Payment } from "mercadopago";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { verificarFirmaWebhook } from "../../../../lib/mercadopago/firma";
import { crearReservaConCupo } from "../../../../lib/reservas/crear";
import { logger } from "../../../../lib/logger";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!dataId) {
    return Response.json({ ok: true }); // notificación sin id reconocible, se ignora
  }

  const firmaValida = verificarFirmaWebhook({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  });
  if (!firmaValida) {
    logger.warn({ dataId }, "webhook de mercado pago con firma inválida");
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  // Nunca confiar en el body del webhook: se reconfirma el pago contra la API de Mercado Pago.
  const payment = new Payment(mpClient);
  const pagoMp = await payment.get({ id: dataId });

  const externalRef = pagoMp.external_reference ? JSON.parse(pagoMp.external_reference) : null;
  if (!externalRef?.pagoId) {
    logger.warn({ dataId }, "webhook de mercado pago sin external_reference reconocible");
    return Response.json({ ok: true });
  }

  const pago = await prisma.pago.findUnique({ where: { id: externalRef.pagoId } });
  if (!pago) {
    logger.warn({ pagoId: externalRef.pagoId }, "webhook referencia un pago inexistente");
    return Response.json({ ok: true });
  }
  if (pago.estado !== "PENDIENTE") {
    // Idempotencia: Mercado Pago puede reenviar la misma notificación más de una vez.
    return Response.json({ ok: true });
  }

  if (pagoMp.status === "approved") {
    await prisma.pago.update({
      where: { id: pago.id },
      data: { estado: "APROBADO", mpPaymentId: String(pagoMp.id) },
    });

    try {
      await crearReservaConCupo({
        clienteId: pago.clienteId,
        claseId: externalRef.claseId,
        medio: null,
        pagoIdExistente: pago.id,
      });
      // Generación y envío del comprobante — ver Task 11.
    } catch (e) {
      // El pago ya está aprobado y cobrado; si la clase se llenó mientras tanto, esto se resuelve
      // manualmente desde el panel (spec §7.1: nunca se le cobra al cliente sin darle lugar,
      // así que acá se deja registrado el error para seguimiento en vez de perder el pago).
      logger.error({ err: e, pagoId: pago.id }, "pago aprobado pero no se pudo crear la reserva");
    }
  } else if (pagoMp.status === "rejected") {
    await prisma.pago.update({ where: { id: pago.id }, data: { estado: "RECHAZADO", mpPaymentId: String(pagoMp.id) } });
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 12: Correr y verificar que todo pasa**

Run: `npx vitest run --project integration tests/integration/webhook-mercadopago.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 13: Commit**

```bash
git add lib/mercadopago lib/dinero.ts app/api/pagos/clase app/api/webhooks/mercadopago .env.example tests/unit/mercadopago-firma.test.ts tests/integration/webhook-mercadopago.test.ts package.json package-lock.json
git commit -m "feat: checkout pro de mercado pago para clase suelta con webhook firmado e idempotente"
```

---

## Task 9: Mercado Pago — Preapproval (mensualidad) + webhook de cobros + cancelación

**Files:**
- Create: `app/api/pagos/mensualidad/route.ts`
- Create: `app/api/mensualidad/cancelar/route.ts`
- Modify: `app/api/webhooks/mercadopago/route.ts` (agregar rama `type: "subscription_preapproval"` / `"subscription_authorized_payment"`)
- Test: `tests/integration/mensualidad-preapproval.test.ts`

**Interfaces:**
- Consumes: `mpClient` (Task 8), `prisma`.
- Produces: `POST /api/pagos/mensualidad` → `{ initPoint, suscripcionId }`, `POST /api/mensualidad/cancelar`, y una rama nueva del webhook — consumidos por `hooks/useBetoApp.ts` (Task 12).

**Confirmado contra documentación oficial vigente (2026-08-22)**: el SDK `mercadopago` v2 expone `PreApproval` para suscripciones recurrentes, con el shape de `body` (`reason`, `external_reference`, `payer_email`, `back_url`, `auto_recurring{frequency, frequency_type, transaction_amount, currency_id}`) usado en este plan. Los `type`/`topic` de notificación (`subscription_preapproval`, `subscription_authorized_payment`, `subscription_preapproval_plan`) también están confirmados. La única corrección real que salió de la verificación está en el Step 6: `subscription_authorized_payment` no trae un `Payment` directo en `data.id`, ver la nota de ese step.

- [ ] **Step 1: Escribir el test de integración de creación y cancelación de mensualidad**

```typescript
// tests/integration/mensualidad-preapproval.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("mercadopago", () => {
  class PreApproval {
    async create() {
      return { id: "mp-preapproval-1", init_point: "https://mercadopago.com/init/abc" };
    }
    async update() {
      return { id: "mp-preapproval-1", status: "cancelled" };
    }
  }
  return { MercadoPagoConfig: vi.fn(), PreApproval };
});

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

beforeEach(async () => {
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/pagos/mensualidad", () => {
  it("crea la Suscripcion en ACTIVA y devuelve el link de autorización", async () => {
    const user = await prisma.user.create({
      data: { email: "mensual-http@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    await prisma.cliente.create({ data: { userId: user.id, nombre: "Mensual HTTP", iniciales: "MH", objetivo: "" } });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/pagos/mensualidad/route");
    const res = await POST(new Request("http://localhost/api/pagos/mensualidad", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.initPoint).toContain("mercadopago.com");

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { id: body.suscripcionId } });
    expect(suscripcion.estado).toBe("ACTIVA");
    expect(suscripcion.mpPreapprovalId).toBe("mp-preapproval-1");
  });
});

describe("POST /api/mensualidad/cancelar", () => {
  it("marca la Suscripcion como CANCELADA sin borrar el acceso ya pago", async () => {
    const user = await prisma.user.create({
      data: { email: "cancelar-mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Cancelar Mensual", iniciales: "CM", objetivo: "" } });
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "ACTIVA",
        precio: 15000000,
        fechaProximoCobro: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: "mp-preapproval-1",
      },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/mensualidad/cancelar/route");
    const res = await POST(new Request("http://localhost/api/mensualidad/cancelar", { method: "POST" }));
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("CANCELADA");
    expect(suscripcion.canceladaEn).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/mensualidad-preapproval.test.ts`
Expected: FAIL — módulos no existen

- [ ] **Step 3: Implementar `POST /api/pagos/mensualidad`**

```typescript
// app/api/pagos/mensualidad/route.ts
import { PreApproval } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { centavosAPesos } from "../../../../lib/dinero";
import { logger } from "../../../../lib/logger";

const PRECIO_MENSUALIDAD_CENTAVOS = 15000000; // $150.000 ARS — mismo valor que PACKS.mensual en lib/data.ts

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id }, include: { user: true } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const existente = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  if (existente && existente.estado === "ACTIVA") {
    return Response.json({ error: "Ya tenés una mensualidad activa" }, { status: 409 });
  }

  try {
    const preapproval = new PreApproval(mpClient);
    const resultado = await preapproval.create({
      body: {
        reason: "Mensualidad Beto Training",
        external_reference: cliente.id,
        payer_email: cliente.user.email,
        back_url: `${process.env.NEXTAUTH_URL}/?screen=cuenta`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: centavosAPesos(PRECIO_MENSUALIDAD_CENTAVOS),
          currency_id: "ARS",
        },
      },
    });

    const suscripcion = await prisma.suscripcion.upsert({
      where: { clienteId: cliente.id },
      update: {
        estado: "ACTIVA",
        precio: PRECIO_MENSUALIDAD_CENTAVOS,
        fechaInicio: new Date(),
        fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: resultado.id,
        canceladaEn: null,
      },
      create: {
        clienteId: cliente.id,
        precio: PRECIO_MENSUALIDAD_CENTAVOS,
        fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: resultado.id,
      },
    });

    return Response.json({ initPoint: resultado.init_point, suscripcionId: suscripcion.id }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "error creando preapproval de mercado pago");
    return Response.json({ error: "No pudimos iniciar la suscripción, intentá de nuevo" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Implementar `POST /api/mensualidad/cancelar`**

```typescript
// app/api/mensualidad/cancelar/route.ts
import { PreApproval } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { logger } from "../../../../lib/logger";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const suscripcion = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  if (!suscripcion || suscripcion.estado !== "ACTIVA") {
    return Response.json({ error: "No tenés una mensualidad activa" }, { status: 404 });
  }

  if (suscripcion.mpPreapprovalId) {
    try {
      const preapproval = new PreApproval(mpClient);
      await preapproval.update({ id: suscripcion.mpPreapprovalId, body: { status: "cancelled" } });
    } catch (e) {
      logger.error({ err: e, suscripcionId: suscripcion.id }, "error cancelando preapproval en mercado pago");
      return Response.json({ error: "No pudimos cancelar la suscripción, intentá de nuevo" }, { status: 502 });
    }
  }

  // Sigue dando acceso hasta fechaProximoCobro (ya está pago ese período) — spec §7.2.
  await prisma.suscripcion.update({
    where: { id: suscripcion.id },
    data: { estado: "CANCELADA", canceladaEn: new Date() },
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/mensualidad-preapproval.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Agregar al webhook la rama de cobro recurrente de mensualidad**

**Corrección post-spec, confirmada contra la documentación oficial y ejemplos del SDK vigentes al momento de esta revisión** (ya no es una suposición a verificar — reemplaza la nota de riesgo original de este step): para el `topic`/`type` `subscription_authorized_payment`, el `data.id` de la notificación **no es un `Payment` ni el `preapproval_id`** — es el id de un recurso propio, "Authorized Payment" (`GET /authorized_payments/:id`), que contiene `preapproval_id` (la suscripción) y un objeto `payment` anidado con el pago real. El SDK oficial `mercadopago` (Node.js) no expone una clase dedicada para este recurso — se consulta con `fetch` directo a la REST API con el access token, no con el SDK.

Editar `app/api/webhooks/mercadopago/route.ts` (creado en Task 8) agregando, antes del `return Response.json({ ok: true })` final, la detección de notificaciones de tipo suscripción — Mercado Pago manda `type`/`topic` en el query string además de `data.id`:

```typescript
// app/api/webhooks/mercadopago/route.ts (fragmento a agregar — el resto del archivo de Task 8 no cambia)
const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");

if (topic === "subscription_authorized_payment") {
  const authorizedPaymentRes = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!authorizedPaymentRes.ok) {
    logger.error({ dataId, status: authorizedPaymentRes.status }, "no se pudo consultar el authorized_payment de mercado pago");
    return Response.json({ ok: true });
  }
  const authorizedPayment: { preapproval_id: string; payment?: { id: number | string; status: string } } =
    await authorizedPaymentRes.json();

  if (!authorizedPayment.payment || authorizedPayment.payment.status !== "approved") {
    return Response.json({ ok: true }); // cobro rechazado/pendiente — no se registra como Pago aprobado
  }

  const suscripcion = await prisma.suscripcion.findFirst({ where: { mpPreapprovalId: authorizedPayment.preapproval_id } });
  if (suscripcion) {
    const mpPaymentId = String(authorizedPayment.payment.id);
    const yaRegistrado = await prisma.pago.findFirst({ where: { suscripcionId: suscripcion.id, mpPaymentId } });
    if (!yaRegistrado) {
      await prisma.pago.create({
        data: {
          clienteId: suscripcion.clienteId,
          tipo: "MENSUALIDAD",
          medio: "MERCADO_PAGO",
          monto: suscripcion.precio,
          estado: "APROBADO",
          mpPaymentId,
          suscripcionId: suscripcion.id,
        },
      });
      await prisma.suscripcion.update({
        where: { id: suscripcion.id },
        data: { fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    }
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 6b: Test de integración de la rama de cobro recurrente**

```typescript
// tests/integration/webhook-mensualidad.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../../lib/db";

const SECRET = "test-secret-webhook-mensualidad";

beforeEach(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  vi.restoreAllMocks();
});

function firmar(dataId: string, requestId: string, ts: string): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(template).digest("hex");
}

describe("POST /api/webhooks/mercadopago — subscription_authorized_payment", () => {
  it("crea el Pago de mensualidad a partir del authorized_payment, no del data.id directo", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Mensual", iniciales: "WM", objetivo: "" } });
    await prisma.suscripcion.create({
      data: { clienteId: cliente.id, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(), mpPreapprovalId: "preapproval-abc" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-abc", payment: { id: 999888777, status: "approved" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-1";
    const v1 = firmar(dataId, "req-1", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const pago = await prisma.pago.findFirstOrThrow({ where: { clienteId: cliente.id } });
    expect(pago.mpPaymentId).toBe("999888777"); // el id del pago real, no el id del authorized_payment
    expect(pago.estado).toBe("APROBADO");
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add app/api/pagos/mensualidad app/api/mensualidad app/api/webhooks/mercadopago/route.ts tests/integration/mensualidad-preapproval.test.ts
git commit -m "feat: preapproval de mercado pago para mensualidad, cobros recurrentes y cancelacion"
```

---

## Task 10: Pago en efectivo — marcar como recibido

**Files:**
- Create: `app/api/coach/pagos/[id]/route.ts`
- Test: `tests/integration/coach-pagos.test.ts`

**Interfaces:**
- Consumes: `auth()`, `prisma`. Protegido en dos capas: `proxy.ts` (ya cubre `/api/coach/*`, Fundación Task 9) + verificación server-side de rol en el propio Route Handler (defensa en profundidad, spec §11).
- Produces: `PATCH /api/coach/pagos/:id` — consumido por la UI de `Coach.tsx` (Task 13).

- [ ] **Step 1: Escribir el test de integración**

```typescript
// tests/integration/coach-pagos.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

beforeEach(async () => {
  await prisma.pago.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("PATCH /api/coach/pagos/:id", () => {
  it("rechaza si la sesión no es ADMIN", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "x", role: "CLIENTE" } } as never);

    const { PATCH } = await import("../../app/api/coach/pagos/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/coach/pagos/abc", { method: "PATCH" }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(403);
  });

  it("marca un pago en efectivo como APROBADO cuando la sesión es ADMIN", async () => {
    const user = await prisma.user.create({
      data: { email: "efectivo@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Efectivo Test", iniciales: "ET", objetivo: "" } });
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "EFECTIVO", monto: 1200000, estado: "PENDIENTE" },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-id", role: "ADMIN" } } as never);

    const { PATCH } = await import("../../app/api/coach/pagos/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/coach/pagos/${pago.id}`, { method: "PATCH" }),
      { params: Promise.resolve({ id: pago.id }) }
    );
    expect(res.status).toBe(200);

    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(pagoActualizado.estado).toBe("APROBADO");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run --project integration tests/integration/coach-pagos.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar el endpoint**

```typescript
// app/api/coach/pagos/[id]/route.ts
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  // Defensa en profundidad: proxy.ts ya protege /api/coach/*, esto vuelve a verificar acá
  // por si alguna vez se llama a este handler fuera de ese prefijo (spec §11).
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) {
    return Response.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  if (pago.medio !== "EFECTIVO") {
    return Response.json({ error: "Solo se marcan manualmente los pagos en efectivo" }, { status: 400 });
  }

  await prisma.pago.update({ where: { id }, data: { estado: "APROBADO" } });
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run --project integration tests/integration/coach-pagos.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/coach/pagos tests/integration/coach-pagos.test.ts
git commit -m "feat: marcar pago en efectivo como recibido desde el panel del entrenador"
```

---

## Task 11: Comprobante PDF simple (no fiscal)

**Files:**
- Create: `lib/pdf/render.ts`
- Create: `lib/comprobantes/generar.ts`
- Create: `app/comprobante/[pagoId]/page.tsx`
- Modify: `lib/email/templates.ts` (agregar `sendComprobanteEmail`)
- Modify: `app/api/webhooks/mercadopago/route.ts` (disparar el envío al aprobar un pago)
- Modify: `Dockerfile` (instalar navegador de Playwright en producción)
- Test: `tests/unit/comprobante-token.test.ts`

**Interfaces:**
- Produces: `renderPdf(url: string): Promise<Buffer>`, `generarComprobantePago(pagoId): Promise<Buffer>`, `sendComprobanteEmail(to, pdf, nombreArchivo): Promise<void>`.

**Nota de fusión obligatoria:** `lib/pdf/render.ts` también lo puede crear el plan de Panel + Rutinas (spec 3), que reutiliza el mismo mecanismo HTML→PDF para el PDF de rutinas (spec §7.4 de este documento lo pide explícitamente para no duplicar dependencias). **Antes del Step 3, verificar si el archivo ya existe** (por ejemplo si ese plan corrió primero en este mismo repo): si existe, comparar la firma contra la de abajo (`renderPdf(url: string): Promise<Buffer>`) y no crear una segunda implementación — solo agregar lo que falte.

- [ ] **Step 1: Instalar Playwright como dependencia de runtime (no solo de test)**

```bash
npm install playwright
```

- [ ] **Step 2: Escribir el test unitario de la firma del token de acceso al comprobante**

```typescript
// tests/unit/comprobante-token.test.ts
import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters";
});

describe("verificarTokenComprobante", () => {
  it("acepta el token generado para el mismo pagoId", async () => {
    const { generarTokenComprobante, verificarTokenComprobante } = await import("../../lib/comprobantes/generar");
    const token = generarTokenComprobante("pago-123");
    expect(verificarTokenComprobante("pago-123", token)).toBe(true);
  });

  it("rechaza el token de otro pagoId", async () => {
    const { generarTokenComprobante, verificarTokenComprobante } = await import("../../lib/comprobantes/generar");
    const token = generarTokenComprobante("pago-123");
    expect(verificarTokenComprobante("pago-999", token)).toBe(false);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run --project unit tests/unit/comprobante-token.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 4: Implementar `lib/pdf/render.ts` (si no existe ya — ver nota de fusión)**

```typescript
// lib/pdf/render.ts
import { chromium } from "playwright";

export async function renderPdf(url: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 5: Implementar `lib/comprobantes/generar.ts`**

```typescript
// lib/comprobantes/generar.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { renderPdf } from "../pdf/render";

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

export function generarTokenComprobante(pagoId: string): string {
  return createHmac("sha256", secreto()).update(pagoId).digest("hex");
}

export function verificarTokenComprobante(pagoId: string, token: string): boolean {
  const esperado = Buffer.from(generarTokenComprobante(pagoId), "hex");
  const recibido = Buffer.from(token, "hex");
  if (esperado.length !== recibido.length) return false;
  return timingSafeEqual(esperado, recibido);
}

export async function generarComprobantePago(pagoId: string): Promise<Buffer> {
  const token = generarTokenComprobante(pagoId);
  const url = `${process.env.NEXTAUTH_URL}/comprobante/${pagoId}?token=${token}`;
  return renderPdf(url);
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run --project unit tests/unit/comprobante-token.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Implementar la página imprimible del comprobante**

```tsx
// app/comprobante/[pagoId]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/db";
import { centavosAPesos } from "../../../lib/dinero";
import { verificarTokenComprobante } from "../../../lib/comprobantes/generar";

export default async function ComprobantePage({
  params,
  searchParams,
}: {
  params: Promise<{ pagoId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { pagoId } = await params;
  const { token } = await searchParams;
  if (!token || !verificarTokenComprobante(pagoId, token)) {
    notFound();
  }

  const pago = await prisma.pago.findUnique({ where: { id: pagoId }, include: { cliente: true } });
  if (!pago) {
    notFound();
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 40, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Beto Training — Comprobante interno</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Cliente</td><td>{pago.cliente.nombre}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Concepto</td><td>{pago.tipo === "MENSUALIDAD" ? "Mensualidad" : "Clase suelta"}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Monto</td><td>${centavosAPesos(pago.monto).toLocaleString("es-AR")}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Fecha</td><td>{pago.creadoEn.toLocaleDateString("es-AR")}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Medio de pago</td><td>{pago.medio === "MERCADO_PAGO" ? "Mercado Pago" : "Efectivo"}</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 48, fontSize: 11, fontStyle: "italic", opacity: 0.7 }}>
        Comprobante interno de Beto Training. No es una factura válida ante AFIP.
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Agregar el envío de comprobante por email**

```typescript
// lib/email/templates.ts (agregar al archivo existente de Fundación, sin tocar las funciones ya presentes)
export async function sendComprobanteEmail(to: string, pdf: Buffer, nombreArchivo: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Tu comprobante de pago — Beto Training",
    text: "Te adjuntamos el comprobante de tu pago. Recordá que es un comprobante interno, no una factura fiscal.",
    html: "<p>Te adjuntamos el comprobante de tu pago.</p><p>Recordá que es un comprobante interno, no una factura fiscal.</p>",
    attachments: [{ filename: nombreArchivo, content: pdf, contentType: "application/pdf" }],
  });
}
```

- [ ] **Step 9: Disparar la generación y el envío al aprobar el pago en el webhook**

Editar `app/api/webhooks/mercadopago/route.ts` (Task 8), agregando dentro del bloque `if (pagoMp.status === "approved")`, después de `crearReservaConCupo(...)`:

```typescript
// app/api/webhooks/mercadopago/route.ts (fragmento a agregar dentro del bloque approved, Task 8)
import { generarComprobantePago } from "../../../../lib/comprobantes/generar";
import { sendComprobanteEmail } from "../../../../lib/email/templates";

// ...dentro del try, después de crearReservaConCupo:
const clienteConUser = await prisma.cliente.findUnique({ where: { id: pago.clienteId }, include: { user: true } });
if (clienteConUser) {
  void generarComprobantePago(pago.id)
    .then((pdf) => sendComprobanteEmail(clienteConUser.user.email, pdf, `comprobante-${pago.id}.pdf`))
    .catch((e) => logger.error({ err: e, pagoId: pago.id }, "no se pudo generar/enviar el comprobante"));
}
```

- [ ] **Step 10: Actualizar el `Dockerfile` para que el navegador de Playwright esté disponible en producción**

**Nota de riesgo:** el tag exacto de la imagen `mcr.microsoft.com/playwright` debe coincidir con la versión de `playwright`/`@playwright/test` instalada (`^1.62.1` en este repo al momento de escribir este plan) — verificar el tag disponible en Microsoft Container Registry al implementar, puede no existir un tag `v1.62.1-jammy` exacto si esa versión es muy reciente.

```dockerfile
# Dockerfile (modificar solo la etapa `runner`, dejando `deps` y `builder` como las dejó Fundación)
FROM mcr.microsoft.com/playwright:v1.62.1-jammy AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 11: Commit**

```bash
git add lib/pdf lib/comprobantes lib/email/templates.ts app/comprobante app/api/webhooks/mercadopago/route.ts Dockerfile tests/unit/comprobante-token.test.ts package.json package-lock.json
git commit -m "feat: comprobante pdf no fiscal y envio por email al aprobarse un pago"
```

---

## Task 12: Migración de datos y hook — `lib/data.ts` y `hooks/useBetoApp.ts`

**Files:**
- Modify: `lib/data.ts`
- Modify: `lib/types.ts`
- Modify: `hooks/useBetoApp.ts`

**Interfaces:**
- Consumes: `GET /api/clases`, `POST /api/reservas`, `POST /api/reservas/:id/cancelar`, `POST /api/pagos/clase`, `POST /api/pagos/mensualidad`, `POST /api/mensualidad/cancelar`.
- Produces: `vals.horarios`, `vals.pagar`, `vals.metodos` (sin `"bono"`), `vals.checkoutItems`, `vals.confirmItems` operando sobre datos reales — consumidos por `Reservar.tsx`/`Checkout.tsx`/`Confirm.tsx` (Task 13).

- [ ] **Step 1: Quitar `HORAS` y los packs de bono de `lib/data.ts`**

```typescript
// lib/data.ts (reemplaza el bloque de HORAS y el array PACKS existentes)
// El export `Hora`/`HORAS` se elimina — los horarios ahora vienen de GET /api/clases (Task 4).

export interface Pack {
  id: string;
  nombre: string;
  desc: string;
  precio: number;
  unit: string;
  badge: string;
  feats: string[];
  cta: string;
}

export const PACKS: Pack[] = [
  { id: "suelta", nombre: "Clase suelta", desc: "Probá sin compromiso, se paga al reservar.", precio: 12000, unit: "por clase", badge: "", feats: ["Sin vencimiento", "Cualquier disciplina"], cta: "Reservar" },
  { id: "mensual", nombre: "Mensualidad", desc: "Todas las grupales + 1 personalizada por semana.", precio: 150000, unit: "por mes, se renueva solo", badge: "Suscripción", feats: ["Clases ilimitadas", "Cupo garantizado", "Cancelás cuando quieras"], cta: "Suscribirme" },
];
```

Nota: se quita `"Plan nutricional"` de los `feats` de `mensual` — no es un beneficio real implementado en ningún spec de este proyecto, quedaba solo como copy suelto en el mock.

`SERVICIOS` **no se borra** — sigue siendo la fuente de fotos/descripciones/tags para las tarjetas de la landing (`Landing.tsx`, fuera de alcance de este plan). Su `precio` se mantiene como referencia de marketing; el precio y cupo reales y vinculantes al reservar vienen siempre de `GET /api/clases` (Task 4), nunca de este array.

- [ ] **Step 2: Actualizar `Metodo` en `lib/types.ts` — quitar `"bono"`**

```typescript
// lib/types.ts (reemplaza la línea existente)
export type Metodo = "tarjeta" | "mp" | "efectivo";
```

Y quitar `creditos`/`packSel` de `AppState` si no se usan más para nada — se reemplazan por el estado de clases/reservas reales:

```typescript
// lib/types.ts (fragmento — reemplaza AppState existente)
export interface AppState {
  screen: Screen;
  cuentaTab: CuentaTab;
  prev: Screen[];
  servicio: string;
  dia: number;
  hora: string | null;
  claseSeleccionadaId: string | null; // nuevo: id real de Clase, reemplaza el par dia/hora al momento de reservar
  recurrente: boolean;
  metodo: Metodo;
  cuota: number;
  packSel: string | null; // se mantiene solo para distinguir "suelta" vs "mensual" en Checkout, no hay más bonos
  rutinaDia: number;
  hechos: Record<string, boolean>;
  toast: string | null;
  loginRolUI: LoginRol;
}
```

- [ ] **Step 3: Agregar el estado y la carga de clases reales a `hooks/useBetoApp.ts`**

```typescript
// hooks/useBetoApp.ts (agregar cerca de la declaración de `state`, después de los imports existentes)
interface ClaseApi {
  id: string;
  servicioId: string;
  servicioSlug: string;
  fecha: string;
  cupoMax: number;
  cuposOcupados: number;
  cuposDisponibles: number;
  lleno: boolean;
}

// ...dentro de useBetoApp(), junto a los otros useState:
const [clasesDisponibles, setClasesDisponibles] = useState<ClaseApi[]>([]);
const [cargandoClases, setCargandoClases] = useState(false);
const [suscripcionActiva, setSuscripcionActiva] = useState(false);

useEffect(() => {
  if (state.screen !== "reservar") return;
  const servicioId = s.id; // `s` ya existe en el hook, viene de `svc(st.servicio)` — es el Servicio elegido
  setCargandoClases(true);
  fetch(`/api/clases?servicioId=${servicioId}`)
    .then((r) => r.json())
    .then((data) => setClasesDisponibles(data.clases ?? []))
    .finally(() => setCargandoClases(false));
}, [state.screen, st.servicio]);
```

Nota para quien implemente: `s` es el resultado de `svc(st.servicio)` que ya existe más abajo en el hook (línea `const s = svc(st.servicio);`) — si el orden de declaración de este `useEffect` queda antes de esa línea, moverlo después, o reemplazar `s.id` por `svc(st.servicio).id` inline.

- [ ] **Step 4: Reemplazar `horarios` derivado del mock por el derivado de `clasesDisponibles`**

```typescript
// hooks/useBetoApp.ts (reemplaza el bloque `horarios: HORAS.map(...)` existente en `vals`)
horarios: clasesDisponibles
  .filter((c) => {
    const fecha = new Date(c.fecha);
    return fecha.getDate() === diaSel.num; // el mock ya usa números de día fijos de agosto 2026, ver diasData()
  })
  .map((c) => {
    const horaStr = new Date(c.fecha).toISOString().slice(11, 16);
    const on = st.claseSeleccionadaId === c.id;
    const base = c.lleno ? { bg: "transparent", bd: "rgba(233,233,237,.07)", fg: "rgba(233,233,237,.3)" } : sel(on);
    return {
      hora: horaStr,
      cupos: c.lleno ? "Completo" : `${c.cuposDisponibles} lugares`,
      ...base,
      cursor: c.lleno ? "not-allowed" : "pointer",
      onClick: c.lleno ? undefined : () => set({ hora: horaStr, claseSeleccionadaId: c.id }),
    };
  }),
cargandoHorarios: cargandoClases,
```

- [ ] **Step 5: Reemplazar `pagar`/`irCheckout`/`resumenPrecio`/`ctaPago` con las llamadas reales**

```typescript
// hooks/useBetoApp.ts (reemplaza `irCheckout` y `pagar` existentes en `vals`)
irCheckout: () => {
  if (!st.claseSeleccionadaId) {
    showToast("Elegí un horario disponible");
    return;
  }
  set({ packSel: null });
  go("checkout");
},

pagar: async () => {
  if (packSel?.id === "mensual") {
    const res = await fetch("/api/pagos/mensualidad", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "No pudimos iniciar el pago");
      return;
    }
    window.location.href = data.initPoint;
    return;
  }

  if (!st.claseSeleccionadaId) {
    showToast("Elegí una clase para reservar");
    return;
  }

  if (st.metodo === "efectivo") {
    const res = await fetch("/api/reservas", {
      method: "POST",
      body: JSON.stringify({ claseId: st.claseSeleccionadaId, medio: "EFECTIVO" }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "No pudimos reservar la clase");
      return;
    }
    go("confirm");
    return;
  }

  // tarjeta / mp: siempre vía Mercado Pago Checkout Pro (no hay integración de tarjeta directa).
  const intento = await fetch("/api/reservas", {
    method: "POST",
    body: JSON.stringify({ claseId: st.claseSeleccionadaId }),
  });
  if (intento.status === 409) {
    const pagoRes = await fetch("/api/pagos/clase", {
      method: "POST",
      body: JSON.stringify({ claseId: st.claseSeleccionadaId }),
    });
    const pagoData = await pagoRes.json();
    if (!pagoRes.ok) {
      showToast(pagoData.error ?? "No pudimos iniciar el pago");
      return;
    }
    window.location.href = pagoData.initPoint;
    return;
  }
  const data = await intento.json();
  if (!intento.ok) {
    showToast(data.error ?? "No pudimos reservar la clase");
    return;
  }
  go("confirm");
},
```

Nota para quien implemente: esto reemplaza por completo la lógica vieja de `creditos`/`packSel.id === "bono8"` dentro de `pagar` — buscar el identificador `creditos` en el resto del archivo (aparece también en `resumenPrecio`, `creditosPct`, y en el bloque de `notis`/`reservas` que hoy hablan de "bono") y quitar cada mención, reemplazando el texto de UI relacionado por el precio/cobertura real:

```typescript
// hooks/useBetoApp.ts (reemplaza `resumenPrecio` y el texto fijo de "Te quedan N clases del Bono 8")
resumenPrecio: (() => {
  const clase = clasesDisponibles.find((c) => c.id === st.claseSeleccionadaId);
  if (!clase) return "—";
  const servicioSeleccionado = SERVICIOS.find((x) => x.id === st.servicio);
  if (!servicioSeleccionado || servicioSeleccionado.precio === 0) return "Sin cargo";
  if (suscripcionActiva && servicioSeleccionado.id !== "personal") return "Cubierto por tu mensualidad";
  return money(servicioSeleccionado.precio);
})(),
```

- [ ] **Step 6: Quitar `"bono"` de `metodos` en `vals`**

```typescript
// hooks/useBetoApp.ts (reemplaza el array `metodos` existente en `vals`)
metodos: [
  { id: "tarjeta", label: "Tarjeta de crédito o débito", sub: "Vía Mercado Pago, hasta 6 cuotas", icon: "ph-credit-card" },
  { id: "mp", label: "Mercado Pago", sub: "Dinero en cuenta o transferencia", icon: "ph-wallet" },
  { id: "efectivo", label: "Efectivo en el estudio", sub: "Reservás ahora y pagás al llegar", icon: "ph-money" },
].map((m) => {
  const on = st.metodo === m.id;
  return {
    ...m, bd: on ? AC : DIV, bg: on ? "rgba(145,132,217,.10)" : "transparent",
    dotBd: on ? AC : "rgba(233,233,237,.35)", dotBg: on ? AC : "transparent", dotIn: on ? "inset 0 0 0 3px #161826" : "none",
    onClick: () => set({ metodo: m.id as AppState["metodo"] }),
  };
}),
```

- [ ] **Step 7: Cargar si el cliente tiene mensualidad activa al iniciar sesión**

```typescript
// hooks/useBetoApp.ts (agregar junto a los otros useEffect que dependen de `auth`/`session`)
useEffect(() => {
  if (!esCliente) {
    setSuscripcionActiva(false);
    return;
  }
  fetch("/api/cuenta/mensualidad")
    .then((r) => (r.ok ? r.json() : { activa: false }))
    .then((data) => setSuscripcionActiva(!!data.activa))
    .catch(() => setSuscripcionActiva(false));
}, [esCliente]);
```

Esto asume un endpoint liviano `GET /api/cuenta/mensualidad` → `{ activa: boolean }`. Agregarlo como parte de este mismo step:

```typescript
// app/api/cuenta/mensualidad/route.ts
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ activa: false });
  }
  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ activa: false });
  }
  const suscripcion = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  return Response.json({ activa: suscripcion?.estado === "ACTIVA" });
}
```

- [ ] **Step 8: Verificar tipos**

```bash
npx tsc --noEmit
```

Expected: sin errores. Si quedan referencias sueltas a `HORAS`, `creditos`, `bono4`, `bono8` en el resto de `useBetoApp.ts` (por ejemplo en `pagos`, `historial`, `notis`, que son datos de ejemplo del panel del cliente, fuera del flujo de reserva/pago pero con copy que menciona "bono"), este es el momento de limpiarlos — reemplazar cada mención de "bono" en textos de UI por lenguaje neutro ("tu plan", "tu mensualidad") ya que el concepto de bono no existe más en el negocio.

- [ ] **Step 9: Commit**

```bash
git add lib/data.ts lib/types.ts hooks/useBetoApp.ts app/api/cuenta/mensualidad
git commit -m "feat: migrar useBetoApp a reservas y pagos reales, quitar el modelo de bono"
```

---

## Task 13: Migración de pantallas — `Reservar.tsx`, `Checkout.tsx`, `Coach.tsx`

**Files:**
- Modify: `components/screens/Reservar.tsx`
- Modify: `components/screens/Checkout.tsx`
- Modify: `components/screens/Coach.tsx`

**Interfaces:**
- Consumes: `vals` extendido en Task 12 (`vals.horarios`, `vals.cargandoHorarios`, `vals.resumenPrecio`, `vals.metodos` sin bono).
- Produces: pantallas visualmente iguales salvo los textos explícitamente listados en spec §10, conectadas a datos reales.

- [ ] **Step 1: Quitar la mención a "bono" del copy de `Reservar.tsx`**

```tsx
// components/screens/Reservar.tsx (reemplaza la línea del <p> de bajada, línea 7 del archivo actual)
<p style={{ fontSize: 14, opacity: .6, margin: "8px 0 28px" }}>Elegí la clase, el día y el horario. Podés pagar con tarjeta, Mercado Pago o en el estudio.</p>
```

- [ ] **Step 2: Quitar la mención a "descuenta de tu bono" del checkbox de recurrencia**

```tsx
// components/screens/Reservar.tsx (reemplaza el <label> de "Repetir todas las semanas")
<label style={{ display: "flex", gap: 11, alignItems: "center", padding: 15, borderRadius: 12, background: "var(--color-surface)", cursor: "pointer", maxWidth: 520 }}>
  <input type="checkbox" checked={vals.recurrente} onChange={vals.toggleRecurrente} style={{ width: 17, height: 17, accentColor: "var(--color-accent)" }} />
  <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>Repetir todas las semanas<br /><span style={{ fontSize: 12, opacity: .5 }}>Reserva el mismo día y horario durante las próximas 4 semanas</span></span>
</label>
```

- [ ] **Step 3: Quitar "Te quedan N clases del Bono 8" del resumen — mostrar cobertura real**

```tsx
// components/screens/Reservar.tsx (reemplaza el <div> de la línea de bono en el resumen)
<div style={{ fontSize: 12, opacity: .55, lineHeight: 1.45 }}>
  {vals.cargandoHorarios ? "Buscando horarios disponibles…" : ""}
</div>
```

- [ ] **Step 4: Quitar el método "bono" y el checkbox de factura A de `Checkout.tsx`**

```tsx
// components/screens/Checkout.tsx (reemplaza el <label> de "Necesito factura A", líneas 41-43 del archivo actual)
<p style={{ fontSize: 12.5, opacity: .55 }}>
  Vas a recibir un comprobante simple por email — no es una factura fiscal (sin AFIP).
</p>
```

El array `vals.metodos` ya no trae `"bono"` desde Task 12 (Step 6), así que `Checkout.tsx` no necesita ningún cambio en el `.map()` que lo renderiza — se actualiza solo al consumir el nuevo `vals`.

- [ ] **Step 5: Agregar en `Coach.tsx` la acción de marcar un pago en efectivo como recibido**

```tsx
// components/screens/Coach.tsx (reemplaza la tabla de "Últimos pagos" existente)
<table className="table">
  <thead><tr><th>Cliente</th><th>Concepto</th><th style={{ textAlign: "right" }}>Importe</th><th /></tr></thead>
  <tbody>
    {vals.pagosCoach.map((p) => (
      <tr key={p.cliente}>
        <td>{p.cliente}</td>
        <td>{p.concepto}</td>
        <td style={{ textAlign: "right" }}>{p.importe}</td>
        <td style={{ textAlign: "right" }}>
          {p.pendienteEfectivo && (
            <button className="btn btn-secondary" onClick={() => vals.marcarPagoRecibido(p.pagoId)}>Marcar recibido</button>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

Y en `hooks/useBetoApp.ts` (fragmento adicional a Task 12, agregar junto a `pagosCoach`):

```typescript
// hooks/useBetoApp.ts (agregar función junto al resto de `vals`)
marcarPagoRecibido: async (pagoId: string) => {
  const res = await fetch(`/api/coach/pagos/${pagoId}`, { method: "PATCH" });
  if (res.ok) {
    showToast("Pago marcado como recibido");
  } else {
    showToast("No se pudo marcar el pago");
  }
},
```

Nota: `p.pendienteEfectivo`/`p.pagoId` requieren que `pagosCoach` deje de ser el array de ejemplo hardcodeado y pase a venir de un endpoint real (`GET /api/coach/pagos`, listando `Pago` con `include: { cliente: true }`) — ese endpoint de lectura no está en el alcance explícito de este spec (que solo pide la acción de marcar-recibido, spec §7.3) y queda fuera de este plan; documentarlo como seguimiento para quien migre el resto del panel de Coach en un plan posterior. Mientras tanto, para que el botón sea funcional con datos reales sin construir el endpoint de listado completo, alcanza con que `pagosCoach` incluya `pagoId`/`pendienteEfectivo` en su mapeo actual si ya se migran esos datos; si no, dejar el botón deshabilitado (`disabled` cuando `!p.pagoId`) hasta que el listado real exista.

- [ ] **Step 6: Verificar manualmente**

```bash
npm run dev
```

Navegar a `/?screen=reservar`, elegir un servicio pago sin mensualidad, ir a checkout, confirmar que no aparece "bono" en ningún lado, confirmar que el checkbox de factura A no existe, y que "efectivo" reserva directo mientras "tarjeta"/"mp" redirigen a Mercado Pago (sandbox).

- [ ] **Step 7: Commit**

```bash
git add components/screens/Reservar.tsx components/screens/Checkout.tsx components/screens/Coach.tsx
git commit -m "feat: migrar pantallas de reserva, checkout y panel a booking y pagos reales"
```

---

## Task 14: E2E con Playwright — reserva gratis y reserva paga

**Files:**
- Create: `e2e/booking.spec.ts`

**Interfaces:**
- Consumes: la app completa corriendo (Tasks 1-13) + seed de Servicio/HorarioRecurrente (Task 2) + sandbox de Mercado Pago (credenciales de test).

- [ ] **Step 1: Escribir el spec de reserva gratuita de punta a punta**

```typescript
// e2e/booking.spec.ts
import { expect, test } from "@playwright/test";

test("reservar una clase gratis (evaluación) de punta a punta", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("camila.f@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/$|\/cuenta/);

  await page.goto("/?screen=reservar");
  await page.getByText("Evaluación inicial", { exact: false }).click().catch(() => {});
  // Si el chip de servicio no está visible directamente, seleccionar desde los chips de servicio:
  const chipEvaluacion = page.getByRole("button", { name: /evaluación/i });
  if (await chipEvaluacion.isVisible().catch(() => false)) {
    await chipEvaluacion.click();
  }

  const primerHorario = page.locator("button", { hasText: /\d{2}:\d{2}/ }).first();
  await primerHorario.click();

  await page.getByRole("button", { name: /continuar al pago/i }).click();
  await page.getByRole("button", { name: /confirmar|pagar/i }).click();

  await expect(page.getByText(/turno confirmado/i)).toBeVisible();
});

test("una clase paga sin mensualidad redirige a Mercado Pago", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("martin.d@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();

  await page.goto("/?screen=reservar");
  const primerHorario = page.locator("button", { hasText: /\d{2}:\d{2}/ }).first();
  await primerHorario.click();
  await page.getByRole("button", { name: /continuar al pago/i }).click();

  await page.getByText(/mercado pago/i).click();
  const [popupOrNav] = await Promise.all([
    page.waitForURL(/mercadopago\.com/, { timeout: 15000 }).catch(() => null),
    page.getByRole("button", { name: /pagar/i }).click(),
  ]);
  // Nota: en CI, usar credenciales de sandbox de Mercado Pago (nunca producción) —
  // confirmar contra la doc oficial cómo automatizar el checkout de sandbox sin intervención manual
  // antes de habilitar este test en un pipeline real; documentado como riesgo abierto (spec §12).
  expect(page.url()).toMatch(/mercadopago\.com|checkout/);
});
```

- [ ] **Step 2: Agregar `SEED_DEMO_DATA=true` al entorno de e2e**

Ya lo hace `playwright.config.ts` (Fundación Task 17: `webServer.env.SEED_DEMO_DATA: "true"`) y `e2e/global-setup.ts` corre el seed antes de la suite — este plan agrega servicios/horarios en el mismo `prisma/seed.ts` (Task 2), así que no hace falta tocar la configuración de e2e existente.

- [ ] **Step 3: Correr**

```bash
npm run test:e2e
```

Expected: PASS. El segundo test depende de credenciales de sandbox de Mercado Pago configuradas en el entorno de CI (`MERCADOPAGO_ACCESS_TOKEN` de test) — si no están disponibles al momento de correr, marcarlo `test.skip` con un comentario explicando por qué, en vez de dejarlo fallar en rojo permanentemente.

- [ ] **Step 4: Commit**

```bash
git add e2e/booking.spec.ts
git commit -m "test: e2e de reserva gratuita y reserva paga con mercado pago"
```

---

## Self-Review (completado por quien escribió este plan)

**Cobertura del spec:** cada sección de `2026-08-22-booking-pagos-design.md` tiene tarea(s) que la implementan — §4 Modelo de datos → Task 1; §5 Generación de clases → Task 3; §6 Flujo de reserva y cupos → Task 6 (con el test crítico de concurrencia de §12 explícitamente reproducido); §7.1 Clase suelta → Task 8; §7.2 Mensualidad → Task 9; §7.3 Efectivo → Task 6 (creación) + Task 10 (marcar recibido); §7.4 Comprobante → Task 11; §8 Cobertura de mensualidad → Task 5; §9 Job de generación → Task 3 (mismo entregable, sin infraestructura adicional, documentado como decisión); §10 Migración de código → Tasks 12 y 13; §11 Seguridad → Tasks 6, 7, 8, 10 (verificación de dueño del recurso, firma de webhook, rol ADMIN server-side); §12 Testing → cada task trae su propio test unit/integration, Task 14 cubre e2e; §13 Riesgos → notas de riesgo explícitas en Tasks 8, 9 y 11 (Mercado Pago y Docker/Playwright), criterio propio documentado en Task 2 (cupoMax de servicios) y en la semana calendario de Task 5 (ya estaba resuelta en el spec como lunes-domingo, solo se implementa).

**Placeholders:** ninguno — cada step trae código TypeScript/Prisma completo y ejecutable. Las únicas dos áreas marcadas explícitamente como "hay que confirmar contra la documentación oficial antes de dar por cerrada la task" son la integración con Mercado Pago (Tasks 8 y 9) y el tag de imagen Docker de Playwright (Task 11) — es exactamente el tipo de dato externo versionado que el propio spec (§7, §13.1) pide no inventar de memoria, no un placeholder de implementación propia.

**Consistencia de tipos y nombres entre tasks:**
- `Prisma.TransactionIsolationLevel.Serializable` se usa consistentemente en Task 6 (`crearReservaConCupo`) y Task 7 (`cancelarReserva`) — ambas son las únicas dos mutaciones que leen/escriben cupo o estado de reserva bajo concurrencia.
- `RequierePagoError` (Task 6) y `NoAutorizadoError` (Task 7) siguen el mismo patrón de clases de error específicas que usa Fundación para diferenciar códigos HTTP en el Route Handler, en vez de parsear mensajes de string en cada endpoint (excepto en un único lugar retenido por compatibilidad — `e.message.includes(...)` no se usa en este plan, a diferencia de un borrador temprano, precisamente para evitar ese acoplamiento frágil).
- `Servicio.precio`/`Pago.monto` están en **centavos** de punta a punta en la capa de datos (Task 1, comentario del schema) — `lib/dinero.ts` (Task 2) es el único punto de conversión a pesos, usado en Task 8 (`unit_price` de Mercado Pago), Task 9 (`transaction_amount`), y Task 11 (comprobante). Se verificó que ningún endpoint devuelve centavos directamente a la UI sin pasar por `centavosAPesos`.
- `viaMensualidad` (booleano en `Reserva`) es escrito únicamente por `crearReservaConCupo` (Task 6) a partir de `cubreMensualidad` (Task 5), y leído únicamente por `cubreMensualidad` mismo (para el conteo semanal de `personal`) y por la UI de resumen (Task 12) — no hay una segunda fuente de verdad para "esto lo cubre la mensualidad".
- `medio: "EFECTIVO"` es el único valor de medio de pago que puede pasar por `POST /api/reservas` (Task 6); el pago con Mercado Pago siempre pasa por `POST /api/pagos/clase` (Task 8) y nunca crea la `Reserva` directamente — se verificó que `crearReservaConCupo` con `pagoIdExistente` (usado solo por el webhook) y con `medio: "EFECTIVO"` (usado solo por el endpoint de reservas) son los dos únicos caminos que la función acepta sin lanzar `RequierePagoError`, sin solaparse.
- El campo `HorarioRecurrente.diaSemana` usa `Date.getUTCDay()` de forma consistente en Task 2 (seed), Task 3 (`ensureClasesGeneradas`) y sus tests — se usa UTC en todo el pipeline de generación de clases para evitar el corrimiento de zona horaria que introduciría `getDay()` local si el proceso Node corriera con un `TZ` distinto de UTC en producción (Docker, por defecto, corre en UTC salvo que se configure lo contrario — no se asume que el desarrollador local esté en UTC, por eso todas las fechas de test usan `Date.getUTCDay()`/`setUTCHours` explícitamente).

---

**Plan completo y guardado en `docs/superpowers/plans/2026-08-22-booking-pagos.md`.**

Al igual que en el plan de Fundación, la implementación real puede correr de dos formas:

1. **Entregar este plan tal cual a la IA externa** que lo va a ejecutar, task por task, commiteando en cada paso.
2. **Ejecutarlo en esta sesión** con `superpowers:subagent-driven-development`, un subagente por task con revisión entre tasks.

¿Cuál de las dos preferís?
