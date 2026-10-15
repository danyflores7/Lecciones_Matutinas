// Complejidad ciclomática (McCabe) de las funciones de la app, sin
// dependencias nuevas: usa el compilador de TypeScript que ya instala mobile/.
//
// Uso (desde la raíz del repo o desde mobile/):
//   npx tsx tools/calidad/complejidad.ts          (o: cd mobile && npm run complejidad)
//   npx tsx tools/calidad/complejidad.ts --top 30
//
// Complejidad de una función = 1 + sus puntos de decisión: if, ?:, &&, ||, ??
// (y &&=, ||=, ??=), cada `case`, for / for-in / for-of / while / do, catch.
// Las funciones anidadas (callbacks, handlers) se cuentan aparte, no suman a
// la que las contiene. Las decisiones fuera de toda función se reportan como
// "(nivel de módulo)". Es un reporte informativo: siempre termina con código 0.
//
// Guía usual (SEI): 1-10 simple · 11-20 moderada · 21-50 alta · >50 muy alta.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as tipos from '../../mobile/node_modules/typescript';

type TS = typeof tipos;

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOBILE = path.join(RAIZ, 'mobile');
const CARPETAS = ['app', 'lib', 'components'];

// typescript vive en mobile/node_modules (no hay package.json en la raíz).
const ts: TS = createRequire(path.join(MOBILE, 'package.json'))('typescript');

type Funcion = { nombre: string; archivo: string; linea: number; complejidad: number };

function archivosFuente(dir: string): string[] {
  const out: string[] = [];
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // la carpeta no existe
  }
  for (const e of entradas) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivosFuente(ruta));
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(ruta);
  }
  return out.sort();
}

const esFuncion = (n: tipos.Node) =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isConstructorDeclaration(n) ||
  ts.isGetAccessorDeclaration(n) ||
  ts.isSetAccessorDeclaration(n);

const OPERADORES_DECISION = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

// ¿Este nodo es un punto de decisión?
function esDecision(n: tipos.Node): boolean {
  switch (n.kind) {
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ConditionalExpression:
    case ts.SyntaxKind.CaseClause:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.CatchClause:
      return true;
    case ts.SyntaxKind.BinaryExpression:
      return OPERADORES_DECISION.has((n as tipos.BinaryExpression).operatorToken.kind);
    default:
      return false;
  }
}

function textoNombre(n: tipos.Node | undefined, sf: tipos.SourceFile): string | null {
  if (!n) return null;
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return n.getText(sf);
}

// Nombre legible de una función: el suyo, el de la variable/propiedad que la
// recibe, o "callback de foo(...)" si es un argumento.
function nombreDe(fn: tipos.Node, sf: tipos.SourceFile): string {
  const f = fn as tipos.FunctionLikeDeclaration;
  if (f.name) return textoNombre(f.name, sf) ?? '(anónima)';
  if (ts.isConstructorDeclaration(fn)) return 'constructor';
  const p = fn.parent;
  if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) {
    return textoNombre(p.name, sf) ?? '(anónima)';
  }
  if (ts.isCallExpression(p)) {
    const llamada = p.expression.getText(sf).replace(/\s+/g, '');
    return `callback de ${llamada.length > 40 ? llamada.slice(0, 37) + '...' : llamada}()`;
  }
  if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent)) return `${p.parent.name.getText(sf)}={...}`;
  if (ts.isExportAssignment(p)) return 'export default';
  return '(anónima)';
}

function analizar(archivo: string): Funcion[] {
  const texto = readFileSync(archivo, 'utf8');
  const kind = archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(archivo, texto, ts.ScriptTarget.Latest, true, kind);
  const relativo = path.relative(RAIZ, archivo).split(path.sep).join('/');
  const funciones: Funcion[] = [];
  const modulo: Funcion = { nombre: '(nivel de módulo)', archivo: relativo, linea: 1, complejidad: 1 };

  // Recorre el árbol; `actual` es la función que acumula las decisiones.
  const visitar = (n: tipos.Node, actual: Funcion, ruta: string[]) => {
    if (esFuncion(n)) {
      const nombre = nombreDe(n, sf);
      const nueva: Funcion = {
        nombre: [...ruta, nombre].join(' › '),
        archivo: relativo,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        complejidad: 1,
      };
      funciones.push(nueva);
      ts.forEachChild(n, (h) => visitar(h, nueva, [...ruta, nombre]));
      return;
    }
    if (esDecision(n)) actual.complejidad++;
    ts.forEachChild(n, (h) => visitar(h, actual, ruta));
  };
  ts.forEachChild(sf, (h) => visitar(h, modulo, []));
  if (modulo.complejidad > 1) funciones.push(modulo);
  return funciones;
}

function main() {
  const i = process.argv.indexOf('--top');
  const top = i >= 0 ? Number(process.argv[i + 1]) || 15 : 15;

  const archivos = CARPETAS.flatMap((c) => archivosFuente(path.join(MOBILE, c)));
  const funciones = archivos.flatMap(analizar);
  if (!funciones.length) {
    console.log('No se encontraron funciones en mobile/{app,lib,components}.');
    return;
  }

  const ordenadas = [...funciones].sort((a, b) => b.complejidad - a.complejidad || a.archivo.localeCompare(b.archivo));
  const ancho = Math.max(...ordenadas.slice(0, top).map((f) => f.nombre.length), 7);

  console.log(`Complejidad ciclomática (McCabe) · ${archivos.length} archivos · ${funciones.length} funciones\n`);
  console.log(`TOP ${top} FUNCIONES MÁS COMPLEJAS`);
  console.log(`  #   CC  ${'función'.padEnd(ancho)}  archivo:línea`);
  ordenadas.slice(0, top).forEach((f, k) => {
    console.log(
      `  ${String(k + 1).padStart(2)}  ${String(f.complejidad).padStart(3)}  ${f.nombre.padEnd(ancho)}  ${f.archivo}:${f.linea}`
    );
  });

  // Totales por archivo: suma de la complejidad de sus funciones.
  const porArchivo = new Map<string, { total: number; n: number; max: number }>();
  for (const f of funciones) {
    const e = porArchivo.get(f.archivo) ?? { total: 0, n: 0, max: 0 };
    e.total += f.complejidad;
    e.n++;
    e.max = Math.max(e.max, f.complejidad);
    porArchivo.set(f.archivo, e);
  }
  const filas = [...porArchivo.entries()].sort((a, b) => b[1].total - a[1].total);
  const anchoArch = Math.max(...filas.map(([a]) => a.length));
  console.log('\nTOTAL POR ARCHIVO (suma de CC de sus funciones)');
  console.log(`  ${'archivo'.padEnd(anchoArch)}  total  funciones  máx`);
  for (const [a, e] of filas) {
    console.log(`  ${a.padEnd(anchoArch)}  ${String(e.total).padStart(5)}  ${String(e.n).padStart(9)}  ${String(e.max).padStart(3)}`);
  }

  const total = funciones.reduce((s, f) => s + f.complejidad, 0);
  const rango = (min: number, max: number) => funciones.filter((f) => f.complejidad >= min && f.complejidad <= max).length;
  console.log('\nRESUMEN');
  console.log(`  CC total ${total} · promedio por función ${(total / funciones.length).toFixed(2)}`);
  console.log(
    `  1-10 simple: ${rango(1, 10)} · 11-20 moderada: ${rango(11, 20)} · 21-50 alta: ${rango(21, 50)} · >50 muy alta: ${rango(51, Infinity)}`
  );
}

main();
