// Generador de audio de la narración (corre UNA vez, fuera de la app).
// Reutiliza la MISMA segmentación que la app (mobile/lib/segmentos.ts) para que
// el hash SHA-1 de cada texto hablado coincida con el que calcula la app.
//
// Uso:
//   SB_URL=... SB_KEY=<anon> npx tsx tools/gen-audio/generar.ts
//   (opcional) LIMIT=3 para una prueba, CONC=8 para concurrencia.
//
// Salida: tools/gen-audio/out/v1/<sha1>.mp3
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { segmentosLeccion, segmentosMatutina } from '../../mobile/lib/segmentos';

const execFileP = promisify(execFile);

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;
const VOICE = 'es-MX-JorgeNeural';
const CONC = Number(process.env.CONC ?? 8);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

const OUTDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'v1');

if (!SB_URL || !SB_KEY) {
  console.error('Faltan SB_URL y/o SB_KEY en el entorno.');
  process.exit(1);
}

async function tabla(query: string): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
    headers: { apikey: SB_KEY as string, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`${query} -> HTTP ${res.status}`);
  return res.json();
}

function sha1(texto: string): string {
  return createHash('sha1').update(texto, 'utf8').digest('hex');
}

async function main() {
  console.log('Descargando contenido…');
  const [versiculos, lecciones, preguntas, citasRows] = await Promise.all([
    tabla('versiculos_dia?select=fecha,cita,texto&limit=2000'),
    tabla('lecciones?select=id,numero,fecha,titulo,versiculo_central_cita,versiculo_central_texto,introduccion&limit=2000'),
    tabla('lecciones_preguntas?select=leccion_id,orden,pregunta,citas,nota&limit=2000'),
    tabla('citas_texto?select=cita,texto&limit=2000'),
  ]);
  const citas: Record<string, string> = {};
  for (const r of citasRows) citas[r.cita] = r.texto;

  // Reúne todos los textos hablados ÚNICOS (dedup).
  const textos = new Set<string>();
  const add = (segs: string[]) => {
    for (const s of segs) {
      const t = s.trim();
      if (t) textos.add(t);
    }
  };
  for (const v of versiculos) add(segmentosMatutina(v as any));
  for (const l of lecciones) {
    const ps = preguntas
      .filter((p) => p.leccion_id === (l as any).id)
      .sort((a, b) => a.orden - b.orden);
    add(segmentosLeccion(l as any, ps as any, citas));
  }

  // Frases del Modo por voz (deben coincidir EXACTO con las de la app para que
  // el hash calce): anuncios de matutina/lección y avisos fijos del asistente.
  const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  for (const v of versiculos) {
    const f = (v as any).fecha as string; // 'YYYY-MM-DD'
    const dia = Number(f.slice(8, 10));
    const mes = MESES[Number(f.slice(5, 7)) - 1];
    add([`Matutina del ${dia} de ${mes}.`]);
  }
  for (const l of lecciones) {
    add([`Lección ${(l as any).numero}. ${(l as any).titulo}.`]);
  }
  add([
    'Puedes decir: matutina de hoy. Lección 3. La pregunta 2 de la lección 3. ' +
      'Busca el versículo que dice, de tal manera amó Dios al mundo. Dónde se cita Juan 3 16. ' +
      'Versículos relacionados con el versículo central de la lección 2. Preguntas similares. ' +
      'Siguiente. Anterior. Pausar.',
    'Es la primera pregunta.',
    'No te entendí. Di ayuda para escuchar los comandos.',
    'Primero pide una matutina o una lección.',
    'Abriendo Inicio.',
    'Abriendo Calendario.',
    'Abriendo Estudio.',
    'No hay más resultados.',
    'Es el primer resultado.',
    'Es la primera lección.',
    'No pude cargar la lección. Conéctate a internet una vez.',
    'Los datos de búsqueda aún no se descargan. Conéctate a internet una vez y vuelve a intentar.',
    'No encontré la lección de esta semana.',
    'Te escucho. Di lo que quieres escuchar, o di ayuda.',
    'Dime qué cita busco. Por ejemplo: dónde se cita Juan 3 16.',
    'Dime de qué versículo. Por ejemplo: versículos relacionados a Juan 3 16.',
    'Primero abre una lección, y luego te busco preguntas similares.',
  ]);

  const items = [...textos].map((texto) => ({ texto, hash: sha1(texto) }));
  mkdirSync(OUTDIR, { recursive: true });
  const pendientes = items
    .filter((it) => !existsSync(path.join(OUTDIR, `${it.hash}.mp3`)))
    .slice(0, LIMIT);

  console.log(
    `Filas: v=${versiculos.length} l=${lecciones.length} p=${preguntas.length} c=${citasRows.length}`
  );
  console.log(`Textos únicos: ${items.length} · por generar: ${pendientes.length} · voz: ${VOICE}`);

  let i = 0;
  let ok = 0;
  let fail = 0;
  async function worker() {
    while (i < pendientes.length) {
      const it = pendientes[i++];
      const out = path.join(OUTDIR, `${it.hash}.mp3`);
      try {
        await execFileP(
          'python3',
          ['-m', 'edge_tts', '--voice', VOICE, '--text', it.texto, '--write-media', out],
          { maxBuffer: 16 * 1024 * 1024 }
        );
        ok++;
      } catch (e) {
        fail++;
        console.error('FALLO', it.hash, String((e as Error).message).slice(0, 90));
      }
      if ((ok + fail) % 50 === 0) console.log(`  progreso ${ok + fail}/${pendientes.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`Listo. generados=${ok} fallos=${fail} · total únicos=${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
