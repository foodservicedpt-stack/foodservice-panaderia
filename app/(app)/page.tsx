export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { toDateString, prevBusinessDay } from '@/lib/business-logic';
import DashboardClient from './dashboard-client';

export default async function DashboardPage() {
  const today = new Date();
  const todayStr = toDateString(today);

  const products = await prisma.product.findMany({
    where: { categoria: 'STOCK', activo: true },
    orderBy: { orden: 'asc' },
  });

  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 14);

  const planificaciones = await prisma.planificacionDia.findMany({
    where: {
      fecha: { gte: new Date(todayStr), lte: futureDate },
      productoId: { in: products.map((p: any) => p.id) },
    },
    orderBy: { fecha: 'asc' },
  });

  const todayPlan = await prisma.planificacionDia.findMany({
    where: { fecha: new Date(todayStr) },
    include: { producto: true },
  });

  const amasadoras = await prisma.amasadora.findMany({
    where: {
      estado: { in: ['EN_FERMENTACION', 'PENDIENTE_CONFIRMAR'] },
    },
    include: { producto: true },
    orderBy: { fechaInicio: 'desc' },
  });

  const productData = products.map((product: any) => {
    const productPlan = planificaciones
      .filter((p: any) => p.productoId === product.id)
      .map((p: any) => (p.desayuno ?? 0) + (p.comida ?? 0) + (p.extra ?? 0));

    let stock = product.stockActual ?? 0;
    let coverageDays = 0;
    for (const consumo of productPlan) {
      if (stock <= 0) break;
      stock -= consumo;
      if (stock >= 0) coverageDays++;
    }
    if (stock > 0 && (product.consumoDiarioDefecto ?? 0) > 0) {
      coverageDays += Math.floor(stock / product.consumoDiarioDefecto);
    }

    const avgConsumption = productPlan.length > 0
      ? Math.round(productPlan.reduce((a: number, b: number) => a + b, 0) / Math.max(productPlan.length, 1))
      : (product.consumoDiarioDefecto ?? 10);

    return {
      id: product.id,
      nombre: product.nombre,
      stockActual: product.stockActual ?? 0,
      coverageDays,
      avgConsumption,
      margenSeguridadDias: product.margenSeguridadDias ?? 2,
      status: (coverageDays <= (product.margenSeguridadDias ?? 2) ? 'danger' : coverageDays <= (product.margenSeguridadDias ?? 2) + 1 ? 'warning' : 'ok') as 'ok' | 'warning' | 'danger',
      progressPercent: Math.min(100, Math.round((coverageDays / Math.max((product.margenSeguridadDias ?? 2) * 3, 1)) * 100)),
    };
  });

  const yesterday = prevBusinessDay(today);
  const yesterdayStr = toDateString(yesterday);

  const pendingAmasadoras = amasadoras.filter((a: any) => {
    const initStr = toDateString(new Date(a.fechaInicio));
    return initStr <= yesterdayStr && a.estado === 'EN_FERMENTACION';
  });

  const confirming = amasadoras.filter((a: any) => a.estado === 'PENDIENTE_CONFIRMAR');
  const allPending = [...pendingAmasadoras, ...confirming];

  const todayConsumption = todayPlan.map((p: any) => ({
    id: p.id,
    productoNombre: p.producto?.nombre ?? 'Producto',
    desayuno: p.desayuno ?? 0,
    comida: p.comida ?? 0,
    extra: p.extra ?? 0,
    total: (p.desayuno ?? 0) + (p.comida ?? 0) + (p.extra ?? 0),
  }));

  return (
    <DashboardClient
      products={JSON.parse(JSON.stringify(productData))}
      pendingAmasadoras={JSON.parse(JSON.stringify(allPending))}
      todayConsumption={JSON.parse(JSON.stringify(todayConsumption))}
      todayStr={todayStr}
    />
  );
}
