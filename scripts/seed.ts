import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hash team password
  const hashedPassword = await bcrypt.hash('foodservice2024', 10);
  await prisma.appConfig.upsert({
    where: { clave: 'team_password' },
    update: { valor: hashedPassword },
    create: { clave: 'team_password', valor: hashedPassword },
  });

  await prisma.appConfig.upsert({
    where: { clave: 'margen_seguridad_global' },
    update: {},
    create: { clave: 'margen_seguridad_global', valor: '2' },
  });

  // Cat A - con stock
  const catA = [
    { nombre: 'Hogazas blancas', stockActual: 80, margenSeguridadDias: 2, consumoDiarioDefecto: 22, orden: 1 },
    { nombre: 'Hogazas integrales', stockActual: 30, margenSeguridadDias: 2, consumoDiarioDefecto: 3, orden: 2 },
    { nombre: 'Bollitos blancos', stockActual: 120, margenSeguridadDias: 2, consumoDiarioDefecto: 50, orden: 3 },
    { nombre: 'Barras blancas', stockActual: 50, margenSeguridadDias: 2, consumoDiarioDefecto: 10, orden: 4 },
  ];

  for (const p of catA) {
    await prisma.product.upsert({
      where: { id: catA.indexOf(p) + 1 },
      update: {},
      create: { ...p, categoria: 'STOCK' },
    });
  }

  // Cat B - semanal
  const catB = [
    { nombre: 'Panes especiales', orden: 5, diaSemanal: 'miercoles' },
    { nombre: 'Bizcocho', orden: 6, diaSemanal: 'lunes' },
  ];

  for (const p of catB) {
    await prisma.product.upsert({
      where: { id: catA.length + catB.indexOf(p) + 1 },
      update: {},
      create: { ...p, categoria: 'SEMANAL', stockActual: 0, consumoDiarioDefecto: 0, margenSeguridadDias: 0 },
    });
  }

  // Cat C - otros
  const catC = [
    { nombre: 'Yogur', orden: 7, diaSemanal: 'martes' },
    { nombre: 'Helado', orden: 8, diaSemanal: 'jueves' },
  ];

  for (const p of catC) {
    await prisma.product.upsert({
      where: { id: catA.length + catB.length + catC.indexOf(p) + 1 },
      update: {},
      create: { ...p, categoria: 'OTRO', stockActual: 0, consumoDiarioDefecto: 0, margenSeguridadDias: 0 },
    });
  }

  // Seed planificacion for current week (Mon-Sun)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const planData: { productoId: number; dia: number; d: number; c: number; e: number }[] = [
    // Hogazas blancas (id=1)
    { productoId: 1, dia: 0, d: 0, c: 24, e: 0 },
    { productoId: 1, dia: 1, d: 0, c: 18, e: 0 },
    { productoId: 1, dia: 2, d: 0, c: 24, e: 0 },
    { productoId: 1, dia: 3, d: 0, c: 18, e: 0 },
    { productoId: 1, dia: 4, d: 0, c: 6, e: 0 },
    // Hogazas integrales (id=2)
    { productoId: 2, dia: 0, d: 0, c: 3, e: 0 },
    { productoId: 2, dia: 1, d: 0, c: 3, e: 0 },
    { productoId: 2, dia: 2, d: 0, c: 3, e: 0 },
    { productoId: 2, dia: 3, d: 0, c: 3, e: 0 },
    { productoId: 2, dia: 4, d: 0, c: 2, e: 0 },
    // Bollitos blancos (id=3)
    { productoId: 3, dia: 0, d: 50, c: 0, e: 0 },
    { productoId: 3, dia: 1, d: 50, c: 0, e: 0 },
    { productoId: 3, dia: 2, d: 50, c: 0, e: 0 },
    { productoId: 3, dia: 3, d: 50, c: 0, e: 0 },
    { productoId: 3, dia: 4, d: 50, c: 0, e: 0 },
    // Barras blancas (id=4)
    { productoId: 4, dia: 4, d: 0, c: 50, e: 0 },
    { productoId: 4, dia: 5, d: 0, c: 50, e: 0 },
    { productoId: 4, dia: 6, d: 0, c: 50, e: 0 },
  ];

  for (const p of planData) {
    const fecha = new Date(monday);
    fecha.setDate(monday.getDate() + p.dia);
    const dateStr = fecha.toISOString().split('T')[0];
    await prisma.planificacionDia.upsert({
      where: { productoId_fecha: { productoId: p.productoId, fecha: new Date(dateStr) } },
      update: {},
      create: {
        productoId: p.productoId,
        fecha: new Date(dateStr),
        desayuno: p.d,
        comida: p.c,
        extra: p.e,
        esExcepcion: false,
      },
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
