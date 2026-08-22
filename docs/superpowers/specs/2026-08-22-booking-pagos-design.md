# Booking + Pagos (Beto Training)

- **Fecha**: 2026-08-22
- **Estado**: Aprobado para implementación
- **Subsistema**: 2 de 3 (depende de Fundación; se implementa en paralelo con Panel + Rutinas)
- **Autor del spec**: Claude (arquitectura/auditoría) — implementación a cargo de un agente de IA externo
- **Repo**: `beto` (Next.js 16.3.1 App Router, React 19.2.8, TypeScript)

## 1. Contexto

Hoy `Reservar.tsx` → `Checkout.tsx` → `Confirm.tsx` son un flujo 100% mock: los horarios (`HORAS` en `lib/data.ts`) son una lista fija sin relación real con fecha ni servicio, "pagar" solo resta un número en memoria (`creditos`), y no existe ningún concepto de cupo real, cancelación, ni pago verificado. Este spec reemplaza eso por reservas reales con cupos concurrentes, pagos reales vía Mercado Pago, y las reglas de negocio que definimos con el usuario.

Depende de la Fundación (`docs/superpowers/specs/2026-08-22-fundacion-auth-datos-design.md`): usa `User`/`Cliente` ya existentes, corre sobre la misma infraestructura Docker/Postgres/Prisma, y toda mutación sensible verifica sesión igual que ahí (defensa en profundidad, `proxy.ts` + verificación server-side en cada Route Handler).

## 2. Decisiones de negocio (confirmadas con el usuario, no reabrir sin razón nueva)

| Decisión | Valor | Motivo |
|---|---|---|
| Medios de pago | Mercado Pago (tarjeta/débito, con cuotas) + efectivo en el estudio (sin pago online, se paga al llegar) | Confirmado explícitamente |
| Bono / crédito prepago | **Eliminado.** No existe "Bono 4/8 clases" como paquete de créditos | Rechazado explícitamente por el usuario |
| Formas de cobro que quedan | **Mensualidad** (suscripción recurrente, acceso a clases grupales + 1 personalizada/semana) + **clase suelta** (pago único por clase) | Confirmado explícitamente, reemplaza el modelo de bonos |
| Facturación fiscal | Ninguna. Comprobante simple no fiscal (PDF/email), sin integración AFIP | Confirmado explícitamente — evita meter un subsistema regulatorio entero |
| Ventana de cancelación | 12 horas antes de la clase | Confirmado explícitamente |
| Evaluación inicial | Sin cargo (precio 0), solo reserva, sin flujo de pago | Ya así en el mock, se mantiene |

## 3. Fuera de alcance

- Todo lo de Fundación (auth, usuarios) y de Panel+Rutinas (constructor de bloques) — specs propios.
- Facturación electrónica AFIP (§2).
- Rutinas grabadas / biblioteca de video ("Rutinas online" en `SERVICIOS`): sigue siendo un servicio reservable como cualquier otro en este spec, pero el contenido de video en sí (subir/organizar rutinas grabadas) no se construye acá.
- Notificaciones push/WhatsApp reales — igual que en Fundación, quedan mockeadas en "Cuenta → Notificaciones"; el email transaccional (SMTP ya montado en Fundación) sí se usa para comprobantes y confirmaciones.

## 4. Modelo de datos (extiende el schema de Fundación)

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
  id            String        @id @default(cuid())
  clienteId     String
  cliente       Cliente       @relation(fields: [clienteId], references: [id])
  claseId       String
  clase         Clase         @relation(fields: [claseId], references: [id])
  estado        EstadoReserva @default(CONFIRMADA)
  pagoId        String?       @unique
  pago          Pago?         @relation(fields: [pagoId], references: [id])
  viaMensualidad Boolean      @default(false) // true si el acceso vino de la suscripción activa, no de un pago puntual
  creadaEn      DateTime      @default(now())
  canceladaEn   DateTime?
  canceladaTarde Boolean      @default(false) // true si se canceló con menos de 12hs — no reembolsable

  @@index([claseId, estado])
  @@index([clienteId])
}

enum EstadoSuscripcion {
  ACTIVA
  CANCELADA
  VENCIDA
}

model Suscripcion {
  id                    String            @id @default(cuid())
  clienteId             String            @unique // un cliente tiene a lo sumo una mensualidad activa a la vez
  cliente               Cliente           @relation(fields: [clienteId], references: [id])
  estado                EstadoSuscripcion @default(ACTIVA)
  precio                Int
  fechaInicio           DateTime          @default(now())
  fechaProximoCobro     DateTime
  mpPreapprovalId       String?           @unique // id de la suscripción en Mercado Pago
  canceladaEn           DateTime?
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
  id              String      @id @default(cuid())
  clienteId       String
  cliente         Cliente     @relation(fields: [clienteId], references: [id])
  tipo            TipoPago
  medio           MedioPago
  monto           Int
  estado          EstadoPago  @default(PENDIENTE)
  mpPaymentId     String?     @unique // id de pago en Mercado Pago, null si es efectivo
  suscripcionId   String?
  suscripcion     Suscripcion? @relation(fields: [suscripcionId], references: [id])
  reserva         Reserva?
  creadoEn        DateTime    @default(now())
  actualizadoEn   DateTime    @updatedAt

  @@index([mpPaymentId])
}
```

Cambios sobre `Cliente` (definido en Fundación): agrega relaciones inversas `reservas Reserva[]`, `pagos Pago[]`, `suscripcion Suscripcion?` — no cambia ningún campo existente.

## 5. Generación de clases a partir de horarios recurrentes

Beto define horarios recurrentes por servicio (ej. "Funcional, martes y jueves 19:00") en `HorarioRecurrente`. Un job programado (no un cron de sistema — ver §9) genera instancias de `Clase` para una ventana móvil de **6 semanas hacia adelante**, corriendo una vez por día. Idempotente por el `@@unique([servicioId, fecha])`: correr el job de más no duplica clases.

Beto puede:
- Cancelar una `Clase` puntual (`cancelada = true`) sin tocar la plantilla — cancela las reservas asociadas y dispara reembolso/liberación según corresponda (mismo flujo que una cancelación de cliente, pero iniciada por el sistema, ver §7).
- Activar/desactivar un `HorarioRecurrente` — afecta solo a instancias futuras aún no generadas.

Este mecanismo de generación **no** es parte del Panel+Rutinas (spec 3) ni tiene UI de "constructor" — es la agenda operativa simple de clases grupales, mucho más chica en alcance que el constructor de bloques de entrenamiento personalizado.

## 6. Flujo de reserva y cupos (control de concurrencia)

1. `POST /api/reservas` recibe `claseId`. Dentro de una única transacción Prisma (`$transaction` con nivel de aislamiento `Serializable` o un `SELECT ... FOR UPDATE` sobre la fila `Clase`):
   - Cuenta `Reserva` con `estado: CONFIRMADA` para esa `claseId`.
   - Si `count < clase.cupoMax`: crea la reserva en `CONFIRMADA`.
   - Si `count >= clase.cupoMax`: crea la reserva en `LISTA_ESPERA`.
2. Esto evita la condición de carrera de dos clientes reservando el último cupo al mismo tiempo — sin el lock/transacción serializable, un `count` + `create` separados permiten que ambos lean `count < cupoMax` antes de que ninguno inserte.
3. Si el servicio tiene `precio > 0` y el cliente no tiene una `Suscripcion` con `estado: ACTIVA` que cubra ese servicio (ver §8, la mensualidad cubre "clases grupales" — todos los servicios salvo `personal`, que factura aparte incluso con mensualidad, tal como dice el mock: "+ 1 personalizada por semana" está incluida, el resto de personalizadas no): la reserva queda en un estado transitorio hasta que el pago se confirme (ver §7). Si el servicio es gratis (`evaluacion`) o el cliente tiene mensualidad activa que lo cubre: la reserva queda `CONFIRMADA` directamente, con `viaMensualidad: true` en el segundo caso.

## 7. Pagos con Mercado Pago

**Antes de escribir código de integración**: usar el MCP/plugin oficial de Mercado Pago (`mercadopago`, ver memoria de Fundación §Mercado Pago) para obtener los endpoints, payloads y firma de webhooks vigentes en el momento de implementar. No inventar de memoria el shape de la API de Checkout Pro/Preapproval ni la validación de la firma del webhook — es exactamente el tipo de detalle donde un error de implementación permite falsificar un pago.

### 7.1 Clase suelta (pago único)

1. `POST /api/pagos/clase` crea un `Pago(tipo: CLASE_SUELTA, estado: PENDIENTE)` y una preferencia de Checkout Pro de Mercado Pago, devuelve la URL de redirect.
2. El cliente paga en Mercado Pago. Mercado Pago notifica por webhook (`POST /api/webhooks/mercadopago`).
3. El webhook **verifica la firma** de la notificación (obligatorio — sin esto cualquiera puede pegarle a este endpoint y marcar un pago como aprobado), busca el pago real vía la API de Mercado Pago (nunca confiar en el body del webhook sin confirmarlo contra la API — patrón estándar anti-fraude de Mercado Pago), y:
   - Si `approved`: actualiza `Pago.estado = APROBADO`, `Pago.mpPaymentId`, crea/confirma la `Reserva` asociada (mismo control de cupo de §6 — el pago puede tardar más que la ventana de cupo disponible, si para cuando se confirma el pago la clase ya se llenó, la reserva pasa a `LISTA_ESPERA` y se le avisa al cliente por email, nunca se le cobra sin darle lugar).
   - Si `rejected`: `Pago.estado = RECHAZADO`, no se crea reserva, se notifica al cliente.
4. Envía email con el comprobante simple (PDF adjunto o link, ver §7.4) vía el mismo SMTP de Fundación.

### 7.2 Mensualidad (suscripción recurrente)

1. `POST /api/pagos/mensualidad` crea una `Suscripcion(estado: ACTIVA)` y una suscripción de Mercado Pago (Preapproval), devuelve la URL de autorización.
2. Mercado Pago cobra automáticamente cada mes y notifica por webhook cada cobro.
3. Cada notificación de cobro exitoso crea un `Pago(tipo: MENSUALIDAD, estado: APROBADO)` asociado y actualiza `fechaProximoCobro`.
4. Si un cobro falla (tarjeta rechazada, etc.): `Suscripcion.estado = VENCIDA` tras el reintento que defina la política de Mercado Pago (no reinventar reintentos propios), se notifica al cliente. Mientras esté `VENCIDA`, el cliente no puede reservar clases cubiertas por mensualidad sin pagar clase suelta.
5. Cancelación de mensualidad (`POST /api/mensualidad/cancelar`, iniciada por el cliente desde "Cuenta → Paquetes"): cancela el Preapproval en Mercado Pago y marca `Suscripcion.estado = CANCELADA`, `canceladaEn`. Sigue dando acceso hasta `fechaProximoCobro` (ya está pago ese período), después no se renueva.

### 7.3 Efectivo

`POST /api/reservas` con `medio: EFECTIVO`: crea la reserva directo (`CONFIRMADA` o `LISTA_ESPERA` según cupo, §6) y un `Pago(medio: EFECTIVO, estado: PENDIENTE)`. Beto marca el pago como recibido manualmente desde el panel (`PATCH /api/coach/pagos/:id`, marca `estado: APROBADO`) cuando el cliente paga al llegar al estudio — esto pertenece a la UI del Panel del entrenador, que si bien las pantallas base (`Coach.tsx`) no se tocan en el spec de Panel+Rutinas, esta acción puntual sí se agrega acá porque es parte del ciclo de vida del pago, no del constructor de rutinas.

### 7.4 Comprobante simple (no fiscal)

Al aprobarse un pago (§7.1, §7.2), generar un PDF simple (mismo mecanismo de HTML→PDF que se usa en Panel+Rutinas para el PDF de rutinas, ver spec 3 — reutilizar la misma dependencia en vez de agregar una segunda librería de PDF al proyecto) con: nombre del cliente, concepto, monto, fecha, medio de pago, y una leyenda explícita "Comprobante interno de Beto Training. No es una factura válida ante AFIP." — esta leyenda es obligatoria, no cosmética: evita que un comprobante no fiscal se confunda con una factura real.

## 8. Qué cubre la mensualidad

Según el mock (`PACKS`, id `mensual`): "Todas las grupales + 1 personalizada por semana". Traducido a regla de negocio verificable en código:
- Una `Suscripcion` activa cubre sin cargo adicional cualquier `Reserva` de un `Servicio` con `slug` distinto de `"personal"`.
- Cubre además **hasta 1** `Reserva` de `slug: "personal"` por semana calendario (lunes a domingo). La 2ª reserva de personalizada en la misma semana, aunque haya mensualidad activa, exige pago de clase suelta — esto se valida contando `Reserva` con `viaMensualidad: true` y `servicio.slug: "personal"` de esa semana antes de confirmar sin pago.
- No cubre `evaluacion` en el sentido de "consumir el beneficio" — es gratis para todos, con o sin mensualidad, no compite por ese cupo especial.

## 9. Job de generación de clases — sin infra adicional

Igual que el rate limiting de Fundación evitó Redis, este job evita un scheduler externo: se implementa como una función invocada perezosamente (`ensureClasesGeneradas()`) al inicio de cualquier request a `GET /api/clases` (la que alimenta la pantalla de Reservar) — si la última clase generada para algún `HorarioRecurrente` activo es de hace más de 20 horas, dispara la generación de la ventana de 6 semanas antes de responder. Es más simple que mantener un proceso cron separado en el Docker Compose, a costa de que el primer request del día tarde unos milisegundos más — aceptable a esta escala. Documentar esto explícitamente como decisión, no como accidente: si el tráfico creciera mucho, migrar a un cron real dentro del contenedor `app` (`node-cron` o similar) es un cambio acotado.

## 10. Migración del código existente

| Archivo actual | Cambio |
|---|---|
| `lib/data.ts` | `SERVICIOS` y `PACKS` (sin los ids `bono4`/`bono8`) migran a seed de `Servicio`. `HORAS` deja de ser una lista fija — se reemplaza por `GET /api/clases?servicioId&fecha` que devuelve instancias reales de `Clase` con cupo real calculado. |
| `hooks/useBetoApp.ts` | Todo el bloque de `dia`/`hora`/`horarios`/`recurrente`/`creditos`/`metodo`/`cuota`/`packSel`/`pagar`/`irCheckout` dejan de operar sobre estado en memoria y pasan a llamar a los endpoints reales de este spec. `recurrente` ("repetir todas las semanas") pierde el vínculo con "bono" que tenía en el mock (`descuenta de tu bono`) — pasa a significar "crear una `Reserva` por cada una de las próximas 4 instancias de ese `HorarioRecurrente`", pagando cada una por separado si no hay mensualidad. |
| `components/screens/Reservar.tsx` | El copy "Podés pagar con crédito de un bono, tarjeta, Mercado Pago o en el estudio" pierde la mención a bono. El resumen deja de mostrar "Te quedan N clases del Bono 8" — muestra en cambio si el servicio está cubierto por la mensualidad activa del cliente o el precio a pagar. |
| `components/screens/Checkout.tsx` | El método "bono" desaparece de `vals.metodos`. Se quita el checkbox "Necesito factura A" (spec §2: sin facturación fiscal) — se reemplaza, si hace falta, por una nota "Vas a recibir un comprobante simple por email" (no un formulario de CUIT que no lleva a nada real). |
| `components/screens/Confirm.tsx` | Sin cambios estructurales — `confirmItems` pasa a reflejar datos reales de la `Reserva`/`Pago` creados. |
| `components/screens/Coach.tsx` | Se agrega la acción de marcar un pago en efectivo como recibido (§7.3) en la tabla "Últimos pagos" — único cambio de este archivo en este spec; el resto de cambios de `Coach.tsx` (botón "Constructor de rutinas", KPI de rutinas) son del spec 3. |

## 11. Seguridad y validación

- Verificación de firma de webhook de Mercado Pago obligatoria (§7.1) — sin esto, el endpoint de webhook es una forma trivial de crear pagos "aprobados" falsos.
- Nunca confiar en el monto/estado que manda el cliente desde el frontend — todo pago se valida contra la API de Mercado Pago o, para efectivo, contra una acción explícita del admin autenticado con rol `ADMIN` (mismo patrón de doble verificación de Fundación §4.2/§8.4: `proxy.ts` protege `/api/coach/*`, y el Route Handler de marcar-pago-recibido vuelve a chequear `session.user.role === "ADMIN"`).
- Todas las mutaciones de reserva/pago verifican que `session.user.id` (o el `clienteId` derivado de la sesión) coincida con el dueño del recurso — un cliente no puede cancelar la reserva de otro cliente cambiando un id en la URL.
- Idempotencia de webhooks: Mercado Pago puede reenviar la misma notificación más de una vez — el handler debe ser idempotente (buscar por `mpPaymentId` antes de crear, no asumir que cada notificación es nueva).

## 12. Testing

- Unit: cálculo de cupo/lista de espera (función pura que recibe `cupoMax` y el conteo actual), regla de "1 personalizada por semana cubierta por mensualidad", cálculo de ventana de cancelación (12hs).
- Integración: dos reservas concurrentes contra el último cupo de una clase (usar `Promise.all` con dos llamadas a la función de reserva contra la misma `claseId` con `cupoMax: 1` y confirmar que una queda `CONFIRMADA` y la otra `LISTA_ESPERA`, nunca las dos `CONFIRMADA`); webhook de Mercado Pago con firma inválida rechazado; webhook duplicado no crea un segundo pago; cancelación con 13hs de anticipación libera cupo y promueve a lista de espera; cancelación con 6hs de anticipación no reembolsa.
- E2E: reservar una clase gratis (evaluación) de punta a punta; reservar una clase paga y completar el pago contra el sandbox de Mercado Pago (credenciales de test, nunca producción en CI).

## 13. Riesgos y decisiones abiertas para quien implemente

1. **API de Mercado Pago**: confirmar contra el MCP oficial (o la doc vigente) los nombres exactos de campos de Checkout Pro y Preapproval — este spec describe el flujo, no el payload exacto, porque eso cambia entre versiones de API y no debe copiarse de memoria.
2. **Definición de "semana calendario" para el límite de personalizadas** (§8): se definió lunes a domingo; si el negocio real de Beto usa otro corte, es un cambio de una línea en la query, no de arquitectura.
3. **Generación perezosa de clases (§9)**: aceptable a esta escala (un entrenador). Si en algún momento se nota latencia real en el primer request del día, migrar a cron dentro del contenedor sin cambiar el modelo de datos.
