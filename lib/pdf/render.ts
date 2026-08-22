import { chromium, type Browser } from "playwright";
import type { CookieSesion } from "./session-cookie";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

export async function renderPdf(url: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await page.close();
  }
}

export async function renderPdfConSesion(url: string, cookie: CookieSesion, origin: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    await context.addCookies([{ name: cookie.name, value: cookie.value, url: origin }]);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await context.close();
  }
}