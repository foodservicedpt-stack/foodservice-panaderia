export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
  }

  const items = await prisma.ordenTrabajoItem.findMany({
    where: {
      fecha: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: { producto: true },
  });

  const notas = await prisma.notaDia.findMany({
    where: {
      fecha: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
  });

  const products = await prisma.product.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
  });

  const planificaciones = await prisma.planificacionDia.findMany({
    where: {
      fecha: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: { producto: true },
  });

  return NextResponse.json({ items, notas, products, planificaciones });
}

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { type } = body ?? {};

    if (type === 'toggle') {
      const { productoId, fecha, completado } = body;
      await prisma.ordenTrabajoItem.upsert({
        where: { productoId_fecha: { productoId: parseInt(productoId), fecha: new Date(fecha) } },
        update: { completado },
        create: { productoId: parseInt(productoId), fecha: new Date(fecha), completado },
      });
      return NextResponse.json({ success: true });
    }

    if (type === 'nota') {
      const { fecha, nota } = body;
      if (!nota?.trim()) {
        await prisma.notaDia.deleteMany({ where: { fecha: new Date(fecha) } });
      } else {
        await prisma.notaDia.upsert({
          where: { fecha: new Date(fecha) },
          update: { nota },
          create: { fecha: new Date(fecha), nota },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
