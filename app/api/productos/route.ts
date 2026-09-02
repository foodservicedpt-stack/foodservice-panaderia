export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const products = await prisma.product.findMany({
    orderBy: { orden: 'asc' },
  });

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { id, nombre, categoria, margenSeguridadDias, consumoDiarioDefecto, diaSemanal, activo } = body ?? {};

    if (id) {
      // Update
      const product = await prisma.product.update({
        where: { id: parseInt(id) },
        data: {
          nombre: nombre ?? undefined,
          categoria: categoria ?? undefined,
          margenSeguridadDias: margenSeguridadDias !== undefined ? parseInt(margenSeguridadDias) : undefined,
          consumoDiarioDefecto: consumoDiarioDefecto !== undefined ? parseInt(consumoDiarioDefecto) : undefined,
          diaSemanal: diaSemanal ?? undefined,
          activo: activo !== undefined ? activo : undefined,
        },
      });
      return NextResponse.json(product);
    } else {
      // Create
      const maxOrder = await prisma.product.aggregate({ _max: { orden: true } });
      const product = await prisma.product.create({
        data: {
          nombre: nombre ?? 'Nuevo producto',
          categoria: categoria ?? 'STOCK',
          margenSeguridadDias: parseInt(margenSeguridadDias) || 2,
          consumoDiarioDefecto: parseInt(consumoDiarioDefecto) || 10,
          diaSemanal: diaSemanal ?? null,
          orden: (maxOrder._max.orden ?? 0) + 1,
        },
      });
      return NextResponse.json(product);
    }
  } catch (error: any) {
    console.error('Error saving product:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
