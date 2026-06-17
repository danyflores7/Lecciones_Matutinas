import * as Speech from 'expo-speech';

// Convierte una cita a una forma hablada que el lector de voz no confunda con una hora,
// usando singular/plural y "al" (rango) o "y" (lista) según corresponda:
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

type Estado = { partes: string[]; idx: number; rate: number; onFin?: () => void };

// token: invalida secuencias anteriores (al detener, pausar o iniciar otra).
let token = 0;
let estado: Estado | null = null;

function decir(mi: number) {
  if (mi !== token || !estado) return;
  if (estado.idx >= estado.partes.length) {
    const fin = estado.onFin;
    estado = null;
    fin?.();
    return;
  }
  Speech.speak(estado.partes[estado.idx], {
    language: 'es-MX',
    rate: estado.rate,
    onDone: () => {
      if (mi === token && estado) {
        estado.idx += 1;
        decir(mi);
      }
    },
    onError: () => {
      if (mi === token && estado) {
        estado.idx += 1;
        decir(mi);
      }
    },
  });
}

// Reproduce una lista de segmentos uno tras otro (evita un audio muy largo que
// en algunos dispositivos falla). `onFin` se llama al terminar todos.
export function reproducirPartes(
  partes: string[],
  opts: { rate?: number; onFin?: () => void } = {}
): void {
  token += 1;
  Speech.stop();
  estado = {
    partes: partes.map((p) => (p ?? '').trim()).filter(Boolean),
    idx: 0,
    rate: opts.rate ?? 1.0,
    onFin: opts.onFin,
  };
  decir(token);
}

// Pausa: corta el segmento actual y conserva la posición (al continuar se
// vuelve a leer ese segmento desde el inicio).
export function pausar(): void {
  token += 1;
  Speech.stop();
}

export function continuar(): void {
  if (!estado) return;
  token += 1;
  Speech.stop();
  decir(token);
}

export function detenerVoz(): void {
  token += 1;
  estado = null;
  Speech.stop();
}
