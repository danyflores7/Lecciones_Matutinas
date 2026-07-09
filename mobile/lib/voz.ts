import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import { rutaLocalAudioParaTexto } from './audio';

// citaParaVoz se movió a ./segmentos (compartido con el generador de audio).
// Se re-exporta aquí para no romper las importaciones existentes.
export { citaParaVoz } from './segmentos';

// Configura el audio para que suene aunque el teléfono esté en silencio (iOS).
export async function prepararAudio(): Promise<void> {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // no crítico
  }
}

type Estado = { partes: string[]; idx: number; rate: number; onFin?: () => void };

// token: invalida secuencias anteriores (al detener, pausar o iniciar otra).
let token = 0;
let estado: Estado | null = null;
let player: AudioPlayer | null = null;

function liberarPlayer() {
  if (player) {
    try {
      player.remove();
    } catch {
      // ignorar
    }
    player = null;
  }
}

function hablarTTS(mi: number, texto: string) {
  Speech.speak(texto, {
    language: 'es-MX',
    rate: estado?.rate ?? 1.0,
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

async function decir(mi: number) {
  if (mi !== token || !estado) return;
  if (estado.idx >= estado.partes.length) {
    const fin = estado.onFin;
    estado = null;
    fin?.();
    return;
  }
  const texto = estado.partes[estado.idx];

  let uri: string | null = null;
  try {
    uri = await rutaLocalAudioParaTexto(texto);
  } catch {
    uri = null;
  }
  // La secuencia pudo cancelarse mientras calculábamos el hash/archivo.
  if (mi !== token || !estado) return;

  // Sin mp3 descargado: voz del sistema (respaldo).
  if (!uri) {
    hablarTTS(mi, texto);
    return;
  }

  // Con mp3: voz neural pre-grabada. Si algo falla, cae a la voz del sistema.
  liberarPlayer();
  try {
    const p = createAudioPlayer({ uri });
    player = p;
    p.setPlaybackRate(estado.rate, 'high');
    let avanzado = false;
    const sub = p.addListener('playbackStatusUpdate', (st) => {
      if (mi !== token) return;
      if (st.didJustFinish && !avanzado) {
        avanzado = true;
        sub.remove();
        liberarPlayer();
        if (estado) {
          estado.idx += 1;
          decir(mi);
        }
      }
    });
    p.play();
  } catch {
    liberarPlayer();
    hablarTTS(mi, texto);
  }
}

// Reproduce una lista de segmentos uno tras otro (evita un audio muy largo que
// en algunos dispositivos falla). `onFin` se llama al terminar todos.
export function reproducirPartes(
  partes: string[],
  opts: { rate?: number; onFin?: () => void } = {}
): void {
  token += 1;
  Speech.stop();
  liberarPlayer();
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
  try {
    player?.pause();
  } catch {
    // ignorar
  }
}

export function continuar(): void {
  if (!estado) return;
  token += 1;
  Speech.stop();
  liberarPlayer();
  decir(token);
}

export function detenerVoz(): void {
  token += 1;
  estado = null;
  Speech.stop();
  liberarPlayer();
}
