import { prisma } from "../lib/db";

async function main() {
  // Limpia el estado transaccional y de sesiones antes de cada corrida de e2e.
  // Es una DB de test efímera (docker-compose.test.yml); borrar su contenido es seguro.
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.bloqueCompletado.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  console.log("Estado de e2e limpiado (reservas, pagos, suscripciones, audit, sesiones).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });