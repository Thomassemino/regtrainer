import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // `next dev` compila rutinas on-demand: correr los tests en paralelo multiplica la
  // contención y hace flaky el arranque. Con un solo worker es secuencial y estable,
  // y un timeout global holgado absorbe la primera compilación en frío de los routings.
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  expect: {
    // El expect timeout por defecto (5s) es muy corto para el primer render de la SPA
    // tras la compilación on-demand de `next dev`; un margen holgado evita falsos flaky.
    timeout: 20000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reusa el dev server si ya está prendido; en caso contrario Next lo levanta con
    // las env de test del webServer (DB 5433 + SMTP Maildev), que es lo habitual.
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      SEED_DEMO_DATA: "true",
      // El e2e corre por defecto contra la DB efímera del docker-compose.test.yml.
      // Si se define DATABASE_URL en el entorno, se respeta esa (p. ej. CI).
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://beto:test@localhost:5433/beto_training_test",
      // El SMTP del e2e apunta a Maildev (docker-compose.test.yml), no al relay del .env.
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      SMTP_FROM: process.env.SMTP_FROM ?? "RegTrainer <no-reply@betotraining.com.ar>",
      ...(process.env.E2E_DATABASE_URL ? { E2E_DATABASE_URL: process.env.E2E_DATABASE_URL } : {}),
      ...(process.env.AUTH_SECRET ? { AUTH_SECRET: process.env.AUTH_SECRET } : {}),
      ...(process.env.NEXTAUTH_URL ? { NEXTAUTH_URL: process.env.NEXTAUTH_URL } : {}),
    },
  },
  use: { baseURL: "http://localhost:3000" },
});