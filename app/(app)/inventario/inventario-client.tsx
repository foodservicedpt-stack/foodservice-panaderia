'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Minus, History, X } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  nombre: string;
  stockActual: number;
  margenSeguridadDias: number;
  consumoDiarioDefecto: number;
}

interface Movimiento {
  id: number;
  productoId: number;
  fecha: string;
  cantidad: number;
  tipo: string;
  notas: string | null;
  createdAt: string;
  producto: { nombre: string };
}

export default function InventarioClient({
  products,
  movimientos,
}: {
  products: Product[];
  movimientos: Movimiento[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ type: 'add' | 'adjust'; product: Product } | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('AMASADA');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!modal || !cantidad) {
      toast.error('Introduce una cantidad');
      return;
    }
    const qty = parseInt(cantidad);
    if (isNaN(qty) || (modal.type === 'add' && qty <= 0)) {
      toast.error('Cantidad no válida');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: modal.product.id,
          cantidad: qty,
          tipo: modal.type === 'add' ? motivo : 'AJUSTE',
          notas: notas || null,
        }),
      });
      if (res.ok) {
        toast.success('Inventario actualizado');
        setModal(null);
        setCantidad('');
        setNotas('');
        router.refresh();
      } else {
        toast.error('Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const tipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      AMASADA: 'Amasada',
      AJUSTE: 'Ajuste',
      CONSUMO: 'Consumo',
      CORRECCION: 'Corrección',
      COMPRA: 'Compra',
    };
    return map[tipo] ?? tipo;
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Control de stock de pan congelado</p>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4 max-w-4xl mx-auto">
        {/* Product cards */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Productos con stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(products ?? []).map((p) => {
              const coverageDays = (p?.consumoDiarioDefecto ?? 1) > 0 ? Math.floor((p?.stockActual ?? 0) / (p?.consumoDiarioDefecto ?? 1)) : 99;
              return (
                <div key={p?.id} className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold">{p?.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{coverageDays} días de cobertura</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums">{p?.stockActual}</p>
                      <p className="text-xs text-muted-foreground">unidades</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setModal({ type: 'add', product: p }); setCantidad(''); setMotivo('AMASADA'); setNotas(''); }}
                      className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#5A9E3A] text-white text-sm font-bold hover:opacity-90 transition"
                    >
                      <Plus className="h-4 w-4" /> Añadir
                    </button>
                    <button
                      onClick={() => { setModal({ type: 'adjust', product: p }); setCantidad(''); setNotas(''); }}
                      className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-secondary/80 transition"
                    >
                      <Minus className="h-4 w-4" /> Ajustar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Movement history */}
        <section className="space-y-3 pb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5" /> Historial de movimientos
          </h2>
          {(movimientos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
          ) : (
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="divide-y divide-border">
                {(movimientos ?? []).map((m) => (
                  <div key={m?.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{m?.producto?.nombre ?? 'Producto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m?.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })} · {tipoLabel(m?.tipo ?? '')}
                        {m?.notas ? ` · ${m.notas}` : ''}
                      </p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${
                      (m?.cantidad ?? 0) > 0 ? 'text-[#5A9E3A]' : 'text-destructive'
                    }`}>
                      {(m?.cantidad ?? 0) > 0 ? '+' : ''}{m?.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {modal.type === 'add' ? 'Añadir stock' : 'Ajustar stock'} — {modal.product?.nombre}
              </h3>
              <button onClick={() => setModal(null)} className="p-2 rounded-full hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Cantidad</label>
                <input
                  type="number"
                  min={modal.type === 'add' ? '1' : undefined}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder={modal.type === 'add' ? 'Nº unidades a añadir' : 'Cantidad (negativo para restar)'}
                  className="w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              {modal.type === 'add' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Motivo</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary"
                  >
                    <option value="AMASADA">Amasada completada</option>
                    <option value="COMPRA">Compra</option>
                    <option value="CORRECCION">Corrección de inventario</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones..."
                  className="w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !cantidad}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
