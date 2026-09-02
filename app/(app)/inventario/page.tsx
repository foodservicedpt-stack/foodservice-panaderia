export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import InventarioClient from './inventario-client';

export default async function InventarioPage() {
  const products = await prisma.product.findMany({
    where: { categoria: 'STOCK', activo: true },
    orderBy: { orden: 'asc' },
  });

  const movimientos = await prisma.movimientoInventario.findMany({
    include: { producto: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <InventarioClient
      products={JSON.parse(JSON.stringify(products))}
      movimientos={JSON.parse(JSON.stringify(movimientos))}
    />
  );
}
