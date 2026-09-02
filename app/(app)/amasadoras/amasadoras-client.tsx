'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Clock, Bell, CheckCircle, X, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Amasadora {
  id: number;
  productoId: number;
  fechaInicio: string;
  estado: string;
  piezasProducidas: number | null;
  createdAt: string;
  producto: { nombre: string };
}

interface Product {
  id: number;
  nombre: string;
}

function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AmasadorasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewParam = searchParams?.get('nueva') === '1';

  const [amasadoras, setAmasadoras] = useState<Amasadora[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(showNewParam);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-01-01');
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [piezas, setPiezas] = useState('');

  useEffect(() => {
    setSelectedDate(toDateString(new Date()));
    fetchData();
  }, []);

  useEffect(() => {
    if (showNewParam) setShowNew(true);
  }, [showNewParam]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [amRes, prodRes] = await Promise.all([
        fetch('/api/amasadoras'),
        fetch('/api/productos'),
      ]);
      const amData = await amRes.json();
      const prodData = await prodRes.json();
      setAmasadoras(Array.isArray(amData) ? amData : []);
      const stockProducts = (Array.isArray(prodData) ? prodData : []).filter((p: any) => p?.categoria === 'STOCK' && p?.activo);
      setProducts(stockProducts);
      if (stockProducts.length > 0 && !selectedProduct) {
        setSelectedProduct(String(stockProducts[0].id));
      }
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/amasadoras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId: selectedProduct, fechaInicio: selectedDate }),
      });
      if (res.ok) {
        toast.success('Amasadora registrada');
        setShowNew(false);
        fetchData();
        router.replace('/amasadoras');
      } else {
        toast.error('Error al crear');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (id: number) => {
    if (!piezas || parseInt(piezas) <= 0) {
      toast.error('Introduce un número válido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/amasadoras/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amasadoraId: id, piezas: parseInt(piezas) }),
      });
      if (res.ok) {
        toast.success('Confirmada y añadida al inventario');
        setConfirmingId(null);
        setPiezas('');
        fetchData();
      } else {
        toast.error('Error al confirmar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const fermenting = (amasadoras ?? []).filter((a) => a?.estado === 'EN_FERMENTACION');
  const pending = (amasadoras ?? []).filter((a) => a?.estado === 'PENDIENTE_CONFIRMAR');
  const completed = (amasadoras ?? []).filter((a) => a?.estado === 'COMPLETADA');

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Amasadoras</h1>
            <p className="text-sm text-muted-foreground">Gestión de fermentación y producción</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> Nueva amasadora
          </button>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4 max-w-4xl mx-auto pb-6">
        {/* New amasadora button mobile */}
        <button
          onClick={() => setShowNew(true)}
          className="lg:hidden w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition"
        >
          <Plus className="h-5 w-5" /> Nueva amasadora
        </button>

        {/* Pending confirmation */}
        {(pending ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#E8922A]" /> Pendiente de confirmar piezas
            </h2>
            {pending.map((a) => (
              <div key={a?.id} className="rounded-2xl border border-[#F0C98F] bg-[#FFF8E8] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{a?.producto?.nombre}</p>
                    <p className="text-sm text-[#795B35]">
                      Iniciada: {new Date(a?.fechaInicio + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid' })}
                    </p>
                  </div>
                </div>
                {confirmingId === a?.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={piezas}
                      onChange={(e) => setPiezas(e.target.value)}
                      placeholder="Nº piezas producidas"
                      className="flex-1 h-11 rounded-xl border border-border bg-white px-4 text-base outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      onClick={() => handleConfirm(a.id)}
                      disabled={saving}
                      className="h-11 px-5 rounded-xl bg-[#E8922A] text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setConfirmingId(a?.id); setPiezas(''); }}
                    className="mt-3 w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#E8922A] text-sm font-bold text-white hover:opacity-90"
                  >
                    <Package className="h-4 w-4" /> Confirmar y añadir al inventario
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Fermenting */}
        {(fermenting ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" /> En fermentación
            </h2>
            {fermenting.map((a) => (
              <div key={a?.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{a?.producto?.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Inicio: {new Date(a?.fechaInicio + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Madrid' })}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">
                    Lista: {nextBusinessDay(a?.fechaInicio ?? '2026-01-01')}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Completed */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#5A9E3A]" /> Historial completadas
          </h2>
          {(completed ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin amasadoras completadas aún</p>
          ) : (
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="divide-y divide-border">
                {completed.map((a) => (
                  <div key={a?.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{a?.producto?.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a?.fechaInicio + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#5A9E3A]">{a?.piezasProducidas ?? 0} piezas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* New amasadora modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => { setShowNew(false); router.replace('/amasadoras'); }}>
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nueva amasadora</h3>
              <button onClick={() => { setShowNew(false); router.replace('/amasadoras'); }} className="p-2 rounded-full hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Producto</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary"
                >
                  {(products ?? []).map((p) => (
                    <option key={p?.id} value={String(p?.id)}>{p?.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear amasadora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
