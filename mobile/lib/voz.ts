import { useSyncExternalStore } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { asegurarAudio, fuenteDelUltimoAudio, type FuenteAudio } from './audio';

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

type Estado = {
  partes: string[];
  orig: number[]; // índice de cada parte en la lista original (antes de filtrar vacías)
  idx: number;
  rate: number;
  onFin?: () => void;
  onParte?: (indice: number) => void;
};

// token: invalida secuencias anteriores (al detener, pausar o iniciar otra).
let token = 0;
let estado: Estado | null = null;
let player: AudioPlayer | null = null;

// Estado visible de la lectura, para que las pantallas muestren "Preparando
// audio…" mientras se descarga el primer clip, y el botón correcto.
export type EstadoVoz = 'inactivo' | 'preparando' | 'hablando' | 'pausado';
let estadoVoz: EstadoVoz = 'inactivo';
const oyentes = new Set<() => void>();

// Medición de velocidad: milisegundos desde que se pide leer hasta que suena la
// primera voz. Se guardan las últimas 30 lecturas para "Acerca de la app".
const K_TIEMPOS = 'voz:tiempos';
export type Tiempo = { ms: number; fuente: FuenteAudio | 'sistema' | null };
let inicioLectura = 0;
let medido = true;

function registrarTiempo(fuente: FuenteAudio | 'sistema' | null) {
  if (medido || !inicioLectura) return;
  medido = true;
  const ms = Date.now() - inicioLectura;
  AsyncStorage.getItem(K_TIEMPOS)
    .then((raw) => {
      const lista: Tiempo[] = raw ? JSON.parse(raw) : [];
      lista.push({ ms, fuente });
      return AsyncStorage.setItem(K_TIEMPOS, JSON.stringify(lista.slice(-30)));
    })
    .catch(() => {});
}

export async function leerTiempos(): Promise<Tiempo[]> {
  try {
    const raw = await AsyncStorage.getItem(K_TIEMPOS);
    return raw ? (JSON.parse(raw) as Tiempo[]) : [];
  } catch {
    return [];
  }
}

function setEstadoVoz(e: EstadoVoz) {
  if (e === estadoVoz) return;
  estadoVoz = e;
  oyentes.forEach((f) => f());
}

function suscribirVoz(f: () => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export function useEstadoVoz(): EstadoVoz {
  return useSyncExternalStore(suscribirVoz, () => estadoVoz);
}

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
  registrarTiempo('sistema');
  setEstadoVoz('hablando');
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
    setEstadoVoz('inactivo');
    fin?.();
    return;
  }
  const texto = estado.partes[estado.idx];
  estado.onParte?.(estado.orig[estado.idx]);

  // Voz neural: usa el mp3 local o lo descarga AL MOMENTO si hay internet
  // (clips de ~35 KB). Solo si no se puede, cae a la voz del sistema.
  let uri: string | null = null;
  try {
    uri = await asegurarAudio(texto);
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
      if (st.playing) {
        registrarTiempo(fuenteDelUltimoAudio());
        setEstadoVoz('hablando');
      }
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
    // Vigilante: si en 5s el clip no arrancó (archivo dañado / carga fallida),
    // se cae a la voz del sistema para que la lectura nunca se quede muda.
    setTimeout(() => {
      if (mi !== token || avanzado || !estado) return;
      let arranco = false;
      try {
        arranco = p.playing || p.currentTime > 0;
      } catch {
        arranco = false;
      }
      if (!arranco) {
        avanzado = true;
        try {
          sub.remove();
        } catch {
          // ignorar
        }
        liberarPlayer();
        hablarTTS(mi, texto);
      }
    }, 5000);
  } catch {
    liberarPlayer();
    hablarTTS(mi, texto);
  }
}

// Reproduce una lista de segmentos uno tras otro (evita un audio muy largo que
// en algunos dispositivos falla). `onFin` se llama al terminar todos.
// `onParte(i)` avisa qué parte (índice en `partes`) empieza a sonar.
export function reproducirPartes(
  partes: string[],
  opts: { rate?: number; onFin?: () => void; onParte?: (indice: number) => void; desde?: number } = {}
): void {
  token += 1;
  Speech.stop();
  liberarPlayer();
  const limpias: string[] = [];
  const orig: number[] = [];
  partes.forEach((p, i) => {
    const t = (p ?? '').trim();
    if (t && i >= (opts.desde ?? 0)) {
      limpias.push(t);
      orig.push(i);
    }
  });
  estado = {
    partes: limpias,
    orig,
    idx: 0,
    rate: opts.rate ?? 1.0,
    onFin: opts.onFin,
    onParte: opts.onParte,
  };
  setEstadoVoz('preparando');
  inicioLectura = Date.now();
  medido = false;
  decir(token);
}

// Pausa: corta el segmento actual y conserva la posición (al continuar se
// vuelve a leer ese segmento desde el inicio).
export function pausar(): void {
  token += 1;
  if (estado) setEstadoVoz('pausado');
  Speech.stop();
  try {
    player?.pause();
  } catch {
    // ignorar
  }
}

// Devuelve false si no había lectura pausada que continuar.
export function continuar(): boolean {
  if (!estado) return false;
  token += 1;
  Speech.stop();
  liberarPlayer();
  setEstadoVoz('preparando');
  decir(token);
  return true;
}

export function detenerVoz(): void {
  token += 1;
  estado = null;
  setEstadoVoz('inactivo');
  Speech.stop();
  liberarPlayer();
}
