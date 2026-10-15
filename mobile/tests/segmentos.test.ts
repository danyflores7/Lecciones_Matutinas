// Pruebas de la segmentación de la narración (lib/segmentos.ts).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';

import {
  citaParaVoz,
  segmentosDePregunta,
  segmentosLeccion,
  segmentosMatutina,
} from '../lib/segmentos';
import type { Leccion, Pregunta } from '../lib/supabase';

// Mismo hash que usan la app (lib/audio.ts, hashHablado) y el generador
// (tools/gen-audio/generar.ts): SHA-1 del texto hablado sin espacios extremos.
const sha1 = (texto: string) => createHash('sha1').update(texto.trim(), 'utf8').digest('hex');

// Pregunta de ejemplo con los campos mínimos que usa la segmentación.
const pregunta = (p: Pick<Pregunta, 'pregunta' | 'citas' | 'nota'> & { orden?: number }) =>
  ({ id: 1, leccion_id: 1, orden: 1, ...p }) as Pregunta;

describe('RF-09 · Audio: cita en forma hablada', () => {
  test('RF-09 · citaParaVoz: verso, rango ("al") y lista ("y")', () => {
    assert.equal(citaParaVoz('Hechos 4:19'), 'Hechos capítulo 4, versículo 19');
    assert.equal(citaParaVoz('Santiago 2:14-17'), 'Santiago capítulo 2, versículos 14 al 17');
    assert.equal(citaParaVoz('Romanos 5:1, 2'), 'Romanos capítulo 5, versículos 1 y 2');
    assert.equal(citaParaVoz('1 Juan 4:7, 8, 11'), '1 Juan capítulo 4, versículos 7, 8 y 11');
  });

  test('RF-09 · citaParaVoz no deja "C:V" que el lector confunda con una hora', () => {
    for (const cita of ['Juan 3:16', 'Salmos 119:105', 'Mateo 5:3-12', 'Lucas 24:46, 47']) {
      assert.doesNotMatch(citaParaVoz(cita), /\d:\d/, cita);
    }
  });

  test('RF-09 · citaParaVoz deja igual una cita sin versículo', () => {
    assert.equal(citaParaVoz('Salmos 23'), 'Salmos 23');
  });
});

describe('RF-01 · Matutina del día hablada', () => {
  test('RF-01 · segmentosMatutina sin nota: cita anunciada y texto', () => {
    assert.deepEqual(segmentosMatutina({ cita: 'Juan 3:16', texto: 'Porque de tal manera…', nota: null }), [
      'Juan capítulo 3, versículo 16.',
      'Porque de tal manera…',
    ]);
  });

  test('RF-01 · segmentosMatutina sin texto solo anuncia la cita', () => {
    assert.deepEqual(segmentosMatutina({ cita: 'Juan 3:16', texto: null, nota: undefined }), [
      'Juan capítulo 3, versículo 16.',
    ]);
  });
});

describe('RF-03 · Nota de la matutina hablada', () => {
  test('RF-03 · segmentosMatutina con nota la lee al final precedida de "Nota."', () => {
    const segs = segmentosMatutina({ cita: 'Juan 3:16', texto: 'Porque de tal manera…', nota: 'Dios nos ama.' });
    assert.equal(segs.length, 3);
    assert.equal(segs[2], 'Nota. Dios nos ama.');
  });

  test('RF-03 · una nota vacía no agrega segmento', () => {
    assert.equal(segmentosMatutina({ cita: 'Juan 3:16', texto: 'x', nota: '' }).length, 2);
  });
});

describe('RF-05 · Pregunta por pregunta hablada', () => {
  test('RF-05 · segmentosDePregunta: pregunta, cada cita con su texto y la nota', () => {
    const p = pregunta({ pregunta: '¿Qué es la fe?', citas: ['Hebreos 11:1', 'Romanos 10:17'], nota: 'Sin fe es imposible.' });
    const mapa = { 'Hebreos 11:1': 'Es pues la fe…', 'Romanos 10:17': 'Luego la fe es por el oír…' };
    assert.deepEqual(segmentosDePregunta(p, mapa), [
      '¿Qué es la fe?',
      'Hebreos capítulo 11, versículo 1.',
      'Es pues la fe…',
      'Romanos capítulo 10, versículo 17.',
      'Luego la fe es por el oír…',
      'Nota. Sin fe es imposible.',
    ]);
  });

  test('RF-05 · segmentosDePregunta omite las citas sin texto y tolera citas nulas', () => {
    const p = pregunta({ pregunta: '¿Qué es la fe?', citas: ['Hebreos 11:1', 'Hebreos 99:1'], nota: null });
    assert.deepEqual(segmentosDePregunta(p, { 'Hebreos 11:1': 'Es pues la fe…' }), [
      '¿Qué es la fe?',
      'Hebreos capítulo 11, versículo 1.',
      'Es pues la fe…',
    ]);
    const sinCitas = pregunta({ pregunta: '¿Y sin citas?', citas: null as unknown as string[], nota: null /* filas viejas sin citas */ });
    assert.deepEqual(segmentosDePregunta(sinCitas, {}), ['¿Y sin citas?']);
  });
});

// ---------------------------------------------------------------------------
// CONTRATO DE AUDIO (instantánea). Cada clip mp3 publicado en el CDN se llama
// <SHA-1 del texto hablado>.mp3, y la app lo busca calculando ese hash con los
// textos que generan citaParaVoz / segmentosMatutina / segmentosDePregunta /
// segmentosLeccion. Si alguien cambia UNA coma o palabra del texto hablado
// (p. ej. "versículos 14 al 17" -> "versículos 14 a 17", o "Nota." -> "Nota:"),
// el hash cambia y los 2,669 audios publicados dejan de encontrarse: la app
// caería al lector TTS del teléfono en silencio. Esta prueba fija los textos y
// hashes EXACTOS de casos reales (matutina del 2026-10-15 y la pregunta 4 de
// la lección 1). Si el cambio es intencional, hay que regenerar y publicar los
// audios (tools/gen-audio/generar.ts) y solo entonces actualizar estos valores.
// ---------------------------------------------------------------------------
describe('RF-09 · Contrato de audio: textos hablados fijos (instantánea)', () => {
  // [texto hablado, sha1 = nombre del mp3 en el CDN]
  type Clip = [string, string];
  const comprobar = (segs: string[], esperado: Clip[]) => {
    assert.deepEqual(segs, esperado.map(([t]) => t), 'cambió el texto hablado');
    assert.deepEqual(segs.map(sha1), esperado.map(([, h]) => h), 'cambió el hash del audio');
  };

  test('RF-09 · instantánea: matutina del 2026-10-15 (Juan 6:40)', () => {
    const segs = segmentosMatutina({
      cita: 'Juan 6:40',
      texto:
        'Y esta es la voluntad del que me ha enviado: Que todo aquel que ve al Hijo, y cree en él, tenga vida eterna: y yo le resucitaré en el día postrero.',
      nota: null,
    });
    comprobar(segs, [
      ['Juan capítulo 6, versículo 40.', '11e26c1ab5710bb0fc4cabe24c964bc0197b9056'],
      [
        'Y esta es la voluntad del que me ha enviado: Que todo aquel que ve al Hijo, y cree en él, tenga vida eterna: y yo le resucitaré en el día postrero.',
        '00529612ead8fda0c39cbc3443f3a2d18b639522',
      ],
    ]);
  });

  test('RF-09 · instantánea: matutina con nota (formato de la nota)', () => {
    const segs = segmentosMatutina({
      cita: 'Salmos 23:1-3',
      texto: 'Jehová es mi pastor; nada me faltará.',
      nota: 'Dios cuida de los suyos.',
    });
    comprobar(segs, [
      ['Salmos capítulo 23, versículos 1 al 3.', '6914f14ae4adfbdffcec087009c4399372e13b4e'],
      ['Jehová es mi pastor; nada me faltará.', '6a4a2e3f9ffaa21e282940b0e591a2e22c4e722b'],
      ['Nota. Dios cuida de los suyos.', '945a4f9df2f9164ed5c3e5d6b409dffb530b1a7a'],
    ]);
  });

  test('RF-09 · instantánea: pregunta 4 de la lección 1 (lista y rango de versículos)', () => {
    const romanos =
      '9 El amor sea sin fingimiento: aborreciendo lo malo, llegándoos á lo bueno;  10 Amándoos los unos á los otros con caridad fraternal; previniéndoos con honra los unos á los otros;';
    const santiago =
      '14 Hermanos míos, ¿qué aprovechará si alguno dice que tiene fe, y no tiene obras? ¿Podrá la fe salvarle?  15 Y si el hermano ó la hermana están desnudos, y tienen necesidad del mantenimiento de cada día,  16 Y alguno de vosotros les dice: Id en paz, calentaos y hartaos; pero no les diereis las cosas que son necesarias para el cuerpo: ¿qué aprovechará?  17 Así también la fe, si no tuviere obras, es muerta en sí misma.';
    const nota =
      'El hecho de que hemos seguido a Cristo, nos coloca en la obligación de amar a nuestros hermanos en la Fe, no únicamente con palabras, sino con hechos.';
    const p = pregunta({
      orden: 4,
      pregunta: '¿Cómo se manifiesta el amor fraternal?',
      citas: ['Romanos 12:9, 10', 'Santiago 2:14-17'],
      nota,
    });
    const segs = segmentosDePregunta(p, { 'Romanos 12:9, 10': romanos, 'Santiago 2:14-17': santiago });
    comprobar(segs, [
      ['¿Cómo se manifiesta el amor fraternal?', '2910d0f8a5771cd7b380443c083ff1c87301f4c4'],
      ['Romanos capítulo 12, versículos 9 y 10.', '85085dc8aef07a66d2fd5fd51befbfca54fd982b'],
      [romanos, '9227e32b1881fe79ef26dd92c955f446f9fc8eb3'],
      ['Santiago capítulo 2, versículos 14 al 17.', '05ff0498ec57f9cab39c6516281775f347a9d021'],
      [santiago, 'c060e3ccbd707e7b0eb1ccf7e10165acfcd8a8a4'],
      [`Nota. ${nota}`, '84aeb4862fc8cdbcc58e3fe6efd12c3e10924870'],
    ]);
  });

  test('RF-09 · instantánea: estructura de la lección y frases que se repiten en todas', () => {
    const leccion = {
      titulo: 'Título',
      versiculo_central_cita: 'Juan 3:16',
      versiculo_central_texto: 'Texto central.',
      introduccion: 'Introducción.',
    } as Leccion;
    const segs = segmentosLeccion(
      leccion,
      [pregunta({ orden: 1, pregunta: '¿P1?', citas: [], nota: null })],
      {}
    );
    assert.deepEqual(segs, [
      'Título',
      'Versículo central.',
      'Juan capítulo 3, versículo 16.',
      'Texto central.',
      'Introducción.',
      'Pregunta 1.',
      '¿P1?',
    ]);
    // Estas frases fijas suenan en cada lección: su clip es uno solo.
    assert.equal(sha1('Versículo central.'), '8a1d56315ea1ce4856f2d3c9e288a418f01c3f85');
    assert.equal(sha1('Pregunta 1.'), '871d2465e7094e99d86107d7f869b8c2990f26a5');
  });
});
