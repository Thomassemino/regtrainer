import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          testTimeout: 20000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 20000,
          hookTimeout: 30000,
          fileParallelism: false,
          env: {
            DATABASE_URL: "postgresql://beto:test@localhost:5433/beto_training_test",
            SMTP_HOST: "localhost",
            SMTP_PORT: "1025",
            NEXTAUTH_URL: "http://localhost:3000",
            AUTH_SECRET: "test-secret-at-least-32-characters",
            RATE_LIMIT_LOGIN_MAX_ATTEMPTS: "5",
            RATE_LIMIT_LOGIN_WINDOW_MINUTES: "15",
          },
        },
      },
    ],
  },
});