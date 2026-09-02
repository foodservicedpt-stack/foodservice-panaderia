'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Shield, Plus, Edit, Archive, X, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  nombre: string;
  categoria: string;
  activo: boolean;
  margenSeguridadDias: number;
  consumoDiarioDefecto: number;
  diaSemanal: string | null;
}

export default function ConfiguracionClient() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Product form
  const [formNombre, setFormNombre] = useState('');
  const [formCategoria, setFormCategoria] = useState('STOCK');
  const [formMargen, setFormMargen] = useState('2');
  const [formConsumo, setFormConsumo] = useState('10');
  const [formDia, setFormDia] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormNombre(p?.nombre ?? '');
    setFormCategoria(p?.categoria ?? 'STOCK');
    setFormMargen(String(p?.margenSeguridadDias ?? 2));
    setFormConsumo(String(p?.consumoDiarioDefecto ?? 10));
    setFormDia(p?.diaSemanal ?? '');
    setShowNew(false);
  };

  const openNew = () => {
    setEditProduct(null);
    setFormNombre('');
    setFormCategoria('STOCK');
    setFormMargen('2');
    setFormConsumo('10');
    setFormDia('');
    setShowNew(true);
  };

  const saveProduct = async () => {
    if (!formNombre.trim()) {
      toast.error('Nombre requerido');
      return;
    }
    setSavingProduct(true);
    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editProduct?.id ?? null,
          nombre: formNombre,
          categoria: formCategoria,
          margenSeguridadDias: formMargen,
          consumoDiarioDefecto: formConsumo,
          diaSemanal: formDia || null,
        }),
      });
      if (res.ok) {
        toast.success(editProduct ? 'Producto actualizado' : 'Producto creado');
        setEditProduct(null);
        setShowNew(false);
        fetchProducts();
      } else {
        toast.error('Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingProduct(false);
    }
  };

  const archiveProduct = async (p: Product) => {
    try {
      await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, activo: !p.activo }),
      });
      toast.success(p.activo ? 'Producto archivado' : 'Producto reactivado');
      fetchProducts();
    } catch {
      toast.error('Error');
    }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch('/api/config/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Contraseña cambiada');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        toast.error(data?.error ?? 'Error');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold flex items-center gap-2"><Settings className="h-5 w-5" /> Configuración</h1>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4 max-w-4xl mx-auto pb-6">
        {/* Products */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Gestión de productos</h2>
            <button onClick={openNew} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition">
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {(products ?? []).map((p) => (
                <div key={p?.id} className={`rounded-2xl border border-border bg-white p-4 flex items-center justify-between ${!p?.activo ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-bold text-sm">{p?.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p?.categoria} · Margen: {p?.margenSeguridadDias}d · Consumo: {p?.consumoDiarioDefecto}/día
                      {p?.diaSemanal ? ` · ${p.diaSemanal}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-secondary transition">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => archiveProduct(p)} className="p-2 rounded-lg hover:bg-secondary transition">
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Password */}
        <section className="space-y-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Seguridad
          </h2>
          <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
            <p className="text-sm font-semibold">Cambiar contraseña del equipo</p>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Contraseña actual"
              className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Nueva contraseña"
              className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={changePassword}
              disabled={savingPw}
              className="w-full h-11 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {savingPw ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </section>

        {/* Logout (mobile) */}
        <section className="lg:hidden">
          <button
            onClick={handleLogout}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-bold text-destructive hover:bg-destructive/5 transition"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </section>
      </main>

      {/* Edit/New product modal */}
      {(editProduct || showNew) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => { setEditProduct(null); setShowNew(false); }}>
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => { setEditProduct(null); setShowNew(false); }} className="p-2 rounded-full hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre</label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Categoría</label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                >
                  <option value="STOCK">Stock (Cat. A)</option>
                  <option value="SEMANAL">Semanal (Cat. B)</option>
                  <option value="OTRO">Otro (Cat. C)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Margen seguridad (días)</label>
                  <input
                    type="number"
                    min="0"
                    value={formMargen}
                    onChange={(e) => setFormMargen(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Consumo diario</label>
                  <input
                    type="number"
                    min="0"
                    value={formConsumo}
                    onChange={(e) => setFormConsumo(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              {(formCategoria === 'SEMANAL' || formCategoria === 'OTRO') && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Día asignado</label>
                  <select
                    value={formDia}
                    onChange={(e) => setFormDia(e.target.value)}
                    className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Sin asignar</option>
                    <option value="lunes">Lunes</option>
                    <option value="martes">Martes</option>
                    <option value="miércoles">Miércoles</option>
                    <option value="jueves">Jueves</option>
                    <option value="viernes">Viernes</option>
                  </select>
                </div>
              )}
              <button
                onClick={saveProduct}
                disabled={savingProduct}
                className="w-full h-11 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {savingProduct ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
