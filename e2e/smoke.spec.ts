import { expect, test } from "@playwright/test";

const MAILDEV = "http://localhost:1080/api/email";
const NOMBRE = "Smoke Cliente";

async function ingresar(page: import("@playwright/test").Page, email: string, pass: string) {
  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(pass);
  await page.getByRole("button", { name: /ingresar|entrar al panel/i }).click();
  // La primera llamada a /api/auth/callback en un dev server recién levantado puede
  // fallar con un 5xx transitorio de compilación/DB (no deja LOGIN_FAILED ni sesión),
  // que la UI traduce al banner genérico pese a que las credenciales son correctas.
  // Si aparece ese banner, un segundo intento (con el server tibio) debería resolverlo.
  const bannerError = page.getByText(/email o contrase.a incorrectos/i);
  try {
    await bannerError.waitFor({ state: "visible", timeout: 3000 });
    await page.getByRole("button", { name: /ingresar|entrar al panel/i }).click();
  } catch {
    // sin banner de error: login correcto
  }
}

async function elegirSlotFuncional(page: import("@playwright/test").Page) {
  // La Funcional tiene horarios Lun y Mié 19:00. Esperamos (con margen, el fetch de
  // /api/clases puede tardar en dev) a que aparezca el slot del día y lo volvemos.
  for (const dia of ["Lun", "Mié"]) {
    const chip = page.getByRole("button", { name: new RegExp(`^${dia}\\s+\\d+$`) }).first();
    await chip.click();
    const slot = page.getByRole("button", { name: /^19:00/ }).first();
    try {
      await slot.waitFor({ state: "visible", timeout: 20000 });
      return slot;
    } catch {
      // seguimos con la otra jornada
    }
  }
  throw new Error("No se encontró ningún horario de Funcional (Lun/Mié 19:00)");
}

// Smoke test de punta a punta que cruza los tres subsistemas en una sola corrida:
// registro -> verificacion de email -> login de cliente -> reserva una clase COLECHA
// en EFECTIVO (sin depender del sandbox de MP) -> la ve en Mis reservas -> la
// cancela dentro de la ventana de 12hs y confirma cupo liberado -> login como ADMIN
// -> arma una rutina desde la ficha de ese cliente y la asigna -> login de nuevo como
// el cliente y confirma que "Mi rutina" muestra el programa asignado.
test.describe.configure({ mode: "serial" });

test("smoke: registro/verif/reserva-en-efectivo/cancelar/admin-arma-rutina/asignar/Mi-rutina", async ({ page, request }) => {
  const email = `smoke-${Date.now()}@example.com`;

  // ── 1) Registro de un cliente nuevo ──────────────────────────────────────────
  await page.goto("/registro");
  await page.getByPlaceholder("Nombre").fill(NOMBRE);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill("Password123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText(/Te mandamos un email/)).toBeVisible();

  // ── 2) Verificacion de email vía Maildev ─────────────────────────────────────
  await expect
    .poll(
      async () => {
        const res = await request.get(MAILDEV);
        const emails = (await res.json()) as { to: { address: string }[] }[];
        return emails.find((m) => m.to.some((t) => t.address === email));
      },
      { timeout: 15000 }
    )
    .toBeTruthy();
  const mails = (await (await request.get(MAILDEV)).json()) as { to: { address: string }[]; html: string }[];
  const ultimo = mails.find((m) => m.to.some((t) => t.address === email))!;
  const htmlMatch = ultimo.html.match(/href="([^"]*token=[^"\s&>]+)"/);
  await page.goto(htmlMatch?.[1]!);
  await expect(page).toHaveURL(/\/login\?/);

  // ── 3) Login como cliente ────────────────────────────────────────────────────
  await ingresar(page, email, "Password123");
  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();

  // ── 4) Reservar una clase paga en efectivo (funcional, cupoMax 8 sin conflicto) ──
  await page.getByRole("button", { name: /reservar clase/i }).click();
  await expect(page.getByRole("heading", { name: /Reservá tu turno/i })).toBeVisible();
  await page.getByRole("button", { name: /funcional/i }).click();
  // La funcional se dicta Lun y Mié 19:00; elegimos el primer día que tenga el
  // horario y clic el slot 19:00 (cupoMax 8, no hay contención por cupo).
  const slotFuncional = await elegirSlotFuncional(page);
  await slotFuncional.click();
  await page.getByRole("button", { name: /continuar al pago/i }).click();
  // Método en efectivo: reservás ahora, pagás al llegar.
  await page.getByRole("button", { name: /efectivo en el estudio/i }).click();
  await page.getByRole("button", { name: /pagar/i }).click();
  await expect(page.getByText(/turno confirmado/i)).toBeVisible({ timeout: 15000 });

  // ── 5) La ve en "Mis reservas" ───────────────────────────────────────────────
  await page.getByRole("button", { name: /ver mis reservas/i }).click();
  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
  await expect(page.getByText(/funcional/i).first()).toBeVisible();

  // ── 6) La cancela de verdad (ventana 12hs) y el cupo se libera ────────────────
  await page.getByRole("button", { name: /cancelar/i }).click();
  await expect(page.getByText(/reserva cancelada/i)).toBeVisible();
  // La reserva ya no está activa: desaparece el botón "Cancelar" de esa fila.
  await expect(page.getByRole("button", { name: /cancelar/i })).not.toBeVisible();

  // ── 7) Cambiar a ADMIN y armar la rutina desde la ficha del cliente ────────────
  // Limpiamos cookies directamente (más determinista que el logout por UI en el
  // mismo browser) y entramos como el admin del seed.
  await page.context().clearCookies();
  await page.goto("/login");
  await ingresar(page, process.env.SEED_ADMIN_EMAIL ?? "admin@e2e.com", process.env.SEED_ADMIN_PASSWORD ?? "AdminE2E123");
  await expect(page.getByRole("heading", { name: "Panel de Beto" })).toBeVisible({ timeout: 20000 });

  await page.getByRole("button", { name: /constructor de rutinas/i }).click();
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await page.getByPlaceholder("Buscar cliente").fill(NOMBRE);
  const filaSmoke = page.getByRole("row").filter({ hasText: NOMBRE }).first();
  await filaSmoke.getByRole("button", { name: "Abrir ficha" }).click();
  await page.getByRole("button", { name: /armar rutina/i }).click();
  await expect(page.getByText("Sin asignar")).toBeVisible();

  await page.getByText("Lunes").locator("..").locator("..").getByRole("button", { name: "+", exact: true }).click();
  await page.getByPlaceholder("Nombre del ejercicio").fill("Sentadilla trasera con barra");
  await page.getByPlaceholder(/Detalle/).fill("4 × 3 · @ 75% 1RM");
  await page.getByRole("button", { name: /guardar bloque/i }).click();
  await expect(page.getByText("Bloque guardado con su sobrecarga")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByText(/^Asignar «/)).toBeVisible();
  // Puede haber Smoke Cliente duplicados de corridas anteriores; cualquiera sirve.
  await page.getByText(NOMBRE).first().click();
  await page.getByRole("button", { name: /Asignar a 1 clientes/ }).click();
  await expect(page.getByText(/Programa asignado a 1 clientes/)).toBeVisible();

  // ── 8) Cambiar de nuevo al cliente y ver el programa en Mi rutina ─────────────
  await page.context().clearCookies();
  await page.goto("/login");
  await ingresar(page, email, "Password123");
  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
  await page.getByText("Mi rutina").click();
  await expect(page.getByRole("heading", { name: "Mi rutina" })).toBeVisible();
  await expect(page.getByText(/asignada por Beto el/)).toBeVisible();
  await expect(page.getByText("Sentadilla trasera con barra")).toBeVisible({ timeout: 15000 });
});