// Corpus de ENUNCIADOS (utterances) para probar el intérprete de voz.
// Cada caso: enunciado tal como lo diría alguien de la congregación, la
// INTENCIÓN esperada (tipo) y los ESPACIOS (slots) esperados.
// Viene de la evaluación de usabilidad (hecha el jueves 2026-10-15). Las
// fechas esperadas NO son fijas: "hoy", "el sábado" o "el 1 de noviembre"
// dependen del día en que corre la prueba, así que se calculan aquí.
// Espacios especiales: `contiene` = el texto buscado debe incluir esa frase
// (normalizada); `cita` en buscarVersiculo = la cita que se reconoce del texto.
import { fechaHoyISO, fechaRelativaISO } from '../../lib/fechas';

export type Caso = { u: string; t: string; s?: Record<string, unknown> };

const HOY = fechaHoyISO();
const MANANA = fechaRelativaISO(1);
const AYER = fechaRelativaISO(-1);
const PASADO_MANANA = fechaRelativaISO(2);

const DOMINGO = 0;
const VIERNES = 5;
const SABADO = 6;

const dowDe = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

// '11-01' -> 'AAAA-11-01' del año en curso (las fechas dichas no llevan año).
const delAnio = (mesDia: string) => `${HOY.slice(0, 4)}-${mesDia}`;

// "la matutina del quince": ese día del mes en curso.
const delMes = (dia: number) => `${HOY.slice(0, 7)}-${String(dia).padStart(2, '0')}`;

// Próxima fecha con ese día de la semana (hoy incluido): "la del sábado".
function proximo(dow: number): string {
  for (let i = 0; i < 7; i++) if (dowDe(fechaRelativaISO(i)) === dow) return fechaRelativaISO(i);
  throw new Error('día de la semana inválido');
}

// La anterior, estrictamente antes de hoy: "la del domingo pasado".
function anterior(dow: number): string {
  for (let i = 1; i <= 7; i++) if (dowDe(fechaRelativaISO(-i)) === dow) return fechaRelativaISO(-i);
  throw new Error('día de la semana inválido');
}

export const CORPUS: Caso[] = [
  // ---------- abrirMatutina (espacio: fecha) ----------
  { u: 'la matutina de hoy', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'Léeme la matutina de hoy', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'quiero escuchar la matutina', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'pon la matutina de mañana', t: 'abrirMatutina', s: { fecha: MANANA } },
  { u: 'la matutina de ayer', t: 'abrirMatutina', s: { fecha: AYER } },
  { u: 'matutina del 1 de noviembre', t: 'abrirMatutina', s: { fecha: delAnio('11-01') } },
  { u: 'la matutina del primero de noviembre', t: 'abrirMatutina', s: { fecha: delAnio('11-01') } },
  { u: 'dime la matutina del veinticinco de diciembre', t: 'abrirMatutina', s: { fecha: delAnio('12-25') } },
  { u: 'el versículo del día', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'cuál es el versículo de hoy', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'lee el devocional de hoy', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'la matutina del sábado', t: 'abrirMatutina', s: { fecha: proximo(SABADO) } },
  { u: 'la matutina del domingo pasado', t: 'abrirMatutina', s: { fecha: anterior(DOMINGO) } },
  { u: 'matutina del 3 de enero', t: 'abrirMatutina', s: { fecha: delAnio('01-03') } },
  { u: 'léeme la del 20 de octubre', t: 'abrirMatutina', s: { fecha: delAnio('10-20') } },
  { u: 'ponme el versículo de mañana', t: 'abrirMatutina', s: { fecha: MANANA } },
  { u: 'qué versículo toca hoy', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'la matutina del quince', t: 'abrirMatutina', s: { fecha: delMes(15) } },
  { u: 'escuchar matutina', t: 'abrirMatutina', s: { fecha: HOY } },
  { u: 'matutina del 31 de octubre por favor', t: 'abrirMatutina', s: { fecha: delAnio('10-31') } },
  { u: 'oye léeme la matutina de pasado mañana', t: 'abrirMatutina', s: { fecha: PASADO_MANANA } },

  // ---------- temaMatutina (espacio: fecha) ----------
  { u: 'cuál es el tema de hoy', t: 'temaMatutina', s: { fecha: HOY } },
  { u: 'el tema de la matutina de mañana', t: 'temaMatutina', s: { fecha: MANANA } },
  { u: 'de qué trata la matutina de hoy', t: 'temaMatutina', s: { fecha: HOY } },
  { u: 'dime el título de la matutina del 1 de noviembre', t: 'temaMatutina', s: { fecha: delAnio('11-01') } },
  { u: 'qué tema tiene la matutina del viernes', t: 'temaMatutina', s: { fecha: proximo(VIERNES) } },
  { u: 'el tema', t: 'temaMatutina', s: { fecha: HOY } },
  { u: 'cómo se llama la matutina de hoy', t: 'temaMatutina', s: { fecha: HOY } },

  // ---------- abrirLeccion (espacio: numero) ----------
  { u: 'lección 3', t: 'abrirLeccion', s: { numero: 3 } },
  { u: 'lección tres', t: 'abrirLeccion', s: { numero: 3 } },
  { u: 'abre la lección 12', t: 'abrirLeccion', s: { numero: 12 } },
  { u: 'léeme la lección número cinco', t: 'abrirLeccion', s: { numero: 5 } },
  { u: 'quiero escuchar la lección 20', t: 'abrirLeccion', s: { numero: 20 } },
  { u: 'pon la lección veintiséis', t: 'abrirLeccion', s: { numero: 26 } },
  { u: 'la lección 1', t: 'abrirLeccion', s: { numero: 1 } },
  { u: 'lección doce por favor', t: 'abrirLeccion', s: { numero: 12 } },
  { u: 'leccion 7', t: 'abrirLeccion', s: { numero: 7 } },
  { u: 'la séptima lección', t: 'abrirLeccion', s: { numero: 7 } },
  { u: 'la lección 3 completa', t: 'abrirLeccion', s: { numero: 3 } },
  { u: 'dicta la lección diecisiete', t: 'abrirLeccion', s: { numero: 17 } },

  // ---------- abrirLeccionActual ----------
  { u: 'la lección de esta semana', t: 'abrirLeccionActual' },
  { u: 'léeme la lección de hoy', t: 'abrirLeccionActual' },
  { u: 'la lección que toca', t: 'abrirLeccionActual' },
  { u: 'cuál es la lección de este sábado', t: 'abrirLeccionActual' },
  { u: 'la lección actual', t: 'abrirLeccionActual' },
  { u: 'la lección que vamos a estudiar', t: 'abrirLeccionActual' },
  { u: 'pon la lección de la semana', t: 'abrirLeccionActual' },
  { u: 'la lección del sábado', t: 'abrirLeccionActual' },

  // ---------- abrirPregunta (espacios: pregunta, leccion) ----------
  { u: 'la pregunta 3 de la lección 2', t: 'abrirPregunta', s: { pregunta: 3, leccion: 2 } },
  { u: 'léeme la pregunta uno de la lección dos', t: 'abrirPregunta', s: { pregunta: 1, leccion: 2 } },
  { u: 'pregunta número cinco', t: 'abrirPregunta', s: { pregunta: 5, leccion: null } },
  { u: 'la pregunta 4', t: 'abrirPregunta', s: { pregunta: 4, leccion: null } },
  { u: 'lee la tercera pregunta', t: 'abrirPregunta', s: { pregunta: 3, leccion: null } },
  { u: 'qué dice la pregunta 2 de la lección 10', t: 'abrirPregunta', s: { pregunta: 2, leccion: 10 } },
  { u: 'dime la pregunta seis de la lección número doce', t: 'abrirPregunta', s: { pregunta: 6, leccion: 12 } },
  { u: 'la pregunta 10', t: 'abrirPregunta', s: { pregunta: 10, leccion: null } },
  { u: 'de la lección 4 la pregunta 2', t: 'abrirPregunta', s: { pregunta: 2, leccion: 4 } },

  // ---------- versiculoCentral (espacio: leccion) ----------
  { u: 'el versículo central de la lección 2', t: 'versiculoCentral', s: { leccion: 2 } },
  { u: 'cuál es el versículo central', t: 'versiculoCentral', s: { leccion: null } },
  { u: 'dime el versículo clave de la lección 5', t: 'versiculoCentral', s: { leccion: 5 } },
  { u: 'solo el versículo central de la lección tres', t: 'versiculoCentral', s: { leccion: 3 } },
  { u: 'el versículo central de esta lección', t: 'versiculoCentral', s: { leccion: null } },
  { u: 'versículo central lección 8', t: 'versiculoCentral', s: { leccion: 8 } },

  // ---------- tituloLeccion (espacio: leccion) ----------
  { u: 'el título de la lección 3', t: 'tituloLeccion', s: { leccion: 3 } },
  { u: 'cómo se llama la lección 5', t: 'tituloLeccion', s: { leccion: 5 } },
  { u: 'dime solo el título', t: 'tituloLeccion', s: { leccion: null } },
  { u: 'cuál es el título de la lección de esta semana', t: 'tituloLeccion', s: { leccion: null } },
  { u: 'el tema de la lección 4', t: 'tituloLeccion', s: { leccion: 4 } },
  { u: 'qué título tiene la lección veinte', t: 'tituloLeccion', s: { leccion: 20 } },

  // ---------- notasLeccion (espacios: leccion, pregunta) ----------
  { u: 'las notas de la lección 2', t: 'notasLeccion', s: { leccion: 2, pregunta: null } },
  { u: 'léeme las notas', t: 'notasLeccion', s: { leccion: null, pregunta: null } },
  { u: 'la nota de la pregunta 3 de la lección 2', t: 'notasLeccion', s: { leccion: 2, pregunta: 3 } },
  { u: 'qué dice la nota de la pregunta 5', t: 'notasLeccion', s: { leccion: null, pregunta: 5 } },
  { u: 'las notas principales de la lección dos', t: 'notasLeccion', s: { leccion: 2, pregunta: null } },
  { u: 'tiene notas la lección 7', t: 'notasLeccion', s: { leccion: 7, pregunta: null } },

  // ---------- leccionesSimilares (espacio: leccion) ----------
  { u: 'qué lección se parece a la lección 2', t: 'leccionesSimilares', s: { leccion: 2 } },
  { u: 'lecciones similares a la lección cinco', t: 'leccionesSimilares', s: { leccion: 5 } },
  { u: 'hay alguna lección parecida a esta', t: 'leccionesSimilares', s: { leccion: null } },
  { u: 'qué otra lección trata lo mismo que la lección 4', t: 'leccionesSimilares', s: { leccion: 4 } },

  // ---------- preguntasSimilares ----------
  { u: 'preguntas similares', t: 'preguntasSimilares' },
  { u: 'hay preguntas parecidas en otras lecciones', t: 'preguntasSimilares' },
  { u: 'busca preguntas relacionadas', t: 'preguntasSimilares' },
  { u: 'qué preguntas se parecen a estas', t: 'preguntasSimilares' },

  // ---------- versiculosRelacionados (espacio: objetivo) ----------
  { u: 'versículos relacionados', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'cita', cita: null } } },
  { u: 'versículos relacionados a Juan 3 16', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'cita', cita: 'Juan 3:16' } } },
  { u: 'versículos relacionados con el versículo central de la lección 2', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'central', leccion: 2 } } },
  { u: 'versículos relacionados con la pregunta 1 de la lección 2', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'pregunta', pregunta: 1, leccion: 2 } } },
  { u: 'versículos parecidos a Romanos 8 28', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'cita', cita: 'Romanos 8:28' } } },
  { u: 'qué otros versículos hablan de lo mismo', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'cita', cita: null } } },
  { u: 'textos relacionados con Juan 3 16', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'cita', cita: 'Juan 3:16' } } },
  { u: 'citas relacionadas con la pregunta 3', t: 'versiculosRelacionados', s: { objetivo: { tipo: 'pregunta', pregunta: 3, leccion: null } } },

  // ---------- dondeSeCita (espacio: cita) ----------
  { u: 'dónde se cita Juan 3 16', t: 'dondeSeCita', s: { cita: 'Juan 3:16' } },
  { u: 'en qué lecciones aparece Romanos 6 23', t: 'dondeSeCita', s: { cita: 'Romanos 6:23' } },
  { u: 'dónde más se menciona Mateo 5 3', t: 'dondeSeCita', s: { cita: 'Mateo 5:3' } },
  { u: 'en cuántas lecciones viene Éxodo 20 8', t: 'dondeSeCita', s: { cita: 'Éxodo 20:8' } },
  { u: 'dónde se cita', t: 'dondeSeCita', s: { cita: null } },
  { u: 'en qué otras partes está este versículo', t: 'dondeSeCita', s: { cita: null } },

  // ---------- buscarVersiculo por FRAGMENTO (espacios: ambito, texto) ----------
  { u: 'busca el versículo que dice Jehová es mi pastor', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'jehova es mi pastor' } },
  { u: 'búscame el versículo que habla de la fe que mueve montañas', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'fe' } },
  { u: 'encuentra el texto que dice todo lo puedo en Cristo', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'todo lo puedo' } },
  { u: 'busca en las lecciones el que dice el séptimo día es reposo', t: 'buscarVersiculo', s: { ambito: 'lecciones', contiene: 'reposo' } },
  { u: 'dónde dice el justo vivirá por la fe', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'justo vivira' } },
  { u: 'qué versículo dice no temas porque yo estoy contigo', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'no temas' } },
  { u: 'busca amarás a tu prójimo como a ti mismo', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'projimo' } },
  { u: 'en qué parte de la Biblia dice bienaventurados los pobres en espíritu', t: 'buscarVersiculo', s: { ambito: 'biblia', contiene: 'bienaventurados' } },

  // ---------- buscarVersiculo por CITA directa (espacio: cita) ----------
  { u: 'Juan 3 16', t: 'buscarVersiculo', s: { cita: 'Juan 3:16' } },
  { u: 'lee Génesis 1 1', t: 'buscarVersiculo', s: { cita: 'Génesis 1:1' } },
  { u: 'qué dice Salmos 23 1', t: 'buscarVersiculo', s: { cita: 'Salmos 23:1' } },
  { u: 'léeme primera de Corintios 13 4', t: 'buscarVersiculo', s: { cita: '1 Corintios 13:4' } },
  { u: 'Juan 316', t: 'buscarVersiculo', s: { cita: 'Juan 3:16' } },
  { u: 'Apocalipsis capítulo 21 versículo 4', t: 'buscarVersiculo', s: { cita: 'Apocalipsis 21:4' } },
  { u: 'dime segunda de Timoteo 3 16', t: 'buscarVersiculo', s: { cita: '2 Timoteo 3:16' } },
  { u: 'Filipenses 4 13', t: 'buscarVersiculo', s: { cita: 'Filipenses 4:13' } },
  { u: 'Romanos ocho veintiocho', t: 'buscarVersiculo', s: { cita: 'Romanos 8:28' } },
  { u: 'Isaías 53 5', t: 'buscarVersiculo', s: { cita: 'Isaías 53:5' } },
  { u: 'lee Judas 24', t: 'buscarVersiculo', s: { cita: 'Judas 1:24' } },
  { u: 'el salmo 23 versículo 4', t: 'buscarVersiculo', s: { cita: 'Salmos 23:4' } },
  { u: 'Proverbios 3 5', t: 'buscarVersiculo', s: { cita: 'Proverbios 3:5' } },
  { u: 'Mateo 6:33', t: 'buscarVersiculo', s: { cita: 'Mateo 6:33' } },
  { u: 'lee Hechos 2 38', t: 'buscarVersiculo', s: { cita: 'Hechos 2:38' } },
  { u: 'san Juan 14 6', t: 'buscarVersiculo', s: { cita: 'Juan 14:6' } },
  { u: 'primera de Juan 1 9', t: 'buscarVersiculo', s: { cita: '1 Juan 1:9' } },
  { u: 'Hebreos once uno', t: 'buscarVersiculo', s: { cita: 'Hebreos 11:1' } },

  // ---------- navegación relativa y control de lectura ----------
  { u: 'siguiente', t: 'siguiente' },
  { u: 'la que sigue', t: 'siguiente' },
  { u: 'pasa a la siguiente', t: 'siguiente' },
  { u: 'la próxima', t: 'siguiente' },
  { u: 'adelante', t: 'siguiente' },
  { u: 'anterior', t: 'anterior' },
  { u: 'regresa a la anterior', t: 'anterior' },
  { u: 'la de antes', t: 'anterior' },
  { u: 'atrás', t: 'anterior' },
  { u: 'lee', t: 'leer' },
  { u: 'léelo', t: 'leer' },
  { u: 'continúa', t: 'leer' },
  { u: 'sigue leyendo', t: 'leer' },
  { u: 'repítelo', t: 'leer' },
  { u: 'otra vez', t: 'leer' },
  { u: 'pausa', t: 'pausar' },
  { u: 'pausar', t: 'pausar' },
  { u: 'espera un momento', t: 'pausar' },
  { u: 'detente', t: 'detener' },
  { u: 'para', t: 'detener' },
  { u: 'ya basta', t: 'detener' },
  { u: 'silencio', t: 'detener' },
  { u: 'cállate', t: 'detener' },
  { u: 'detén la lectura', t: 'detener' },
  { u: 'alto', t: 'detener' },

  // ---------- ir (espacio: destino) ----------
  { u: 'ir al calendario', t: 'ir', s: { destino: 'calendario' } },
  { u: 'abre el calendario', t: 'ir', s: { destino: 'calendario' } },
  { u: 'llévame al inicio', t: 'ir', s: { destino: 'inicio' } },
  { u: 'regresa a la pantalla principal', t: 'ir', s: { destino: 'inicio' } },
  { u: 've a estudio', t: 'ir', s: { destino: 'estudio' } },
  { u: 'muéstrame las lecciones', t: 'ir', s: { destino: 'estudio' } },

  // ---------- ayuda ----------
  { u: 'ayuda', t: 'ayuda' },
  { u: 'qué puedo decir', t: 'ayuda' },
  { u: 'qué comandos hay', t: 'ayuda' },
  { u: 'cómo funciona esto', t: 'ayuda' },
  { u: 'no sé qué decir', t: 'ayuda' },

  // ---------- FUERA DE DOMINIO (debe ser 'desconocido') ----------
  { u: 'qué hora es', t: 'desconocido' },
  { u: 'pon música', t: 'desconocido' },
  { u: 'llama a mi hija', t: 'desconocido' },
  { u: 'cómo está el clima', t: 'desconocido' },
  { u: 'abre WhatsApp', t: 'desconocido' },
  { u: 'manda un mensaje a Juan', t: 'desconocido' },
  { u: 'gracias', t: 'desconocido' },
  { u: 'hola buenos días', t: 'desconocido' },
  { u: 'cuánto es dos más dos', t: 'desconocido' },
  { u: 'apaga la luz', t: 'desconocido' },
  { u: 'qué día es hoy', t: 'desconocido' },
  { u: 'pon la alarma a las 7', t: 'desconocido' },
  { u: 'busca restaurantes cerca', t: 'desconocido' },
  { u: 'reproduce música de alabanza', t: 'desconocido' },
  { u: 'te quiero mucho', t: 'desconocido' },
  { u: 'para qué sirve esta aplicación', t: 'ayuda' },
];
