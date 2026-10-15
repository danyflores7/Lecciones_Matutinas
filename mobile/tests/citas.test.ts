// Pruebas de las utilidades de citas bíblicas (lib/citas.ts): entender citas
// escritas y HABLADAS, y compararlas entre sí por su ancla.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CAPITULOS, LIBROS, anclaDeCita, citaHablada, palabrasANumeros, parseCita } from '../lib/citas';

describe('RF-07 · Búsqueda de citas: números dichos en palabras', () => {
  test('RF-07 · palabrasANumeros convierte unidades, decenas y centenas', () => {
    assert.equal(palabrasANumeros('juan tres dieciseis'), 'juan 3 16');
    assert.equal(palabrasANumeros('setenta y cinco'), '75');
    assert.equal(palabrasANumeros('cien'), '100');
    assert.equal(palabrasANumeros('ciento uno'), '101');
    assert.equal(
      palabrasANumeros('capitulo ciento diecinueve verso ciento setenta y seis'),
      'capitulo 119 verso 176'
    );
    assert.equal(palabrasANumeros('treinta y uno de diciembre'), '31 de diciembre');
    assert.equal(palabrasANumeros('veintiun'), '21');
  });

  test('RF-07 · palabrasANumeros deja "un"/"una" sueltos (son artículos) y el resto igual', () => {
    assert.equal(palabrasANumeros('busca un versiculo de una carta'), 'busca un versiculo de una carta');
    assert.equal(palabrasANumeros('el primero de noviembre'), 'el 1 de noviembre');
    assert.equal(palabrasANumeros(''), '');
  });
});

describe('RF-07 · Búsqueda de citas: citas habladas', () => {
  test('RF-07 · citaHablada reconoce "libro capítulo versículo" con dígitos o palabras', () => {
    assert.equal(citaHablada('juan 3 16'), 'Juan 3:16');
    assert.equal(citaHablada('juan 3:16'), 'Juan 3:16');
    assert.equal(citaHablada('juan 3, 16'), 'Juan 3:16');
    assert.equal(citaHablada('juan capitulo tres versiculo dieciseis'), 'Juan 3:16');
    assert.equal(citaHablada('romanos ocho veintiocho'), 'Romanos 8:28');
    assert.equal(citaHablada('apocalipsis capitulo 21 versiculo 4'), 'Apocalipsis 21:4');
  });

  test('RF-07 · citaHablada entiende "primera/segunda de" y nombres compuestos', () => {
    assert.equal(citaHablada('primera de corintios 13 4'), '1 Corintios 13:4');
    assert.equal(citaHablada('segunda de timoteo 3 16'), '2 Timoteo 3:16');
    assert.equal(citaHablada('primera de juan 1 9'), '1 Juan 1:9'); // no "Juan 1:9"
    assert.equal(citaHablada('el salmo 23 versiculo 4'), 'Salmos 23:4');
    assert.equal(citaHablada('cantar de los cantares 2 1'), 'Cantares 2:1');
  });

  test('RF-07 · citaHablada parte el dictado pegado ("Juan 316" = Juan 3:16)', () => {
    assert.equal(citaHablada('juan 316'), 'Juan 3:16');
    assert.equal(citaHablada('1 juan 316'), '1 Juan 3:16');
    assert.equal(citaHablada('apocalipsis 2210'), 'Apocalipsis 22:10');
  });

  test('RF-07 · citaHablada: libros de un solo capítulo y capítulo sin verso', () => {
    assert.equal(citaHablada('judas 24'), 'Judas 1:24');
    assert.equal(citaHablada('filemon 10'), 'Filemón 1:10');
    assert.equal(citaHablada('el salmo 23'), 'Salmos 23');
  });

  test('RF-07 · citaHablada devuelve null si no hay libro o el capítulo no existe', () => {
    assert.equal(citaHablada('hola buenos dias'), null);
    assert.equal(citaHablada('juan'), null);
    assert.equal(citaHablada('juan 22 1'), null); // Juan tiene 21 capítulos
    assert.equal(citaHablada('mateo 0 1'), null);
  });

  test('RF-07 · el canon tiene 66 libros con su número de capítulos', () => {
    assert.equal(LIBROS.length, 66);
    assert.equal(CAPITULOS.length, 66);
    assert.equal(CAPITULOS[LIBROS.indexOf('Salmos')], 150);
    assert.equal(CAPITULOS[LIBROS.indexOf('Apocalipsis')], 22);
  });
});

describe('RF-07 · Búsqueda de citas: citas escritas', () => {
  test('RF-07 · parseCita descompone "Libro C:V" usando el primer verso como ancla', () => {
    assert.deepEqual(parseCita('Juan 3:16'), { libro: 'Juan', capitulo: 3, verso: 16 });
    assert.deepEqual(parseCita('Santiago 2:14-17'), { libro: 'Santiago', capitulo: 2, verso: 14 });
    assert.deepEqual(parseCita('Romanos 12:9, 10'), { libro: 'Romanos', capitulo: 12, verso: 9 });
    assert.deepEqual(parseCita('1 Corintios 13:4'), { libro: '1 Corintios', capitulo: 13, verso: 4 });
    assert.deepEqual(parseCita('Salmos 23'), { libro: 'Salmos', capitulo: 23, verso: null });
  });

  test('RF-07 · parseCita acepta el libro sin acentos ni mayúsculas y lo devuelve canónico', () => {
    assert.deepEqual(parseCita('genesis 1:1'), { libro: 'Génesis', capitulo: 1, verso: 1 });
    assert.deepEqual(parseCita('  ÉXODO 20:8 '), { libro: 'Éxodo', capitulo: 20, verso: 8 });
  });

  test('RF-07 · parseCita devuelve null con un libro desconocido o sin capítulo', () => {
    assert.equal(parseCita('Hechos de los apóstoles'), null);
    assert.equal(parseCita('Libro inventado 3:16'), null);
    assert.equal(parseCita('Juan'), null);
    assert.equal(parseCita(''), null);
  });
});

describe('RF-08 · Dónde se cita / relacionados: comparar citas por ancla', () => {
  test('RF-08 · anclaDeCita empata la misma cita aunque sea rango o lista', () => {
    const juan = anclaDeCita('Juan 3:16');
    assert.equal(juan, 'juan|3|16');
    assert.equal(anclaDeCita('Juan 3:16-17'), juan);
    assert.equal(anclaDeCita('Juan 3:16, 18'), juan);
    assert.equal(anclaDeCita('juan 3:16'), juan);
  });

  test('RF-08 · anclaDeCita: un capítulo entero se ancla en su verso 1', () => {
    assert.equal(anclaDeCita('Salmos 23'), 'salmos|23|1');
    assert.equal(anclaDeCita('Salmos 23:1'), anclaDeCita('Salmos 23'));
  });

  test('RF-08 · anclaDeCita distingue libros, capítulos y versos distintos', () => {
    assert.notEqual(anclaDeCita('Juan 3:16'), anclaDeCita('1 Juan 3:16'));
    assert.notEqual(anclaDeCita('Juan 3:16'), anclaDeCita('Juan 3:17'));
    assert.notEqual(anclaDeCita('Juan 3:16'), anclaDeCita('Juan 4:16'));
    assert.equal(anclaDeCita('Libro inventado 1:1'), null);
  });

  test('RF-08 · una cita hablada se ancla igual que la escrita en el contenido', () => {
    const hablada = citaHablada('primera de corintios trece cuatro');
    assert.ok(hablada);
    assert.equal(anclaDeCita(hablada), anclaDeCita('1 Corintios 13:4-7'));
  });
});
