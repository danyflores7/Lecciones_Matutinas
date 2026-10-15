// Pruebas de las frases fijas del Modo por voz (lib/frases.ts).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { interpretar } from '../lib/comandos';
import { F, frasesFijas } from '../lib/frases';

describe('RF-09 · Audio: frases fijas pre-grabadas', () => {
  test('RF-09 · frasesFijas no tiene frases vacías ni duplicadas', () => {
    const frases = frasesFijas();
    assert.ok(frases.length > 0);
    for (const f of frases) assert.ok(f.trim().length > 0, 'hay una frase vacía');
    // Dos claves con el mismo texto comparten un solo audio: es un descuido.
    const repetidas = frases.filter((f, i) => frases.indexOf(f) !== i);
    assert.deepEqual(repetidas, []);
  });

  test('RF-09 · frasesFijas incluye todas las frases de F, también las anidadas', () => {
    const frases = frasesFijas();
    assert.ok(frases.includes(F.ayuda));
    assert.ok(frases.includes(F.noEntendi));
    for (const f of Object.values(F.abriendo)) assert.ok(frases.includes(f), f);
  });

  test('RF-09 · las frases no tienen espacios sobrantes (el hash usa el texto recortado)', () => {
    for (const f of frasesFijas()) {
      assert.equal(f, f.trim(), `"${f}"`);
      assert.doesNotMatch(f, / {2}/, `"${f}"`);
    }
  });
});

describe('RF-13 · Bienvenida y ayuda del Modo por voz', () => {
  test('RF-13 · la bienvenida invita a pedir ayuda', () => {
    assert.match(F.bienvenida, /ayuda/i);
    assert.match(F.noEntendi, /ayuda/i);
  });

  // Cada ejemplo que la ayuda le enseña al usuario debe entenderlo el
  // intérprete: si alguien cambia la ayuda o las reglas, esto lo detecta.
  test('RF-13 · todos los ejemplos que dice la ayuda se entienden', () => {
    const [comandos, controles] = F.ayuda.replace(/^Puedes decir:\s*/, '').split(/\s*Y para controlar la lectura:\s*/);
    assert.ok(controles, 'la ayuda ya no menciona los controles de lectura');
    const ejemplos = [
      ...comandos.split(/\.\s+/),
      ...controles.replace(/\.$/, '').split(/,\s*|\s+o\s+/),
    ]
      .map((e) => e.replace(/\.$/, '').trim())
      .filter(Boolean);
    assert.ok(ejemplos.length >= 15, `se esperaban al menos 15 ejemplos, hay ${ejemplos.length}`);
    const noEntendidos = ejemplos.filter((e) => interpretar(e).tipo === 'desconocido');
    assert.deepEqual(noEntendidos, []);
  });

  test('RF-13 · los ejemplos de las frases de aclaración se entienden con la intención correcta', () => {
    assert.equal(interpretar('Salmos 23 1').tipo, 'buscarVersiculo'); // F.diVersiculo
    assert.equal(interpretar('dónde se cita Juan 3 16').tipo, 'dondeSeCita'); // F.diCita
    assert.equal(interpretar('versículos relacionados a Juan 3 16').tipo, 'versiculosRelacionados'); // F.diVersiculoRel
  });

  test('RF-13 · cada ejemplo de la ayuda abre lo que promete', () => {
    const casos: [string, string][] = [
      ['la matutina de hoy', 'abrirMatutina'],
      ['La nota de la matutina', 'notaMatutina'],
      ['Lección 3', 'abrirLeccion'],
      ['La pregunta 2 de la lección 3', 'abrirPregunta'],
      ['El versículo central de la lección 2', 'versiculoCentral'],
      ['El título de la lección 3', 'tituloLeccion'],
      ['El tema de la matutina de hoy', 'temaMatutina'],
      ['Las notas de la lección 2', 'notasLeccion'],
      ['Qué lección se parece a la lección 2', 'leccionesSimilares'],
      ['Busca el versículo que dice, de tal manera amó Dios al mundo', 'buscarVersiculo'],
      ['Dónde se cita Juan 3 16', 'dondeSeCita'],
      ['Versículos relacionados con el versículo central de la lección 2', 'versiculosRelacionados'],
      ['Preguntas similares', 'preguntasSimilares'],
      ['siguiente', 'siguiente'],
      ['anterior', 'anterior'],
      ['pausa', 'pausar'],
      ['continúa', 'leer'],
      ['repite', 'leer'],
      ['detente', 'detener'],
    ];
    for (const [u, tipo] of casos) {
      assert.ok(F.ayuda.toLowerCase().includes(u.toLowerCase()), `la ayuda ya no dice "${u}"`);
      assert.equal(interpretar(u).tipo, tipo, `"${u}"`);
    }
  });
});
