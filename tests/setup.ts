import { execSync } from "node:child_process";
import { beforeAll } from "vitest";

beforeAll(() => {
  execSync("npx prisma migrate reset --force", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "inherit",
  });
});