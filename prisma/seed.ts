import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/hash";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log("Set SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para crear el admin; continuando sin admin.");
    return;
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const clientesDemo = [
    { email: "camila.f@example.com", nombre: "Camila Ferreyra", iniciales: "CF", objetivo: "Volver a correr sin dolor de rodilla", plan: "Bono 8 · 6 clases" },
    { email: "martin.d@example.com", nombre: "Martín Duarte", iniciales: "MD", objetivo: "Ganar fuerza en tren superior", plan: "Mensualidad" },
    { email: "sofia.l@example.com", nombre: "Sofía Lema", iniciales: "SL", objetivo: "Bajar grasa y sostener la rutina", plan: "Bono 4 · 2 clases" },
    { email: "lucia.g@example.com", nombre: "Lucía Giménez", iniciales: "LG", objetivo: "Primera vez en el gimnasio", plan: "Evaluación inicial" },
    { email: "nicolas.p@example.com", nombre: "Nicolás Pereyra", iniciales: "NP", objetivo: "Bajar la marca en 10K", plan: "Mensualidad" },
    { email: "julieta.r@example.com", nombre: "Julieta Ríos", iniciales: "JR", objetivo: "Rehabilitación de hombro", plan: "Bono 8 · 4 clases" },
  ];

  if (process.env.SEED_DEMO_DATA === "true") {
    for (const c of clientesDemo) {
      const user = await prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: {
          email: c.email,
          passwordHash: await hashPassword("Demo1234"),
          role: "CLIENTE",
          emailVerified: new Date(),
        },
      });
      await prisma.cliente.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          nombre: c.nombre,
          iniciales: c.iniciales,
          objetivo: c.objetivo,
          plan: c.plan,
        },
      });
    }
    console.log("Clientes demo creados.");
  } else {
    console.log("SEED_DEMO_DATA no activado: no se crearon clientes demo.");
  }

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });