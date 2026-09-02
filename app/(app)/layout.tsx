import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import AppShell from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const isAuth = await verifySession();
  if (!isAuth) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
