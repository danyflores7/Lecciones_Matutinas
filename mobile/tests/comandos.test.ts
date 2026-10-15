// Pruebas del intérprete de voz por reglas (lib/comandos.ts).
// Los nombres llevan el id del requisito que verifican (matriz de trazabilidad).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { citaHablada, normalizar } from '../lib/citas';
import { interpretar, type Comando } from '../lib/comandos';
import { fechaHoyISO, fechaRelativaISO } from '../lib/fechas';
import { CORPUS } from './fixtures/corpus_voz';
import { HOLDOUT } from './fixtures/holdout_voz';

const HOY = fechaHoyISO();
const ANIO = HOY.slice(0, 4);

// Compara los ESPACIOS esperados de un caso del corpus con el comando obtenido
// (mismo criterio que el runner de la evaluación de usabilidad). Devuelve la
// lista de diferencias; vacía = todo coincide.
function diferenciasDeEspacios(c: Comando, esperados: Record<string, unknown> | undefined): string[] {
  if (!esperados) return [];
  const obtenido = c as unknown as Record<string, unknown>;
  const fallas: string[] = [];
  for (const [k, v] of Object.entries(esperados)) {
    if (k === 'contiene') {
      const txt = normalizar(String(obtenido.texto ?? ''));
      if (!txt.includes(String(v))) fallas.push(`texto no contiene "${v}" (dio "${obtenido.texto}")`);
    } else if (k === 'cita' && c.tipo === 'buscarVersiculo') {
      const cita = citaHablada(normalizar(String(obtenido.texto ?? '')));
      if (cita !== v) fallas.push(`cita=${cita} (esperada ${v})`);
    } else if (JSON.stringify(obtenido[k] ?? null) !== JSON.stringify(v)) {
      fallas.push(`${k}=${JSON.stringify(obtenido[k] ?? null)} (esperado ${JSON.stringify(v)})`);
    }
  }
  return fallas;
}

describe('RF-06 · Modo por voz: intenciones y espacios', () => {
  test('RF-06 · interpreta "la matutina de hoy"', () => {
    assert.deepEqual(interpretar('la matutina de hoy'), { tipo: 'abrirMatutina', fecha: HOY });
  });

  test('RF-06 · interpreta fechas relativas: mañana, ayer, pasado mañana, antier', () => {
    assert.deepEqual(interpretar('la matutina de mañana'), { tipo: 'abrirMatutina', fecha: fechaRelativaISO(1) });
    assert.deepEqual(interpretar('la matutina de ayer'), { tipo: 'abrirMatutina', fecha: fechaRelativaISO(-1) });
    assert.deepEqual(interpretar('la de pasado mañana'), { tipo: 'abrirMatutina', fecha: fechaRelativaISO(2) });
    assert.deepEqual(interpretar('la matutina de antier'), { tipo: 'abrirMatutina', fecha: fechaRelativaISO(-2) });
  });

  test('RF-06 · interpreta una fecha dicha con número o en palabras', () => {
    const esperado = { tipo: 'abrirMatutina', fecha: `${ANIO}-11-01` };
    assert.deepEqual(interpretar('matutina del 1 de noviembre'), esperado);
    assert.deepEqual(interpretar('la matutina del primero de noviembre'), esperado);
    assert.deepEqual(interpretar('léeme la del treinta y uno de diciembre'), {
      tipo: 'abrirMatutina',
      fecha: `${ANIO}-12-31`,
    });
  });

  test('RF-06 · interpreta "la nota de la matutina de ayer"', () => {
    assert.deepEqual(interpretar('la nota de la matutina de ayer'), {
      tipo: 'notaMatutina',
      fecha: fechaRelativaISO(-1),
    });
  });

  test('RF-06 · interpreta "el tema de la matutina de hoy"', () => {
    assert.deepEqual(interpretar('el tema de la matutina de hoy'), { tipo: 'temaMatutina', fecha: HOY });
  });

  test('RF-06 · interpreta "lección tres" y "la séptima lección"', () => {
    assert.deepEqual(interpretar('lección tres'), { tipo: 'abrirLeccion', numero: 3 });
    assert.deepEqual(interpretar('la séptima lección'), { tipo: 'abrirLeccion', numero: 7 });
    assert.deepEqual(interpretar('pon la lección veintiséis'), { tipo: 'abrirLeccion', numero: 26 });
  });

  test('RF-06 · interpreta "la lección de esta semana" como la lección vigente', () => {
    assert.deepEqual(interpretar('la lección de esta semana'), { tipo: 'abrirLeccionActual' });
    assert.deepEqual(interpretar('la lección del sábado'), { tipo: 'abrirLeccionActual' });
  });

  test('RF-06 · interpreta "la pregunta 3 de la lección 2"', () => {
    assert.deepEqual(interpretar('la pregunta 3 de la lección 2'), {
      tipo: 'abrirPregunta',
      pregunta: 3,
      leccion: 2,
    });
    assert.deepEqual(interpretar('lee la tercera pregunta'), { tipo: 'abrirPregunta', pregunta: 3, leccion: null });
  });

  test('RF-06 · interpreta las notas de una lección o de una pregunta', () => {
    assert.deepEqual(interpretar('las notas de la lección 2'), { tipo: 'notasLeccion', leccion: 2, pregunta: null });
    assert.deepEqual(interpretar('la nota de la pregunta 3 de la lección 2'), {
      tipo: 'notasLeccion',
      leccion: 2,
      pregunta: 3,
    });
  });

  test('RF-06 · interpreta el versículo central y el título de una lección', () => {
    assert.deepEqual(interpretar('el versículo central de la lección 2'), { tipo: 'versiculoCentral', leccion: 2 });
    assert.deepEqual(interpretar('el título de la lección 3'), { tipo: 'tituloLeccion', leccion: 3 });
  });

  test('RF-06 · interpreta una cita dicha directa ("Juan 316" dictado pegado)', () => {
    const c = interpretar('Juan 316');
    assert.equal(c.tipo, 'buscarVersiculo');
    assert.equal(c.tipo === 'buscarVersiculo' && c.ambito, 'biblia');
    assert.equal(citaHablada(normalizar(c.tipo === 'buscarVersiculo' ? c.texto : '')), 'Juan 3:16');
  });

  test('RF-06 · interpreta la búsqueda por fragmento en la Biblia y en las lecciones', () => {
    assert.deepEqual(interpretar('busca el versículo que dice Jehová es mi pastor'), {
      tipo: 'buscarVersiculo',
      texto: 'jehova es mi pastor',
      ambito: 'biblia',
    });
    const enLecciones = interpretar('busca en las lecciones el que dice el séptimo día es reposo');
    assert.equal(enLecciones.tipo === 'buscarVersiculo' && enLecciones.ambito, 'lecciones');
  });

  test('RF-06 · interpreta "dónde se cita Juan 3 16" (y sin cita = la última leída)', () => {
    assert.deepEqual(interpretar('dónde se cita Juan 3 16'), { tipo: 'dondeSeCita', cita: 'Juan 3:16' });
    assert.deepEqual(interpretar('dónde se cita'), { tipo: 'dondeSeCita', cita: null });
  });

  test('RF-06 · interpreta versículos relacionados con sus tres anclas', () => {
    assert.deepEqual(interpretar('versículos relacionados a Juan 3 16'), {
      tipo: 'versiculosRelacionados',
      objetivo: { tipo: 'cita', cita: 'Juan 3:16' },
    });
    assert.deepEqual(interpretar('versículos relacionados con el versículo central de la lección 2'), {
      tipo: 'versiculosRelacionados',
      objetivo: { tipo: 'central', leccion: 2 },
    });
    assert.deepEqual(interpretar('versículos relacionados con la pregunta 1 de la lección 2'), {
      tipo: 'versiculosRelacionados',
      objetivo: { tipo: 'pregunta', pregunta: 1, leccion: 2 },
    });
  });

  test('RF-06 · interpreta preguntas similares y lecciones parecidas', () => {
    assert.deepEqual(interpretar('preguntas similares'), { tipo: 'preguntasSimilares' });
    assert.deepEqual(interpretar('qué lección se parece a la lección 2'), { tipo: 'leccionesSimilares', leccion: 2 });
  });

  test('RF-06 · interpreta los controles de lectura', () => {
    const casos: [string, Comando['tipo']][] = [
      ['siguiente', 'siguiente'],
      ['la que sigue', 'siguiente'],
      ['anterior', 'anterior'],
      ['pausa', 'pausar'],
      ['continúa', 'leer'],
      ['sigue leyendo', 'leer'],
      ['repítelo', 'leer'],
      ['detente', 'detener'],
      ['para', 'detener'],
    ];
    for (const [u, tipo] of casos) assert.equal(interpretar(u).tipo, tipo, `"${u}"`);
  });

  test('RF-06 · interpreta la navegación entre pantallas', () => {
    assert.deepEqual(interpretar('abre el calendario'), { tipo: 'ir', destino: 'calendario' });
    assert.deepEqual(interpretar('llévame al inicio'), { tipo: 'ir', destino: 'inicio' });
    assert.deepEqual(interpretar('muéstrame las lecciones'), { tipo: 'ir', destino: 'estudio' });
  });

  test('RF-06 · ignora mayúsculas, acentos y signos de puntuación', () => {
    assert.deepEqual(interpretar('¿LA PREGUNTA 3 DE LA LECCIÓN 2?'), interpretar('la pregunta 3 de la leccion 2'));
    assert.deepEqual(interpretar('¡Léeme la matutina de HOY!'), { tipo: 'abrirMatutina', fecha: HOY });
  });

  test('RF-06 · rechaza peticiones fuera de la app y el texto vacío', () => {
    for (const u of ['pon música', 'qué hora es', 'abre WhatsApp', 'gracias', '', '   ', '¿?']) {
      assert.deepEqual(interpretar(u), { tipo: 'desconocido' }, `"${u}"`);
    }
  });

  test('RF-06 · pedir ayuda devuelve la intención de ayuda', () => {
    for (const u of ['ayuda', 'qué puedo decir', 'cómo funciona esto']) {
      assert.deepEqual(interpretar(u), { tipo: 'ayuda' }, `"${u}"`);
    }
  });
});

describe('RNF-03 · Usabilidad de voz: regresión con el corpus etiquetado', () => {
  test(`RNF-03 · corpus de ${CORPUS.length} enunciados: 100% de intención correcta`, () => {
    const fallas = CORPUS.map((caso) => ({ caso, c: interpretar(caso.u) }))
      .filter(({ caso, c }) => c.tipo !== caso.t)
      .map(({ caso, c }) => `"${caso.u}": esperado ${caso.t}, obtenido ${JSON.stringify(c)}`);
    assert.equal(CORPUS.length, 175, 'el corpus debe tener 175 enunciados');
    assert.deepEqual(fallas, [], `intenciones equivocadas (${fallas.length}/${CORPUS.length})`);
  });

  test('RNF-03 · corpus: 100% de espacios correctos cuando la intención acierta', () => {
    const fallas: string[] = [];
    for (const caso of CORPUS) {
      const c = interpretar(caso.u);
      if (c.tipo !== caso.t) continue; // eso lo reporta la prueba de intención
      const dif = diferenciasDeEspacios(c, caso.s);
      if (dif.length) fallas.push(`"${caso.u}": ${dif.join('; ')}`);
    }
    assert.deepEqual(fallas, []);
  });

  test(`RNF-03 · holdout de ${HOLDOUT.length} frases no vistas: 100% de intención correcta`, () => {
    const fallas = HOLDOUT.map(([u, t]) => ({ u, t, c: interpretar(u) }))
      .filter(({ t, c }) => c.tipo !== t)
      .map(({ u, t, c }) => `"${u}": esperado ${t}, obtenido ${JSON.stringify(c)}`);
    assert.equal(HOLDOUT.length, 30, 'el holdout debe tener 30 frases');
    assert.deepEqual(fallas, []);
  });
});
