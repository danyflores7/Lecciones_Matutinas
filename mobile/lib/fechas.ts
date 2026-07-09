export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const MESES_ABREV = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

// Fecha local del teléfono en formato 'YYYY-MM-DD'.
export function fechaHoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// 'Martes 16 de junio'
export function fechaLarga(fechaISO: string, diaSemana: string): string {
  const dia = Number(fechaISO.slice(8, 10));
  const mes = MESES[Number(fechaISO.slice(5, 7)) - 1];
  return `${diaSemana} ${dia} de ${mes}`;
}

// ISO de hoy desplazado N días (p. ej. -1 = ayer). Útil para la racha.
export function fechaRelativaISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function diaDelMes(fechaISO: string): number {
  return Number(fechaISO.slice(8, 10));
}

export function mesAbrev(fechaISO: string): string {
  return MESES_ABREV[Number(fechaISO.slice(5, 7)) - 1];
}

// '6 de junio'
export function fechaDiaMes(fechaISO: string): string {
  return `${diaDelMes(fechaISO)} de ${MESES[Number(fechaISO.slice(5, 7)) - 1]}`;
}

// '6:00 a.m.'
export function horaTexto(hour: number, minute: number): string {
  const ampm = hour < 12 ? 'a.m.' : 'p.m.';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// Una fecha ISO desplazada N días (respecto a esa fecha, no a hoy).
export function sumarDias(fechaISO: string, n: number): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Las 7 fechas ISO de la "semana en curso": la fecha base (hoy por defecto) y
// los 6 días siguientes. Se usa para decidir qué audios descargar por semana.
export function fechasDeLaSemana(fechaISO?: string): string[] {
  const base = fechaISO ? new Date(`${fechaISO}T00:00:00`) : new Date();
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push(`${d.getFullYear()}-${mm}-${dd}`);
  }
  return out;
}
