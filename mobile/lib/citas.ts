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
//   "juan 3 16" / "juan 3:16" / "juan capitulo 3 versiculo 16"
//   "primera de corintios 13 4" -> "1 Corintios 13:4"
// Devuelve la cita canónica "Libro C:V" (o "Libro C" si no dijo verso), o null.
export function citaHablada(fraseNormalizada: string): string | null {
  let t = fraseNormalizada
    .replace(/\b(primera|primero|primer)\s+(de\s+)?/g, '1 ')
    .replace(/\b(segunda|segundo)\s+(de\s+)?/g, '2 ')
    .replace(/\b(tercera|tercero)\s+(de\s+)?/g, '3 ')
    .replace(/\bcapitulo\b/g, ' ')
    .replace(/\bversiculos?\b/g, ' ')
    .replace(/:/g, ' ')
    .replace(/\s+/g, ' ');

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

  // Números que siguen al nombre del libro: capítulo [verso].
  const resto = t.slice(mejor.pos + mejor.largo);
  const nums = resto.match(/^\s+(\d{1,3})(?:\s+(?:al?\s+)?(\d{1,3}))?/);
  if (!nums) return null;
  const libro = LIBROS[mejor.idx];
  return nums[2] ? `${libro} ${nums[1]}:${nums[2]}` : `${libro} ${nums[1]}`;
}
