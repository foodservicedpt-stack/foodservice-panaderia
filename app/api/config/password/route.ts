export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const isAuth = await verifySession();
  if (!isAuth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    const config = await prisma.appConfig.findUnique({
      where: { clave: 'team_password' },
    });

    if (!config) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 500 });
    }

    const valid = await bcrypt.compare(currentPassword, config.valor);
    if (!valid) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await prisma.appConfig.update({
      where: { clave: 'team_password' },
      data: { valor: hashedNew },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Error al cambiar' }, { status: 500 });
  }
}
