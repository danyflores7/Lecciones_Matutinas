// Versión web/escritorio de los datos de búsqueda. En el programa de escritorio
// vienen incluidos (window.matutinasDesktop.datosBase); en un navegador se leen
// del CDN. Se guardan en memoria tras la primera lectura.

const CDN = 'https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/datos/v1';

declare global {
  interface Window {
    matutinasDesktop?: { escritorio: true; plataforma: string; audioBase: string; datosBase: string };
  }
}

const base = () =>
  (typeof window !== 'undefined' && window.matutinasDesktop?.datosBase) || CDN;

const memoria = new Map<string, Promise<unknown | null>>();

export async function descargarDatos(): Promise<void> {
  // nada que descargar: se leen bajo demanda
}

export function leerDatoJSON<T>(nombre: string): Promise<T | null> {
  let p = memoria.get(nombre);
  if (!p) {
    p = fetch(`${base()}/${nombre}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    memoria.set(nombre, p);
    // si falló, que se pueda reintentar después
    p.then((v) => {
      if (v === null) memoria.delete(nombre);
    });
  }
  return p as Promise<T | null>;
}

export async function existeDato(nombre: string): Promise<boolean> {
  return (await leerDatoJSON(nombre)) !== null;
}
