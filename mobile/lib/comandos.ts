import { MESES, fechaHoyISO, fechaRelativaISO } from './fechas';

// Intérprete de comandos por VOZ, 100% por reglas (sin IA). El dominio es fijo
// y pequeño (lecciones 1-26, matutinas por fecha, y unos pocos verbos), así que
// un parser determinista es suficiente y no necesita red ni modelo.

export type Comando =
  | { tipo: 'abrirLeccion'; numero: number }
  | { tipo: 'abrirMatutina'; fecha: string } // 'YYYY-MM-DD'
  | { tipo: 'siguiente' }
  | { tipo: 'anterior' }
  | { tipo: 'leer' }
  | { tipo: 'pausar' }
  | { tipo: 'detener' }
  | { tipo: 'ir'; destino: 'inicio' | 'calendario' | 'estudio' }
  | { tipo: 'ayuda' }
  | { tipo: 'desconocido' };

// Quita acentos y baja a minúsculas (Hermes no siempre trae String.normalize,
// así que se hace a mano).
function sinAcentos(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n');
}

const NUM_PALABRA: Record<string, number> = {
  uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, treintaiuno: 31,
};

// Primer número que aparezca en el texto (dígitos o palabra), o null.
function primerNumero(texto: string): number | null {
  const dig = texto.match(/\b(\d{1,2})\b/);
  if (dig) return Number(dig[1]);
  for (const palabra of texto.split(' ')) {
    if (palabra in NUM_PALABRA) return NUM_PALABRA[palabra];
  }
  return null;
}

// 'YYYY-MM-DD' desde una frase con fecha, o null.
function fechaDeTexto(texto: string): string | null {
  if (/\bhoy\b/.test(texto)) return fechaHoyISO();
  if (/\bmanana\b/.test(texto)) return fechaRelativaISO(1);
  if (/\bayer\b/.test(texto)) return fechaRelativaISO(-1);
  // "<día> de <mes>", p. ej. "cinco de julio" o "5 de julio".
  const m = texto.match(/(\d{1,2}|[a-z]+)\s+de\s+([a-z]+)/);
  if (m) {
    const dia = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]] ?? 0;
    const mesIdx = MESES.findIndex((mm) => sinAcentos(mm) === m[2]);
    if (dia >= 1 && dia <= 31 && mesIdx >= 0) {
      const anio = fechaHoyISO().slice(0, 4);
      return `${anio}-${String(mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return null;
}

const contiene = (t: string, palabras: string[]) => palabras.some((p) => t.includes(p));

export function interpretar(textoOriginal: string): Comando {
  const t = sinAcentos(textoOriginal).replace(/\s+/g, ' ').trim();
  if (!t) return { tipo: 'desconocido' };

  if (contiene(t, ['ayuda', 'que puedo', 'que digo', 'comandos', 'que hago'])) {
    return { tipo: 'ayuda' };
  }

  // Pedir una lección concreta ("lección 3", "lección tres").
  if (t.includes('leccion')) {
    const n = primerNumero(t);
    if (n && n >= 1) return { tipo: 'abrirLeccion', numero: n };
    return { tipo: 'ir', destino: 'estudio' };
  }

  // Pedir una matutina / versículo (por fecha, o de hoy por defecto).
  if (contiene(t, ['matutina', 'versiculo', 'devocional', 'lectura del dia'])) {
    return { tipo: 'abrirMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }

  // Navegación por pantalla.
  if (contiene(t, ['inicio', 'principal'])) return { tipo: 'ir', destino: 'inicio' };
  if (t.includes('calendario')) return { tipo: 'ir', destino: 'calendario' };
  if (contiene(t, ['estudio', 'lecciones'])) return { tipo: 'ir', destino: 'estudio' };

  // Controles de lectura.
  if (contiene(t, ['pausa', 'pausar', 'espera'])) return { tipo: 'pausar' };
  if (contiene(t, ['detente', 'deten', 'detener', 'basta', 'silencio', 'callar', 'calla'])) {
    return { tipo: 'detener' };
  }
  if (contiene(t, ['lee', 'escucha', 'escuchar', 'reproduce', 'reproducir', 'lectura'])) {
    return { tipo: 'leer' };
  }

  // Navegación relativa (respecto a lo último leído).
  if (contiene(t, ['siguiente', 'proxima', 'proximo', 'adelante', 'avanza'])) {
    return { tipo: 'siguiente' };
  }
  if (contiene(t, ['anterior', 'previa', 'previo', 'regresa', 'atras', 'retrocede'])) {
    return { tipo: 'anterior' };
  }

  return { tipo: 'desconocido' };
}
