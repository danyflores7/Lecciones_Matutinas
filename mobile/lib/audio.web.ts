import * as Crypto from 'expo-crypto';

// Versión web/escritorio del audio. Los mp3 se piden por URL (en el programa de
// escritorio vienen incluidos: window.matutinasDesktop.audioBase; en un navegador
// se piden al CDN y el navegador los guarda en su caché). No hay descargas ni
// limpieza manual: aquí todo es "al momento".

export const VOZ_VERSION = 'v1';
const CDN = `https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/${VOZ_VERSION}`;

export type FuenteAudio = 'local' | 'incluido' | 'red';
let ultimaFuente: FuenteAudio | null = null;
export const fuenteDelUltimoAudio = (): FuenteAudio | null => ultimaFuente;

const desktopBase = () => (typeof window !== 'undefined' ? window.matutinasDesktop?.audioBase : undefined);

export async function hashHablado(texto: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, texto.trim());
}

const existe = new Map<string, boolean>(); // hash -> ¿hay clip? (caché de la sesión)

// Devuelve la URL del mp3 de ese texto o null si no existe / tardó demasiado.
export async function asegurarAudio(texto: string, timeoutMs = 3500): Promise<string | null> {
  const t = texto.trim();
  if (!t) return null;
  const hash = await hashHablado(t);
  const local = desktopBase();
  const url = `${local ?? CDN}/${hash}.mp3`;
  const fuente: FuenteAudio = local ? 'incluido' : 'red';
  const visto = existe.get(hash);
  if (visto === false) return null;
  if (visto === true) {
    ultimaFuente = fuente;
    return url;
  }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { method: 'HEAD', signal: ctl.signal });
    clearTimeout(timer);
    existe.set(hash, r.ok);
    if (!r.ok) return null;
    ultimaFuente = fuente;
    return url;
  } catch {
    return null;
  }
}

export async function rutaLocalAudioParaTexto(texto: string): Promise<string | null> {
  return desktopBase() ? asegurarAudio(texto) : null;
}

// --- En escritorio no hay descargas: se mantiene la misma interfaz, vacía ---
export type EstadoDescarga = { activa: boolean; hecho: number; total: number; completo: boolean };
const estado: EstadoDescarga = { activa: false, hecho: 0, total: 0, completo: true };
export const estadoDescargaActual = (): EstadoDescarga => ({ ...estado });
export function suscribirDescarga(fn: (e: EstadoDescarga) => void): () => void {
  fn({ ...estado });
  return () => {};
}
export const esModoCompleto = async (): Promise<boolean> => true;
export const descargarSemana = async (): Promise<void> => {};
export const limpiarViejo = async (): Promise<void> => {};
export const descargarTodo = async (): Promise<void> => {};
export const cancelarDescarga = (): void => {};
export const tamanoOcupado = async (): Promise<number> => 0;
export const borrarAudios = async (): Promise<void> => {};
