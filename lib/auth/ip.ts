const TRUST_PROXY = process.env.TRUST_PROXY === "1";

function stripPort(raw: string): string {
  const ip = raw.trim();
  if (ip.startsWith("[")) {
    const close = ip.indexOf("]");
    return close > 0 ? ip.slice(1, close) : ip;
  }
  const m = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  return m ? m[1] : ip;
}

export function getClientIpFrom(headers: Headers | string[]): string {
  if (!TRUST_PROXY) {
    return "unknown";
  }
  const xff = Array.isArray(headers) ? headers.join(",") : headers.get("x-forwarded-for") ?? "";
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first && first !== "unknown") return stripPort(first);
  }
  const realIp = Array.isArray(headers)
    ? null
    : headers.get("x-real-ip");
  if (realIp && realIp !== "unknown") return stripPort(realIp);
  return "unknown";
}

export function getClientIp(req: Request): string {
  return getClientIpFrom(req.headers);
}

export function maskIp(ip: string | null | undefined): string | null {
  if (ip == null || ip === "unknown") return null;
  if (ip.includes(":")) {
    const firstGroup = ip.split(":")[0];
    return firstGroup ? `${firstGroup}:...` : null;
  }
  const firstOctet = ip.split(".")[0];
  return firstOctet ? `${firstOctet}.x.x.x` : null;
}