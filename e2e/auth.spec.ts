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
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("camila.f@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/login/);
});