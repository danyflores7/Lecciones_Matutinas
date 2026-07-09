import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getLecciones,
  getTodasLasCitas,
  getTodasLasPreguntas,
  getTodosLosVersiculos,
  type Leccion,
  type Pregunta,
  type VersiculoDia,
} from './supabase';

// Almacén local del contenido COMPLETO del año, para que la app funcione 100%
// sin internet tras una sola sincronización. El texto entero pesa <~2 MB.

type Store = {
  versiculos: VersiculoDia[];
  lecciones: Leccion[];
  preguntas: Pregunta[];
  citas: Record<string, string>;
};

const K = {
  versiculos: 'contenido:versiculos',
  lecciones: 'contenido:lecciones',
  preguntas: 'contenido:preguntas',
  citas: 'contenido:citas',
  meta: 'contenido:meta',
};

let store: Store | null = null;
let cargando: Promise<Store | null> | null = null;

async function leerJSON<T>(clave: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Carga el store desde disco a memoria (una sola vez). Devuelve null si nunca
// se ha sincronizado.
export async function cargarStore(): Promise<Store | null> {
  if (store) return store;
  if (cargando) return cargando;
  cargando = (async () => {
    const [versiculos, lecciones, preguntas, citas] = await Promise.all([
      leerJSON<VersiculoDia[]>(K.versiculos),
      leerJSON<Leccion[]>(K.lecciones),
      leerJSON<Pregunta[]>(K.preguntas),
      leerJSON<Record<string, string>>(K.citas),
    ]);
    if (versiculos && lecciones && preguntas && citas) {
      store = { versiculos, lecciones, preguntas, citas };
    }
    cargando = null;
    return store;
  })();
  return cargando;
}

// Descarga TODO el contenido y lo guarda en disco. Lanza si no hay red.
export async function sincronizarContenido(): Promise<void> {
  const [versiculos, lecciones, preguntas, citas] = await Promise.all([
    getTodosLosVersiculos(),
    getLecciones(),
    getTodasLasPreguntas(),
    getTodasLasCitas(),
  ]);
  await Promise.all([
    AsyncStorage.setItem(K.versiculos, JSON.stringify(versiculos)),
    AsyncStorage.setItem(K.lecciones, JSON.stringify(lecciones)),
    AsyncStorage.setItem(K.preguntas, JSON.stringify(preguntas)),
    AsyncStorage.setItem(K.citas, JSON.stringify(citas)),
    AsyncStorage.setItem(
      K.meta,
      JSON.stringify({
        sincronizado: new Date().toISOString(),
        filas: {
          versiculos: versiculos.length,
          lecciones: lecciones.length,
          preguntas: preguntas.length,
          citas: Object.keys(citas).length,
        },
      })
    ),
  ]);
  store = { versiculos, lecciones, preguntas, citas };
}

export async function getVersiculosLocal(): Promise<VersiculoDia[]> {
  return (await cargarStore())?.versiculos ?? [];
}

export async function getVersiculoLocal(fecha: string): Promise<VersiculoDia | null> {
  const s = await cargarStore();
  return s?.versiculos.find((v) => v.fecha === fecha) ?? null;
}

export async function getLeccionesLocal(): Promise<Leccion[]> {
  return (await cargarStore())?.lecciones ?? [];
}

export async function getLeccionLocal(
  fecha: string
): Promise<{ leccion: Leccion; preguntas: Pregunta[]; citasTexto: Record<string, string> } | null> {
  const s = await cargarStore();
  if (!s) return null;
  const leccion = s.lecciones.find((l) => l.fecha === fecha);
  if (!leccion) return null;
  const preguntas = s.preguntas
    .filter((p) => p.leccion_id === leccion.id)
    .sort((a, b) => a.orden - b.orden);
  const citasTexto: Record<string, string> = {};
  for (const p of preguntas) {
    for (const c of p.citas ?? []) {
      if (s.citas[c]) citasTexto[c] = s.citas[c];
    }
  }
  return { leccion, preguntas, citasTexto };
}
