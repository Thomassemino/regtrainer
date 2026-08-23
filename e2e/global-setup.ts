import { execSync } from "node:child_process";

export default async function globalSetup() {
  const dbUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("E2E requiere DATABASE_URL (o E2E_DATABASE_URL)");
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL ?? "admin@e2e.com",
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "AdminE2E123",
      SEED_DEMO_DATA: process.env.SEED_DEMO_DATA ?? "true",
    },
  });

  // Limpia el audit log y las sesiones antes de cada corrida de e2e: sin esto, los
  // LOGIN_FAILED acumulados de corridas previas activan el rate-limit anti fuerza bruta
  // (máx. 5 en 15 min) sobre la cuenta de demo y bloquean el login del test aunque la
  // password sea correcta. Es una DB de test efímera; borrar sus logs es seguro.
  execSync("npx tsx e2e/cleanup.ts", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  // Warmup del dev server: el primer request a una ruta de API en un `next dev`
  // recién levantado puede fallar con un 5xx transitorio (compilación on-demand +
  // init de argon2/pool de pg), que la UI traduce a errores genéricos aunque el
  // flujo sea correcto. Pre-compilamos las rutas que los e2e tocan y dejamos el
  // dummy-hash de argon2 calculado, de modo que los tests no peguen en frío.
  const baseUrl = "http://localhost:3000";
  const rutasAWarmear = [
    "/api/auth/callback/credentials",
    "/api/health",
    "/api/clases?slug=funcional",
    "/api/reservas",
    "/api/cuenta/mensualidad",
    "/api/cuenta/mi-rutina",
    "/api/coach/clientes",
    "/api/coach/pagos",
    "/api/coach/programas",
    "/api/coach/clientes/x",
    "/api/coach/programas/x",
  ];
  for (const ruta of rutasAWarmear) {
    try {
      await fetch(`${baseUrl}${ruta}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // rutas que devuelven 401/404 igual compilan el route handler
    }
  }
  try {
    await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": "warmup-e2e" },
      body: JSON.stringify({ csrfToken: "warmup", email: "warmup@invalid.local", password: "warmup-0000000000" }),
    });
  } catch {
    // ignora: el warmup es solo de compilación
  }
}