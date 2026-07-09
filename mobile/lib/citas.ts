// Canon de libros (RV1909, orden 1-66) y utilidades puras para entender citas
// bíblicas escritas o HABLADAS ("Juan 3 16", "primera de Corintios 13 4").
// Sin dependencias de expo: lo usan la app y las herramientas por igual.

export const LIBROS = [
  'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut',
  '1 Samuel', '2 Samuel', '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras',
  'Nehemías', 'Ester', 'Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares',
  'Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel',
  'Amós', 'Abdías', 'Jonás', 'Miqueas', 'Nahum', 'Habacuc', 'Sofonías', 'Hageo',
  'Zacarías', 'Malaquías', 'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos', 'Romanos',
  '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses',
  '1 Tesalonicenses', '2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón',
  'Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas',
  'Apocalipsis',
];

// Capítulos por libro (orden canónico 1-66). Sirve para desambiguar números
// pegados que dicta el reconocedor: "Juan 316" -> 316 > 21 capítulos de Juan,
// así que se lee como 3:16.
export const CAPITULOS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8,
  66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16,
  13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

// Quita acentos y baja a minúsculas (sin String.normalize, por Hermes).
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n');
}

// "salmos" -> índice 18, etc.
const LIBRO_POR_NOMBRE = new Map<string, number>(LIBROS.map((n, i) => [normalizar(n), i]));

// Índice (0-65) del libro de una cita "Libro C:V", o -1.
export function indiceDeLibro(nombre: string): number {
  return LIBRO_POR_NOMBRE.get(normalizar(nombre.trim())) ?? -1;
}

// --- Números dichos en palabras ("ciento diecinueve", "setenta y cinco") ---
const N_UNIDAD: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, primero: 1, primera: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21,
  veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const N_DECENA: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};

// Reemplaza números en palabras por dígitos dentro de una frase normalizada:
// "capitulo ciento diecinueve verso ciento setenta y seis" -> "... 119 ... 176".
export function palabrasANumeros(fraseNormalizada: string): string {
  const palabras = fraseNormalizada.split(' ');
  const out: string[] = [];
  let i = 0;
  while (i < palabras.length) {
    const p = palabras[i];
    let valor: number | null = null;
    let usadas = 1;
    if (p === 'cien' || p === 'ciento') {
      valor = 100;
      if (p === 'ciento' && i + 1 < palabras.length) {
        const d = N_DECENA[palabras[i + 1]];
        const u = N_UNIDAD[palabras[i + 1]];
        if (d !== undefined) {
          valor += d;
          usadas = 2;
          if (palabras[i + 2] === 'y' && N_UNIDAD[palabras[i + 3]] !== undefined) {
            valor += N_UNIDAD[palabras[i + 3]];
            usadas = 4;
          }
        } else if (u !== undefined) {
          valor += u;
          usadas = 2;
        }
      }
    } else if (N_DECENA[p] !== undefined) {
      valor = N_DECENA[p];
      if (palabras[i + 1] === 'y' && N_UNIDAD[palabras[i + 2]] !== undefined) {
        valor += N_UNIDAD[palabras[i + 2]];
        usadas = 3;
      }
    } else if (N_UNIDAD[p] !== undefined && p !== 'un' && p !== 'una') {
      // "un"/"una" sueltos casi siempre son artículos, no números.
      valor = N_UNIDAD[p];
    }
    if (valor !== null) {
      out.push(String(valor));
      i += usadas;
    } else {
      out.push(p);
      i += 1;
    }
  }
  return out.join(' ');
}

export type CitaParte = { libro: string; capitulo: number; verso: number | null };

// Descompone "Libro C:V" / "Libro C:V-V2" / "Libro C:V, V2" usando el PRIMER
// verso como ancla. También acepta "Libro C" (capítulo entero).
export function parseCita(cita: string): CitaParte | null {
  const m = cita.trim().match(/^(.+?)\s+(\d+)(?::\s*(\d+))?/);
  if (!m) return null;
  const idx = indiceDeLibro(m[1]);
  if (idx < 0) return null;
  return { libro: LIBROS[idx], capitulo: Number(m[2]), verso: m[3] ? Number(m[3]) : null };
}

// Llave de ancla "libro|cap|verso" para comparar citas entre sí.
export function anclaDeCita(cita: string): string | null {
  const p = parseCita(cita);
  return p ? `${normalizar(p.libro)}|${p.capitulo}|${p.verso ?? 1}` : null;
}

// Encuentra una cita dicha en VOZ dentro de una frase ya normalizada:
//   "juan 3 16" / "juan 3:16" / "juan 3, 16" / "juan 316" (dictado pegado)
//   "juan capitulo 3 versiculo 16" / "juan capitulo tres versiculo dieciseis"
//   "primera de corintios 13 4" -> "1 Corintios 13:4"
// Devuelve la cita canónica "Libro C:V" (o "Libro C" si no dijo verso), o null.
export function citaHablada(fraseNormalizada: string): string | null {
  let t = palabrasANumeros(
    fraseNormalizada
      .replace(/\b(primera|primero|primer)\s+(de\s+)?/g, '1 ')
      .replace(/\b(segunda|segundo)\s+(de\s+)?/g, '2 ')
      .replace(/\b(tercera|tercero)\s+(de\s+)?/g, '3 ')
      .replace(/\bcapitulo\b/g, ' ')
      .replace(/\bvers(?:iculos?|os?)\b/g, ' ')
      .replace(/[:,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  // Busca el nombre de libro más largo presente en la frase.
  let mejor: { idx: number; pos: number; largo: number } | null = null;
  for (let i = 0; i < LIBROS.length; i++) {
    const nombre = normalizar(LIBROS[i]);
    const pos = t.indexOf(nombre);
    if (pos >= 0 && (pos === 0 || t[pos - 1] === ' ')) {
      if (!mejor || nombre.length > mejor.largo) mejor = { idx: i, pos, largo: nombre.length };
    }
  }
  if (!mejor) return null;

  const libro = LIBROS[mejor.idx];
  const maxCap = CAPITULOS[mejor.idx];

  // Números que siguen al nombre del libro: capítulo [verso].
  const resto = t.slice(mejor.pos + mejor.largo);
  const nums = resto.match(/^\s+(\d{1,4})(?:\s+(?:al?\s+)?(\d{1,3}))?/);
  if (!nums) return null;

  const primero = Number(nums[1]);
  // Libros de un solo capítulo (Judas, Filemón, Abdías…): "Judas 24" significa
  // el verso 24 del capítulo 1.
  if (maxCap === 1 && !nums[2] && primero > 1) {
    return `${libro} 1:${primero}`;
  }
  // El dictado a veces pega capítulo y verso ("316"). Si el número excede los
  // capítulos del libro, se parte en capítulo válido + verso. Se prefiere el
  // corte con verso chico (los versos >40 son raros y >99 solo Salmos 119).
  if (!nums[2] && primero > maxCap && nums[1].length >= 2) {
    const maxVerso = libro === 'Salmos' ? 176 : 99;
    const bajas: string[] = [];
    const medias: string[] = [];
    const raras: string[] = [];
    for (const corte of [1, 2]) {
      if (nums[1].length - corte < 1) continue;
      const cap = Number(nums[1].slice(0, corte));
      const ver = Number(nums[1].slice(corte));
      if (cap < 1 || cap > maxCap || ver < 1) continue;
      const cita = `${libro} ${cap}:${ver}`;
      if (ver <= 40) bajas.push(cita);
      else if (ver <= 99) medias.push(cita);
      else if (ver <= maxVerso) raras.push(cita);
    }
    return bajas[0] ?? medias[0] ?? raras[0] ?? null;
  }
  if (primero < 1 || primero > maxCap) return null;
  return nums[2] ? `${libro} ${primero}:${Number(nums[2])}` : `${libro} ${primero}`;
}
