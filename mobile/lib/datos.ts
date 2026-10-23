import { Directory, File, Paths } from 'expo-file-system';

// Archivos de datos de búsqueda (Biblia completa, relacionados, similares):
// se bajan UNA vez del CDN al teléfono y se leen de ahí. La versión de
// escritorio (datos.web.ts) los trae incluidos en el programa.

const BASE = 'https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/datos/v1';
const ARCHIVOS = ['biblia.json', 'relacionados_versiculos.json', 'relacionadas_preguntas.json'];

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

export async function leerDatoJSON<T>(nombre: string): Promise<T | null> {
  try {
    const f = new File(carpeta(), nombre);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as T;
  } catch {
    return null;
  }
}

export async function existeDato(nombre: string): Promise<boolean> {
  return new File(carpeta(), nombre).exists;
}
