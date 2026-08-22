const NOMBRES_COOKIE_SESION = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export interface CookieSesion {
  name: string;
  value: string;
}

export function extraerCookieSesion(headerCookie: string | null): CookieSesion | null {
  if (!headerCookie) return null;
  for (const par of headerCookie.split(";")) {
    const [rawName, ...resto] = par.trim().split("=");
    if (NOMBRES_COOKIE_SESION.includes(rawName)) {
      return { name: rawName, value: resto.join("=") };
    }
  }
  return null;
}