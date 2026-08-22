import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./lib/auth";

const PROTECTED_ADMIN_PREFIXES = ["/coach", "/api/coach"];

const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; font-src 'self' https://unpkg.com; connect-src 'self' https://unpkg.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": CSP,
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = applySecurityHeaders(NextResponse.next());

  const requiresAdmin = PROTECTED_ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (!requiresAdmin) {
    return response;
  }

  const session = await auth();
  if (!session?.user) {
    if (pathname.startsWith("/api/coach")) {
      return applySecurityHeaders(NextResponse.json({ error: "No autorizado" }, { status: 401 }));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session.user.role !== "ADMIN") {
    if (pathname.startsWith("/api/coach")) {
      return applySecurityHeaders(NextResponse.json({ error: "No autorizado" }, { status: 403 }));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};