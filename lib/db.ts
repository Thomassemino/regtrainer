import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let client = globalForPrisma.prisma;

const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!client) client = createClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, prop, value) {
    if (!client) client = createClient();
    (client as unknown as Record<PropertyKey, unknown>)[prop] = value;
    return true;
  },
}) as PrismaClient;

export const prisma = prismaProxy;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaProxy;
}