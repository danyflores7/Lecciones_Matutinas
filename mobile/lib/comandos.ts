import { citaHablada, normalizar as sinAcentos, palabrasANumeros } from './citas';
import { MESES, fechaHoyISO, fechaRelativaISO } from './fechas';

// Intérprete de comandos por VOZ, 100% por reglas (sin IA). El dominio es fijo
// y pequeño (lecciones 1-26, matutinas por fecha, búsquedas sobre contenido
// conocido y unos pocos verbos), así que un parser determinista es suficiente
// y no necesita red ni modelo.
//
// Vocabulario de la guía: el ENUNCIADO es la frase que se dice; la INTENCIÓN
// es el `tipo` del Comando; los ESPACIOS son sus datos (fecha, lección, ...).

// A qué se anclan los "versículos relacionados": una cita dicha (o la última
// leída), el versículo central de una lección, o las citas de una pregunta.
export type ObjetivoRelacionados =
  | { tipo: 'cita'; cita: string | null }
  | { tipo: 'central'; leccion: number | null }
  | { tipo: 'pregunta'; pregunta: number; leccion: number | null };

export type Comando =
  | { tipo: 'abrirLeccion'; numero: number }
  | { tipo: 'abrirLeccionActual' } // "la lección de hoy / de esta semana"
  | { tipo: 'abrirPregunta'; leccion: number | null; pregunta: number }
  | { tipo: 'versiculoCentral'; leccion: number | null } // solo el central
  | { tipo: 'tituloLeccion'; leccion: number | null } // solo el título
  | { tipo: 'temaMatutina'; fecha: string } // solo el tema de la matutina
  | { tipo: 'notaMatutina'; fecha: string } // la nota del cuaderno de ese día
  | { tipo: 'notasLeccion'; leccion: number | null; pregunta: number | null } // las notas
  | { tipo: 'leccionesSimilares'; leccion: number | null } // lecciones parecidas
  | { tipo: 'abrirMatutina'; fecha: string } // 'YYYY-MM-DD'
  | { tipo: 'buscarVersiculo'; texto: string; ambito: 'biblia' | 'lecciones' }
  | { tipo: 'dondeSeCita'; cita: string | null } // null = la última cita leída
  | { tipo: 'preguntasSimilares' }
  | { tipo: 'versiculosRelacionados'; objetivo: ObjetivoRelacionados }
  | { tipo: 'siguiente' }
  | { tipo: 'anterior' }
  | { tipo: 'leer' }
  | { tipo: 'pausar' }
  | { tipo: 'detener' }
  | { tipo: 'ir'; destino: 'inicio' | 'calendario' | 'estudio' | 'buscar' }
  | { tipo: 'ayuda' }
  | { tipo: 'desconocido' };

const NUM_PALABRA: Record<string, number> = {
  uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, treintaiuno: 31,
};

// "la tercera pregunta" -> "la pregunta 3"; "la séptima lección" -> "la lección 7".
const ORDINAL: Record<string, number> = {
  primer: 1, primero: 1, primera: 1, segundo: 2, segunda: 2, tercer: 3, tercero: 3,
  tercera: 3, cuarto: 4, cuarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6,
  septimo: 7, septima: 7, setimo: 7, setima: 7, octavo: 8, octava: 8, noveno: 9,
  novena: 9, decimo: 10, decima: 10, onceavo: 11, onceava: 11, doceavo: 12, doceava: 12,
};

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Palabra o frase COMPLETA: "tema" no coincide con "temas".
const tiene = (t: string, ...frases: string[]) =>
  frases.some((f) => new RegExp(`\\b${escaparRegex(f)}\\b`).test(t));
// Palabra que EMPIEZA con la raíz: "relacionad" -> relacionados, relacionadas.
const raiz = (t: string, ...raices: string[]) =>
  raices.some((r) => new RegExp(`\\b${escaparRegex(r)}`).test(t));

// Primer número que aparezca en el texto (dígitos o palabra), o null.
function primerNumero(texto: string): number | null {
  const dig = texto.match(/\b(\d{1,2})\b/);
  if (dig) return Number(dig[1]);
  for (const palabra of texto.split(' ')) {
    if (palabra in NUM_PALABRA) return NUM_PALABRA[palabra];
  }
  return null;
}

// Fecha explícita "<día> de <mes>" ("cinco de julio", "5 de julio"). Revisa
// TODAS las coincidencias: en "el título de la matutina del 1 de noviembre" la
// primera ("título de la") no es fecha y no debe tapar a la buena.
function fechaExplicita(texto: string): string | null {
  for (const m of texto.matchAll(/(\d{1,2}|[a-z]+)\s+de\s+([a-z]+)/g)) {
    const dia = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]] ?? 0;
    const mesIdx = MESES.findIndex((mm) => sinAcentos(mm) === m[2]);
    if (dia >= 1 && dia <= 31 && mesIdx >= 0) {
      const anio = fechaHoyISO().slice(0, 4);
      return `${anio}-${String(mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return null;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// 'YYYY-MM-DD' desde una frase con fecha, o null.
function fechaDeTexto(textoNormalizado: string): string | null {
  // Convierte números en palabras ("primero", "treinta y uno") a dígitos.
  const texto = palabrasANumeros(textoNormalizado);
  if (tiene(texto, 'hoy')) return fechaHoyISO();
  if (tiene(texto, 'pasado manana')) return fechaRelativaISO(2);
  if (tiene(texto, 'antier', 'anteayer', 'antes de ayer')) return fechaRelativaISO(-2);
  if (tiene(texto, 'manana')) return fechaRelativaISO(1);
  if (tiene(texto, 'ayer')) return fechaRelativaISO(-1);
  const explicita = fechaExplicita(texto);
  if (explicita) return explicita;
  // Día de la semana: "del sábado", "el viernes pasado".
  const dSem = texto.match(new RegExp(`\\b(${DIAS_SEMANA.join('|')})\\b`));
  if (dSem) {
    const objetivo = DIAS_SEMANA.indexOf(dSem[1]);
    const hoyDow = new Date().getDay();
    let delta = (objetivo - hoyDow + 7) % 7; // próxima ocurrencia (hoy incluido)
    if (raiz(texto, 'pasad')) delta = delta === 0 ? -7 : delta - 7; // la anterior
    return fechaRelativaISO(delta);
  }
  // Solo el día: "matutina del 15" (o "del quince") = este mes.
  const dSolo = texto.match(/\b(?:del|dia)\s+(\d{1,2}|[a-z]+)\b/);
  if (dSolo) {
    const dia = /^\d+$/.test(dSolo[1]) ? Number(dSolo[1]) : NUM_PALABRA[dSolo[1]] ?? 0;
    if (dia >= 1 && dia <= 31) {
      const hoy = fechaHoyISO();
      return `${hoy.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
    }
  }
  return null;
}

// Palabras que delatan una petición ajena a la app (música, llamadas, clima...).
const FUERA_DE_DOMINIO = [
  'musica', 'cancion', 'canciones', 'alarma', 'llama a', 'llamar', 'llamada', 'mensaje',
  'whatsapp', 'clima', 'que hora', 'restaurante', 'restaurantes', 'la luz', 'calculadora',
  'cuanto es', 'chiste', 'noticias', 'navegador', 'camara',
];
const DEL_DOMINIO = ['matutina', 'leccion', 'versiculo', 'pregunta', 'biblia', 'cita', 'nota', 'salmo'];

export function interpretar(textoOriginal: string): Comando {
  let t = sinAcentos(textoOriginal)
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return { tipo: 'desconocido' };

  // Ordinales delante de "pregunta"/"lección" -> número detrás.
  t = t.replace(
    new RegExp(`\\b(${Object.keys(ORDINAL).join('|')})\\s+(pregunta|leccion)\\b`, 'g'),
    (_m, ord: string, sust: string) => `${sust} ${ORDINAL[ord]}`
  );

  // Ayuda (incluye maneras indirectas de pedirla).
  if (
    tiene(t, 'ayuda', 'ayudame', 'que puedo', 'que digo', 'comandos', 'que hago', 'como funciona',
      'como se usa', 'para que sirve', 'no se que', 'instrucciones')
  ) {
    return { tipo: 'ayuda' };
  }

  // Peticiones ajenas a la app: mejor "no te entendí" que una acción equivocada.
  if (tiene(t, ...FUERA_DE_DOMINIO) && !raiz(t, ...DEL_DOMINIO)) {
    return { tipo: 'desconocido' };
  }

  // Números en palabras a dígitos, para leer "pregunta uno de la lección dos".
  const tn = palabrasANumeros(t);
  const numLeccion = tn.match(/\bleccion\s+(?:numero\s+)?(\d{1,2})\b/);
  const numPregunta = tn.match(/\bpregunta\s+(?:numero\s+)?(\d{1,2})\b/);
  const leccionN = numLeccion ? Number(numLeccion[1]) : null;
  const preguntaN = numPregunta ? Number(numPregunta[1]) : null;
  const hablaDeMatutina = raiz(t, 'matutina', 'devocional');

  // --- Relaciones y búsquedas (van ANTES que lección/matutina para no chocar) ---

  // "versículos/textos/citas relacionados ..." con sus tres anclas posibles.
  const pideRelacion =
    raiz(t, 'relacionad', 'parecid', 'similar') || tiene(t, 'hablan de lo mismo', 'tienen que ver');
  if (raiz(t, 'versicul', 'texto', 'cita') && pideRelacion) {
    if (tiene(t, 'central', 'clave')) {
      return { tipo: 'versiculosRelacionados', objetivo: { tipo: 'central', leccion: leccionN } };
    }
    if (preguntaN !== null) {
      return {
        tipo: 'versiculosRelacionados',
        objetivo: { tipo: 'pregunta', pregunta: preguntaN, leccion: leccionN },
      };
    }
    return { tipo: 'versiculosRelacionados', objetivo: { tipo: 'cita', cita: citaHablada(t) } };
  }

  // "preguntas parecidas / similares / que se parecen".
  if (raiz(t, 'pregunta') && (pideRelacion || tiene(t, 'se parecen'))) {
    return { tipo: 'preguntasSimilares' };
  }

  // "¿qué lección se parece a la lección 2?" / "otra lección que trata lo mismo".
  if (
    raiz(t, 'leccion') &&
    (pideRelacion || tiene(t, 'se parece', 'trata lo mismo', 'habla de lo mismo', 'trata de lo mismo'))
  ) {
    return { tipo: 'leccionesSimilares', leccion: leccionN };
  }

  // "solo el versículo central / clave de la lección 2".
  if (tiene(t, 'central') || (tiene(t, 'clave') && raiz(t, 'versicul'))) {
    return { tipo: 'versiculoCentral', leccion: leccionN };
  }

  // Notas: de la MATUTINA ("la nota de la matutina de hoy") o de la LECCIÓN
  // ("las notas de la lección 2", "la nota de la pregunta 3").
  if (tiene(t, 'nota', 'notas')) {
    if (hablaDeMatutina && !raiz(t, 'leccion', 'pregunta')) {
      return { tipo: 'notaMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
    }
    return { tipo: 'notasLeccion', leccion: leccionN, pregunta: preguntaN };
  }

  // Título/tema: de la MATUTINA o de la LECCIÓN.
  const pideTitulo =
    tiene(t, 'titulo', 'tema', 'como se llama', 'de que trata', 'de que se trata', 'nombre de la');
  if (pideTitulo) {
    if (hablaDeMatutina) return { tipo: 'temaMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
    if (raiz(t, 'leccion')) return { tipo: 'tituloLeccion', leccion: leccionN };
    if (tiene(t, 'tema')) return { tipo: 'temaMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
    return { tipo: 'tituloLeccion', leccion: leccionN };
  }

  // "la pregunta 3 de la lección 2" / "léeme la pregunta uno".
  if (preguntaN !== null) {
    return { tipo: 'abrirPregunta', pregunta: preguntaN, leccion: leccionN };
  }

  // "qué dice …" / "dónde dice …" / "en qué parte de la Biblia dice …":
  // buscar ese texto (va antes de "dónde se cita" para no confundir el verbo).
  const dice = t.match(/\b(?:que|donde|biblia|versiculo|texto)\s+(?:dice|diga)\b\s*(.*)$/);
  if (dice && dice[1].trim().length >= 4 && !hablaDeMatutina && !raiz(t, 'leccion')) {
    return { tipo: 'buscarVersiculo', texto: dice[1].trim(), ambito: 'biblia' };
  }

  // "¿dónde más se cita / menciona / aparece / viene [Juan 3 16]?"
  if (
    /\b(donde|en que|en cuales|en cuantas)\b.*\b(cita|citado|menciona|mencionado|aparece|usa|viene|esta|sale)\b/.test(t) ||
    tiene(t, 'donde mas', 'en que otras partes', 'en que otras lecciones')
  ) {
    return { tipo: 'dondeSeCita', cita: citaHablada(t) };
  }

  // "busca el versículo que dice ..." / "busca ... en la Biblia".
  const busca = t.match(/\b(?:busca|buscar|buscame|busquame|encuentra|encuentrame)\b\s*(.*)$/);
  const ambitoLecciones = /\ben\s+las?\s+lecciones\b/.test(t);
  if (busca && (ambitoLecciones || !raiz(t, 'leccion')) && !hablaDeMatutina) {
    const resto = busca[1]
      .replace(/\ben\s+(?:toda\s+)?la\s+biblia\b/g, ' ')
      .replace(/\ben\s+las?\s+lecciones\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:el|la|un|una)\s+/, '')
      .replace(/^(?:versiculo|texto|cita)\s*/, '')
      .replace(/^(?:el\s+|la\s+)?(?:que\s+(?:dice|diga|habla de|dice asi)|donde\s+dice)\s*/, '')
      .trim();
    if (resto) {
      return { tipo: 'buscarVersiculo', texto: resto, ambito: ambitoLecciones ? 'lecciones' : 'biblia' };
    }
  }

  // Una cita bíblica dicha directa ("Juan 3 16", "el salmo 23 4"): se lee de la
  // Biblia completa, esté o no en las lecciones.
  if (citaHablada(t) && !hablaDeMatutina) {
    return { tipo: 'buscarVersiculo', texto: t, ambito: 'biblia' };
  }

  // Pedir una lección concreta ("lección 3", "lección tres") o la vigente.
  if (raiz(t, 'leccion')) {
    const n = primerNumero(tn.replace(/^.*?\bleccion/, ''));
    if (n && n >= 1) return { tipo: 'abrirLeccion', numero: n };
    if (
      tiene(t, 'hoy', 'esta semana', 'de la semana', 'actual', 'vigente', 'del sabado',
        'este sabado', 'corresponde', 'toca', 'vamos a estudiar', 'estudiamos', 'estamos viendo')
    ) {
      return { tipo: 'abrirLeccionActual' };
    }
    return { tipo: 'ir', destino: 'estudio' };
  }

  // Pedir una matutina / versículo (por fecha, o de hoy por defecto).
  if (hablaDeMatutina || raiz(t, 'versiculo') || tiene(t, 'lectura del dia')) {
    return { tipo: 'abrirMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }
  // "léeme la del 20 de octubre": una fecha explícita sola es una matutina.
  const fechaSola = fechaExplicita(tn);
  if (fechaSola) return { tipo: 'abrirMatutina', fecha: fechaSola };
  // "la de ayer", "la de antes de ayer", "la de mañana".
  if (/\b(?:la|el)\s+del?\b/.test(t) && tiene(t, 'hoy', 'ayer', 'manana', 'antier', 'anteayer')) {
    return { tipo: 'abrirMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }

  // Navegación por pantalla.
  if (tiene(t, 'inicio', 'principal', 'pantalla principal')) return { tipo: 'ir', destino: 'inicio' };
  if (tiene(t, 'calendario')) return { tipo: 'ir', destino: 'calendario' };
  if (tiene(t, 'buscador', 'busqueda')) return { tipo: 'ir', destino: 'buscar' };
  if (tiene(t, 'estudio', 'lecciones')) return { tipo: 'ir', destino: 'estudio' };

  // Controles de lectura. Orden: pausar, detener, siguiente/anterior y al final
  // leer (porque "la que sigue" es avanzar y "sigue leyendo" es continuar).
  if (tiene(t, 'pausa', 'pausar', 'pausalo', 'espera', 'esperate')) return { tipo: 'pausar' };
  const palabras = t.split(' ');
  if (
    tiene(t, 'detente', 'deten', 'detener', 'detenlo', 'basta', 'silencio', 'callate', 'calla',
      'callar', 'alto', 'stop', 'termina', 'ya no') ||
    (palabras.length <= 4 && tiene(t, 'para'))
  ) {
    return { tipo: 'detener' };
  }
  if (tiene(t, 'siguiente', 'proxima', 'proximo', 'adelante', 'avanza', 'que sigue', 'lo que sigue')) {
    return { tipo: 'siguiente' };
  }
  if (tiene(t, 'anterior', 'previa', 'previo', 'regresa', 'atras', 'retrocede', 'de antes')) {
    return { tipo: 'anterior' };
  }
  if (
    tiene(t, 'lee', 'leelo', 'leela', 'leeme', 'leer', 'leerlo', 'leerla', 'leyendo', 'vuelve a', 'escucha', 'escuchar', 'escuchalo',
      'reproduce', 'reproducir', 'lectura', 'continua', 'continuar', 'continuemos', 'sigue', 'seguir',
      'repite', 'repitelo', 'repetir', 'otra vez', 'de nuevo')
  ) {
    return { tipo: 'leer' };
  }

  return { tipo: 'desconocido' };
}
