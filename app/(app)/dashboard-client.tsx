'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Bell, Package, Coffee, UtensilsCrossed, Star, Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ClientOnly } from '@/components/client-only';

interface ProductData {
  id: number;
  nombre: string;
  stockActual: number;
  coverageDays: number;
  avgConsumption: number;
  margenSeguridadDias: number;
  status: 'ok' | 'warning' | 'danger';
  progressPercent: number;
}

interface PendingAmasadora {
  id: number;
  productoId: number;
  fechaInicio: string;
  estado: string;
  producto: { nombre: string };
}

interface TodayConsumption {
  id: number;
  productoNombre: string;
  desayuno: number;
  comida: number;
  extra: number;
  total: number;
}

export default function DashboardClient({
  products,
  pendingAmasadoras,
  todayConsumption,
  todayStr,
}: {
  products: ProductData[];
  pendingAmasadoras: PendingAmasadora[];
  todayConsumption: TodayConsumption[];
  todayStr: string;
}) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [piezas, setPiezas] = useState('');
  const [saving, setSaving] = useState(false);

  const alerts = (products ?? []).filter((p) => p?.status === 'danger');

  const handleConfirmPiezas = async (amasadoraId: number) => {
    if (!piezas || parseInt(piezas) <= 0) {
      toast.error('Introduce un número válido de piezas');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/amasadoras/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amasadoraId, piezas: parseInt(piezas) }),
      });
      if (res.ok) {
        toast.success('Piezas registradas y añadidas al inventario');
        setConfirmingId(null);
        setPiezas('');
        router.refresh();
      } else {
        toast.error('Error al confirmar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const totalToday = (todayConsumption ?? []).reduce((sum, c) => sum + (c?.total ?? 0), 0);

  const dateFormatted = new Date(todayStr + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  });

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Foodservice DPT" className="h-11 w-11 rounded-full bg-white object-contain ring-1 ring-border" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Foodservice DPT</p>
              <h1 className="text-xl font-bold leading-6">Panel de Pan</h1>
            </div>
          </div>
          <Link
            href="/amasadoras?nueva=1"
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            Nueva amasadora
          </Link>
        </div>
      </header>

      <main className="space-y-5 px-4 pt-4 max-w-4xl mx-auto">
        {/* Greeting */}
        <section className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground capitalize">{dateFormatted}</p>
            <ClientOnly fallback={<h2 className="mt-0.5 text-2xl font-bold">Hola, equipo</h2>}>
              <GreetingText />
            </ClientOnly>
          </div>
          <span className="rounded-full bg-[#EAF4E5] px-3 py-1 text-xs font-bold text-[#42782B]">Turno activo</span>
        </section>

        {/* Alerts */}
        {(alerts ?? []).map((product) => (
          <section key={product?.id} className="rounded-[18px] border border-[#E9B7AE] bg-[#FFF2EF] p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-destructive">Alerta activa</p>
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">Urgente</span>
                </div>
                <h3 className="mt-1 text-[17px] font-bold leading-5">
                  {product?.nombre}: solo {product?.coverageDays} {product?.coverageDays === 1 ? 'día' : 'días'} de stock
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-[#6E4842]">
                  Programa una amasadora hoy para cubrir el consumo.
                </p>
              </div>
            </div>
            <Link
              href="/amasadoras?nueva=1"
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-destructive text-sm font-bold text-white hover:opacity-90 transition"
            >
              Programar amasadora
            </Link>
          </section>
        ))}

        {/* Pending amasadoras */}
        {(pendingAmasadoras ?? []).map((a) => (
          <section key={a?.id} className="rounded-[18px] border border-[#F0C98F] bg-[#FFF8E8] p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8922A] text-white">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#A75A10]">Lista para confirmar</p>
                <h3 className="mt-1 text-base font-bold leading-5">
                  La amasadora de {a?.producto?.nombre ?? 'producto'} del{' '}
                  {new Date(a?.fechaInicio + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })}{' '}
                  ya está lista
                </h3>
                <p className="mt-1 text-sm text-[#795B35]">¿Cuántas piezas han salido?</p>
              </div>
            </div>
            {confirmingId === a?.id ? (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={piezas}
                  onChange={(e) => setPiezas(e.target.value)}
                  placeholder="Nº piezas"
                  className="flex-1 h-11 rounded-xl border border-border bg-white px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <button
                  onClick={() => handleConfirmPiezas(a.id)}
                  disabled={saving}
                  className="h-11 px-5 rounded-xl bg-[#E8922A] text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-50"
                >
                  {saving ? '...' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setConfirmingId(a?.id); setPiezas(''); }}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E8922A] text-sm font-bold text-white hover:opacity-90 transition"
              >
                <Package className="h-4 w-4" />
                Registrar piezas
              </button>
            )}
          </section>
        ))}

        {/* Stock actual */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Stock actual</h2>
            <Link href="/inventario" className="text-sm font-semibold text-primary flex items-center gap-1">
              Ver inventario <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(products ?? []).map((product) => (
              <article key={product?.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{product?.nombre}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Consumo medio: {product?.avgConsumption} uds/día</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">{product?.stockActual}</p>
                    <p className={`text-xs font-semibold ${
                      product?.status === 'danger' ? 'text-destructive' : product?.status === 'warning' ? 'text-[#D27619]' : 'text-[#5A9E3A]'
                    }`}>
                      {product?.coverageDays} {product?.coverageDays === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F0E8E1]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      product?.status === 'danger' ? 'bg-destructive' : product?.status === 'warning' ? 'bg-[#E8922A]' : 'bg-[#5A9E3A]'
                    }`}
                    style={{ width: `${product?.progressPercent ?? 0}%` }}
                  />
                </div>
                {product?.status === 'danger' && (
                  <p className="mt-2 text-xs font-semibold text-destructive">
                    ⚠️ Por debajo del margen de {product?.margenSeguridadDias} días
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Today consumption */}
        <section className="rounded-[18px] border border-border bg-white p-4 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Consumo previsto hoy</h2>
            <span className="text-xs font-semibold text-accent">{totalToday} uds</span>
          </div>
          {(todayConsumption ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin consumos planificados para hoy</p>
          ) : (
            <div className="divide-y divide-border text-sm">
              {(todayConsumption ?? []).map((c) => (
                <div key={c?.id} className="flex flex-col gap-1 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{c?.productoNombre}</span>
                    <strong>{c?.total} uds</strong>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {(c?.desayuno ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><Coffee className="h-3 w-3 text-[#E8922A]" />D: {c?.desayuno}</span>
                    )}
                    {(c?.comida ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><UtensilsCrossed className="h-3 w-3 text-[#5A9E3A]" />C: {c?.comida}</span>
                    )}
                    {(c?.extra ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-accent" />E: {c?.extra}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function GreetingText() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  return <h2 className="mt-0.5 text-2xl font-bold">{greeting}, equipo</h2>;
}
