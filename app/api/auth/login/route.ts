export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body ?? {};

    if (!password) {
      return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 });
    }

    const config = await prisma.appConfig.findUnique({
      where: { clave: 'team_password' },
    });

    if (!config) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 500 });
    }

    const valid = await bcrypt.compare(password, config.valor);
    if (!valid) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    await createSession();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
