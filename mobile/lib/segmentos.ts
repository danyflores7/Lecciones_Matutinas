// Lógica de segmentación de la narración, COMPARTIDA entre la app y el
// generador de audio (tools/gen-audio). Debe ser JS/TS puro (sin dependencias
// de expo) para que ambos produzcan EXACTAMENTE los mismos textos hablados y,
// por tanto, los mismos audios (mismo hash).
import type { Leccion, Pregunta, VersiculoDia } from './supabase';

// Convierte una cita a una forma hablada que el lector de voz no confunda con
// una hora, usando singular/plural y "al" (rango) o "y" (lista):
//   "Hechos 4:19"        -> "Hechos capítulo 4, versículo 19"
//   "Santiago 2:14-17"   -> "Santiago capítulo 2, versículos 14 al 17"
//   "Romanos 5:1, 2"     -> "Romanos capítulo 5, versículos 1 y 2"
export function citaParaVoz(cita: string): string {
  return cita.replace(/(\d+):([\d,\-\s]+)/, (_m, cap: string, vspec: string) => {
    const spec = vspec.trim();

    const rango = spec.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rango) return `capítulo ${cap}, versículos ${rango[1]} al ${rango[2]}`;

    const lista = spec.split(',').map((s) => s.trim()).filter(Boolean);
    if (lista.length > 1) {
      const ultimo = lista.pop();
      return `capítulo ${cap}, versículos ${lista.join(', ')} y ${ultimo}`;
    }

    return `capítulo ${cap}, versículo ${spec}`;
  });
}

// Matutina: se anuncia la cita y luego el texto.
export function segmentosMatutina(v: Pick<VersiculoDia, 'cita' | 'texto'>): string[] {
  const segs: string[] = [`${citaParaVoz(v.cita)}.`];
  if (v.texto) segs.push(v.texto);
  return segs;
}

// Segmentos de audio de una pregunta: la pregunta, cada cita anunciada + su
// texto, y la nota (precedida por "Nota").
export function segmentosDePregunta(p: Pregunta, mapa: Record<string, string>): string[] {
  const segs: string[] = [p.pregunta];
  for (const c of p.citas ?? []) {
    const t = mapa[c];
    if (t) {
      segs.push(`${citaParaVoz(c)}.`);
      segs.push(t);
    }
  }
  if (p.nota) segs.push(`Nota. ${p.nota}`);
  return segs;
}

// Lección completa: título, versículo central, introducción y cada pregunta.
export function segmentosLeccion(
  leccion: Leccion,
  preguntas: Pregunta[],
  citasTexto: Record<string, string>
): string[] {
  const segs: string[] = [
    leccion.titulo,
    'Versículo central.',
    `${citaParaVoz(leccion.versiculo_central_cita)}.`,
  ];
  if (leccion.versiculo_central_texto) segs.push(leccion.versiculo_central_texto);
  segs.push(leccion.introduccion);
  for (const p of preguntas) {
    segs.push(`Pregunta ${p.orden}.`);
    segs.push(...segmentosDePregunta(p, citasTexto));
  }
  return segs;
}
