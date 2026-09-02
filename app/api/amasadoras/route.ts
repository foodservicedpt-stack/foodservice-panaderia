export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { toDateString } from '@/lib/business-logic';

export async function GET() {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const amasadoras = await prisma.amasadora.findMany({
    include: { producto: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(amasadoras);
}

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { productoId, fechaInicio } = body ?? {};

    if (!productoId) {
      return NextResponse.json({ error: 'Producto requerido' }, { status: 400 });
    }

    const fecha = fechaInicio ? new Date(fechaInicio) : new Date();

    const amasadora = await prisma.amasadora.create({
      data: {
        productoId: parseInt(productoId),
        fechaInicio: new Date(toDateString(fecha)),
        estado: 'EN_FERMENTACION',
      },
      include: { producto: true },
    });

    return NextResponse.json(amasadora);
  } catch (error: any) {
    console.error('Error creating amasadora:', error);
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 });
  }
}
