import { expect, test } from "@playwright/test";

test("reservar una clase gratis (evaluación) de punta a punta", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill("camila.f@example.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\//, { timeout: 10000 });

  // La SPA no lee ?screen=reservar (solo ?screen=coach). Entramos por "Reservar clase".
  await page.getByRole("button", { name: /reservar clase/i }).click();
  await expect(page.getByRole("heading", { name: /Reservá tu turno/i })).toBeVisible({ timeout: 10000 });

  // Elegir el servicio "Evaluación inicial" (gratis).
  await page.getByRole("button", { name: /evaluación inicial/i }).click();

  // La clase se genera un día fijo de la semana (miércoles). El día por defecto puede
  // no tenerla; usamos el último miércoles visible (puede ser el de la semana siguiente).
  await page.getByRole("button", { name: /Mié \d+/i }).last().click();

  // El horario de la evaluación se genera a las 12:00. La primera vez este fetch puede
  // tardar (compilación on-demand de /api/clases en dev), así que esperamos con margen.
  const horarioEvaluacion = page.getByRole("button", { name: /12:00/ }).first();
  await expect(horarioEvaluacion).toBeVisible({ timeout: 20000 });
  await horarioEvaluacion.click();

  await page.getByRole("button", { name: /continuar al pago/i }).click();
  await page.getByRole("button", { name: /confirmar|pagar/i }).click();

  await expect(page.getByText(/turno confirmado/i)).toBeVisible({ timeout: 10000 });
});

test("una clase paga sin mensualidad redirige a Mercado Pago", async ({ page }) => {
  test.skip(
    !process.env.MERCADOPAGO_ACCESS_TOKEN,
    "Requiere credenciales de test/sandbox de Mercado Pago configuradas (MERCADOPAGO_ACCESS_TOKEN). Ver spec §12."
  );

  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill("martin.d@example.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();

  await page.goto("/?screen=reservar");
  const primerHorario = page.locator("button", { hasText: /\d{2}:\d{2}/ }).first();
  await primerHorario.click();
  await page.getByRole("button", { name: /continuar al pago/i }).click();

  await page.getByText(/mercado pago/i).click();
  const [popupOrNav] = await Promise.all([
    page.waitForURL(/mercadopago\.com/, { timeout: 15000 }).catch(() => null),
    page.getByRole("button", { name: /pagar/i }).click(),
  ]);
  expect(page.url()).toMatch(/mercadopago\.com|checkout/);
});