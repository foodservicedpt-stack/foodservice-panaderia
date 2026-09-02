'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Package, Calendar, Bell, Settings, Plus, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/inventario', label: 'Inventario', icon: Package },
  { href: '/planificacion', label: 'Plan', icon: Calendar },
  { href: '/amasadoras', label: 'Amasadoras', icon: Bell },
  { href: '/configuracion', label: 'Config', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-border z-30">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <img src="/logo.png" alt="Foodservice DPT" className="h-11 w-11 rounded-full bg-white object-contain ring-1 ring-border" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Foodservice DPT</p>
            <p className="text-sm font-bold text-foreground">Panel de Pan</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/orden-trabajo"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
              pathname?.startsWith('/orden-trabajo')
                ? 'bg-primary/10 text-primary font-bold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Calendar className="h-5 w-5" />
            Orden de trabajo
          </Link>
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <div className="pb-24 lg:pb-8">
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex h-[72px] items-start justify-around border-t border-border bg-white px-2 pt-2 shadow-[0_-4px_18px_rgba(72,49,34,0.06)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-[70px] flex-col items-center gap-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className={`flex h-8 w-11 items-center justify-center ${
                isActive ? 'rounded-full bg-primary/10' : ''
              }`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className={`text-[10px] ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating add button (mobile) */}
      {(pathname === '/' || pathname === '/amasadoras') && (
        <Link
          href="/amasadoras?nueva=1"
          className="lg:hidden fixed bottom-[82px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_22px_rgba(139,37,0,0.3)] active:scale-95 transition"
          aria-label="Nueva amasadora"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
