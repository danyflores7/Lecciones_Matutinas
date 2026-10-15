// Verifica que la versión de la app sea la MISMA en mobile/app.json (lo que
// usa Expo) y en mobile/android/app/build.gradle (lo que compila Gradle para
// la Play Store). Si no coinciden, la tienda recibe un versionCode distinto
// del que se cree publicar (o rechaza la subida por versionCode repetido).
//
// Uso (desde la raíz del repo o desde mobile/):
//   npx tsx tools/calidad/verificar_version.ts          (o: cd mobile && npm run verificar-version)
//   npx tsx tools/calidad/verificar_version.ts --gradle otra/ruta/build.gradle
//
// mobile/android/ la genera `npx expo prebuild` y NO está en git; si no existe
// (p. ej. en GitHub Actions) solo se valida app.json y se avisa. Con
// --estricto, que falte build.gradle también es error.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_JSON = path.join(RAIZ, 'mobile', 'app.json');

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const GRADLE = path.resolve(argumento('--gradle') ?? path.join(RAIZ, 'mobile', 'android', 'app', 'build.gradle'));
const ESTRICTO = process.argv.includes('--estricto');
// Ruta relativa a la raíz del repo (o absoluta si está fuera).
const rel = (p: string) => {
  const r = path.relative(RAIZ, p);
  return r && !r.startsWith('..') ? r : p;
};

const errores: string[] = [];

// --- app.json ---
const app = JSON.parse(readFileSync(APP_JSON, 'utf8'));
const version: unknown = app?.expo?.version;
const versionCode: unknown = app?.expo?.android?.versionCode;

if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  errores.push(`app.json: expo.version debe ser "X.Y.Z" y es ${JSON.stringify(version)}`);
}
if (!Number.isInteger(versionCode) || (versionCode as number) < 1) {
  errores.push(`app.json: expo.android.versionCode debe ser un entero >= 1 y es ${JSON.stringify(versionCode)}`);
}
console.log(`${rel(APP_JSON)}: version ${version} · versionCode ${versionCode}`);

// --- build.gradle ---
if (!existsSync(GRADLE)) {
  const aviso = `No existe ${rel(GRADLE)} (mobile/android/ se genera con "npx expo prebuild" y no está en git).`;
  if (ESTRICTO) errores.push(aviso);
  else console.log(`AVISO: ${aviso} Solo se validó app.json.`);
} else {
  const gradle = readFileSync(GRADLE, 'utf8');
  // Solo el bloque defaultConfig { ... } (los sabores podrían tener otros valores).
  const inicio = gradle.search(/defaultConfig\s*\{/);
  const bloque = inicio >= 0 ? gradle.slice(inicio, gradle.indexOf('}', inicio)) : gradle;
  const gCode = bloque.match(/\bversionCode\s+(\d+)/)?.[1];
  const gName = bloque.match(/\bversionName\s+["']([^"']+)["']/)?.[1];
  console.log(`${rel(GRADLE)}: versionName ${gName ?? '(no encontrado)'} · versionCode ${gCode ?? '(no encontrado)'}`);

  if (gName === undefined || gCode === undefined) {
    errores.push(`${rel(GRADLE)}: no se encontró versionName y/o versionCode en defaultConfig.`);
  } else {
    if (gName !== version) {
      errores.push(`versionName de Gradle (${gName}) no coincide con expo.version de app.json (${version}).`);
    }
    if (Number(gCode) !== versionCode) {
      errores.push(`versionCode de Gradle (${gCode}) no coincide con expo.android.versionCode de app.json (${versionCode}).`);
    }
  }
}

if (errores.length) {
  console.error('\nVERSIÓN INCONSISTENTE:');
  for (const e of errores) console.error(`  - ${e}`);
  if (errores.some((e) => e.includes('no coincide'))) {
    console.error(
      '\nCorrige los dos archivos para que digan lo mismo (al subir de versión: version y versionCode ' +
        'en app.json, versionName y versionCode en android/app/build.gradle).'
    );
  }
  process.exit(1);
}
console.log('OK: la versión es consistente.');
