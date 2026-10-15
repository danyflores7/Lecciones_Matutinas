// Revisa los DATOS que viajan dentro de la app (assets/contenido.json): cada
// cita debe ser reconocible (libro completo, capítulo y versículo que existen).
// Así una cita capturada como "Heb. 15:24" se detecta antes de publicar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { CAPITULOS, indiceDeLibro, parseCita } from '../lib/citas';

const contenido = JSON.parse(
  readFileSync(new URL('../assets/contenido.json', import.meta.url), 'utf8')
) as {
  versiculos: { fecha: string; cita: string; texto: string | null }[];
  lecciones: { id: number; numero: number; versiculo_central_cita: string }[];
  preguntas: { leccion_id: number; orden: number; citas: string[] | null }[];
  citas: Record<string, string>;
};

const numeroDe = new Map(contenido.lecciones.map((l) => [l.id, l.numero]));
const donde = (p: { leccion_id: number; orden: number }) =>
  `lección ${numeroDe.get(p.leccion_id) ?? '?'} pregunta ${p.orden}`;

// "Libro C:V; Libro C:V" -> cada parte por separado.
const partes = (cita: string) => cita.split(';').map((c) => c.trim()).filter(Boolean);

function problemas(cita: string): string[] {
  const out: string[] = [];
  for (const parte of partes(cita)) {
    const p = parseCita(parte);
    if (!p) {
      out.push(`${parte}: libro no reconocido (¿abreviado?)`);
      continue;
    }
    const max = CAPITULOS[indiceDeLibro(p.libro)];
    if (p.capitulo < 1 || p.capitulo > max) out.push(`${parte}: ${p.libro} solo tiene ${max} capítulos`);
  }
  return out;
}

describe('RF-08 · Contenido incluido: citas reconocibles', () => {
  test('RF-08 · citas de las preguntas de las lecciones', () => {
    const malas = contenido.preguntas.flatMap((p) =>
      (p.citas ?? []).flatMap((c) => problemas(c).map((m) => `${donde(p)} · ${m}`))
    );
    assert.deepEqual(malas, []);
  });

  test('RF-08 · versículos centrales de las lecciones', () => {
    const malas = contenido.lecciones.flatMap((l) =>
      problemas(l.versiculo_central_cita).map((m) => `lección ${l.numero} · ${m}`)
    );
    assert.deepEqual(malas, []);
  });

  test('RF-01 · citas de las matutinas', () => {
    const malas = contenido.versiculos.flatMap((v) => problemas(v.cita).map((m) => `${v.fecha} · ${m}`));
    assert.deepEqual(malas, []);
  });

  test('RF-05 · toda cita de una pregunta tiene su texto', () => {
    const sinTexto = contenido.preguntas.flatMap((p) =>
      (p.citas ?? []).filter((c) => !contenido.citas[c]).map((c) => `${donde(p)} · ${c}`)
    );
    assert.deepEqual(sinTexto, []);
  });
});
