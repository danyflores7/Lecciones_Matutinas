// Prepara desktop/recursos/ con todo lo que lleva el programa:
//   web/    la app exportada como web (expo export -p web)
//   audio/  los mp3 de la voz de Jorge  (del branch `audio` de git)
//   datos/  Biblia completa y datos de búsqueda (del branch `audio`)
// Uso: node scripts/preparar.mjs   (desde desktop/)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.join(AQUI, '..');
const RAIZ = path.join(DESKTOP, '..');
const RECURSOS = path.join(DESKTOP, 'recursos');
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

rmSync(RECURSOS, { recursive: true, force: true });
mkdirSync(RECURSOS, { recursive: true });

console.log('1/3 Exportando la app como web…');
const WEB = path.join(RECURSOS, 'web');
sh('npx', ['expo', 'export', '-p', 'web', '--output-dir', WEB], {
  cwd: path.join(RAIZ, 'mobile'),
  shell: process.platform === 'win32',
});

// Expo guarda los iconos y fuentes en web/assets/node_modules/…; muchas
// herramientas (empaquetadores, tar, antivirus) descartan carpetas con ese
// nombre y la app se quedaría sin iconos. Se renombra y se corrige el código.
const nm = path.join(WEB, 'assets', 'node_modules');
if (existsSync(nm)) {
  renameSync(nm, path.join(WEB, 'assets', 'modulos'));
  const arreglar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) arreglar(f);
      else if (/\.(js|html|json|css)$/.test(e.name)) {
        const t = readFileSync(f, 'utf8');
        if (t.includes('assets/node_modules/')) writeFileSync(f, t.replaceAll('assets/node_modules/', 'assets/modulos/'));
      }
    }
  };
  arreglar(WEB);
}

console.log('2/3 Trayendo audio y datos del branch audio…');
// Se actualiza la referencia si hay red; si no, se usa la que ya hay.
try { sh('git', ['fetch', '-q', 'origin', 'audio'], { cwd: RAIZ }); } catch { /* sin red */ }
const ref = ['origin/audio', 'audio'].find((r) => {
  try { execFileSync('git', ['rev-parse', '--verify', '-q', r], { cwd: RAIZ, stdio: 'ignore' }); return true; } catch { return false; }
});
if (!ref) throw new Error('No encuentro el branch "audio" de git (git fetch origin audio).');
const tar = path.join(RECURSOS, '_audio.tar');
sh('git', ['archive', '--format=tar', '-o', tar, ref, 'v1', 'datos'], { cwd: RAIZ });
sh('tar', ['-xf', tar, '-C', RECURSOS]);
rmSync(tar);
// El branch guarda audio/v1 como "v1" y datos como "datos/v1": se ordena.
mkdirSync(path.join(RECURSOS, 'audio'), { recursive: true });
cpSync(path.join(RECURSOS, 'v1'), path.join(RECURSOS, 'audio', 'v1'), { recursive: true });
rmSync(path.join(RECURSOS, 'v1'), { recursive: true });

console.log('3/3 Verificando…');
const mp3 = readdirSync(path.join(RECURSOS, 'audio', 'v1')).filter((f) => f.endsWith('.mp3')).length;
const faltan = ['web/index.html', 'datos/v1/biblia.json', 'web/assets/modulos'].filter((f) => !existsSync(path.join(RECURSOS, f)));
if (faltan.length || mp3 < 2000) throw new Error(`Recursos incompletos: faltan ${faltan.join(', ')} · mp3=${mp3}`);
console.log(`Listo: ${mp3} audios, Biblia y app web en desktop/recursos/`);
