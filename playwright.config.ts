import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      SEED_DEMO_DATA: "true",
      // El e2e corre por defecto contra la DB efímera del docker-compose.test.yml.
      // Si se define DATABASE_URL en el entorno, se respeta esa (p. ej. CI).
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://beto:test@localhost:5433/beto_training_test",
      ...(process.env.E2E_DATABASE_URL ? { E2E_DATABASE_URL: process.env.E2E_DATABASE_URL } : {}),
      ...(process.env.AUTH_SECRET ? { AUTH_SECRET: process.env.AUTH_SECRET } : {}),
      ...(process.env.NEXTAUTH_URL ? { NEXTAUTH_URL: process.env.NEXTAUTH_URL } : {}),
    },
  },
  use: { baseURL: "http://localhost:3000" },
});