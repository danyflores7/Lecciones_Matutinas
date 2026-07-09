import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { leerCache, guardarCache } from './cache';
import { cargarStore, getLeccionLocal, leccionVigente } from './contenido';
import { fechaHoyISO, fechaRelativaISO, fechasDeLaSemana } from './fechas';
import { segmentosLeccion, segmentosMatutina } from './segmentos';

// Audio de la narración: mp3 pre-grabados (voz neural) alojados en un CDN y
// descargados al teléfono para usarse sin internet. Cada mp3 se nombra con el
// hash SHA-1 de su texto hablado, de modo que la app deriva la URL/ruta a
// partir del propio texto (la misma segmentación que usa el generador).

export const VOZ_VERSION = 'v1';
const BASE = `https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/${VOZ_VERSION}`;
const INDICE = 'audio:indice'; // { [hash]: 'YYYY-MM-DD' } fecha de última descarga
const MODO_COMPLETO = 'audio:completo'; // '1' si el usuario bajó todo (sin expirar)

function carpeta(): Directory {
  const d = new Directory(Paths.document, 'audio', VOZ_VERSION);
  try {
    if (!d.exists) d.create({ intermediates: true });
  } catch {
    // ya existía o no se pudo crear; no es crítico
  }
  return d;
}

export async function hashHablado(texto: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, texto.trim());
}

function archivo(hash: string): File {
  return new File(carpeta(), `${hash}.mp3`);
}

// Para un texto hablado, la ruta local del mp3 si ya está descargado (o null).
export async function rutaLocalAudioParaTexto(texto: string): Promise<string | null> {
  const t = texto.trim();
  if (!t) return null;
  const f = archivo(await hashHablado(t));
  return f.exists ? f.uri : null;
}

// Escrituras del índice serializadas en una cola (evita que descargas
// concurrentes se pisen las entradas entre sí).
let colaIndice: Promise<void> = Promise.resolve();
function encolarIndice(
  fn: (
    ind: Record<string, string>
  ) => Promise<Record<string, string> | null> | Record<string, string> | null
): Promise<void> {
  colaIndice = colaIndice
    .then(async () => {
      const ind = (await leerCache<Record<string, string>>(INDICE)) ?? {};
      const nuevo = await fn(ind);
      if (nuevo) await guardarCache(INDICE, nuevo);
    })
    .catch(() => {});
  return colaIndice;
}

// Descarga ATÓMICA: baja a un .part y solo al terminar lo renombra al nombre
// final. Así "el mp3 existe" siempre significa "el mp3 está completo" (un
// corte de red a media descarga no deja un archivo truncado que se sirva).
async function descargarHash(hash: string): Promise<boolean> {
  const f = archivo(hash);
  if (f.exists) return true;
  const part = new File(carpeta(), `${hash}.part`);
  try {
    if (part.exists) part.delete();
    await File.downloadFileAsync(`${BASE}/${hash}.mp3`, part);
    part.move(f);
    return f.exists;
  } catch {
    try {
      if (part.exists) part.delete();
    } catch {
      // ignorar
    }
    return false;
  }
}

// Descargas en curso por hash (para no pedir dos veces el mismo clip) y caché
// negativa de la sesión (clips que el CDN no tiene: frases dinámicas).
const enCurso = new Map<string, Promise<boolean>>();
const fallidos = new Set<string>();

function descargaUnica(hash: string): Promise<boolean> {
  let p = enCurso.get(hash);
  if (!p) {
    p = descargarHash(hash)
      .then((ok) => {
        if (ok) encolarIndice((ind) => ({ ...ind, [hash]: fechaHoyISO() }));
        else fallidos.add(hash);
        return ok;
      })
      .finally(() => enCurso.delete(hash));
    enCurso.set(hash, p);
  }
  return p;
}

// Audio "al momento": si el clip no está descargado, lo baja ya (con tiempo
// límite para no trabar la lectura). Devuelve la ruta local o null (sin red /
// no existe / tardó demasiado). Lo descargado queda guardado e indexado para
// que la limpieza de 14 días también lo gobierne.
export async function asegurarAudio(texto: string, timeoutMs = 3500): Promise<string | null> {
  const t = texto.trim();
  if (!t) return null;
  const hash = await hashHablado(t);
  const f = archivo(hash);
  if (f.exists) return f.uri;
  if (fallidos.has(hash)) return null; // ya sabemos que no está en el CDN

  const bajada = descargaUnica(hash);
  const aTiempo = await Promise.race([
    bajada,
    new Promise<false>((res) => setTimeout(() => res(false), timeoutMs)),
  ]);
  if (!aTiempo) return null; // la descarga puede seguir; servirá la próxima vez
  return f.exists ? f.uri : null;
}

async function agregarHashes(textos: string[], acc: Set<string>): Promise<void> {
  for (const t of textos) {
    const s = t.trim();
    if (s) acc.add(await hashHablado(s));
  }
}

// Hashes de los segmentos de la "semana en curso": las 7 matutinas + la
// lección vigente (la del PRÓXIMO sábado: la que se está estudiando).
async function hashesDeLaSemana(): Promise<Set<string>> {
  const store = await cargarStore();
  const out = new Set<string>();
  if (!store) return out;
  for (const fecha of fechasDeLaSemana()) {
    const v = store.versiculos.find((x) => x.fecha === fecha);
    if (v) await agregarHashes(segmentosMatutina(v), out);
  }
  const vigente = leccionVigente(store.lecciones, fechaHoyISO());
  if (vigente) {
    const d = await getLeccionLocal(vigente.fecha);
    if (d) await agregarHashes(segmentosLeccion(d.leccion, d.preguntas, d.citasTexto), out);
  }
  return out;
}

// Descarga (si faltan) los audios de la semana; descargaUnica los deja
// indexados con fecha de hoy (para la expiración).
export async function descargarSemana(): Promise<void> {
  const hashes = await hashesDeLaSemana();
  for (const h of hashes) {
    await descargaUnica(h);
  }
}

// Borra los audios cuya última descarga sea de hace más de 14 días (a menos
// que el usuario haya activado "descargar todo").
export async function limpiarViejo(): Promise<void> {
  if ((await leerCache<string>(MODO_COMPLETO)) === '1') return;
  const corte = fechaRelativaISO(-14);
  await encolarIndice((indice) => {
    let cambio = false;
    for (const [hash, fecha] of Object.entries(indice)) {
      if (fecha < corte) {
        try {
          const f = archivo(hash);
          if (f.exists) f.delete();
        } catch {
          // ignorar
        }
        delete indice[hash];
        cambio = true;
      }
    }
    return cambio ? indice : null;
  });
}

// --- Estado observable de la descarga "todo" (sobrevive a la navegación) ---
export type EstadoDescarga = { activa: boolean; hecho: number; total: number; completo: boolean };
let estadoDescarga: EstadoDescarga = { activa: false, hecho: 0, total: 0, completo: false };
const oyentes = new Set<(e: EstadoDescarga) => void>();

function emitir() {
  const snap = { ...estadoDescarga };
  for (const fn of oyentes) fn(snap);
}

export function estadoDescargaActual(): EstadoDescarga {
  return { ...estadoDescarga };
}

export function suscribirDescarga(fn: (e: EstadoDescarga) => void): () => void {
  oyentes.add(fn);
  fn({ ...estadoDescarga });
  return () => {
    oyentes.delete(fn);
  };
}

export async function esModoCompleto(): Promise<boolean> {
  return (await leerCache<string>(MODO_COMPLETO)) === '1';
}

// Todos los hashes de TODO el contenido del año.
async function hashesDeTodo(): Promise<Set<string>> {
  const store = await cargarStore();
  const out = new Set<string>();
  if (!store) return out;
  for (const v of store.versiculos) await agregarHashes(segmentosMatutina(v), out);
  for (const l of store.lecciones) {
    const d = await getLeccionLocal(l.fecha);
    if (d) await agregarHashes(segmentosLeccion(d.leccion, d.preguntas, d.citasTexto), out);
  }
  return out;
}

// Descarga TODO el audio en segundo plano. Se puede seguir navegando por la
// app; si ya está corriendo, no vuelve a arrancar. Idempotente (reanuda lo
// que falte). Desactiva la expiración (modo completo).
export async function descargarTodo(): Promise<void> {
  if (estadoDescarga.activa) return;
  estadoDescarga = { activa: true, hecho: 0, total: 0, completo: false };
  emitir();
  try {
    const hashes = await hashesDeTodo();
    estadoDescarga.total = hashes.size;
    emitir();
    for (const h of hashes) {
      await descargaUnica(h);
      estadoDescarga.hecho += 1;
      emitir();
    }
    await guardarCache(MODO_COMPLETO, '1');
    estadoDescarga.completo = true;
  } finally {
    estadoDescarga.activa = false;
    emitir();
  }
}

// Bytes ocupados por los audios descargados.
export async function tamanoOcupado(): Promise<number> {
  try {
    let total = 0;
    for (const e of carpeta().list()) {
      if (e instanceof File) total += e.size ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function borrarAudios(): Promise<void> {
  try {
    const d = carpeta();
    if (d.exists) d.delete();
  } catch {
    // ignorar
  }
  await guardarCache(INDICE, {});
  await guardarCache(MODO_COMPLETO, '0');
  fallidos.clear();
  estadoDescarga = { activa: false, hecho: 0, total: 0, completo: false };
  emitir();
}
