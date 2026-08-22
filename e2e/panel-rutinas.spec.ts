import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "beto@betotraining.com.ar";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "";

test.describe.configure({ mode: "serial" });

test("entrenador: clientes -> ficha -> builder -> asignar -> pdf", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/contraseña/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /entrar al panel|ingresar/i }).click();
  await expect(page).toHaveURL(/screen=coach/);

  await page.getByRole("button", { name: /constructor de rutinas/i }).click();
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();

  await page.getByRole("button", { name: "Abrir ficha" }).first().click();
  await page.getByRole("button", { name: /armar rutina/i }).click();
  await expect(page.getByText("Sin asignar")).toBeVisible();

  // Crear el primer bloque del lunes.
  await page.getByText("Lunes").locator("..").getByText("+").click();
  await page.getByPlaceholder("Nombre del ejercicio").fill("Sentadilla trasera con barra");
  await page.getByPlaceholder(/Detalle/).fill("5 × 3 · @ 80% 1RM");
  await page.getByRole("button", { name: /guardar bloque/i }).click();
  await expect(page.getByText("Bloque guardado con su sobrecarga")).toBeVisible();

  // Crear el segundo bloque del mismo día.
  await page.getByText("Lunes").locator("..").getByText("+").click();
  await page.getByPlaceholder("Nombre del ejercicio").fill("Press de banca con barra");
  await page.getByPlaceholder(/Detalle/).fill("5 × 4 · @ 77,5% 1RM");
  await page.getByRole("button", { name: /guardar bloque/i }).click();

  // Reordenar por teclado (activación por teclado de @dnd-kit, spec §6): foco en la
  // primera tarjeta, Espacio para levantarla, flecha abajo para moverla, Espacio para soltarla.
  const primeraTarjeta = page.getByText("Sentadilla trasera con barra");
  await primeraTarjeta.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");

  // Agregar una semana.
  await page.getByRole("button", { name: "+", exact: true }).last().click();
  await expect(page.getByText(/Semana \d agregada al bloque/)).toBeVisible();

  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByText(/^Asignar «/)).toBeVisible();

  await page.getByText("Camila Ferreyra").click();
  await page.getByText("Martín Duarte").click();
  await page.getByRole("button", { name: /Asignar a 2 clientes/ }).click();
  await expect(page.getByText(/Programa asignado a 2 clientes/)).toBeVisible();

  await page.getByText("Night Design").click();
  const descargaPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const descarga = await descargaPromise;
  expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
});

test("cliente: ve el programa recién asignado en Mi rutina", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("camila.f@example.com");
  await page.getByPlaceholder(/contraseña/i).fill("Demo1234");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/cuenta/);

  await page.getByText("Mi rutina").click();
  await expect(page.getByRole("heading", { name: "Mi rutina" })).toBeVisible();
  await expect(page.getByText(/asignada por Beto el/)).toBeVisible();
});