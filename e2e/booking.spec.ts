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

test("reservar, verla en Mis reservas, cancelarla de verdad y confirmar que el cupo se liberó", async ({ page }) => {
  // Cliente distinto al del test de reserva (que usa .last()); este usa .first() de Mié,
  // así ambas instancias de evaluación (cupoMax 1) son independientes.
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill("sofia.l@example.com");
  await page.getByPlaceholder("••••••••").fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\//, { timeout: 10000 });

  await page.getByRole("button", { name: /reservar clase/i }).click();
  await expect(page.getByRole("heading", { name: /Reservá tu turno/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /evaluación inicial/i }).click();
  await page.getByRole("button", { name: /Mié \d+/i }).first().click();
  const horario12 = page.getByRole("button", { name: /12:00/ }).first();
  await expect(horario12).toBeVisible({ timeout: 20000 });
  await horario12.click();
  await page.getByRole("button", { name: /continuar al pago/i }).click();
  await page.getByRole("button", { name: /confirmar|pagar/i }).click();
  await expect(page.getByText(/turno confirmado/i)).toBeVisible({ timeout: 10000 });

  // Ir a "Mis reservas" (la pantalla de confirmación ofrece el acceso directo).
  await page.getByRole("button", { name: /ver mis reservas/i }).click();
  await expect(page.getByRole("heading", { name: /Mis reservas/i })).toBeVisible({ timeout: 10000 });

  // Cancelar la reserva de verdad (el backend libera el cupo). Un solo cliente, una sola fila.
  const filaReserva = page.getByText(/evaluación inicial/i).first();
  await expect(filaReserva).toBeVisible();
  await page.getByRole("button", { name: /cancelar/i }).click();
  await expect(page.getByText(/reserva cancelada/i)).toBeVisible({ timeout: 10000 });

  // Tras cancelar, la reserva sale de "Mis reservas".
  await expect(page.getByText(/evaluación inicial/i).first()).not.toBeVisible();

  // Confirmar que el cupo se liberó: la evaluación (cupoMax 1) vuelve a tener lugar.
  await page.getByRole("button", { name: /reservar clase/i }).click();
  await expect(page.getByRole("heading", { name: /Reservá tu turno/i })).toBeVisible();
  await page.getByRole("button", { name: /evaluación inicial/i }).click();
  await page.getByRole("button", { name: /Mié \d+/i }).first().click();
  const slot = page.getByRole("button", { name: /12:00/ }).first();
  await expect(slot).toBeVisible({ timeout: 20000 });
  // Ya no dice "Completo": el cupo 1 quedó libre.
  await expect(slot).not.toContainText(/completo/i);
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