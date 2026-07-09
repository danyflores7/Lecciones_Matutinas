import AsyncStorage from '@react-native-async-storage/async-storage';

import { anclaDeCita, normalizar } from './citas';
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

// La lección VIGENTE es la que se estudia esta semana: la del PRÓXIMO sábado
// (fecha >= hoy). La del sábado anterior ya se estudió. Si el plan ya terminó,
// se queda con la última.
export function leccionVigente<T extends { fecha: string }>(
  lecciones: T[],
  hoy: string
): T | null {
  const orden = [...lecciones].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const proxima = orden.find((l) => l.fecha >= hoy);
  return proxima ?? orden[orden.length - 1] ?? null;
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

export type LugarCita =
  | {
      tipo: 'pregunta';
      leccionNumero: number;
      leccionTitulo: string;
      leccionFecha: string;
      orden: number;
      pregunta: string;
    }
  | { tipo: 'central'; leccionNumero: number; leccionTitulo: string; leccionFecha: string }
  | { tipo: 'matutina'; fecha: string; cita: string; tema: string };

// ¿Dónde se cita este versículo en el contenido de la app? Compara por ancla
// (libro + capítulo + primer verso), así "Juan 3:16" empata con "Juan 3:16-17".
export async function dondeSeCita(cita: string): Promise<LugarCita[]> {
  const s = await cargarStore();
  const objetivo = anclaDeCita(cita);
  if (!s || !objetivo) return [];
  const porId = new Map(s.lecciones.map((l) => [l.id, l]));
  const out: LugarCita[] = [];
  for (const p of s.preguntas) {
    if ((p.citas ?? []).some((c) => anclaDeCita(c) === objetivo)) {
      const l = porId.get(p.leccion_id);
      if (l) {
        out.push({
          tipo: 'pregunta',
          leccionNumero: l.numero,
          leccionTitulo: l.titulo,
          leccionFecha: l.fecha,
          orden: p.orden,
          pregunta: p.pregunta,
        });
      }
    }
  }
  for (const l of s.lecciones) {
    if (anclaDeCita(l.versiculo_central_cita) === objetivo) {
      out.push({
        tipo: 'central',
        leccionNumero: l.numero,
        leccionTitulo: l.titulo,
        leccionFecha: l.fecha,
      });
    }
  }
  for (const v of s.versiculos) {
    if (anclaDeCita(v.cita) === objetivo) {
      out.push({ tipo: 'matutina', fecha: v.fecha, cita: v.cita, tema: v.tema });
    }
  }
  return out;
}

// Busca un fragmento de texto dentro del contenido de las LECCIONES y
// matutinas (los textos bíblicos citados). Sin IA: frase exacta o cobertura
// de palabras, igual que la búsqueda en la Biblia.
export async function buscarTextoLocal(
  consulta: string,
  limite = 5
): Promise<{ etiqueta: string; texto: string }[]> {
  const s = await cargarStore();
  if (!s) return [];
  const q = normalizar(consulta).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = q.split(' ').filter((t) => t.length >= 3);
  if (!q) return [];
  const puntuados: { score: number; etiqueta: string; texto: string }[] = [];
  const evaluar = (etiqueta: string, texto: string | null) => {
    if (!texto) return;
    const nt = normalizar(texto);
    let score = 0;
    if (nt.includes(q)) score = 1000;
    else if (tokens.length) {
      let hits = 0;
      for (const tok of tokens) if (nt.includes(tok)) hits++;
      if (hits / tokens.length >= 0.65) score = (hits / tokens.length) * 100;
    }
    if (score > 0) puntuados.push({ score, etiqueta, texto });
  };
  for (const [cita, texto] of Object.entries(s.citas)) evaluar(cita, texto);
  for (const v of s.versiculos) evaluar(v.cita, v.texto);
  puntuados.sort((a, b) => b.score - a.score);
  // Quita duplicados por texto (la misma cita puede estar en ambas fuentes).
  const vistos = new Set<string>();
  const out: { etiqueta: string; texto: string }[] = [];
  for (const p of puntuados) {
    if (vistos.has(p.etiqueta)) continue;
    vistos.add(p.etiqueta);
    out.push({ etiqueta: p.etiqueta, texto: p.texto });
    if (out.length >= limite) break;
  }
  return out;
}
