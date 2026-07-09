import { Directory, File, Paths } from 'expo-file-system';

import { anclaDeCita, indiceDeLibro, LIBROS, normalizar, parseCita } from './citas';

// Biblia RV1909 completa + datos pre-calculados (versículos relacionados y
// preguntas similares), alojados en el CDN y descargados UNA vez al teléfono.
// Después todo funciona offline: la app solo lee estos archivos locales.

const BASE = 'https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/datos/v1';
const ARCHIVOS = ['biblia.json', 'relacionados_versiculos.json', 'relacionadas_preguntas.json'];

type Biblia = { version: number; libros: { n: string; c: string[][] }[] };
type RelVers = {
  version: number;
  fuente?: string;
  licencia?: string;
  relacionados: Record<string, { cita: string; texto: string }[]>;
};
export type PreguntaSimilar = {
  leccion_numero: number;
  leccion_titulo: string;
  leccion_fecha: string;
  orden: number;
  pregunta: string;
  citas: string[];
};
type RelPreg = { version: number; similares: Record<string, PreguntaSimilar[]> };

function carpeta(): Directory {
  const d = new Directory(Paths.document, 'datos', 'v1');
  try {
    if (!d.exists) d.create({ intermediates: true });
  } catch {
    // ya existía
  }
  return d;
}

// Descarga (si faltan) los archivos de datos. Silencioso e idempotente.
export async function descargarDatos(): Promise<void> {
  const dir = carpeta();
  for (const nombre of ARCHIVOS) {
    const f = new File(dir, nombre);
    if (f.exists) continue;
    try {
      await File.downloadFileAsync(`${BASE}/${nombre}`, f);
    } catch {
      // sin red o aún no publicado; se reintenta en el próximo arranque
    }
  }
}

async function leerJSON<T>(nombre: string): Promise<T | null> {
  try {
    const f = new File(carpeta(), nombre);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as T;
  } catch {
    return null;
  }
}

// --- Biblia completa (carga perezosa; ~31 mil versículos) ---
let biblia: Biblia | null = null;
let cargandoBiblia: Promise<Biblia | null> | null = null;

async function cargarBiblia(): Promise<Biblia | null> {
  if (biblia) return biblia;
  if (cargandoBiblia) return cargandoBiblia;
  cargandoBiblia = (async () => {
    biblia = await leerJSON<Biblia>('biblia.json');
    cargandoBiblia = null;
    return biblia;
  })();
  return cargandoBiblia;
}

export async function bibliaDisponible(): Promise<boolean> {
  return new File(carpeta(), 'biblia.json').exists;
}

// Texto de un versículo por cita ("Juan 3:16"; en rangos usa el primero).
export async function obtenerVersiculo(cita: string): Promise<{ cita: string; texto: string } | null> {
  const b = await cargarBiblia();
  const p = parseCita(cita);
  if (!b || !p) return null;
  const libro = b.libros[indiceDeLibro(p.libro)];
  const texto = libro?.c[p.capitulo - 1]?.[(p.verso ?? 1) - 1];
  return texto ? { cita: `${p.libro} ${p.capitulo}:${p.verso ?? 1}`, texto } : null;
}

const RUIDO = new Set([
  'que', 'quien', 'con', 'por', 'para', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas',
  'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'aquel', 'como', 'mas', 'pero', 'sus', 'les',
  'nos', 'vosotros', 'ellos', 'ellas', 'porque', 'cuando', 'donde', 'entre', 'sobre', 'hasta',
]);

export type ResultadoBusqueda = { cita: string; texto: string };

// Busca un fragmento recordado en TODA la Biblia. Sin IA: normaliza y puntúa
// por frase exacta o por cobertura de palabras.
export async function buscarEnBiblia(consulta: string, limite = 5): Promise<ResultadoBusqueda[]> {
  const b = await cargarBiblia();
  if (!b) return [];
  const q = normalizar(consulta).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = q.split(' ').filter((t) => t.length >= 3 && !RUIDO.has(t));
  if (!q || (!tokens.length && q.length < 4)) return [];

  const puntuados: { score: number; cita: string; texto: string }[] = [];
  for (let li = 0; li < b.libros.length; li++) {
    const libro = b.libros[li];
    for (let ci = 0; ci < libro.c.length; ci++) {
      const cap = libro.c[ci];
      for (let vi = 0; vi < cap.length; vi++) {
        const nt = normalizar(cap[vi]);
        let score = 0;
        if (nt.includes(q)) score = 1000 - Math.abs(nt.length - q.length) / 10;
        else if (tokens.length) {
          let hits = 0;
          for (const tok of tokens) if (nt.includes(tok)) hits++;
          const cobertura = hits / tokens.length;
          if (cobertura >= 0.65) score = cobertura * 100 - nt.length / 100;
        }
        if (score > 0) {
          puntuados.push({ score, cita: `${LIBROS[li]} ${ci + 1}:${vi + 1}`, texto: cap[vi] });
        }
      }
    }
  }
  puntuados.sort((a, b2) => b2.score - a.score);
  return puntuados.slice(0, limite).map(({ cita, texto }) => ({ cita, texto }));
}

// --- Versículos relacionados (referencias cruzadas pre-calculadas) ---
let relVers: RelVers | null = null;
let anclasRelVers: Map<string, string> | null = null;

async function cargarRelVers(): Promise<RelVers | null> {
  if (!relVers) {
    relVers = await leerJSON<RelVers>('relacionados_versiculos.json');
    if (relVers) {
      anclasRelVers = new Map();
      for (const k of Object.keys(relVers.relacionados)) {
        const a = anclaDeCita(k);
        if (a && !anclasRelVers.has(a)) anclasRelVers.set(a, k);
      }
    }
  }
  return relVers;
}

export async function versiculosRelacionados(
  cita: string
): Promise<{ cita: string; texto: string }[]> {
  const r = await cargarRelVers();
  if (!r) return [];
  if (r.relacionados[cita]) return r.relacionados[cita];
  const a = anclaDeCita(cita);
  const llave = a ? anclasRelVers?.get(a) : undefined;
  return llave ? r.relacionados[llave] : [];
}

// --- Preguntas similares (pre-calculadas) ---
let relPreg: RelPreg | null = null;

async function cargarRelPreg(): Promise<RelPreg | null> {
  if (!relPreg) relPreg = await leerJSON<RelPreg>('relacionadas_preguntas.json');
  return relPreg;
}

// Similares de UNA pregunta (por id).
export async function similaresDePregunta(preguntaId: number): Promise<PreguntaSimilar[]> {
  const r = await cargarRelPreg();
  return r?.similares[String(preguntaId)] ?? [];
}

// LECCIONES parecidas a una lección: agrupa los similares de sus preguntas
// POR LECCIÓN destino y ordena por cuántas coincidencias tiene cada una.
export async function leccionesSimilares(
  preguntaIds: number[],
  excluirFecha: string,
  limite = 3
): Promise<{ numero: number; titulo: string; fecha: string; veces: number }[]> {
  const r = await cargarRelPreg();
  if (!r) return [];
  const conteo = new Map<string, { numero: number; titulo: string; fecha: string; veces: number }>();
  for (const id of preguntaIds) {
    for (const s of r.similares[String(id)] ?? []) {
      if (s.leccion_fecha === excluirFecha) continue;
      const prev = conteo.get(s.leccion_fecha);
      if (prev) prev.veces++;
      else
        conteo.set(s.leccion_fecha, {
          numero: s.leccion_numero,
          titulo: s.leccion_titulo,
          fecha: s.leccion_fecha,
          veces: 1,
        });
    }
  }
  return [...conteo.values()].sort((a, b) => b.veces - a.veces).slice(0, limite);
}

// Similares agregadas de una LECCIÓN: junta las de todas sus preguntas y
// ordena por frecuencia (lo que más se repite va primero).
export async function similaresDeLeccion(
  preguntaIds: number[],
  excluirLeccionNumero: number,
  limite = 6
): Promise<PreguntaSimilar[]> {
  const r = await cargarRelPreg();
  if (!r) return [];
  const conteo = new Map<string, { item: PreguntaSimilar; veces: number }>();
  for (const id of preguntaIds) {
    for (const s of r.similares[String(id)] ?? []) {
      if (s.leccion_numero === excluirLeccionNumero) continue;
      const k = `${s.leccion_fecha}|${s.orden}`;
      const prev = conteo.get(k);
      if (prev) prev.veces++;
      else conteo.set(k, { item: s, veces: 1 });
    }
  }
  return [...conteo.values()]
    .sort((a, b) => b.veces - a.veces)
    .slice(0, limite)
    .map((x) => x.item);
}
