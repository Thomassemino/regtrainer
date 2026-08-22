import { hashToken } from "../../../../lib/auth/tokens";
import { verifyEmailToken } from "../../../../lib/auth/verify-email-token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.redirect(new URL("/login?error=token_invalido", url));
  }
  const ok = await verifyEmailToken(hashToken(token));
  return Response.redirect(
    new URL(ok ? "/login?verificado=1" : "/login?error=token_expirado", url)
  );
}