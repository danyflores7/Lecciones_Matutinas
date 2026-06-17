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

// Token para cancelar una secuencia en curso (al detener o iniciar otra).
let token = 0;

export function detenerVoz(): void {
  token += 1;
  Speech.stop();
}

// Reproduce una lista de segmentos uno tras otro. Evita un único audio muy
// largo (que en algunos dispositivos falla) hablando frase por frase y
// encadenando con onDone. `onFin` se llama al terminar todos los segmentos.
export function reproducirPartes(
  partes: string[],
  opts: { rate?: number; onFin?: () => void } = {}
): void {
  token += 1;
  const miToken = token;
  Speech.stop();

  const limpias = partes.map((p) => (p ?? '').trim()).filter(Boolean);
  const rate = opts.rate ?? 1.0;

  const decir = (i: number) => {
    if (miToken !== token) return; // se canceló o empezó otra reproducción
    if (i >= limpias.length) {
      opts.onFin?.();
      return;
    }
    Speech.speak(limpias[i], {
      language: 'es-MX',
      rate,
      onDone: () => decir(i + 1),
      onError: () => decir(i + 1),
    });
  };

  decir(0);
}
