export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { toDateString } from '@/lib/business-logic';

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { amasadoraId, piezas } = body ?? {};

    if (!amasadoraId || !piezas || piezas <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const amasadora = await prisma.amasadora.findUnique({
      where: { id: parseInt(amasadoraId) },
    });

    if (!amasadora) {
      return NextResponse.json({ error: 'Amasadora no encontrada' }, { status: 404 });
    }

    // Update amasadora
    await prisma.amasadora.update({
      where: { id: parseInt(amasadoraId) },
      data: {
        estado: 'COMPLETADA',
        piezasProducidas: parseInt(piezas),
      },
    });

    // Add to stock
    await prisma.product.update({
      where: { id: amasadora.productoId },
      data: {
        stockActual: { increment: parseInt(piezas) },
      },
    });

    // Create movement record
    await prisma.movimientoInventario.create({
      data: {
        productoId: amasadora.productoId,
        fecha: new Date(toDateString(new Date())),
        cantidad: parseInt(piezas),
        tipo: 'AMASADA',
        notas: `Amasadora del ${new Date(amasadora.fechaInicio).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error confirming amasadora:', error);
    return NextResponse.json({ error: 'Error al confirmar' }, { status: 500 });
  }
}
