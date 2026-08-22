# Fundación: base de datos real + autenticación (Beto Training)

- **Fecha**: 2026-08-22
- **Estado**: Aprobado para implementación
- **Subsistema**: 1 de 3 (Fundación → Booking+Pagos / Panel+Rutinas, en paralelo después de este)
- **Autor del spec**: Claude (arquitectura/auditoría) — implementación a cargo de un agente de IA externo
- **Repo**: `beto` (Next.js 16.3.1 App Router, React 19.2.8, TypeScript)

## 1. Contexto

"Beto Training" es hoy un prototipo 100% frontend: landing, reserva de turnos, checkout, cuenta de cliente y panel del entrenador, todo navegable pero sin backend real. Todo el estado vive en `hooks/useBetoApp.ts` (un único `useState`), los datos de clientes/servicios/pagos están hardcodeados en `lib/data.ts`, y el login (`components/screens/Login.tsx`) acepta cualquier combinación de email/contraseña no vacía.

Este spec cubre **exclusivamente** el subsistema de Fundación: reemplazar el mock de autenticación y el mock de datos por una base real, dejando el terreno listo para que los subsistemas de Booking+Pagos y Panel+Constructor de rutinas (specs separados) construyan encima.

Es un proyecto **greenfield**: no hay clientes reales, ni datos de producción, ni operación existente que migrar. Se puede — y se debe — construir sin atajos de "MVP corto", aprovechando que la implementación no está limitada por presupuesto de desarrollo.

## 2. Decisiones de arquitectura ya tomadas (no reabrir sin razón nueva)

| Decisión | Valor | Motivo |
|---|---|---|
| Hosting de producción | Servidor propio del usuario, Docker | Vercel se usa solo para demos, nunca producción. No usar integraciones de Vercel Marketplace (Neon, Clerk, etc.) |
| Modelo de tenancy | Single-tenant | Solo Beto Training. Nada de `tenant_id`, nada de aislamiento multi-organización |
| Base de datos | PostgreSQL en contenedor Docker propio | Requisito explícito del usuario |
| ORM | Prisma | Migraciones declarativas con historial, Prisma Studio para inspección manual de datos, tipos generados |
| Autenticación | Self-hosted (Auth.js / NextAuth v5), Credentials provider | Cero dependencia de un proveedor SaaS de auth |
| Segundo factor (2FA) | **No implementar.** Rechazado explícitamente por el usuario | — |
| Alta de clientes | Self-signup libre, sin aprobación manual del entrenador | El cliente se registra y ya puede operar (reservar/pagar es responsabilidad del spec de Booking, no de este) |
| Alta de admin | Solo por seed / script, nunca por ruta pública | Single-tenant: un único entrenador, no tiene sentido un flujo de registro de admin |
| Email transaccional | SMTP propio en Docker (Postfix/msmtp como relay) | Coherente con "todo self-hosted". El usuario asume la responsabilidad de configurar SPF/DKIM/DMARC del dominio para evitar spam — ver §8.4 |
| Estrategia de sesión | Sesiones en base de datos (no JWT) | Permite revocación real ("cerrar sesión en todos los dispositivos"), auditoría de sesiones activas, y a esta escala (un entrenador) el roundtrip extra a Postgres es irrelevante |
| Rate limiting | Contra la misma Postgres (tabla `AuditLog`), sin Redis | Evita una pieza de infra adicional. Documentado como punto de escalado futuro si el tráfico lo justifica (no ahora — YAGNI) |
| Nivel de profundidad de este spec | Técnica, no funcional | Se endurece cada pieza de auth/datos (seguridad, testing, observabilidad). No se agregan features de negocio no diseñadas (multi-entrenador, permisos granulares, etc.) |

## 3. Fuera de alcance (explícitamente)

Este spec **no** incluye, porque pertenecen a los subsistemas 2 y 3 (specs propios, a escribir después de este):

- Reservas, cupos, calendario, lista de espera
- Checkout, Mercado Pago, bonos/créditos, facturación
- Constructor de rutinas, bloques de ejercicio, asignación masiva, exportación PDF
- Cualquier UI nueva de negocio (las pantallas existentes se tocan solo para conectar datos reales, no se rediseñan)
- Notificaciones push/WhatsApp reales (hoy son mock en "Cuenta → Notificaciones"; se mantienen mockeadas)

Este spec **sí** entrega, porque todo lo demás depende de esto para ser real:

- Modelo de datos base (`User`, `Cliente`, sesiones, tokens, auditoría)
- Registro, verificación de email, login, logout, recuperación de contraseña
- Rate limiting anti fuerza bruta
- Protección de rutas por rol (`CLIENTE` / `ADMIN`)
- Infraestructura Docker completa (app + DB + SMTP)
- Seed de datos de desarrollo equivalentes a los que hoy están en `lib/data.ts`
- Testing y observabilidad de todo lo anterior

## 4. Notas de compatibilidad Next.js 16 (verificado contra `node_modules/next/dist/docs/`)

`AGENTS.md` advierte que esta versión de Next.js puede diferir del conocimiento de entrenamiento del modelo que implemente. Dos hallazgos concretos que **cambian código respecto a tutoriales/documentación vieja de NextAuth/Auth.js**:

1. **`middleware.ts` está deprecado, renombrado a `proxy.ts`** (Next 16.0.0). Mismo comportamiento, mismo runtime por defecto (Node.js — ya no hay que preocuparse por limitaciones de Edge Runtime), pero el archivo debe llamarse `proxy.ts` y exportar una función `proxy` (o default export), no `middleware`. Todo el código y ejemplos de Auth.js que usan `export { auth as middleware } from "./auth"` en `middleware.ts` deben adaptarse a `export { auth as proxy } from "./auth"` en `proxy.ts`.
2. **No confiar solo en el proxy para autorización.** La documentación de Next.js 16 es explícita: un cambio de matcher o un refactor que mueva una Server Function a otra ruta puede remover silenciosamente la cobertura del proxy. **Cada Route Handler y Server Action que toque datos sensibles debe volver a verificar sesión y rol dentro suyo**, no asumir que el proxy ya filtró la request. Esto es defensa en profundidad, no redundancia innecesaria.

**Antes de escribir código**, quien implemente debe:
- Confirmar que `next-auth@5` (o la versión estable de Auth.js vigente al momento de implementar) sea compatible con Next.js 16.3.1 y con la convención `proxy.ts`. Si no lo es, la alternativa de respaldo es sesión custom con cookie firmada (`iron-session` o equivalente) + las tablas de sesión ya diseñadas en este spec — el modelo de datos no cambia, solo la librería que lo orquesta.
- Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` y `.../route.md` en el repo antes de tocar rutas o proxy.

## 5. Infraestructura

### 5.1 Topología Docker Compose

```
docker-compose.yml
├── app       # Next.js (build de producción, next start)
├── db        # postgres:16, volumen nombrado persistente
├── smtp      # relay SMTP (postfix o msmtp), solo accesible en la red interna del compose
└── adminer   # solo en docker-compose.override.yml de desarrollo, no en producción
```

- `app` depende de `db` y `smtp` (`depends_on` con `condition: service_healthy`).
- `db` expone healthcheck vía `pg_isready`.
- `app` expone `/api/health` (chequea conexión a DB) como healthcheck propio.
- Variables de entorno vía `.env` (no versionado) + `.env.example` (versionado, documentando cada variable sin valores reales).
- Dos archivos de compose: `docker-compose.yml` (base, producción) + `docker-compose.override.yml` (desarrollo: monta `adminer`, hot-reload del código fuente, mapea puertos de DB al host).

### 5.2 Variables de entorno requeridas

```
DATABASE_URL=postgresql://user:pass@db:5432/beto_training
AUTH_SECRET=<random 32+ bytes, generado por script de setup>
SMTP_HOST=smtp
SMTP_PORT=25
SMTP_FROM="Beto Training <no-reply@betotraining.com.ar>"
NEXTAUTH_URL=https://<dominio real> # producción; http://localhost:3000 en dev
RATE_LIMIT_LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
```

`AUTH_SECRET` se genera con un script (`scripts/generate-secret.ts` o `openssl rand -base64 32`), nunca se hardcodea ni se versiona.

### 5.3 Scripts de ciclo de vida

- `npm run db:migrate` → `prisma migrate deploy` (producción) / `prisma migrate dev` (desarrollo)
- `npm run db:seed` → `prisma/seed.ts`, crea el usuario admin (Beto) desde variables de entorno (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — solo para el primer arranque, se fuerza cambio de contraseña en el primer login) y clientes/servicios de demo equivalentes a los actuales de `lib/data.ts`.
- `npm run db:backup` → `pg_dump` a un archivo con timestamp, pensado para correr por cron en el servidor del usuario (el script se entrega; la programación del cron queda fuera del repo, es responsabilidad operativa del usuario — se documenta en `docs/OPERACIONES.md`).

## 6. Modelo de datos (Prisma)

```prisma
enum Role {
  CLIENTE
  ADMIN
}

enum AuditAction {
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  REGISTRO
  EMAIL_VERIFICADO
  PASSWORD_RESET_SOLICITADO
  PASSWORD_RESET_COMPLETADO
  SESION_REVOCADA
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  role              Role      @default(CLIENTE)
  emailVerified     DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  cliente           Cliente?
  sessions          Session[]
  emailTokens       EmailVerificationToken[]
  resetTokens       PasswordResetToken[]
  auditLogs         AuditLog[]

  @@index([email])
}

model Cliente {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nombre        String
  iniciales     String
  objetivo      String
  plan          String   @default("Sin plan")
  frecuencia    String?
  nivel         String?
  whatsapp      String?
  notaMedica    String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Session {
  id            String   @id @default(cuid())
  sessionToken  String   @unique
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ip            String?
  userAgent     String?
  expires       DateTime
  createdAt     DateTime @default(now())

  @@index([userId])
}

model EmailVerificationToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId])
}

model PasswordResetToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId])
}

model AuditLog {
  id          String       @id @default(cuid())
  userId      String?
  user        User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  email       String?      // se guarda aunque el login falle y el user no exista, para poder ratelimitar por email
  action      AuditAction
  ip          String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime     @default(now())

  @@index([email, action, createdAt])
  @@index([ip, action, createdAt])
}
```

Notas de diseño:
- Los tokens (`EmailVerificationToken`, `PasswordResetToken`) guardan **hash** del token (SHA-256), nunca el token en texto plano — igual que una contraseña, si la DB se filtra no debe filtrar tokens usables.
- `AuditLog` es la única fuente de verdad tanto para rate limiting como para auditoría. Se indexa por `(email, action, createdAt)` y `(ip, action, createdAt)` porque las consultas de rate limiting son "contame los `LOGIN_FAILED` de este email/IP en los últimos N minutos".
- `Cliente.plan` con default `"Sin plan"` porque en self-signup libre un cliente puede existir sin haber comprado nada todavía (el spec de Booking/Pagos es quien más adelante le asigna un plan real).

## 7. Flujos de autenticación

### 7.1 Registro (self-signup)

`POST /api/auth/registro` (Route Handler, no Server Action — necesita ser llamable también si a futuro hay app externa):

1. Valida `email` (formato + unicidad) y `password` (mínimo 10 caracteres, al menos una letra y un número — validar con Zod).
2. Hashea con **argon2id** (`argon2` npm, no `bcrypt` — argon2id es el ganador de la Password Hashing Competition y resiste mejor ataques con GPU).
3. Crea `User(role: CLIENTE)` + `Cliente` mínimo (nombre e iniciales provistos en el form de registro; `objetivo` y el resto quedan vacíos, se completan luego en "Mis datos").
4. Genera `EmailVerificationToken` (token random 32 bytes, se hashea antes de guardar, expira en 24h).
5. Envía email de verificación vía SMTP con el link `/verificar-email?token=...`.
6. Registra `AuditLog(action: REGISTRO)`.
7. **No** inicia sesión automáticamente — el usuario debe verificar el email antes del primer login (ver 7.3).

### 7.2 Verificación de email

`GET /api/auth/verificar-email?token=...`:
1. Hashea el token recibido, busca `EmailVerificationToken` no usado y no expirado.
2. Si es válido: marca `User.emailVerified = now()`, marca el token `usedAt = now()`, registra `AuditLog(EMAIL_VERIFICADO)`, redirige a `/login?verificado=1`.
3. Si expiró: redirige a una pantalla que ofrece reenviar el email (nuevo endpoint `POST /api/auth/reenviar-verificacion`, también rate-limitado).

### 7.3 Login

Vía Auth.js Credentials provider:
1. Busca `User` por email. Si no existe, o `emailVerified` es null, o el password no matchea → error genérico **"Email o contraseña incorrectos"** (nunca revelar cuál de las tres cosas falló — evita enumeración de usuarios).
2. Antes de validar password, **chequea rate limit** (ver 7.5). Si está bloqueado, error "Demasiados intentos, probá de nuevo en N minutos" sin siquiera tocar la DB de passwords.
3. Compara con `argon2.verify` (resistente a timing attacks por diseño del algoritmo).
4. Si es correcto: crea `Session` en base de datos, registra `AuditLog(LOGIN_SUCCESS)`, setea cookie de sesión `httpOnly`, `secure` (en producción), `sameSite: lax`.
5. Si es incorrecto: registra `AuditLog(LOGIN_FAILED)` con el email intentado (exista o no el user) y la IP.

### 7.4 Logout / gestión de sesiones

- `POST /api/auth/logout`: borra la `Session` actual de la DB, limpia cookie.
- `GET /api/cuenta/sesiones`: lista las `Session` activas del usuario (fecha, IP, user agent) — pantalla nueva mínima dentro de "Mis datos", agregar un tab o sección "Sesiones activas".
- `POST /api/cuenta/sesiones/cerrar-todas`: borra todas las `Session` del usuario salvo la actual (o todas, forzando re-login) y registra `AuditLog(SESION_REVOCADA)`.

### 7.5 Rate limiting

Función `checkRateLimit(email: string, ip: string)`, usada en login y en solicitud de reset de contraseña:

```
contar AuditLog donde
  action = LOGIN_FAILED
  AND (email = :email OR ip = :ip)
  AND createdAt > now() - RATE_LIMIT_LOGIN_WINDOW_MINUTES minutos

si count >= RATE_LIMIT_LOGIN_MAX_ATTEMPTS → bloqueado
```

Ventana deslizante simple contra Postgres. Nota para el implementador: agregar el índice compuesto ya definido en §6 es obligatorio, sin él esta query hace table scan en cada intento de login.

### 7.6 Recuperación de contraseña

1. `POST /api/auth/olvide-password` con `email`. Rate-limitado igual que el login (evita que alguien lo use para floodear la bandeja de otro usuario). Responde siempre "Si el email existe, te llegó un correo" **exista o no la cuenta** (anti-enumeración).
2. Si existe: genera `PasswordResetToken` (32 bytes, hash guardado, expira en 1h — más corto que la verificación de email porque es más sensible), envía email con link `/resetear-password?token=...`.
3. `POST /api/auth/resetear-password` con `token` + `nuevaPassword`: valida token no usado/no expirado, actualiza `passwordHash`, marca token usado, **revoca todas las sesiones activas del usuario** (si alguien más tenía la cuenta comprometida, esto lo saca), registra `AuditLog(PASSWORD_RESET_COMPLETADO)`.

### 7.7 Alta del admin (Beto)

Nunca por ruta pública. Se crea exclusivamente por `prisma/seed.ts` a partir de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (variables de entorno, solo usadas en el primer `db:seed`). El seed marca `mustChangePassword: true` conceptualmente — en la práctica, dado que no agregamos ese campo al schema para no sobre-diseñar, el procedimiento operativo documentado en `docs/OPERACIONES.md` indica: "cambiar la contraseña del admin desde `/cuenta/datos` inmediatamente después del primer despliegue, usando el flujo normal de cambio de contraseña (fuera de alcance de auth pura, se apoya en un endpoint `PATCH /api/cuenta/password` protegido por sesión, trivial de agregar junto con el resto de 'Mis datos')".

## 8. Seguridad

1. **Hashing**: `argon2id`, parámetros memoria/iteraciones alineados con la guía OWASP vigente al momento de implementar (como piso: mínimo 19 MiB de memoria, 2 iteraciones, 1 de paralelismo), o los valores por defecto de la librería `argon2` de Node si son iguales o más conservadores que ese piso.
2. **Cookies de sesión**: `httpOnly`, `secure` (solo si `NODE_ENV=production`), `sameSite: lax`, expiración igual a `Session.expires` (recomendado: 30 días, renovación deslizante en cada request autenticada).
3. **Headers de seguridad**: en `proxy.ts` (ver §4), setear `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` para todas las respuestas.
4. **Protección de rutas por rol**: `proxy.ts` redirige a `/login` si no hay sesión válida en rutas bajo `/coach` y `/api/coach/*`; y **además**, cada Route Handler bajo esos paths vuelve a verificar `session.user.role === "ADMIN"` server-side (defensa en profundidad, ver hallazgo de §4.2). Hoy esta protección (`goCoach` en `useBetoApp.ts`) es puramente client-side — cualquiera con las devtools abiertas se cuela; esto se corrige de raíz acá.
5. **Anti-enumeración de usuarios**: mensajes de error genéricos en login y en "olvidé mi contraseña" (ver 7.3 y 7.6).
6. **Anti-CSRF**: Auth.js maneja esto internamente para sus propios endpoints; los Route Handlers custom (registro, reset password) son mutaciones vía `POST` con `sameSite: lax` en la cookie de sesión, que ya mitiga CSRF cross-site para el caso de uso (no hay necesidad de un token CSRF adicional dado que estas rutas no dependen de que haya sesión previa para el ataque más común).
7. **Secretos**: nunca en el repo. `.env` en `.gitignore` (confirmar que ya lo está — el repo tiene un `.gitignore` modificado según el estado de git al inicio de esta conversación, revisar antes de continuar). `.env.example` documenta nombres, no valores.

### 8.4 Nota sobre deliverabilidad de SMTP propio

El usuario optó explícitamente por SMTP propio en Docker en vez de un proveedor externo, entendiendo el trade-off: sin configurar correctamente SPF, DKIM y DMARC en el DNS del dominio real de producción, los emails de verificación y recuperación de contraseña van a spam o son rechazados por Gmail/Outlook. Esto **no es responsabilidad del código** de esta app, pero el spec lo deja escrito porque es un requisito operativo bloqueante para que el registro funcione en producción: documentar en `docs/OPERACIONES.md` los registros DNS exactos a configurar (SPF `TXT`, DKIM `TXT` con la clave pública que genere el relay SMTP elegido, DMARC `TXT`) antes de lanzar.

## 9. Migración del código existente

| Archivo actual | Cambio |
|---|---|
| `hooks/useBetoApp.ts` | Se elimina todo el estado de auth (`auth`, `loginRol`, `loginEmail`, `loginPass`, `loginCodigo`, `recordarme`, `loginError`) del `useState` local. Pasa a leer la sesión real (`useSession()` de Auth.js en cliente, `auth()` en Server Components). Las funciones `entrar`, `logout`, `goCoach` se reescriben para llamar a los endpoints reales en vez de mutar estado en memoria. El resto del hook (estado de UI de las pantallas de negocio: reservar, checkout, cuenta) **no se toca** en este spec — son datos que hoy dependen de auth para *quién* los ve, no de la lógica de auth en sí. |
| `lib/types.ts` | Se elimina `LoginRol` como tipo de estado del formulario y se reemplaza por el `Role` que viene de la sesión de Auth.js (tipado extendido vía module augmentation del tipo `Session` de Auth.js, para que `session.user.role` sea `"CLIENTE" \| "ADMIN"` en vez de `any`). |
| `lib/data.ts` | Los datos de clientes (`clientes`, hoy hardcodeados en `hooks/useBetoApp.ts` como `coachKpis`/`clientes`/etc. y en el README del handoff nuevo) migran a `prisma/seed.ts`. Las funciones que hoy devuelven arrays estáticos se reemplazan por queries reales (`prisma.cliente.findMany()`, etc.) — pero **solo para lo que depende de `User`/`Cliente`**; los datos de servicios/horarios/paquetes de booking quedan como están hasta el spec 2. |
| `components/screens/Login.tsx` | Se quita el campo de código 2FA (rechazado, §2). El submit deja de llamar a `entrar()` síncrono sobre estado local y pasa a hacer un `fetch`/Server Action real con manejo de estado de carga y error de red (hoy no existe, porque nunca puede fallar un mock). |
| `components/screens/Cuenta.tsx` | El tab "Mis datos" gana una sección "Sesiones activas" (§7.4). Nada más cambia visualmente. |
| `components/screens/Coach.tsx` | Sin cambios de este spec (los cambios de este archivo — botón "Constructor de rutinas", KPI de rutinas sin actualizar — pertenecen al spec 3). |

No se toca el diseño visual de ninguna pantalla — mismos tokens de `app/globals.css`, mismos componentes. El contrato de este spec es "de dónde sale el dato", no "cómo se ve".

## 10. Testing

### 10.1 Unit
- Hashing: `argon2id` hash/verify roundtrip, verificación de que dos hashes del mismo password son distintos (salt).
- Validación de password/email con Zod: casos límite (password de 9 caracteres rechazado, de 10 aceptado, etc.)
- Generación y validación de tokens: expiración, un solo uso (segundo intento de uso falla).
- Lógica de rate limit: función pura que recibe una lista de intentos y devuelve bloqueado/no bloqueado — testeable sin DB.

### 10.2 Integración (contra Postgres real de test, no mocks de Prisma)
- Flujo completo: registro → intento de login antes de verificar (debe fallar) → verificación → login (debe funcionar).
- Rate limiting real: 5 intentos fallidos consecutivos → 6to bloqueado, aunque la contraseña sea correcta.
- Reset de password: solicitar → usar token → login con la nueva contraseña funciona, con la vieja no.
- Un token de verificación/reset usado dos veces falla la segunda vez.
- Acceso a una ruta `/api/coach/*` sin sesión → 401. Con sesión `CLIENTE` → 403. Con sesión `ADMIN` → 200.
- Base de datos de test: schema propio (`beto_training_test`), reseteado con `prisma migrate reset --force` entre corridas (o en un contenedor Postgres efímero en CI).

### 10.3 E2E (Playwright)
- Registro → verificación (interceptar el email en un servidor SMTP de test tipo MailHog/Maildev en el compose de test) → login → ver que redirige a `/cuenta`.
- Cliente autenticado que intenta navegar a `/coach` → redirigido a `/login`.

## 11. Observabilidad

- Logging estructurado con `pino`: cada intento de auth (éxito/fallo) loguea a stdout en JSON, para que Docker/el sistema de logs del servidor lo capture. No se introduce un backend de logs nuevo en este spec (self-hosted, sin agregar piezas — si el usuario más adelante quiere agregación de logs, es una decisión aparte).
- `AuditLog` en DB ya cubre el caso de "necesito ver quién entró y cuándo" desde Prisma Studio sin herramientas adicionales.
- Endpoint `/api/health`: chequea `SELECT 1` contra la DB, devuelve 200/503. Usado por el healthcheck de Docker Compose.

## 12. Riesgos y decisiones abiertas para quien implemente

1. **Compatibilidad Auth.js v5 ↔ Next.js 16 / `proxy.ts`**: verificar antes de empezar (§4). Si hay fricción real, el plan B (sesión custom) está pre-diseñado en el modelo de datos de §6, que no depende de ninguna librería de auth específica.
2. **Deliverabilidad de SMTP propio** (§8.4): riesgo operativo, no de código. Documentar y no bloquear el desarrollo por esto — en local/desarrollo, usar MailHog/Maildev para no depender de DNS real.
3. **Password hashing params de argon2id**: usar los defaults de la librería salvo que un profiling muestre que son demasiado lentos para el hardware del servidor del usuario; no hay tráfico suficiente en este proyecto para que sea una preocupación real de performance.
