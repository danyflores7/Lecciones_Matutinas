// Pruebas de la lección VIGENTE (la que se estudia esta semana).
// lib/contenido.ts importa AsyncStorage, por eso primero se sustituyen las
// dependencias de React Native (ver apoyo/sin_react_native.ts).
import './apoyo/sin_react_native';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import contenido from '../assets/contenido.json';
import { leccionVigente } from '../lib/contenido';
import { sumarDias } from '../lib/fechas';

// Lecciones de ejemplo: una por sábado, desordenadas a propósito.
const LECCIONES = [
  { numero: 17, fecha: '2026-10-24' },
  { numero: 15, fecha: '2026-10-10' },
  { numero: 16, fecha: '2026-10-17' },
];

const vigente = (hoy: string) => leccionVigente(LECCIONES, hoy)?.numero ?? null;

describe('RF-04 · Lección vigente = la del próximo sábado', () => {
  test('RF-04 · entre semana es la lección del sábado que viene', () => {
    assert.equal(vigente('2026-10-11'), 16); // domingo
    assert.equal(vigente('2026-10-15'), 16); // jueves
    assert.equal(vigente('2026-10-16'), 16); // viernes
  });

  test('RF-04 · el mismo sábado sigue siendo la de ese día', () => {
    assert.equal(vigente('2026-10-17'), 16);
  });

  test('RF-04 · el domingo cambia a la del siguiente sábado', () => {
    assert.equal(vigente('2026-10-18'), 17);
  });

  test('RF-04 · antes del plan es la primera; terminado el plan se queda la última', () => {
    assert.equal(vigente('2026-01-01'), 15);
    assert.equal(vigente('2027-03-01'), 17);
  });

  test('RF-04 · sin lecciones devuelve null y no altera la lista recibida', () => {
    assert.equal(leccionVigente([], '2026-10-15'), null);
    const copia = JSON.stringify(LECCIONES);
    leccionVigente(LECCIONES, '2026-10-15');
    assert.equal(JSON.stringify(LECCIONES), copia);
  });

  test('RF-04 · con el plan incluido en la app, cada día tiene lección en los próximos 6 días', () => {
    const lecciones = contenido.lecciones as { numero: number; fecha: string }[];
    assert.ok(lecciones.length > 0, 'el contenido incluido no trae lecciones');
    const fechas = lecciones.map((l) => l.fecha).sort();
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];
    const huecos: string[] = [];
    for (let hoy = sumarDias(primera, -6); hoy <= ultima; hoy = sumarDias(hoy, 1)) {
      const l = leccionVigente(lecciones, hoy);
      const dias = l ? (Date.parse(l.fecha) - Date.parse(hoy)) / 86_400_000 : NaN;
      if (!(dias >= 0 && dias <= 6)) huecos.push(`${hoy} -> ${l?.fecha ?? 'ninguna'}`);
    }
    assert.deepEqual(huecos, [], 'hay semanas sin lección en el plan');
  });
});
