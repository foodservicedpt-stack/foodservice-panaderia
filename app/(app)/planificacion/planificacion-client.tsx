'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: number;
  nombre: string;
  stockActual: number;
  margenSeguridadDias: number;
}

interface PlanData {
  [key: string]: { desayuno: number; comida: number; extra: number; esExcepcion: boolean };
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function PlanificacionClient() {
  const [weekStart, setWeekStart] = useState(() => {
    // SSR-safe: use a fixed epoch; will be updated in useEffect
    return getMondayOfWeek(new Date(0));
  });
  const [initialized, setInitialized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [planData, setPlanData] = useState<PlanData>({});
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const todayStr = initialized ? toDateString(new Date()) : '1970-01-01';

  useEffect(() => {
    setWeekStart(getMondayOfWeek(new Date()));
    setInitialized(true);
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEndDate = weekDays[6];
  const weekLabel = `${weekDays[0]?.getDate()} de ${monthNames[weekDays[0]?.getMonth() ?? 0]} – ${weekEndDate?.getDate()} de ${monthNames[weekEndDate?.getMonth() ?? 0]} de ${weekEndDate?.getFullYear()}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = toDateString(weekDays[0] ?? new Date());
      const endStr = toDateString(weekDays[6] ?? new Date());
      const res = await fetch(`/api/planificacion?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setProducts(data?.products ?? []);

      const pd: PlanData = {};
      for (const p of (data?.planificaciones ?? [])) {
        const dateStr = toDateString(new Date(p.fecha));
        const key = `${p.productoId}-${dateStr}`;
        pd[key] = {
          desayuno: p?.desayuno ?? 0,
          comida: p?.comida ?? 0,
          extra: p?.extra ?? 0,
          esExcepcion: p?.esExcepcion ?? false,
        };
      }
      setPlanData(pd);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCellKey = (productId: number, date: Date) => `${productId}-${toDateString(date)}`;

  const getCellData = (productId: number, date: Date) => {
    const key = getCellKey(productId, date);
    return planData[key] ?? { desayuno: 0, comida: 0, extra: 0, esExcepcion: false };
  };

  const updateCell = (productId: number, date: Date, field: 'desayuno' | 'comida' | 'extra', value: number) => {
    const key = getCellKey(productId, date);
    setPlanData((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { desayuno: 0, comida: 0, extra: 0, esExcepcion: false }),
        [field]: value,
      },
    }));
  };

  const toggleException = (productId: number, date: Date) => {
    const key = getCellKey(productId, date);
    const current = planData[key] ?? { desayuno: 0, comida: 0, extra: 0, esExcepcion: false };
    setPlanData((prev) => ({
      ...prev,
      [key]: { ...current, esExcepcion: !current.esExcepcion },
    }));
  };

  const saveCell = async (productId: number, date: Date) => {
    const key = getCellKey(productId, date);
    const data = planData[key] ?? { desayuno: 0, comida: 0, extra: 0, esExcepcion: false };
    setSavingCell(key);
    try {
      const res = await fetch('/api/planificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: productId,
          fecha: toDateString(date),
          ...data,
        }),
      });
      if (res.ok) {
        toast.success('Guardado');
      } else {
        toast.error('Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingCell(null);
    }
  };

  const isToday = (date: Date) => toDateString(date) === todayStr;
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

  const goToCurrentWeek = () => setWeekStart(getMondayOfWeek(new Date()));
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  // Calculate stock projection
  const getStockProjection = (product: Product, upToDayIndex: number) => {
    let consumed = 0;
    for (let i = 0; i <= upToDayIndex; i++) {
      const cellData = getCellData(product.id, weekDays[i] ?? new Date());
      consumed += (cellData?.desayuno ?? 0) + (cellData?.comida ?? 0) + (cellData?.extra ?? 0);
    }
    return (product?.stockActual ?? 0) - consumed;
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-bold">Planificación semanal</h1>
          <p className="text-sm text-muted-foreground">Consumos previstos por día y producto</p>
        </div>
      </header>

      <main className="px-4 pt-4 max-w-6xl mx-auto pb-6">
        {/* Week selector */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <button onClick={prevWeek} className="p-2 rounded-full hover:bg-secondary transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold min-w-[280px] text-center">{weekLabel}</span>
          <button onClick={nextWeek} className="p-2 rounded-full hover:bg-secondary transition">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={goToCurrentWeek}
            className="ml-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-bold hover:bg-secondary/80 transition"
          >
            Semana actual
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-xs font-bold uppercase text-muted-foreground py-2 px-2 w-[140px]">Producto / Día</th>
                  {weekDays.map((day, i) => (
                    <th
                      key={i}
                      className={`text-center text-xs py-2 px-1 ${
                        isToday(day) ? 'text-primary font-bold' : isWeekend(day) ? 'text-muted-foreground' : 'text-foreground font-bold'
                      }`}
                    >
                      <div className={isToday(day) ? 'border-b-2 border-primary pb-1' : 'pb-1'}>
                        {dayNames[i]}
                        <br />
                        <span className="text-[10px] font-normal">
                          {String(day.getMonth() + 1).padStart(2, '0')}-{String(day.getDate()).padStart(2, '0')}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(products ?? []).map((product) => (
                  <tr key={product?.id} className="border-t border-border">
                    <td className="py-3 px-2">
                      <p className="text-sm font-bold">{product?.nombre}</p>
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const cellData = getCellData(product?.id ?? 0, day);
                      const total = (cellData?.desayuno ?? 0) + (cellData?.comida ?? 0) + (cellData?.extra ?? 0);
                      const key = getCellKey(product?.id ?? 0, day);
                      const isSaving = savingCell === key;

                      return (
                        <td
                          key={dayIdx}
                          className={`py-2 px-1 text-center align-top ${
                            isToday(day) ? 'bg-primary/5 border-x-2 border-primary/20' : isWeekend(day) ? 'bg-muted/50' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex gap-0.5 justify-center">
                              {(['desayuno', 'comida', 'extra'] as const).map((field) => (
                                <div key={field} className="text-center">
                                  <label className="text-[9px] text-muted-foreground uppercase">
                                    {field === 'desayuno' ? 'D' : field === 'comida' ? 'C' : 'E'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={cellData?.[field] ?? 0}
                                    onChange={(e) => updateCell(product?.id ?? 0, day, field, parseInt(e.target.value) || 0)}
                                    className="w-10 h-8 text-center text-sm border border-border rounded-md bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Total {total} uds</p>
                            <div className="flex gap-1 justify-center">
                              {cellData?.esExcepcion && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold">Excepción</span>
                              )}
                            </div>
                            <div className="flex gap-1 justify-center flex-wrap">
                              <button
                                onClick={() => toggleException(product?.id ?? 0, day)}
                                className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                                  cellData?.esExcepcion
                                    ? 'bg-accent/20 text-accent hover:bg-accent/30'
                                    : 'text-muted-foreground hover:bg-secondary'
                                }`}
                              >
                                {cellData?.esExcepcion ? 'Restaurar regla' : 'Excepción'}
                              </button>
                            </div>
                            <button
                              onClick={() => saveCell(product?.id ?? 0, day)}
                              disabled={isSaving}
                              className="text-[10px] px-2 py-1 rounded bg-secondary text-foreground font-bold hover:bg-secondary/80 transition disabled:opacity-50"
                            >
                              {isSaving ? '...' : 'Guardar'}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Stock projection row */}
                {(products ?? []).map((product) => (
                  <tr key={`proj-${product?.id}`} className="border-t border-dashed border-border">
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      Stock proy. <span className="font-semibold">{product?.nombre}</span>
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const projected = getStockProjection(product, dayIdx);
                      const margin = product?.margenSeguridadDias ?? 2;
                      const consumoDiario = (product as any)?.consumoDiarioDefecto ?? 10;
                      const daysLeft = consumoDiario > 0 ? Math.floor(projected / consumoDiario) : 99;
                      const color = daysLeft <= 0 ? 'text-white bg-destructive' : daysLeft <= margin ? 'text-[#A52F24] bg-[#FFF2EF]' : daysLeft <= margin + 1 ? 'text-[#A75A10] bg-[#FFF8E8]' : 'text-[#42782B] bg-[#EAF4E5]';

                      return (
                        <td key={dayIdx} className={`py-2 px-1 text-center text-xs font-bold tabular-nums rounded ${color}`}>
                          {projected}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
