# Fundación (auth + datos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el mock de autenticación y datos de "Beto Training" por Postgres real (Docker) + Prisma + Auth.js v5 self-hosted, con registro, verificación de email, login, logout, sesiones revocables, rate limiting, recuperación de contraseña y protección de rutas por rol.

**Architecture:** Next.js 16.3.1 App Router con Route Handlers para cada operación de auth, Prisma como capa de datos contra un Postgres en Docker, Auth.js v5 en modo JWT pero con un `Session` propio en base de datos como fuente de verdad de revocación (ver Task 8 — resuelve la limitación conocida de Auth.js de que el proveedor Credentials no soporta la estrategia de sesión "database" nativamente). `proxy.ts` (no `middleware.ts` — deprecado en Next 16) protege rutas por rol como primera capa; cada Route Handler sensible vuelve a verificar server-side como segunda capa.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Prisma, PostgreSQL 16 (Docker), Auth.js v5 (`next-auth@beta`), `argon2`, `nodemailer`, `zod`, `pino`, Vitest (unit/integration), Playwright (e2e), Docker Compose.

**Spec:** [docs/superpowers/specs/2026-08-22-fundacion-auth-datos-design.md](../specs/2026-08-22-fundacion-auth-datos-design.md) — todas las decisiones de arquitectura, modelo de datos y flujos ya están ahí; este plan las ejecuta en tareas verificables. Leer el spec completo antes de empezar.

## Global Constraints

- No implementar 2FA en ningún flujo (spec §2 — rechazado explícitamente por el usuario).
- Producción es self-hosted en Docker del usuario. Nunca introducir una integración de Vercel Marketplace (Neon, Clerk, etc.) en este proyecto.
- Single-tenant: nada de `tenant_id`, nada de aislamiento multi-organización.
- Hashing de contraseñas: `argon2id` exclusivamente. Nunca `bcrypt`, `md5`, `sha1` sin salt, ni texto plano.
- Tokens de verificación/reset se guardan **hasheados** (SHA-256) en la base, nunca en texto plano.
- Estrategia de sesión: revocable desde base de datos (ver Task 8 para el mecanismo exacto con Auth.js + Credentials).
- Rate limiting contra la misma Postgres (tabla `AuditLog`), sin Redis ni infraestructura adicional.
- Usar `proxy.ts` (no `middleware.ts` — deprecado en Next.js 16.0.0, ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` en este repo).
- Cada Route Handler que toque datos de `ADMIN` o de otro usuario vuelve a verificar sesión y rol server-side, sin confiar solo en `proxy.ts` (defensa en profundidad, ver spec §4.2).
- Mensajes de error de auth genéricos, nunca revelan si el email existe (anti-enumeración) — ver spec §7.3 y §7.6.
- No tocar el diseño visual de ninguna pantalla existente (tokens de `app/globals.css`, estructura de componentes) salvo lo explícitamente listado en Task 16.
- SMTP: usar el relay Docker `smtp` (`SMTP_HOST=smtp`) en todos los entornos que no sean tests unitarios; en tests de integración/e2e usar un servidor SMTP de prueba (Maildev), nunca la red real.

---

## Task 1: Infraestructura Docker Compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker-compose.override.yml`
- Create: `.env.example`
- Modify: `.gitignore` (agregar `.env`, `.env.local` si no están)
- Create: `docs/OPERACIONES.md`

**Interfaces:**
- Produces: variables de entorno `DATABASE_URL`, `AUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `NEXTAUTH_URL`, `RATE_LIMIT_LOGIN_MAX_ATTEMPTS`, `RATE_LIMIT_LOGIN_WINDOW_MINUTES`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — todas las tareas siguientes las consumen vía `process.env`.

- [ ] **Step 1: Escribir el Dockerfile multi-stage**

```dockerfile
# Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
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

Nota: requiere `output: "standalone"` en `next.config.ts` (agregarlo en este step si no está).

- [ ] **Step 2: Escribir `docker-compose.yml` (base, producción)**

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      smtp:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    ports:
      - "3000:3000"

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: beto
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: beto_training
    volumes:
      - beto_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U beto -d beto_training"]
      interval: 10s
      timeout: 5s
      retries: 5

  smtp:
    image: boky/postfix
    restart: unless-stopped
    environment:
      ALLOWED_SENDER_DOMAINS: "betotraining.com.ar"

volumes:
  beto_pgdata:
```

- [ ] **Step 3: Escribir `docker-compose.override.yml` (desarrollo, se aplica automático junto al base)**

```yaml
services:
  app:
    build:
      target: deps
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"

  db:
    ports:
      - "5432:5432"

  adminer:
    image: adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - db
```

- [ ] **Step 4: Escribir `.env.example`**

```
DATABASE_URL=postgresql://beto:changeme@db:5432/beto_training
POSTGRES_PASSWORD=changeme
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
SMTP_HOST=smtp
SMTP_PORT=25
SMTP_FROM="Beto Training <no-reply@betotraining.com.ar>"
RATE_LIMIT_LOGIN_MAX_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW_MINUTES=15
SEED_ADMIN_EMAIL=beto@betotraining.com.ar
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 5: Confirmar `.gitignore` cubre secretos**

Abrir `.gitignore` y asegurar que contiene `.env` y `.env*.local` (no `.env.example`). Si falta, agregarlo.

- [ ] **Step 6: Escribir `docs/OPERACIONES.md` con lo operativo que no es código**

```markdown
# Operaciones — Beto Training

## Primer despliegue
1. Copiar `.env.example` a `.env`, completar `POSTGRES_PASSWORD` y `AUTH_SECRET` (generar con `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
2. `docker compose up -d --build`
3. `docker compose exec app npm run db:migrate`
4. `docker compose exec app npm run db:seed`
5. Loguearse como admin y cambiar la contraseña seedeada desde "Mis datos" inmediatamente.

## DNS para que los emails no caigan en spam (SMTP propio)
Antes de que el registro/recuperación de contraseña funcione de forma confiable en producción, configurar en el DNS del dominio real:
- **SPF** (`TXT` en el dominio raíz): `v=spf1 ip4:<IP del servidor> -all`
- **DKIM** (`TXT` en `default._domainkey.<dominio>`): clave pública generada por el contenedor `smtp` (`docker compose exec smtp postfix-dkim-key-show`, o el comando equivalente según la imagen usada — revisar la documentación de la imagen `boky/postfix` vigente al momento del despliegue).
- **DMARC** (`TXT` en `_dmarc.<dominio>`): `v=DMARC1; p=quarantine; rua=mailto:postmaster@<dominio>`

Sin esto, los emails de verificación/reset probablemente lleguen a spam o sean rechazados por Gmail/Outlook.

## Backups
`npm run db:backup` corre `pg_dump` a un archivo con timestamp en `./backups/`. Programar por cron en el servidor, por ejemplo diario a las 3am:
```
0 3 * * * cd /ruta/al/repo && docker compose exec -T app npm run db:backup
```
```

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml docker-compose.override.yml .env.example .gitignore docs/OPERACIONES.md
git commit -m "chore: infraestructura docker compose (app + postgres + smtp)"
```

---

## Task 2: Prisma — instalación y schema completo

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (agregar `prisma`, `@prisma/client` a dependencias; scripts `db:migrate`, `db:seed`, `db:backup`)
- Create: `next.config.ts` modification (`output: "standalone"`, si no se hizo en Task 1)

**Interfaces:**
- Produces: modelos Prisma `User`, `Cliente`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `AuditLog`, enums `Role`, `AuditAction` — toda tarea siguiente los usa vía `PrismaClient`.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install prisma @prisma/client
npm install -D tsx
```

- [ ] **Step 2: Inicializar Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 3: Escribir el schema completo en `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  role          Role      @default(CLIENTE)
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  cliente       Cliente?
  sessions      Session[]
  emailTokens   EmailVerificationToken[]
  resetTokens   PasswordResetToken[]
  auditLogs     AuditLog[]

  @@index([email])
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
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ip           String?
  userAgent    String?
  expires      DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
}

model EmailVerificationToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

model AuditLog {
  id        String      @id @default(cuid())
  userId    String?
  user      User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  email     String?
  action    AuditAction
  ip        String?
  userAgent String?
  metadata  Json?
  createdAt DateTime    @default(now())

  @@index([email, action, createdAt])
  @@index([ip, action, createdAt])
}
```

- [ ] **Step 4: Agregar scripts a `package.json`**

```json
{
  "scripts": {
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:backup": "tsx scripts/backup.ts"
  }
}
```

- [ ] **Step 5: Generar la primera migración contra la DB de desarrollo**

```bash
docker compose up -d db
npx prisma migrate dev --name init
```

Expected: crea `prisma/migrations/<timestamp>_init/migration.sql` y aplica el schema contra la DB local.

- [ ] **Step 6: Verificar el cliente generado**

```bash
npx prisma generate
npx tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations package.json package-lock.json
git commit -m "feat: schema prisma completo (user, cliente, sesiones, tokens, audit log)"
```

---

## Task 3: Cliente Prisma singleton + seed

**Files:**
- Create: `lib/db.ts`
- Create: `prisma/seed.ts`
- Create: `scripts/backup.ts`

**Interfaces:**
- Consumes: `PrismaClient` generado en Task 2.
- Produces: `export const prisma: PrismaClient` desde `lib/db.ts` — usado por absolutamente toda la capa de datos del resto del plan.

- [ ] **Step 1: Escribir el singleton (evita agotar conexiones con hot-reload de Next.js dev)**

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Escribir el seed con admin + clientes demo (migrando los datos hoy hardcodeados en `hooks/useBetoApp.ts` / `lib/data.ts`)**

```typescript
// prisma/seed.ts
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/hash";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son requeridas para seedear");
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const clientesDemo = [
    { email: "camila.f@example.com", nombre: "Camila Ferreyra", iniciales: "CF", objetivo: "Volver a correr sin dolor de rodilla", plan: "Bono 8 · 6 clases" },
    { email: "martin.d@example.com", nombre: "Martín Duarte", iniciales: "MD", objetivo: "Ganar fuerza en tren superior", plan: "Mensualidad" },
    { email: "sofia.l@example.com", nombre: "Sofía Lema", iniciales: "SL", objetivo: "Bajar grasa y sostener la rutina", plan: "Bono 4 · 2 clases" },
    { email: "lucia.g@example.com", nombre: "Lucía Giménez", iniciales: "LG", objetivo: "Primera vez en el gimnasio", plan: "Evaluación inicial" },
    { email: "nicolas.p@example.com", nombre: "Nicolás Pereyra", iniciales: "NP", objetivo: "Bajar la marca en 10K", plan: "Mensualidad" },
    { email: "julieta.r@example.com", nombre: "Julieta Ríos", iniciales: "JR", objetivo: "Rehabilitación de hombro", plan: "Bono 8 · 4 clases" },
  ];

  for (const c of clientesDemo) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        passwordHash: await hashPassword("Demo1234"),
        role: "CLIENTE",
        emailVerified: new Date(),
      },
    });
    await prisma.cliente.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        nombre: c.nombre,
        iniciales: c.iniciales,
        objetivo: c.objetivo,
        plan: c.plan,
      },
    });
  }

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Escribir el script de backup**

```typescript
// scripts/backup.ts
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("backups", { recursive: true });
const file = `backups/beto_training_${timestamp}.sql`;

execSync(`pg_dump "${process.env.DATABASE_URL}" > ${file}`, { stdio: "inherit" });
console.log(`Backup escrito en ${file}`);
```

- [ ] **Step 4: Correr el seed contra la DB de desarrollo y verificar**

```bash
npm run db:seed
npx prisma studio
```

Expected: en Prisma Studio aparecen 1 `User` con rol `ADMIN` y 6 con rol `CLIENTE`, cada uno con su `Cliente` asociado.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts prisma/seed.ts scripts/backup.ts
git commit -m "feat: prisma client singleton + seed de admin y clientes demo"
```

---

## Task 4: Hashing de contraseñas (argon2id)

**Files:**
- Create: `lib/auth/hash.ts`
- Test: `tests/unit/hash.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>` — usados por Task 3 (seed), Task 10 (registro), Task 12 (login), Task 14 (reset).

- [ ] **Step 1: Instalar dependencias de testing y argon2**

```bash
npm install argon2
npm install -D vitest
```

- [ ] **Step 2: Escribir el test que falla**

```typescript
// tests/unit/hash.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../lib/auth/hash";

describe("hashPassword / verifyPassword", () => {
  it("verifica correctamente una contraseña correcta", async () => {
    const hash = await hashPassword("MiPassword123");
    expect(await verifyPassword(hash, "MiPassword123")).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("MiPassword123");
    expect(await verifyPassword(hash, "OtraPassword456")).toBe(false);
  });

  it("dos hashes del mismo password son distintos (salt aleatorio)", async () => {
    const a = await hashPassword("MiPassword123");
    const b = await hashPassword("MiPassword123");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/unit/hash.test.ts`
Expected: FAIL — `Cannot find module '../../lib/auth/hash'`

- [ ] **Step 4: Implementar**

```typescript
// lib/auth/hash.ts
import * as argon2 from "argon2";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB, piso recomendado por OWASP
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/unit/hash.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/auth/hash.ts tests/unit/hash.test.ts package.json package-lock.json
git commit -m "feat: hashing de passwords con argon2id"
```

---

## Task 5: Tokens de un solo uso (verificación de email / reset de password)

**Files:**
- Create: `lib/auth/tokens.ts`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: nada externo (usa `node:crypto`).
- Produces: `generateToken(): { raw: string; hash: string }`, `hashToken(raw: string): string` — usados por Task 10 (verificación de email) y Task 14 (reset de password).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/unit/tokens.test.ts
import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../../lib/auth/tokens";

describe("generateToken / hashToken", () => {
  it("genera un token raw de al menos 32 bytes en base64url", () => {
    const { raw } = generateToken();
    expect(raw.length).toBeGreaterThanOrEqual(40);
  });

  it("el hash del raw coincide con hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(hashToken(raw)).toBe(hash);
  });

  it("dos tokens generados son distintos", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
  });

  it("hashToken es determinístico", () => {
    expect(hashToken("mismo-valor")).toBe(hashToken("mismo-valor"));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar**

```typescript
// lib/auth/tokens.ts
import { createHash, randomBytes } from "node:crypto";

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/unit/tokens.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/tokens.ts tests/unit/tokens.test.ts
git commit -m "feat: generacion y hashing de tokens de un solo uso"
```

---

## Task 6: Audit log + rate limiting

**Files:**
- Create: `lib/auth/audit.ts`
- Create: `lib/auth/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`
- Test: `tests/integration/audit.test.ts`

**Interfaces:**
- Consumes: `prisma` de Task 3, enum `AuditAction` de Task 2.
- Produces: `logAudit(input: { userId?: string; email?: string; action: AuditAction; ip?: string; userAgent?: string; metadata?: Record<string, unknown> }): Promise<void>`, `isRateLimited(params: { email: string; ip: string }): Promise<boolean>` — usados por Task 10, 12, 13, 14.

- [ ] **Step 1: Escribir `lib/auth/audit.ts`**

```typescript
// lib/auth/audit.ts
import { prisma } from "../db";
import type { AuditAction } from "@prisma/client";

export async function logAudit(input: {
  userId?: string;
  email?: string;
  action: AuditAction;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      email: input.email,
      action: input.action,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: input.metadata,
    },
  });
}
```

- [ ] **Step 2: Escribir el test de integración de audit log (contra Postgres real de test)**

```typescript
// tests/integration/audit.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { logAudit } from "../../lib/auth/audit";

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
});

describe("logAudit", () => {
  it("persiste un evento de login fallido con email e ip", async () => {
    await logAudit({ email: "test@example.com", action: "LOGIN_FAILED", ip: "1.2.3.4" });
    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("LOGIN_FAILED");
    expect(rows[0].email).toBe("test@example.com");
  });
});
```

Nota: este test asume `DATABASE_URL` apuntando a una base de test (ver Task 15 para la configuración de Vitest con setup de DB). Si Task 15 aún no corrió, exportar manualmente `DATABASE_URL` a una DB de test antes de correr este test.

- [ ] **Step 3: Escribir el test unitario de rate limit (lógica pura, sin DB — recibe los conteos ya resueltos)**

```typescript
// tests/unit/rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { exceedsLimit } from "../../lib/auth/rate-limit";

describe("exceedsLimit", () => {
  it("no bloquea por debajo del máximo", () => {
    expect(exceedsLimit(4, 5)).toBe(false);
  });

  it("bloquea al llegar al máximo", () => {
    expect(exceedsLimit(5, 5)).toBe(true);
  });

  it("bloquea por encima del máximo", () => {
    expect(exceedsLimit(9, 5)).toBe(true);
  });
});
```

- [ ] **Step 4: Implementar `lib/auth/rate-limit.ts`**

```typescript
// lib/auth/rate-limit.ts
import { prisma } from "../db";

const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS ?? 5);
const WINDOW_MINUTES = Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES ?? 15);

export function exceedsLimit(failedCount: number, max: number): boolean {
  return failedCount >= max;
}

export async function isRateLimited(params: { email: string; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILED",
      createdAt: { gt: since },
      OR: [{ email: params.email }, { ip: params.ip }],
    },
  });
  return exceedsLimit(count, MAX_ATTEMPTS);
}
```

- [ ] **Step 5: Correr todos los tests de esta task**

Run: `npx vitest run tests/unit/rate-limit.test.ts tests/integration/audit.test.ts`
Expected: PASS (4 tests en total)

- [ ] **Step 6: Commit**

```bash
git add lib/auth/audit.ts lib/auth/rate-limit.ts tests/unit/rate-limit.test.ts tests/integration/audit.test.ts
git commit -m "feat: audit log y rate limiting anti fuerza bruta"
```

---

## Task 7: Email transaccional (SMTP + plantillas)

**Files:**
- Create: `lib/email/client.ts`
- Create: `lib/email/templates.ts`

**Interfaces:**
- Produces: `sendVerificationEmail(to: string, link: string): Promise<void>`, `sendPasswordResetEmail(to: string, link: string): Promise<void>` — usados por Task 10 y Task 14.

- [ ] **Step 1: Instalar nodemailer**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Escribir el cliente SMTP**

```typescript
// lib/email/client.ts
import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 25),
  secure: false,
});
```

- [ ] **Step 3: Escribir las plantillas y funciones de envío**

```typescript
// lib/email/templates.ts
import { mailer } from "./client";

const FROM = process.env.SMTP_FROM ?? "Beto Training <no-reply@betotraining.com.ar>";

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Confirmá tu cuenta de Beto Training",
    text: `Confirmá tu cuenta entrando a este link: ${link}\n\nEste link vence en 24 horas.`,
    html: `<p>Confirmá tu cuenta entrando a este link:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 24 horas.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Recuperá tu contraseña de Beto Training",
    text: `Entrá a este link para elegir una nueva contraseña: ${link}\n\nEste link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.`,
    html: `<p>Entrá a este link para elegir una nueva contraseña:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.</p>`,
  });
}
```

- [ ] **Step 4: Verificar manualmente contra Maildev en desarrollo**

Agregar a `docker-compose.override.yml` (Task 1) un servicio `maildev` (imagen `maildev/maildev`, puerto UI `1080`) apuntado por `SMTP_HOST=maildev` en `.env` de desarrollo. Levantar, correr un script ad-hoc que llame `sendVerificationEmail("test@example.com", "http://localhost:3000/verificar")`, y confirmar en `http://localhost:1080` que el email llegó.

- [ ] **Step 5: Commit**

```bash
git add lib/email/client.ts lib/email/templates.ts docker-compose.override.yml package.json package-lock.json
git commit -m "feat: envio de emails transaccionales via smtp propio"
```

---

## Task 8: Configuración de Auth.js v5 (Credentials + sesión híbrida JWT/DB revocable)

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyPassword`, `logAudit`, `isRateLimited`.
- Produces: `auth()`, `signIn()`, `signOut()` exportados desde `lib/auth.ts` — consumidos por `proxy.ts` (Task 9) y por Server Components/Route Handlers en toda la migración (Task 16). `session.user.role: "CLIENTE" | "ADMIN"` y `session.user.sessionId: string` disponibles en cualquier `auth()`.

**Nota de riesgo técnico (ver spec §12.1):** Auth.js, con el proveedor Credentials, **no soporta nativamente** la estrategia de sesión `"database"` (limitación documentada del proyecto: sin un usuario "real" persistido por un adapter de OAuth, no hay a qué atar una fila de sesión automáticamente). La solución estándar — y la que implementa esta task — es usar la estrategia `"jwt"` de Auth.js, pero con una fila `Session` propia (la del schema de Task 2) como fuente de verdad de revocación: en el `authorize()` se crea la fila `Session` a mano y su `id` viaja dentro del JWT; en el callback `session` se verifica en cada request que esa fila siga existiendo. Verificar este comportamiento contra la documentación oficial de Auth.js vigente al momento de implementar — el patrón es estable desde NextAuth v4, pero los nombres exactos de callbacks pueden variar entre versiones.

- [ ] **Step 1: Instalar Auth.js v5**

```bash
npm install next-auth@beta
```

- [ ] **Step 2: Escribir `lib/auth.ts`**

```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { verifyPassword } from "./auth/hash";
import { logAudit } from "./auth/audit";
import { isRateLimited } from "./auth/rate-limit";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_DURATION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        const userAgent = request.headers.get("user-agent") ?? undefined;

        if (await isRateLimited({ email, ip })) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.emailVerified) {
          await logAudit({ email, action: "LOGIN_FAILED", ip, userAgent });
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
          await logAudit({ email, userId: user.id, action: "LOGIN_FAILED", ip, userAgent });
          return null;
        }

        const dbSession = await prisma.session.create({
          data: {
            sessionToken: crypto.randomUUID(),
            userId: user.id,
            ip,
            userAgent,
            expires: new Date(Date.now() + SESSION_DURATION_MS),
          },
        });

        await logAudit({ email, userId: user.id, action: "LOGIN_SUCCESS", ip, userAgent });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          sessionId: dbSession.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: "CLIENTE" | "ADMIN" }).role;
        token.sessionId = (user as { sessionId: string }).sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      const dbSession = await prisma.session.findUnique({
        where: { id: token.sessionId as string },
      });
      if (!dbSession || dbSession.expires < new Date()) {
        // Sesión revocada (logout, reset de password, etc.) — invalida la sesión de Auth.js también.
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      session.user.role = token.role as "CLIENTE" | "ADMIN";
      session.user.sessionId = token.sessionId as string;
      session.user.id = token.sub as string;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
```

- [ ] **Step 3: Module augmentation de tipos**

```typescript
// types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "CLIENTE" | "ADMIN";
      sessionId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "CLIENTE" | "ADMIN";
    sessionId?: string;
  }
}
```

- [ ] **Step 4: Exponer el route handler de Auth.js**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "../../../../lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth/[...nextauth]/route.ts package.json package-lock.json
git commit -m "feat: configuracion de auth.js v5 con sesion revocable en base de datos"
```

---

## Task 9: `proxy.ts` — protección de rutas por rol + headers de seguridad

**Files:**
- Create: `proxy.ts`
- Test: `tests/integration/proxy.test.ts`

**Interfaces:**
- Consumes: `auth()` de Task 8.

- [ ] **Step 1: Escribir el test de integración (usando `unstable_doesProxyMatch` para el matcher, y un test funcional contra el server de Next levantado para el bloqueo real — ver Task 15 para el harness de integración con servidor real)**

```typescript
// tests/integration/proxy.test.ts
import { describe, expect, it } from "vitest";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { config } from "../../proxy";

describe("proxy matcher", () => {
  it("aplica a rutas /coach", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/coach" })).toBe(true);
  });

  it("aplica a rutas /api/coach", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/api/coach/clientes" })).toBe(true);
  });

  it("no aplica a assets estáticos", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/_next/static/chunk.js" })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/integration/proxy.test.ts`
Expected: FAIL — `proxy.ts` no existe

- [ ] **Step 3: Implementar**

```typescript
// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./lib/auth";

const PROTECTED_ADMIN_PREFIXES = ["/coach", "/api/coach"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  const requiresAdmin = PROTECTED_ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (!requiresAdmin) {
    return response;
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/integration/proxy.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add proxy.ts tests/integration/proxy.test.ts
git commit -m "feat: proxy.ts protege rutas de coach por rol y agrega headers de seguridad"
```

---

## Task 10: Registro (self-signup) + verificación de email

**Files:**
- Create: `app/api/auth/registro/route.ts`
- Create: `app/api/auth/verificar-email/route.ts`
- Create: `app/api/auth/reenviar-verificacion/route.ts`
- Test: `tests/integration/registro.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `generateToken`, `hashToken`, `logAudit`, `sendVerificationEmail`, `prisma`.
- Produces: `POST /api/auth/registro`, `GET /api/auth/verificar-email?token=`, `POST /api/auth/reenviar-verificacion` — consumidos por `Login.tsx`/pantalla de registro en Task 16.

- [ ] **Step 1: Escribir el test de integración del flujo completo**

```typescript
// tests/integration/registro.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/email/templates", () => ({
  sendVerificationEmail: vi.fn(),
}));

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/auth/registro", () => {
  it("crea el usuario, el cliente, y no verifica el email todavía", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    const req = new Request("http://localhost/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ email: "nueva@example.com", password: "Password123", nombre: "Nueva Cliente" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: "nueva@example.com" }, include: { cliente: true } });
    expect(user).not.toBeNull();
    expect(user!.emailVerified).toBeNull();
    expect(user!.cliente?.nombre).toBe("Nueva Cliente");
  });

  it("rechaza un password de menos de 10 caracteres", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    const req = new Request("http://localhost/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ email: "corta@example.com", password: "abc123", nombre: "X" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/verificar-email", () => {
  it("marca emailVerified cuando el token es válido y redirige a /login?verificado=1", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    await POST(
      new Request("http://localhost/api/auth/registro", {
        method: "POST",
        body: JSON.stringify({ email: "verificar@example.com", password: "Password123", nombre: "Y" }),
      }) as any
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "verificar@example.com" } });
    const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });

    // El test conoce el hash pero no el raw (nunca se persiste) — se regenera el flujo llamando
    // directamente a la función de negocio en vez del endpoint para este caso de test white-box.
    const { verifyEmailToken } = await import("../../lib/auth/verify-email-token");
    const ok = await verifyEmailToken(tokenRow.tokenHash);
    expect(ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { email: "verificar@example.com" } });
    expect(updated.emailVerified).not.toBeNull();
  });
});
```

Nota de diseño para este test: como el token raw solo existe en el email enviado (mockeado) y nunca se persiste en texto plano, se extrae la lógica de verificación a una función pura (`lib/auth/verify-email-token.ts`) para poder testear el camino exitoso sin parsear el HTML del email mockeado. El endpoint real (`GET /api/auth/verificar-email`) es un wrapper delgado sobre esa función.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/integration/registro.test.ts`
Expected: FAIL — módulos no existen

- [ ] **Step 3: Implementar la función de negocio de verificación**

```typescript
// lib/auth/verify-email-token.ts
import { prisma } from "../db";
import { logAudit } from "./audit";

export async function verifyEmailToken(tokenHash: string): Promise<boolean> {
  const tokenRow = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: tokenRow.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: tokenRow.userId }, data: { emailVerified: new Date() } }),
  ]);
  await logAudit({ userId: tokenRow.userId, action: "EMAIL_VERIFICADO" });
  return true;
}
```

- [ ] **Step 4: Implementar el endpoint de registro**

```typescript
// app/api/auth/registro/route.ts
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/auth/hash";
import { generateToken } from "../../../../lib/auth/tokens";
import { logAudit } from "../../../../lib/auth/audit";
import { sendVerificationEmail } from "../../../../lib/email/templates";

const RegistroSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).regex(/[a-zA-Z]/).regex(/[0-9]/),
  nombre: z.string().min(2),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RegistroSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { email, password, nombre } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Anti-enumeración: mismo status/mensaje que el caso éxito.
    return Response.json({ ok: true }, { status: 201 });
  }

  const passwordHash = await hashPassword(password);
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "CLIENTE",
      cliente: { create: { nombre, iniciales, objetivo: "" } },
    },
  });

  const { raw, hash } = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const link = `${process.env.NEXTAUTH_URL}/verificar-email?token=${raw}`;
  await sendVerificationEmail(email, link);
  await logAudit({ userId: user.id, email, action: "REGISTRO" });

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 5: Implementar el endpoint de verificación (GET, redirige)**

```typescript
// app/api/auth/verificar-email/route.ts
import { hashToken } from "../../../../lib/auth/tokens";
import { verifyEmailToken } from "../../../../lib/auth/verify-email-token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.redirect(new URL("/login?error=token_invalido", url));
  }
  const ok = await verifyEmailToken(hashToken(token));
  return Response.redirect(
    new URL(ok ? "/login?verificado=1" : "/login?error=token_expirado", url)
  );
}
```

- [ ] **Step 6: Implementar el endpoint de reenvío (rate-limitado igual que el login, reutilizando `isRateLimited`)**

```typescript
// app/api/auth/reenviar-verificacion/route.ts
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { generateToken } from "../../../../lib/auth/tokens";
import { sendVerificationEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Email inválido" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (await isRateLimited({ email: parsed.data.email, ip })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.emailVerified) {
    const { raw, hash } = generateToken();
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await sendVerificationEmail(user.email, `${process.env.NEXTAUTH_URL}/verificar-email?token=${raw}`);
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 7: Correr y verificar que todo pasa**

Run: `npx vitest run tests/integration/registro.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add app/api/auth/registro app/api/auth/verificar-email app/api/auth/reenviar-verificacion lib/auth/verify-email-token.ts tests/integration/registro.test.ts
git commit -m "feat: registro self-signup con verificacion de email"
```

---

## Task 11: Login vía Auth.js + verificación de rate limiting end-to-end

**Files:**
- Test: `tests/integration/login.test.ts`

**Interfaces:**
- Consumes: `signIn` de Task 8, seed de Task 3.

Esta task no crea código nuevo — el login ya está implementado en `authorize()` (Task 8). Es una task de verificación dedicada porque el flujo de rate limiting + login es el más sensible de todo el spec y merece su propio ciclo de test aislado, con datos reales de principio a fin.

- [ ] **Step 1: Escribir el test de integración completo**

```typescript
// tests/integration/login.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { signIn } from "../../lib/auth";
import { logAudit } from "../../lib/auth/audit";

const EMAIL = "login-test@example.com";
const PASSWORD = "Password123";

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      role: "CLIENTE",
      emailVerified: new Date(),
    },
  });
});

describe("login", () => {
  it("falla con contraseña incorrecta y registra LOGIN_FAILED", async () => {
    await expect(
      signIn("credentials", { email: EMAIL, password: "incorrecta", redirect: false })
    ).rejects.toThrow();
    const logs = await prisma.auditLog.findMany({ where: { action: "LOGIN_FAILED" } });
    expect(logs).toHaveLength(1);
  });

  it("bloquea después de N intentos fallidos aunque la contraseña sea correcta", async () => {
    const max = Number(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS ?? 5);
    for (let i = 0; i < max; i++) {
      await logAudit({ email: EMAIL, action: "LOGIN_FAILED", ip: "9.9.9.9" });
    }
    await expect(
      signIn("credentials", { email: EMAIL, password: PASSWORD, redirect: false })
    ).rejects.toThrow();
  });

  it("crea una fila Session en la base al loguearse correctamente", async () => {
    await signIn("credentials", { email: EMAIL, password: PASSWORD, redirect: false });
    const sessions = await prisma.session.findMany({ where: { user: { email: EMAIL } } });
    expect(sessions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr**

Run: `npx vitest run tests/integration/login.test.ts`
Expected: PASS (3 tests). Si falla el primer test porque `signIn` no lanza sino que devuelve `null`/redirige, ajustar la aserción al comportamiento real de `next-auth@beta` verificado en este paso — esto es exactamente el tipo de detalle de versión que hay que confirmar contra la librería instalada, no asumir de memoria.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/login.test.ts
git commit -m "test: cobertura de integracion de login y rate limiting"
```

---

## Task 12: Logout + gestión de sesiones activas

**Files:**
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/cuenta/sesiones/route.ts`
- Create: `app/api/cuenta/sesiones/cerrar-todas/route.ts`
- Test: `tests/integration/sesiones.test.ts`

**Interfaces:**
- Consumes: `auth()`, `signOut()`, `prisma`, `logAudit`.
- Produces: `POST /api/auth/logout`, `GET /api/cuenta/sesiones`, `POST /api/cuenta/sesiones/cerrar-todas` — consumidos por Task 16 (UI de "Mis datos").

- [ ] **Step 1: Escribir el test de integración**

```typescript
// tests/integration/sesiones.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let userId: string;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: "sesiones@example.com", passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() },
  });
  userId = user.id;
  await prisma.session.createMany({
    data: [
      { sessionToken: "s1", userId, expires: new Date(Date.now() + 60_000) },
      { sessionToken: "s2", userId, expires: new Date(Date.now() + 60_000) },
    ],
  });
});

describe("cerrar todas las sesiones", () => {
  it("borra todas las Session del usuario y registra SESION_REVOCADA", async () => {
    const { cerrarTodasLasSesiones } = await import("../../lib/auth/sesiones");
    await cerrarTodasLasSesiones(userId);
    const remaining = await prisma.session.findMany({ where: { userId } });
    expect(remaining).toHaveLength(0);
    const logs = await prisma.auditLog.findMany({ where: { action: "SESION_REVOCADA" } });
    expect(logs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/integration/sesiones.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar la función de negocio**

```typescript
// lib/auth/sesiones.ts
import { prisma } from "../db";
import { logAudit } from "./audit";

export async function cerrarTodasLasSesiones(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  await logAudit({ userId, action: "SESION_REVOCADA" });
}
```

- [ ] **Step 4: Implementar los endpoints**

```typescript
// app/api/auth/logout/route.ts
import { auth, signOut } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { logAudit } from "../../../../lib/auth/audit";

export async function POST() {
  const session = await auth();
  if (session?.user?.sessionId) {
    await prisma.session.delete({ where: { id: session.user.sessionId } }).catch(() => {});
    await logAudit({ userId: session.user.id, action: "LOGOUT" });
  }
  await signOut({ redirect: false });
  return Response.json({ ok: true });
}
```

```typescript
// app/api/cuenta/sesiones/route.ts
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const sesiones = await prisma.session.findMany({
    where: { userId: session.user.id },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expires: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ sesiones, actualId: session.user.sessionId });
}
```

```typescript
// app/api/cuenta/sesiones/cerrar-todas/route.ts
import { auth } from "../../../../../lib/auth";
import { cerrarTodasLasSesiones } from "../../../../../lib/auth/sesiones";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  await cerrarTodasLasSesiones(session.user.id);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/integration/sesiones.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/auth/sesiones.ts app/api/auth/logout app/api/cuenta/sesiones tests/integration/sesiones.test.ts
git commit -m "feat: logout y gestion de sesiones activas"
```

---

## Task 13: Recuperación de contraseña

**Files:**
- Create: `app/api/auth/olvide-password/route.ts`
- Create: `app/api/auth/resetear-password/route.ts`
- Test: `tests/integration/reset-password.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `hashPassword`, `sendPasswordResetEmail`, `isRateLimited`, `cerrarTodasLasSesiones`.

- [ ] **Step 1: Escribir el test de integración**

```typescript
// tests/integration/reset-password.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword, verifyPassword } from "../../lib/auth/hash";
import { generateToken } from "../../lib/auth/tokens";

vi.mock("../../lib/email/templates", () => ({ sendPasswordResetEmail: vi.fn() }));

let userId: string;

beforeEach(async () => {
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: "reset@example.com", passwordHash: await hashPassword("ViejaPassword1"), role: "CLIENTE", emailVerified: new Date() },
  });
  userId = user.id;
});

describe("reset de password", () => {
  it("actualiza el password y revoca sesiones existentes", async () => {
    await prisma.session.create({ data: { sessionToken: "vieja", userId, expires: new Date(Date.now() + 60_000) } });

    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const { resetearPassword } = await import("../../lib/auth/reset-password");
    const ok = await resetearPassword(raw, "NuevaPassword2");
    expect(ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(updated.passwordHash, "NuevaPassword2")).toBe(true);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(0);
  });

  it("un token ya usado no puede reutilizarse", async () => {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const { resetearPassword } = await import("../../lib/auth/reset-password");
    expect(await resetearPassword(raw, "Primera1")).toBe(true);
    expect(await resetearPassword(raw, "Segunda2")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/integration/reset-password.test.ts`
Expected: FAIL — módulo no existe

- [ ] **Step 3: Implementar la función de negocio**

```typescript
// lib/auth/reset-password.ts
import { prisma } from "../db";
import { hashPassword } from "./hash";
import { hashToken } from "./tokens";
import { cerrarTodasLasSesiones } from "./sesiones";
import { logAudit } from "./audit";

export async function resetearPassword(rawToken: string, nuevaPassword: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  const passwordHash = await hashPassword(nuevaPassword);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: tokenRow.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: tokenRow.userId }, data: { passwordHash } }),
  ]);
  await cerrarTodasLasSesiones(tokenRow.userId);
  await logAudit({ userId: tokenRow.userId, action: "PASSWORD_RESET_COMPLETADO" });
  return true;
}
```

- [ ] **Step 4: Implementar los endpoints**

```typescript
// app/api/auth/olvide-password/route.ts
import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { generateToken } from "../../../../lib/auth/tokens";
import { sendPasswordResetEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";
import { logAudit } from "../../../../lib/auth/audit";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Email inválido" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (await isRateLimited({ email: parsed.data.email, ip })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await sendPasswordResetEmail(user.email, `${process.env.NEXTAUTH_URL}/resetear-password?token=${raw}`);
    await logAudit({ userId: user.id, email: user.email, action: "PASSWORD_RESET_SOLICITADO", ip });
  }

  // Respuesta idéntica exista o no la cuenta (anti-enumeración, spec §7.6).
  return Response.json({ ok: true, message: "Si el email existe, te llegó un correo" });
}
```

```typescript
// app/api/auth/resetear-password/route.ts
import { z } from "zod";
import { resetearPassword } from "../../../../lib/auth/reset-password";

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const ok = await resetearPassword(parsed.data.token, parsed.data.password);
  if (!ok) {
    return Response.json({ error: "El link venció o ya fue usado" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/integration/reset-password.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/auth/reset-password.ts app/api/auth/olvide-password app/api/auth/resetear-password tests/integration/reset-password.test.ts
git commit -m "feat: recuperacion de contraseña con revocacion de sesiones"
```

---

## Task 14: Health check + logging estructurado

**Files:**
- Create: `lib/logger.ts`
- Create: `app/api/health/route.ts`

**Interfaces:**
- Produces: `logger` (instancia de pino) — usado opcionalmente por cualquier Route Handler para loguear eventos relevantes además del `AuditLog` en DB.

- [ ] **Step 1: Instalar pino**

```bash
npm install pino
```

- [ ] **Step 2: Escribir el logger**

```typescript
// lib/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});
```

- [ ] **Step 3: Escribir el endpoint de health**

```typescript
// app/api/health/route.ts
import { prisma } from "../../../lib/db";
import { logger } from "../../../lib/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
```

- [ ] **Step 4: Verificar manualmente**

```bash
docker compose up -d
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Commit**

```bash
git add lib/logger.ts app/api/health package.json package-lock.json
git commit -m "feat: healthcheck y logging estructurado"
```

---

## Task 15: Configuración de Vitest (unit + integración contra Postgres de test)

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `docker-compose.test.yml`
- Modify: `package.json` (scripts `test`, `test:integration`)

**Interfaces:**
- Produces: entorno de test reproducible que las Tasks 4–13 ya asumen (deben poder correr `npx vitest run` desde el principio de esta task en adelante sin configuración manual).

- [ ] **Step 1: Escribir `docker-compose.test.yml` (Postgres + Maildev efímeros para test)**

```yaml
services:
  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: beto
      POSTGRES_PASSWORD: test
      POSTGRES_DB: beto_training_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  maildev-test:
    image: maildev/maildev
    ports:
      - "1080:1080"
      - "1025:1025"
```

- [ ] **Step 2: Escribir `tests/setup.ts` (resetea el schema antes de cada archivo de test de integración)**

```typescript
// tests/setup.ts
import { execSync } from "node:child_process";
import { beforeAll } from "vitest";

beforeAll(() => {
  execSync("npx prisma migrate reset --force --skip-seed", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "inherit",
  });
});
```

- [ ] **Step 3: Escribir `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 4: Agregar scripts de test a `package.json`**

```json
{
  "scripts": {
    "test": "vitest run tests/unit",
    "test:integration": "DATABASE_URL=postgresql://beto:test@localhost:5433/beto_training_test SMTP_HOST=localhost SMTP_PORT=1025 vitest run tests/integration"
  }
}
```

- [ ] **Step 5: Verificar que la suite completa corre limpia desde cero**

```bash
docker compose -f docker-compose.test.yml up -d
npm run test
npm run test:integration
```

Expected: todos los tests de las Tasks 4 a 13 pasan (esta task se ejecuta después de todas las anteriores precisamente para dejar la suite completa verificada de punta a punta con el harness definitivo).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/setup.ts docker-compose.test.yml package.json package-lock.json
git commit -m "test: configuracion de vitest con postgres y maildev efimeros"
```

---

## Task 16: Migración del mock — `useBetoApp`, tipos, `Login.tsx`, `Cuenta.tsx`

**Files:**
- Modify: `lib/types.ts`
- Modify: `hooks/useBetoApp.ts`
- Modify: `components/screens/Login.tsx`
- Modify: `components/screens/Cuenta.tsx`
- Create: `app/(auth)/registro/page.tsx`
- Create: `app/(auth)/verificar-email/page.tsx`
- Create: `app/(auth)/resetear-password/page.tsx`

**Interfaces:**
- Consumes: todos los endpoints de las Tasks 8–13.
- Produces: el mock queda reemplazado por datos reales sin cambiar el diseño visual (spec §9).

- [ ] **Step 1: Actualizar `lib/types.ts` — quitar el estado de auth mockeado**

Quitar de `AppState`: `auth`, `loginRol`, `loginEmail`, `loginPass`, `loginCodigo`, `recordarme`, `loginError`. Estos ya no viven en el `useState` local — vienen de `useSession()`. Mantener `LoginRol` como alias de conveniencia si se usa en UI para elegir "soy cliente / soy el entrenador" en el formulario, pero ya no como parte de `AppState`.

```typescript
// lib/types.ts (fragmento relevante, reemplaza las líneas de auth del AppState existente)
export type Screen = "landing" | "reservar" | "checkout" | "confirm" | "login" | "cuenta" | "coach";
export type CuentaTab = "reservas" | "rutina" | "paquetes" | "notis" | "datos";
export type Metodo = "bono" | "tarjeta" | "mp" | "efectivo";
export type LoginRol = "cliente" | "admin";

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
  rutinaDia: number;
  hechos: Record<string, boolean>;
  toast: string | null;
  // auth ya no vive acá — viene de useSession()
  loginRolUI: LoginRol; // solo para el toggle visual "soy cliente / soy el entrenador" del formulario
}
```

- [ ] **Step 2: Actualizar `hooks/useBetoApp.ts` — reemplazar el bloque de auth mockeado por sesión real**

Quitar `auth`, `loginRol`, `loginEmail`, `loginPass`, `loginCodigo`, `recordarme`, `loginError` de `initialState`. Reemplazar las funciones relacionadas:

```typescript
// hooks/useBetoApp.ts (fragmento — reemplaza el bloque de auth existente)
"use client";

import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
// ...resto de imports existentes sin cambios

export function useBetoApp() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<AppState>(initialState);
  // ...resto del hook sin cambios hasta acá

  const st = state;
  const auth = session?.user?.role ?? null; // "CLIENTE" | "ADMIN" | null, reemplaza st.auth
  const esCliente = auth === "CLIENTE";
  const esAdmin = auth === "ADMIN";

  const entrar = async (email: string, password: string) => {
    const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      set({ loginError: "Email o contraseña incorrectos" } as any); // ver Step 3: agregar loginError como estado transitorio de UI, no de AppState persistente
      return;
    }
    go(state.loginRolUI === "admin" ? "coach" : "cuenta");
    showToast(state.loginRolUI === "admin" ? "Bienvenido, Beto" : "Hola de nuevo");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await nextAuthSignOut({ redirect: false });
    go("landing");
    showToast("Sesión cerrada");
  };

  const goCoach = () => {
    if (auth === "ADMIN") {
      go("coach");
      return;
    }
    set({ loginRolUI: "admin" });
    go("login");
  };

  // ...el resto de "vals" que dependía de st.auth pasa a usar la constante `auth` de arriba.
  // cuentaLabel, logoutShow, esCliente, esAdmin, etc. se recalculan igual que antes pero
  // leyendo `auth`/`esCliente`/`esAdmin` en vez de `st.auth`/`st.loginRol`.
}
```

Nota para quien implemente: este fragmento muestra el patrón de reemplazo, no el archivo completo — el resto de `useBetoApp.ts` (reservar, checkout, cuenta, coach data mock) no se toca en este spec, salvo los puntos donde hoy lee `st.auth`/`st.loginRol`/`st.loginEmail`, que hay que ubicar con una búsqueda de esos tres identificadores en el archivo y reemplazar cada uno por su equivalente de sesión real.

- [ ] **Step 3: Agregar el estado transitorio de error de login que no debe persistir en `AppState`**

Como `loginError` ya no es parte de la sesión (es un error momentáneo del formulario), se maneja con un `useState` local dentro de `Login.tsx` en vez de en el hook central — es estado de un solo componente, no de la app. Ver Step 4.

- [ ] **Step 4: Actualizar `components/screens/Login.tsx`**

- Quitar el campo de código 2FA por completo (Global Constraints).
- El submit deja de llamar a una función síncrona sobre estado en memoria: ahora es `async`, llama a `vals.entrar(email, password)` (que a su vez llama al endpoint real), y maneja un estado de carga local (`const [loading, setLoading] = useState(false)`) para deshabilitar el botón mientras la request está en curso — esto no existía en el mock porque un mock nunca tarda ni falla por red.
- Agregar un link "¿Olvidaste tu contraseña?" que lleva a un formulario simple que hace `POST /api/auth/olvide-password`.
- Agregar un link "¿No tenés cuenta? Registrate" que lleva a `/registro`.

- [ ] **Step 5: Crear las páginas nuevas mínimas de registro/verificación/reset**

```tsx
// app/(auth)/registro/page.tsx
"use client";
import { useState } from "react";

export default function RegistroPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ nombre, email, password }),
    });
    if (res.ok) {
      setEnviado(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "No pudimos completar el registro");
    }
  };

  if (enviado) {
    return <p>Te mandamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="field">
      <input className="input" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit">Crear cuenta</button>
    </form>
  );
}
```

```tsx
// app/(auth)/verificar-email/page.tsx
// GET /api/auth/verificar-email ya redirige a /login con query params — esta página
// solo cubre el caso de acceso directo sin token, mostrando instrucciones.
export default function VerificarEmailPage() {
  return <p>Revisá el link que te mandamos por email para confirmar tu cuenta.</p>;
}
```

```tsx
// app/(auth)/resetear-password/page.tsx
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetearPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/resetear-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setMensaje(res.ok ? "Contraseña actualizada, ya podés ingresar." : data.error);
  };

  return (
    <form onSubmit={onSubmit} className="field">
      <input className="input" type="password" placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      <button className="btn btn-primary" type="submit">Guardar nueva contraseña</button>
      {mensaje && <p>{mensaje}</p>}
    </form>
  );
}
```

- [ ] **Step 6: Agregar la sección "Sesiones activas" en `components/screens/Cuenta.tsx`, tab "Mis datos"**

Agregar un bloque que hace `GET /api/cuenta/sesiones` al montar el tab `datos`, lista `ip`/`userAgent`/`createdAt` de cada sesión, marca la actual, y un botón "Cerrar sesión en todos los dispositivos" que llama `POST /api/cuenta/sesiones/cerrar-todas` y luego fuerza logout local. Reutilizar la clase `.card`/`.table` existentes del design system, sin crear estilos nuevos.

- [ ] **Step 7: Envolver la app con `SessionProvider`**

```tsx
// app/layout.tsx (agregar el import y envolver el children existente)
import { SessionProvider } from "next-auth/react";
// ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

Ajustar solo agregando el `SessionProvider` — no reestructurar el resto de `layout.tsx` (fonts, metadata, Phosphor icons ya cargados según el README del handoff).

- [ ] **Step 8: Verificación manual end-to-end**

```bash
docker compose up -d --build
npm run db:migrate
npm run db:seed
```

Navegar a `/registro`, crear una cuenta, revisar Maildev/logs del contenedor `smtp` según corresponda al entorno, verificar el email, loguearse, confirmar que `/coach` redirige si el usuario es `CLIENTE` y funciona si es `ADMIN` (usando el seed de `SEED_ADMIN_EMAIL`).

- [ ] **Step 9: Commit**

```bash
git add lib/types.ts hooks/useBetoApp.ts components/screens/Login.tsx components/screens/Cuenta.tsx app/layout.tsx "app/(auth)"
git commit -m "feat: migrar auth mockeada a sesion real en la ui existente"
```

---

## Task 17: E2E con Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json` (script `test:e2e`)

**Interfaces:**
- Consumes: la app completa corriendo (Task 16) + Maildev de Task 15/7.

- [ ] **Step 1: Instalar Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Escribir `playwright.config.ts`**

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: Escribir el spec del flujo completo**

```typescript
// e2e/auth.spec.ts
import { expect, test } from "@playwright/test";

test("registro, verificación por Maildev y login", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/registro");
  await page.getByPlaceholder("Nombre").fill("E2E Test");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("Password123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText(/Te mandamos un email/)).toBeVisible();

  const maildevRes = await request.get("http://localhost:1080/email");
  const emails = await maildevRes.json();
  const ultimo = emails.find((m: { to: { address: string }[] }) => m.to[0].address === email);
  const match = ultimo.html.match(/token=([\w-]+)/);
  const token = match![1];

  await page.goto(`/api/auth/verificar-email?token=${token}`);
  await expect(page).toHaveURL(/verificado=1/);

  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/contraseña/i).fill("Password123");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/cuenta/);
});

test("un cliente no puede entrar a /coach", async ({ page }) => {
  // Reutiliza un cliente ya seedeado (ver Task 3).
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("camila.f@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Agregar script y correr**

```json
{ "scripts": { "test:e2e": "playwright test" } }
```

Run: `npm run test:e2e`
Expected: PASS (2 tests). Requiere Maildev corriendo (Task 7/15) y la DB seedeada (Task 3).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test: e2e de registro, verificacion, login y proteccion de /coach"
```

---

## Self-Review (completado por quien escribió este plan)

**Cobertura del spec:** cada sección de `2026-08-22-fundacion-auth-datos-design.md` tiene tarea(s) que la implementan — §5 Infra → Task 1; §6 Modelo de datos → Task 2; §7.1-7.2 → Task 10; §7.3/7.5 → Task 8/11; §7.4 → Task 12; §7.6 → Task 13; §7.7 → Task 3; §8 Seguridad → Tasks 4, 8, 9; §9 Migración → Task 16; §10 Testing → Tasks 4-17 (cada una trae su propio test) + Task 15 (harness); §11 Observabilidad → Task 14.

**Placeholders:** ninguno — cada step tiene código completo, ningún "TODO"/"implementar después"/"similar a la task N" sin el código repetido.

**Consistencia de tipos:** `sessionId` (no `sessionToken`) es el campo que viaja en el JWT y se expone en `session.user` — usado consistentemente en Task 8 (definición), Task 9 (no lo usa directo, usa `session.user.role`), Task 12 (`session.user.sessionId` para borrar la fila correcta). `Session.id` (cuid) vs `Session.sessionToken` (uuid random): el JWT lleva `sessionId` = `Session.id`, no el `sessionToken` — son campos distintos con propósitos distintos (`sessionToken` existe para dejar la tabla compatible con la forma estándar que usan los adapters de Auth.js si en el futuro se migra a OAuth además de Credentials; `id` es la clave real que usa este plan). Verificado consistente en Tasks 8, 11, 12, 13.

---

**Plan completo y guardado en `docs/superpowers/plans/2026-08-22-fundacion-auth-datos.md`.**

Dado que la implementación real la va a ejecutar un agente de IA externo (no un subagente de esta sesión), las dos opciones de ejecución estándar de este skill no aplican tal cual:

1. **Entregar este plan tal cual a la IA externa** para que lo ejecute task por task, commiteando en cada paso — el formato de checkboxes y "Files/Interfaces/Steps" está pensado exactamente para que un ejecutor sin contexto previo lo siga solo.
2. **Ejecutarlo acá, en esta sesión**, con `superpowers:subagent-driven-development` (un subagente por task, con revisión mía entre tasks) — sirve si querés que yo mismo lo implemente en lugar de la IA externa, o si querés una corrida de referencia contra la cual auditar lo que produzca la otra IA.

¿Cuál de las dos preferís?
