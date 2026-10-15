// Genera mobile/assets/contenido.json: copia completa del contenido que viaja
// DENTRO de la app. Con ella el primer arranque funciona aunque no haya
// internet o la base de Supabase esté pausada. Correr antes de cada build:
//   SB_URL=... SB_KEY=<anon> npx tsx tools/datos/snapshot_contenido.ts
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('Faltan SB_URL y/o SB_KEY.');
  process.exit(1);
}

async function tabla(query: string): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
    headers: { apikey: SB_KEY as string, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`${query} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [versiculos, lecciones, preguntas, citasRows] = await Promise.all([
    tabla('versiculos_dia?select=*&order=fecha.asc&limit=2000'),
    tabla('lecciones?select=*&order=fecha.asc&limit=2000'),
    tabla('lecciones_preguntas?select=*&order=leccion_id.asc,orden.asc&limit=5000'),
    tabla('citas_texto?select=cita,texto&limit=5000'),
  ]);
  const citas: Record<string, string> = {};
  for (const r of citasRows) citas[r.cita] = r.texto;

  const salida = { version: 1, generado: new Date().toISOString(), versiculos, lecciones, preguntas, citas };
  const destino = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../mobile/assets/contenido.json'
  );
  writeFileSync(destino, JSON.stringify(salida));
  const conNota = versiculos.filter((v) => v.nota).length;
  console.log(
    `contenido.json: ${versiculos.length} matutinas (${conNota} con nota), ${lecciones.length} lecciones, ` +
      `${preguntas.length} preguntas, ${Object.keys(citas).length} citas`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
