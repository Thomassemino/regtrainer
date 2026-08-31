import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/hash";
import { pesosACentavos } from "../lib/dinero";

// cupoMax es un valor demo (ver docs/superpowers/plans/2026-08-22-booking-pagos.md, Task 2)
// — confirmar con Beto antes de producción, no está tomado de ningún dato de negocio real.
const U = (id: string, w?: number) => "https://images.unsplash.com/photo-" + id + "?fm=jpg&q=70&w=" + (w || 1200) + "&auto=format&fit=crop";

const SERVICIOS_SEED = [
  { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precioPesos: 22000, cupoMax: 1, descripcion: "Una hora entera para vos: evaluación de movilidad, corrección técnica y progresión de cargas semana a semana. Ideal si arrancás de cero o venís de una lesión.", imagenUrl: U("1676655079738-af54dfd6318e", 900) },
  { slug: "funcional", nombre: "Funcional / HIIT", tag: "Grupal", duracionMin: 50, precioPesos: 12000, cupoMax: 8, descripcion: "Circuitos de fuerza y cardio en grupos de hasta 8 personas. Cada bloque se adapta a tu nivel, así que entrenás al lado de alguien más avanzado sin quedarte atrás.", imagenUrl: U("1599058917212-d750089bc07e", 900) },
  { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precioPesos: 15000, cupoMax: 8, descripcion: "Trabajo de fuerza planificado en bloques de cuatro semanas, con control de RPE y registro de cargas para que la progresión sea medible y no una sensación.", imagenUrl: U("1689877020200-403d8542d95d", 900) },
  { slug: "outdoor", nombre: "Outdoor / Running", tag: "Aire libre", duracionMin: 60, precioPesos: 10000, cupoMax: 8, descripcion: "Series, fondo y técnica de carrera al aire libre, con grupos separados por ritmo.", imagenUrl: U("1651840403916-d1e0515b32c4", 900) },
  { slug: "online", nombre: "Rutinas grabadas", tag: "Online", duracionMin: 0, precioPesos: 9000, cupoMax: 999, descripcion: "Biblioteca de rutinas filmadas por Beto, organizadas por objetivo y equipamiento. Se actualiza todos los meses e incluye una videollamada de ajuste.", imagenUrl: U("1672344048213-76b6e77304bd", 900) },
  { slug: "evaluacion", nombre: "Evaluación inicial", tag: "Sin cargo", duracionMin: 45, precioPesos: 0, cupoMax: 1, descripcion: "Antropometría, movilidad, fuerza y una charla sobre tu objetivo real. Salís con un plan escrito, entrenes o no con Beto después.", imagenUrl: U("1590487988256-9ed24133863e", 900) },
];

const PLANES_SEED = [
  { slug: "suelta", nombre: "Clase suelta", descripcion: "Probá sin compromiso, se paga al reservar.", precioPesos: 12000, unidad: "por clase", badge: "", feats: ["Sin vencimiento", "Cualquier disciplina"], orden: 0 },
  { slug: "mensual", nombre: "Mensualidad", descripcion: "Todas las grupales + 1 personalizada por semana.", precioPesos: 150000, unidad: "por mes, se renueva solo", badge: "Suscripción", feats: ["Clases ilimitadas", "Cupo garantizado", "Cancelás cuando quieras"], orden: 1 },
];

async function seedServiciosYHorarios() {
  const servicios: Record<string, { id: string }> = {};
  for (const s of SERVICIOS_SEED) {
    servicios[s.slug] = await prisma.servicio.upsert({
      where: { slug: s.slug },
      update: { nombre: s.nombre, tag: s.tag, duracionMin: s.duracionMin, precio: pesosACentavos(s.precioPesos), cupoMax: s.cupoMax },
      create: {
        slug: s.slug,
        nombre: s.nombre,
        tag: s.tag,
        descripcion: s.descripcion,
        imagenUrl: s.imagenUrl,
        duracionMin: s.duracionMin,
        precio: pesosACentavos(s.precioPesos),
        cupoMax: s.cupoMax,
      },
    });
  }

  for (const p of PLANES_SEED) {
    await prisma.planPrecio.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: pesosACentavos(p.precioPesos),
        unidad: p.unidad,
        badge: p.badge,
        feats: p.feats,
        orden: p.orden,
      },
    });
  }

  const HORARIOS_SEED: { slug: string; diaSemana: number; horaInicio: string }[] = [
    { slug: "outdoor", diaSemana: 2, horaInicio: "07:00" },
    { slug: "outdoor", diaSemana: 4, horaInicio: "07:00" },
    { slug: "funcional", diaSemana: 1, horaInicio: "19:00" },
    { slug: "funcional", diaSemana: 3, horaInicio: "19:00" },
    { slug: "musculacion", diaSemana: 1, horaInicio: "18:00" },
    { slug: "musculacion", diaSemana: 3, horaInicio: "18:00" },
    { slug: "musculacion", diaSemana: 5, horaInicio: "18:00" },
    { slug: "personal", diaSemana: 2, horaInicio: "09:00" },
    { slug: "personal", diaSemana: 4, horaInicio: "09:00" },
    { slug: "personal", diaSemana: 6, horaInicio: "10:00" },
    { slug: "evaluacion", diaSemana: 3, horaInicio: "12:00" },
  ];

  for (const h of HORARIOS_SEED) {
    const servicio = servicios[h.slug];
    const existente = await prisma.horarioRecurrente.findFirst({
      where: { servicioId: servicio.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio },
    });
    if (!existente) {
      await prisma.horarioRecurrente.create({
        data: { servicioId: servicio.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio },
      });
    }
  }

  console.log("Servicios y horarios recurrentes seedeados.");
}

async function main() {
  await seedServiciosYHorarios();

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log("Set SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para crear el admin; continuando sin admin.");
  } else {
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
  }

  // Admin de testing (Thomas) — entra por Google OAuth, sin contraseña. Sacar cuando
  // ya no haga falta testear el panel de entrenador con esta cuenta.
  await prisma.user.upsert({
    where: { email: "seminothomas8196@gmail.com" },
    update: {},
    create: {
      email: "seminothomas8196@gmail.com",
      passwordHash: null,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  const clientesDemo = [
    { email: "camila.f@example.com", nombre: "Camila Ferreyra", iniciales: "CF", objetivo: "Volver a correr sin dolor de rodilla", plan: "Mensualidad" },
    { email: "martin.d@example.com", nombre: "Martín Duarte", iniciales: "MD", objetivo: "Ganar fuerza en tren superior", plan: "Mensualidad" },
    { email: "sofia.l@example.com", nombre: "Sofía Lema", iniciales: "SL", objetivo: "Bajar grasa y sostener la rutina", plan: "Clase suelta" },
    { email: "lucia.g@example.com", nombre: "Lucía Giménez", iniciales: "LG", objetivo: "Primera vez en el gimnasio", plan: "Evaluación inicial" },
    { email: "nicolas.p@example.com", nombre: "Nicolás Pereyra", iniciales: "NP", objetivo: "Bajar la marca en 10K", plan: "Mensualidad" },
    { email: "julieta.r@example.com", nombre: "Julieta Ríos", iniciales: "JR", objetivo: "Rehabilitación de hombro", plan: "Mensualidad" },
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