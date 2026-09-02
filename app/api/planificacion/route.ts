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

  const planificaciones = await prisma.planificacionDia.findMany({
    where: {
      fecha: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: { producto: true },
    orderBy: [{ productoId: 'asc' }, { fecha: 'asc' }],
  });

  const products = await prisma.product.findMany({
    where: { categoria: 'STOCK', activo: true },
    orderBy: { orden: 'asc' },
  });

  return NextResponse.json({ planificaciones, products });
}

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { productoId, fecha, desayuno, comida, extra, esExcepcion } = body ?? {};

    if (!productoId || !fecha) {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
    }

    const result = await prisma.planificacionDia.upsert({
      where: {
        productoId_fecha: {
          productoId: parseInt(productoId),
          fecha: new Date(fecha),
        },
      },
      update: {
        desayuno: parseInt(desayuno) || 0,
        comida: parseInt(comida) || 0,
        extra: parseInt(extra) || 0,
        esExcepcion: esExcepcion ?? false,
      },
      create: {
        productoId: parseInt(productoId),
        fecha: new Date(fecha),
        desayuno: parseInt(desayuno) || 0,
        comida: parseInt(comida) || 0,
        extra: parseInt(extra) || 0,
        esExcepcion: esExcepcion ?? false,
      },
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error saving planificacion:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
