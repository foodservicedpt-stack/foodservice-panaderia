import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import LoginForm from './login-form';

export default async function LoginPage() {
  const isAuth = await verifySession();
  if (isAuth) redirect('/');

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 pb-8">
      <section className="flex-1 flex flex-col justify-center pt-10">
        <div className="mx-auto mb-7 flex h-40 w-40 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-border">
          <img src="/logo.png" alt="Foodservice DPT" className="h-36 w-36 rounded-full object-contain" />
        </div>
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Equipo de panadería</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight text-foreground">Bienvenido al obrador</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">Consulta el stock y organiza la producción diaria.</p>
        </div>
        <LoginForm />
      </section>
      <footer className="pt-7 text-center text-xs leading-5 text-muted-foreground">
        <p>🛡️ Acceso exclusivo para el equipo</p>
        <p className="mt-1">Foodservice DPT · Cocina institucional</p>
      </footer>
    </main>
  );
}
