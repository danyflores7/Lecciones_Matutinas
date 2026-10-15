// Pruebas de las utilidades de fechas (lib/fechas.ts). Las fechas son
// 'YYYY-MM-DD' en hora LOCAL del teléfono.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  capitalizar,
  diaSemanaDe,
  fechaHoyISO,
  fechaLarga,
  fechaRelativaISO,
  fechasDeLaSemana,
  horaTexto,
  sumarDias,
} from '../lib/fechas';

describe('RF-01 · Matutina del día: fecha de hoy y encabezado', () => {
  test('RF-01 · fechaLarga arma "Jueves 15 de octubre"', () => {
    assert.equal(fechaLarga('2026-10-15', 'Jueves'), 'Jueves 15 de octubre');
    assert.equal(fechaLarga('2026-01-01', 'JUEVES'), 'Jueves 1 de enero'); // sin cero a la izquierda
    assert.equal(fechaLarga('2026-12-31', 'jueves'), 'Jueves 31 de diciembre');
    assert.equal(fechaLarga('2026-06-17', 'miércoles'), 'Miércoles 17 de junio');
  });

  test('RF-01 · capitalizar solo cambia la primera letra', () => {
    assert.equal(capitalizar('jueves'), 'Jueves');
    assert.equal(capitalizar('sábado santo'), 'Sábado santo');
    assert.equal(capitalizar('éxodo'), 'Éxodo');
    assert.equal(capitalizar(''), '');
  });

  test('RF-01 · fechaHoyISO tiene formato AAAA-MM-DD y coincide con la fecha local', () => {
    const hoy = fechaHoyISO();
    assert.match(hoy, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    assert.equal(Number(hoy.slice(8, 10)), d.getDate());
    assert.equal(fechaRelativaISO(0), hoy);
    assert.equal(fechaRelativaISO(1), sumarDias(hoy, 1));
    assert.equal(fechaRelativaISO(-1), sumarDias(hoy, -1));
  });
});

describe('RF-02 · Calendario: aritmética de fechas', () => {
  test('RF-02 · diaSemanaDe da el día de la semana con acentos', () => {
    assert.equal(diaSemanaDe('2026-10-15'), 'jueves');
    assert.equal(diaSemanaDe('2026-10-17'), 'sábado');
    assert.equal(diaSemanaDe('2026-10-18'), 'domingo');
    assert.equal(diaSemanaDe('2026-10-21'), 'miércoles');
    assert.equal(diaSemanaDe('2028-02-29'), 'martes'); // bisiesto
  });

  test('RF-02 · sumarDias cruza meses, años y febrero (bisiesto y no)', () => {
    assert.equal(sumarDias('2026-10-15', 1), '2026-10-16');
    assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
    assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
    assert.equal(sumarDias('2027-01-01', -1), '2026-12-31');
    assert.equal(sumarDias('2026-02-28', 1), '2026-03-01');
    assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
    assert.equal(sumarDias('2026-10-15', 0), '2026-10-15');
    assert.equal(sumarDias('2026-10-15', -7), '2026-10-08');
  });

  test('RF-02 · sumarDias ida y vuelta regresa a la misma fecha todo el año', () => {
    let f = '2026-01-01';
    for (let i = 0; i < 366; i++) {
      assert.equal(sumarDias(sumarDias(f, 30), -30), f);
      f = sumarDias(f, 1);
    }
    assert.equal(f, '2027-01-02');
  });
});

describe('RF-10 · Sin conexión: semana de descarga de audio', () => {
  test('RF-10 · fechasDeLaSemana da 7 días consecutivos desde la fecha base', () => {
    assert.deepEqual(fechasDeLaSemana('2026-12-29'), [
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
      '2027-01-04',
    ]);
  });

  test('RF-10 · fechasDeLaSemana sin fecha empieza hoy', () => {
    const semana = fechasDeLaSemana();
    assert.equal(semana.length, 7);
    assert.equal(semana[0], fechaHoyISO());
    assert.equal(semana[6], fechaRelativaISO(6));
  });
});

describe('RF-11 · Recordatorio: hora en texto', () => {
  test('RF-11 · horaTexto usa formato de 12 horas con a. m. / p. m.', () => {
    assert.equal(horaTexto(6, 0), '6:00 a. m.');
    assert.equal(horaTexto(0, 5), '12:05 a. m.'); // medianoche
    assert.equal(horaTexto(12, 0), '12:00 p. m.'); // mediodía
    assert.equal(horaTexto(13, 30), '1:30 p. m.');
    assert.equal(horaTexto(23, 59), '11:59 p. m.');
  });
});
