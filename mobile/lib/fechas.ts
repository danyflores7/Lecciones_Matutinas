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

// '6:00 a.m.'
export function horaTexto(hour: number, minute: number): string {
  const ampm = hour < 12 ? 'a.m.' : 'p.m.';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}
