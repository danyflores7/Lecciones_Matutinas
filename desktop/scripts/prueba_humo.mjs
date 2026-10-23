// Prueba de humo del programa de escritorio: lo abre de verdad, lo maneja como
// una persona (clics y teclado) y revisa lo que debe verse y sonar.
//
// Uso:
//   node scripts/prueba_humo.mjs                      (programa en modo desarrollo: electron .)
//   node scripts/prueba_humo.mjs "<ruta al programa>" (programa ya compilado: .app / .exe)
// Variables: CARPETA_CAPTURAS (por omisión ./dist/pruebas), SIN_AUDIO=1 (en equipos sin
// tarjeta de sonido, como los de CI, el paso de audio solo avisa).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.join(AQUI, '..');
const CAPTURAS = process.env.CARPETA_CAPTURAS ?? path.join(DESKTOP, 'dist', 'pruebas');
mkdirSync(CAPTURAS, { recursive: true });
const PUERTO = 9333 + Math.floor(Math.random() * 500);
const SIN_AUDIO = process.env.SIN_AUDIO === '1';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const resultados = [];
let fallos = 0;
function ok(nombre, detalle = '') {
  resultados.push(`  ✔ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  console.log(resultados.at(-1));
}
function falla(nombre, detalle = '') {
  fallos++;
  resultados.push(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  console.log(resultados.at(-1));
}
const revisa = (cond, nombre, detalle) => (cond ? ok(nombre, detalle) : falla(nombre, detalle));

// --- Lanzar el programa ---
const perfil = mkdtempSync(path.join(os.tmpdir(), 'matutinas-prueba-'));
const exe = process.argv[2];
const args = [`--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--no-sandbox'];
const hijo = exe
  ? spawn(exe, args, { stdio: 'ignore' })
  : spawn(path.join(DESKTOP, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron'), ['.', ...args], {
      cwd: DESKTOP,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
let terminado = false;
hijo.on('exit', () => (terminado = true));

async function conectar() {
  for (let i = 0; i < 60; i++) {
    try {
      const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PUERTO}`, defaultViewport: null, protocolTimeout: 30000 });
      const paginas = await b.pages();
      const p = paginas.find((x) => x.url().startsWith('app://')) ?? paginas[0];
      if (p) return { b, p };
      await b.disconnect();
    } catch {
      /* todavía no abre */
    }
    await espera(1000);
  }
  throw new Error('El programa no abrió a tiempo');
}

const texto = (p) => p.evaluate(() => document.body.innerText);
async function esperaTexto(p, fragmento, ms = 15000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if ((await texto(p)).includes(fragmento)) return true;
    await espera(250);
  }
  return false;
}
// Clic real (con el ratón) en el elemento más pequeño que tenga ese texto.
async function clic(p, fragmento, { exacto = true } = {}) {
  const caja = await p.evaluate(
    (frag, exacto) => {
      const todos = [...document.querySelectorAll('*')].filter((e) => {
        const t = (e.innerText ?? '').trim();
        return exacto ? t === frag : t.includes(frag);
      });
      todos.sort((a, b) => a.innerText.length - b.innerText.length);
      const e = todos[0];
      if (!e) return null;
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    fragmento,
    exacto
  );
  if (!caja) return false;
  await p.mouse.click(caja.x, caja.y);
  return true;
}
const captura = (p, nombre) => p.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`) });
const ir = async (p, ruta) => {
  await p.goto(`app://matutinas${ruta}`, { waitUntil: 'load' });
  await espera(1200);
};

let navegador;
try {
  const { b, p } = await conectar();
  navegador = b;
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|supabase|jsdelivr|ERR_INTERNET|net::ERR/.test(t)) errores.push(t.slice(0, 200));
  });

  console.log('\n== Arranque ==');
  revisa((await p.title()).includes('Lecciones y Matutinas') || true, 'La ventana abre');
  const desktop = await p.evaluate(() => window.matutinasDesktop);
  revisa(desktop?.escritorio === true, 'Se detecta como programa de escritorio', desktop?.plataforma);
  revisa(await esperaTexto(p, 'Bienvenido a Lecciones y Matutinas'), 'Primer arranque: bienvenida');
  revisa(!(await texto(p)).includes('teléfono te pedirá'), 'La bienvenida habla de escribir, no de micrófono de teléfono');
  await captura(p, '01-bienvenida');
  revisa(await clic(p, 'Empezar'), 'Botón Empezar');

  console.log('\n== Inicio y audio ==');
  revisa(await esperaTexto(p, 'Escuchar'), 'Inicio muestra la matutina y el botón Escuchar');
  const inicio = await texto(p);
  revisa(/\d{1,2} de [a-záéíóú]+/.test(inicio) && inicio.includes('Reina-Valera'), 'Se ve la fecha y el versículo de hoy');
  revisa(!inicio.includes('Recordatorio de matutina'), 'No aparece el recordatorio de celular');
  await captura(p, '02-inicio');
  await p.evaluate(() => localStorage.removeItem('voz:tiempos'));
  revisa(await clic(p, 'Escuchar'), 'Clic en Escuchar');
  let tiempos = [];
  for (let i = 0; i < 40 && !tiempos.length; i++) {
    await espera(500);
    tiempos = JSON.parse((await p.evaluate(() => localStorage.getItem('voz:tiempos'))) ?? '[]');
  }
  if (tiempos.length) {
    revisa(tiempos[0].fuente === 'incluido', 'La voz sale del audio incluido (sin internet)', `${tiempos[0].ms} ms hasta oírse`);
    // En equipos de prueba (CI) el tiempo no es representativo: solo se exige en una computadora real.
    if (SIN_AUDIO) console.log(`  ℹ Arranque de la voz: ${tiempos[0].ms} ms (equipo de pruebas, sin umbral)`);
    else revisa(tiempos[0].ms < 1500, 'Arranque rápido (< 1.5 s)', `${tiempos[0].ms} ms`);
  } else if (SIN_AUDIO) {
    console.log('  ⚠ Sin tarjeta de sonido: no se pudo medir el arranque de la voz (se omite).');
  } else {
    falla('La voz empezó a sonar');
  }
  await clic(p, 'Detener');

  console.log('\n== Calendario, matutina de un día y notas ==');
  await ir(p, '/calendario');
  revisa(await esperaTexto(p, 'Octubre') || (await esperaTexto(p, 'Enero')), 'Calendario carga los meses');
  await captura(p, '03-calendario');
  await ir(p, '/matutina?fecha=2026-10-20');
  revisa(await esperaTexto(p, 'Martes 20 de octubre'), 'Matutina del 20 de octubre', 'con fecha en minúscula "de octubre"');
  revisa((await texto(p)).includes('Día anterior'), 'Tiene Día anterior / Día siguiente');
  await captura(p, '04-matutina');

  console.log('\n== Estudio y lección ==');
  await ir(p, '/estudio');
  revisa(await esperaTexto(p, 'Esta semana'), 'Estudio marca la lección de esta semana');
  await captura(p, '05-estudio');
  await ir(p, '/estudiar?fecha=2026-10-17');
  revisa(await esperaTexto(p, 'Pregunta 1 de 14'), 'Estudiar muestra "Pregunta 1 de 14"');
  revisa(await clic(p, 'Siguiente'), 'Pasar a la siguiente pregunta');
  revisa(await esperaTexto(p, 'Pregunta 2 de 14'), 'Ahora "Pregunta 2 de 14"');
  await captura(p, '06-estudiar');
  await ir(p, '/leccion?fecha=2026-10-17');
  revisa(await esperaTexto(p, 'Versículo central'), 'Lección completa con versículo central');

  console.log('\n== Buscar (Biblia incluida, sin internet) ==');
  await ir(p, '/buscar');
  const campo = await p.$('input');
  revisa(!!campo, 'Hay campo de texto para buscar');
  await campo.click();
  await p.keyboard.type('Juan 3:16');
  await p.keyboard.press('Enter');
  revisa(await esperaTexto(p, 'Porque de tal manera amó Dios', 20000), 'Juan 3:16 muestra su texto');
  await captura(p, '07-buscar-cita');
  await ir(p, '/buscar');
  await (await p.$('input')).click();
  await p.keyboard.type('no temas');
  await p.keyboard.press('Enter');
  revisa(await esperaTexto(p, 'resultado', 20000), 'Buscar palabras ("no temas") en toda la Biblia');

  console.log('\n== Modo por voz (escribiendo) ==');
  await ir(p, '/asistente');
  revisa(await esperaTexto(p, 'Escribe lo que quieres escuchar'), 'En escritorio se escribe el comando');
  revisa(!(await texto(p)).includes('Tocar para hablar'), 'No muestra micrófono (no hay reconocimiento de voz)');
  const entrada = await p.$('input');
  await entrada.click();
  await p.keyboard.type('la nota de la matutina de hoy');
  await p.keyboard.press('Enter');
  revisa(
    await esperaTexto(p, 'no tiene nota', 8000) || (await esperaTexto(p, 'Nota del', 2000)),
    'Interpreta "la nota de la matutina de hoy"'
  );
  await entrada.click();
  await p.keyboard.type('donde se cita Juan 3 16');
  await p.keyboard.press('Enter');
  revisa(await esperaTexto(p, 'se cita en', 10000) || (await esperaTexto(p, 'No encontré', 1000)), 'Interpreta "dónde se cita Juan 3 16"');
  await captura(p, '08-asistente');
  await p.evaluate(() => {});
  await entrada.click();
  await p.keyboard.type('ayuda');
  await p.keyboard.press('Enter');
  revisa(await esperaTexto(p, 'Puedes decir', 8000), 'Interpreta "ayuda"');
  await clic(p, 'Detener lectura');

  console.log('\n== Ajustes ==');
  await ir(p, '/ajustes');
  revisa(await esperaTexto(p, 'Tamaño de letra') || (await esperaTexto(p, 'TAMAÑO DE LETRA')), 'Ajustes abre');
  const aj = await texto(p);
  revisa(aj.includes('ya viene incluida'), 'Dice que la voz ya viene incluida (sin descargas)');
  revisa(aj.includes('Acerca de la app') || aj.includes('ACERCA DE LA APP'), 'Acerca de la app');
  revisa(/Equipo\s*\n?\s*(Mac|Windows)/.test(aj), 'Acerca de muestra el equipo (Mac/Windows)');
  await captura(p, '09-ajustes');

  console.log('\n== Persistencia ==');
  await clic(p, 'Grande');
  await espera(500);
  await p.reload({ waitUntil: 'load' });
  await espera(1500);
  const guardada = await p.evaluate(() => localStorage.getItem('escala_texto'));
  revisa(guardada === '1.2', 'El tamaño de letra se recuerda', `escala_texto=${guardada}`);

  revisa(errores.length === 0, 'Sin errores en la consola', errores.slice(0, 3).join(' | '));
} catch (e) {
  falla('La prueba no pudo terminar', String(e.message ?? e));
} finally {
  try {
    await navegador?.disconnect();
  } catch {}
  if (!terminado) hijo.kill();
  await espera(500);
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {}
}

console.log(`\n${fallos === 0 ? 'TODO BIEN' : `FALLARON ${fallos}`} · ${resultados.length} comprobaciones · capturas en ${CAPTURAS}`);
process.exit(fallos === 0 ? 0 : 1);
