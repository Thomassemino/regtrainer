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
}