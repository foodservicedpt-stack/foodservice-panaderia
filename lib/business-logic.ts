// Business logic helpers

/**
 * Returns the next business day (Mon-Fri) after a given date.
 */
export function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Returns the previous business day (Mon-Fri) before a given date.
 */
export function prevBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/**
 * Check if a date is a business day (Mon-Fri)
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Get Monday of the week that contains the given date
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = (dayOfWeek + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date to Spanish locale string
 */
export function formatDateES(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', ...options });
}

/**
 * Get day abbreviation in Spanish
 */
export function dayAbbr(dayIndex: number): string {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return days[dayIndex] ?? '';
}

/**
 * Get full day name in Spanish
 */
export function dayFull(dayIndex: number): string {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return days[dayIndex] ?? '';
}

/**
 * Greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Calculate coverage days: how many days until stock runs out based on planned consumption
 */
export function calcCoverageDays(
  stockActual: number,
  consumosPlanificados: number[],
  consumoDiarioDefecto: number
): number {
  let stock = stockActual;
  let days = 0;

  // Use planned consumptions first
  for (const consumo of consumosPlanificados) {
    if (stock <= 0) break;
    stock -= consumo;
    days++;
  }

  // If still stock left, use default daily consumption
  if (stock > 0 && consumoDiarioDefecto > 0) {
    days += Math.floor(stock / consumoDiarioDefecto);
  }

  return days;
}

/**
 * Get stock status color based on coverage days and margin
 */
export function getStockStatus(coverageDays: number, marginDays: number): 'ok' | 'warning' | 'danger' {
  if (coverageDays <= marginDays) return 'danger';
  if (coverageDays <= marginDays + 1) return 'warning';
  return 'ok';
}

/**
 * Date to YYYY-MM-DD string (timezone safe for Spain)
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
