import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { leerCache, guardarCache } from './cache';
import { cargarStore, getLeccionLocal } from './contenido';
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

async function descargarHash(hash: string): Promise<boolean> {
  const f = archivo(hash);
  if (f.exists) return true;
  try {
    await File.downloadFileAsync(`${BASE}/${hash}.mp3`, f);
    return f.exists;
  } catch {
    return false;
  }
}

async function agregarHashes(textos: string[], acc: Set<string>): Promise<void> {
  for (const t of textos) {
    const s = t.trim();
    if (s) acc.add(await hashHablado(s));
  }
}

// Hashes de los segmentos de la "semana en curso": las 7 matutinas + la
// lección vigente (la de mayor fecha que ya empezó).
async function hashesDeLaSemana(): Promise<Set<string>> {
  const store = await cargarStore();
  const out = new Set<string>();
  if (!store) return out;
  for (const fecha of fechasDeLaSemana()) {
    const v = store.versiculos.find((x) => x.fecha === fecha);
    if (v) await agregarHashes(segmentosMatutina(v), out);
  }
  const hoy = fechaHoyISO();
  const vigente = store.lecciones
    .filter((l) => l.fecha <= hoy)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  if (vigente) {
    const d = await getLeccionLocal(vigente.fecha);
    if (d) await agregarHashes(segmentosLeccion(d.leccion, d.preguntas, d.citasTexto), out);
  }
  return out;
}

// Descarga (si faltan) los audios de la semana y marca su fecha para expirar.
export async function descargarSemana(): Promise<void> {
  const hashes = await hashesDeLaSemana();
  if (!hashes.size) return;
  const indice = (await leerCache<Record<string, string>>(INDICE)) ?? {};
  const hoy = fechaHoyISO();
  for (const h of hashes) {
    if (await descargarHash(h)) indice[h] = hoy;
  }
  await guardarCache(INDICE, indice);
}

// Borra los audios cuya última descarga sea de hace más de 14 días (a menos
// que el usuario haya activado "descargar todo").
export async function limpiarViejo(): Promise<void> {
  if ((await leerCache<string>(MODO_COMPLETO)) === '1') return;
  const indice = (await leerCache<Record<string, string>>(INDICE)) ?? {};
  const corte = fechaRelativaISO(-14);
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
  if (cambio) await guardarCache(INDICE, indice);
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
    const indice = (await leerCache<Record<string, string>>(INDICE)) ?? {};
    const hoy = fechaHoyISO();
    for (const h of hashes) {
      if (await descargarHash(h)) indice[h] = hoy;
      estadoDescarga.hecho += 1;
      emitir();
    }
    await guardarCache(INDICE, indice);
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
  estadoDescarga = { activa: false, hecho: 0, total: 0, completo: false };
  emitir();
}
