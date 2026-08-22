import { expect, test } from "@playwright/test";

test("registro, verificación por Maildev y login", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/registro");
  await page.getByPlaceholder("Nombre").fill("E2E Test");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("Password123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText(/Te mandamos un email/)).toBeVisible();

  const MAILDEV = "http://localhost:1080/email";

  await expect
    .poll(
      async () => {
        const res = await request.get(MAILDEV);
        const emails = (await res.json()) as { to: { address: string }[] }[];
        return emails.find((m) => m.to.some((t) => t.address === email));
      },
      { timeout: 10000 }
    )
    .toBeTruthy();

  const maildevRes = await request.get(MAILDEV);
  const emails = (await maildevRes.json()) as { to: { address: string }[]; html: string; text?: string }[];
  const ultimo = emails.find((m) => m.to.some((t) => t.address === email))!;
  // El email envia el link tal cual se registra (produccion apunta al route
  // /api/auth/verificar-email). Lo extraemos del HTML para navegar al link real
  // y evitar hardcodear una ruta que pueda divergir del email generado.
  const htmlMatch = ultimo.html.match(/href="([^"]*token=[^"\s&>]+)"/);
  const textMatch = (ultimo.text ?? "").match(/https?:\/\/[^\s]+token=[\w-]+/);
  const verificationLink = (htmlMatch?.[1] ?? textMatch?.[0])!;

  await page.goto(verificationLink);
  await expect(page).toHaveURL(/\/login\?/);

  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill("Password123");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page.getByText("Mis reservas")).toBeVisible();
});

test("un cliente no puede entrar a /coach", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill("camila.f@example.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page.getByText("Mis reservas")).toBeVisible();

  await page.goto("/coach");
  await page.waitForURL(/\/(login)?$/);
  await expect(page).toHaveURL(/\/(login)?$/);
  await expect(page.getByText("Panel de Beto")).not.toBeVisible();
});