import { prisma } from "../../../lib/db";
import { logger } from "../../../lib/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}