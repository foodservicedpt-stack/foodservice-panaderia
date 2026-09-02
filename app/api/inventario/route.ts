export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { toDateString } from '@/lib/business-logic';

export async function GET() {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { categoria: 'STOCK', activo: true },
    orderBy: { orden: 'asc' },
  });

  const movimientos = await prisma.movimientoInventario.findMany({
    include: { producto: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ products, movimientos });
}

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { productoId, cantidad, tipo, notas } = body ?? {};

    if (!productoId || cantidad === undefined) {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
    }

    const qty = parseInt(cantidad);

    // Update stock
    await prisma.product.update({
      where: { id: parseInt(productoId) },
      data: { stockActual: { increment: qty } },
    });

    // Create movement
    await prisma.movimientoInventario.create({
      data: {
        productoId: parseInt(productoId),
        fecha: new Date(toDateString(new Date())),
        cantidad: qty,
        tipo: tipo || 'AJUSTE',
        notas: notas || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
