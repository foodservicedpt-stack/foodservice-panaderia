'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  nombre: string;
  categoria: string;
  diaSemanal: string | null;
}

interface PlanItem {
  productoId: number;
  fecha: string;
  desayuno: number;
  comida: number;
  extra: number;
  producto: { nombre: string };
}

interface OrdenItem {
  productoId: number;
  fecha: string;
  completado: boolean;
}

interface NotaDia {
  fecha: string;
  nota: string;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const dayNamesShort = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function OrdenTrabajoClient() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date(0)));
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setWeekStart(getMondayOfWeek(new Date()));
    setInitialized(true);
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [planificaciones, setPlanificaciones] = useState<PlanItem[]>([]);
  const [ordenItems, setOrdenItems] = useState<OrdenItem[]>([]);
  const [notas, setNotas] = useState<NotaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNota, setEditingNota] = useState<{ fecha: string; nota: string } | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = toDateString(weekDays[0] ?? new Date());
      const endStr = toDateString(weekDays[6] ?? new Date());
      const res = await fetch(`/api/orden-trabajo?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setProducts(data?.products ?? []);
      setPlanificaciones(data?.planificaciones ?? []);
      setOrdenItems(data?.items ?? []);
      setNotas(data?.notas ?? []);
    } catch {
      toast.error('Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleItem = async (productoId: number, fecha: string, currentCompleted: boolean) => {
    try {
      await fetch('/api/orden-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle', productoId, fecha, completado: !currentCompleted }),
      });
      setOrdenItems((prev) => {
        const existing = prev.find((i) => i.productoId === productoId && i.fecha === fecha);
        if (existing) {
          return prev.map((i) => i === existing ? { ...i, completado: !currentCompleted } : i);
        }
        return [...prev, { productoId, fecha, completado: !currentCompleted }];
      });
    } catch {
      toast.error('Error');
    }
  };

  const saveNota = async () => {
    if (!editingNota) return;
    try {
      await fetch('/api/orden-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'nota', fecha: editingNota.fecha, nota: editingNota.nota }),
      });
      toast.success('Nota guardada');
      setEditingNota(null);
      fetchData();
    } catch {
      toast.error('Error');
    }
  };

  const isCompleted = (productoId: number, fecha: string) => {
    return ordenItems.find((i) => i.productoId === productoId && i.fecha === fecha)?.completado ?? false;
  };

  const getNotaForDate = (fecha: string) => {
    return notas.find((n) => toDateString(new Date(n.fecha)) === fecha)?.nota ?? '';
  };

  const stockProducts = (products ?? []).filter((p) => p?.categoria === 'STOCK');
  const semanalProducts = (products ?? []).filter((p) => p?.categoria === 'SEMANAL');
  const otroProducts = (products ?? []).filter((p) => p?.categoria === 'OTRO');

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold">Orden de trabajo</h1>
          <p className="text-sm text-muted-foreground">Qué preparar cada día de la semana</p>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4 max-w-4xl mx-auto pb-6">
        {/* Week selector */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="p-2 rounded-full hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold">Semana del {weekDays[0]?.getDate()}/{(weekDays[0]?.getMonth() ?? 0) + 1} al {weekDays[6]?.getDate()}/{(weekDays[6]?.getMonth() ?? 0) + 1}</span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="p-2 rounded-full hover:bg-secondary">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : (
          <>
            {/* Pan congelado por día */}
            <section className="space-y-3">
              <h2 className="text-base font-bold">Pan congelado (Categoría A)</h2>
              <p className="text-sm text-muted-foreground">Qué preparar hoy según la planificación del día siguiente</p>
              {weekDays.slice(0, 5).map((day, idx) => {
                const dateStr = toDateString(day);
                const nextDay = new Date(day);
                nextDay.setDate(nextDay.getDate() + 1);
                // Skip weekends for next day
                while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
                  nextDay.setDate(nextDay.getDate() + 1);
                }
                const nextDayStr = toDateString(nextDay);

                const dayPlans = planificaciones.filter((p) => toDateString(new Date(p.fecha)) === nextDayStr);

                return (
                  <div key={idx} className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="font-bold text-sm mb-2">
                      {dayNames[idx]} {day.getDate()}/{(day.getMonth() ?? 0) + 1} — Preparar para mañana
                    </h3>
                    {dayPlans.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin consumos planificados para el día siguiente</p>
                    ) : (
                      <div className="space-y-2">
                        {dayPlans.map((p, pIdx) => {
                          const total = (p?.desayuno ?? 0) + (p?.comida ?? 0) + (p?.extra ?? 0);
                          const done = isCompleted(p.productoId, dateStr);
                          return (
                            <button
                              key={pIdx}
                              onClick={() => toggleItem(p.productoId, dateStr, done)}
                              className="w-full flex items-center gap-3 py-2 text-left"
                            >
                              {done ? (
                                <CheckCircle2 className="h-5 w-5 text-[#5A9E3A] shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <span className={`text-sm flex-1 ${done ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                                {p?.producto?.nombre}: {total} uds
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Nota */}
                    <div className="mt-3 pt-3 border-t border-border">
                      {editingNota?.fecha === dateStr ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingNota.nota}
                            onChange={(e) => setEditingNota({ ...editingNota, nota: e.target.value })}
                            placeholder="Añadir nota..."
                            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                            autoFocus
                          />
                          <button onClick={saveNota} className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold">Guardar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingNota({ fecha: dateStr, nota: getNotaForDate(dateStr) })}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <StickyNote className="h-3 w-3" />
                          {getNotaForDate(dateStr) || 'Añadir nota...'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Produccion semanal */}
            <section className="space-y-3">
              <h2 className="text-base font-bold">Producción semanal (Categoría B)</h2>
              {(semanalProducts ?? []).map((p) => {
                const dayIdx = dayNamesShort.indexOf(p?.diaSemanal ?? '');
                const targetDay = dayIdx >= 0 ? weekDays[dayIdx] : null;
                const dateStr = targetDay ? toDateString(targetDay) : '';
                const done = dateStr ? isCompleted(p.id, dateStr) : false;

                return (
                  <div key={p?.id} className="rounded-2xl border border-border bg-white p-4 flex items-center gap-3">
                    <button onClick={() => dateStr && toggleItem(p.id, dateStr, done)}>
                      {done ? <CheckCircle2 className="h-5 w-5 text-[#5A9E3A]" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div>
                      <p className={`text-sm font-bold ${done ? 'line-through text-muted-foreground' : ''}`}>{p?.nombre}</p>
                      <p className="text-xs text-muted-foreground">Día: {p?.diaSemanal ?? 'sin asignar'}</p>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Otros */}
            <section className="space-y-3">
              <h2 className="text-base font-bold">Otros (Categoría C)</h2>
              {(otroProducts ?? []).map((p) => {
                const dayIdx = dayNamesShort.indexOf(p?.diaSemanal ?? '');
                const targetDay = dayIdx >= 0 ? weekDays[dayIdx] : null;
                const dateStr = targetDay ? toDateString(targetDay) : '';
                const done = dateStr ? isCompleted(p.id, dateStr) : false;

                return (
                  <div key={p?.id} className="rounded-2xl border border-border bg-white p-4 flex items-center gap-3">
                    <button onClick={() => dateStr && toggleItem(p.id, dateStr, done)}>
                      {done ? <CheckCircle2 className="h-5 w-5 text-[#5A9E3A]" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div>
                      <p className={`text-sm font-bold ${done ? 'line-through text-muted-foreground' : ''}`}>{p?.nombre}</p>
                      <p className="text-xs text-muted-foreground">Día: {p?.diaSemanal ?? 'sin asignar'}</p>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
