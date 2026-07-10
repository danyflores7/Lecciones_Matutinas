import { citaHablada, normalizar as sinAcentos, palabrasANumeros } from './citas';
import { MESES, fechaHoyISO, fechaRelativaISO } from './fechas';

// Intérprete de comandos por VOZ, 100% por reglas (sin IA). El dominio es fijo
// y pequeño (lecciones 1-26, matutinas por fecha, búsquedas sobre contenido
// conocido y unos pocos verbos), así que un parser determinista es suficiente
// y no necesita red ni modelo.

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
  | { tipo: 'ir'; destino: 'inicio' | 'calendario' | 'estudio' }
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

// Primer número que aparezca en el texto (dígitos o palabra), o null.
function primerNumero(texto: string): number | null {
  const dig = texto.match(/\b(\d{1,2})\b/);
  if (dig) return Number(dig[1]);
  for (const palabra of texto.split(' ')) {
    if (palabra in NUM_PALABRA) return NUM_PALABRA[palabra];
  }
  return null;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// 'YYYY-MM-DD' desde una frase con fecha, o null.
function fechaDeTexto(texto: string): string | null {
  // Convierte números en palabras ("primero", "treinta y uno") a dígitos.
  texto = palabrasANumeros(texto);
  if (/\bhoy\b/.test(texto)) return fechaHoyISO();
  if (/\bmanana\b/.test(texto)) return fechaRelativaISO(1);
  if (/\bayer\b/.test(texto)) return fechaRelativaISO(-1);
  // "<día> de <mes>", p. ej. "cinco de julio" o "5 de julio".
  const m = texto.match(/(\d{1,2}|[a-z]+)\s+de\s+([a-z]+)/);
  if (m) {
    const dia = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]] ?? 0;
    const mesIdx = MESES.findIndex((mm) => sinAcentos(mm) === m[2]);
    if (dia >= 1 && dia <= 31 && mesIdx >= 0) {
      const anio = fechaHoyISO().slice(0, 4);
      return `${anio}-${String(mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  // Día de la semana: "del sábado", "el viernes pasado".
  const dSem = texto.match(new RegExp(`\\b(${DIAS_SEMANA.join('|')})\\b`));
  if (dSem) {
    const objetivo = DIAS_SEMANA.indexOf(dSem[1]);
    const hoyDow = new Date().getDay();
    let delta = (objetivo - hoyDow + 7) % 7; // próxima ocurrencia (hoy incluido)
    if (/\bpasad[oa]\b/.test(texto)) delta = delta === 0 ? -7 : delta - 7; // la anterior
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

const contiene = (t: string, palabras: string[]) => palabras.some((p) => t.includes(p));

export function interpretar(textoOriginal: string): Comando {
  const t = sinAcentos(textoOriginal).replace(/\s+/g, ' ').trim();
  if (!t) return { tipo: 'desconocido' };

  if (contiene(t, ['ayuda', 'que puedo', 'que digo', 'comandos', 'que hago'])) {
    return { tipo: 'ayuda' };
  }

  // --- Búsquedas (van ANTES que lección/matutina para no chocar) ---

  // Números en palabras a dígitos, para leer "pregunta uno de la lección dos".
  const tn = palabrasANumeros(t);
  const numLeccion = tn.match(/leccion\s+(?:numero\s+)?(\d{1,2})/);
  const numPregunta = tn.match(/pregunta\s+(?:numero\s+)?(\d{1,2})/);

  // "versículos relacionados ..." con sus tres anclas posibles.
  if (t.includes('versicul') && contiene(t, ['relacionad', 'parecid', 'similar'])) {
    // "... con el versículo central de la lección 2"
    if (t.includes('central')) {
      return {
        tipo: 'versiculosRelacionados',
        objetivo: { tipo: 'central', leccion: numLeccion ? Number(numLeccion[1]) : null },
      };
    }
    // "... con (las respuestas/citas de) la pregunta 1 de la lección 2"
    if (numPregunta) {
      return {
        tipo: 'versiculosRelacionados',
        objetivo: {
          tipo: 'pregunta',
          pregunta: Number(numPregunta[1]),
          leccion: numLeccion ? Number(numLeccion[1]) : null,
        },
      };
    }
    // "... con Juan 3 16" (o la última cita leída).
    return { tipo: 'versiculosRelacionados', objetivo: { tipo: 'cita', cita: citaHablada(t) } };
  }

  // "preguntas parecidas / similares" (a la lección actual).
  if (t.includes('pregunta') && contiene(t, ['parecid', 'similar', 'relacionad'])) {
    return { tipo: 'preguntasSimilares' };
  }

  // "¿qué lección es parecida a la lección 2?" / "lecciones similares".
  if (t.includes('leccion') && contiene(t, ['parecid', 'similar', 'se parece'])) {
    return { tipo: 'leccionesSimilares', leccion: numLeccion ? Number(numLeccion[1]) : null };
  }

  // "solo el versículo central de la lección 2".
  if (t.includes('central')) {
    return { tipo: 'versiculoCentral', leccion: numLeccion ? Number(numLeccion[1]) : null };
  }

  // Título/tema: de la MATUTINA ("el tema de la matutina de hoy", "el tema del
  // 15 de julio") o de la LECCIÓN ("el título de la lección 3").
  const pideTitulo = t.includes('titulo') || t.includes('tema');
  if (pideTitulo && contiene(t, ['matutina', 'devocional'])) {
    return { tipo: 'temaMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }
  if (pideTitulo && t.includes('tema') && !t.includes('leccion')) {
    return { tipo: 'temaMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }
  if (pideTitulo) {
    return { tipo: 'tituloLeccion', leccion: numLeccion ? Number(numLeccion[1]) : null };
  }

  // "las notas de la lección 2" / "la nota de la pregunta 3".
  if (/\bnotas?\b/.test(t)) {
    return {
      tipo: 'notasLeccion',
      leccion: numLeccion ? Number(numLeccion[1]) : null,
      pregunta: numPregunta ? Number(numPregunta[1]) : null,
    };
  }

  // "la pregunta 3 de la lección 2" / "léeme la pregunta uno".
  if (numPregunta) {
    return {
      tipo: 'abrirPregunta',
      pregunta: Number(numPregunta[1]),
      leccion: numLeccion ? Number(numLeccion[1]) : null,
    };
  }

  // "¿dónde más se cita / menciona / aparece [Juan 3 16]?"
  if (
    /\b(donde|en que|en cuales|en cuantas)\b.*\b(cita|citado|menciona|mencionado|aparece|usa)/.test(t) ||
    t.includes('donde mas')
  ) {
    return { tipo: 'dondeSeCita', cita: citaHablada(t) };
  }

  // "busca el versículo que dice ..." / "busca ... en la Biblia".
  const busca = t.match(
    /\b(?:busca|buscar|buscame|busquame|encuentra|encuentrame)\b\s*(.*)$/
  );
  const ambitoLecciones = /\ben\s+las?\s+lecciones\b/.test(t);
  if (busca && (ambitoLecciones || !t.includes('leccion')) && !contiene(t, ['matutina', 'devocional'])) {
    let resto = busca[1]
      .replace(/\ben\s+(?:toda\s+)?la\s+biblia\b/g, ' ')
      .replace(/\ben\s+las?\s+lecciones\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:el|la|un|una)\s+/, '')
      .replace(/^(?:versiculo|texto|cita)\s*/, '')
      .replace(/^(?:el\s+|la\s+)?(?:que\s+(?:dice|diga|dice asi)|donde\s+dice)\s*/, '')
      .trim();
    if (resto) {
      return { tipo: 'buscarVersiculo', texto: resto, ambito: ambitoLecciones ? 'lecciones' : 'biblia' };
    }
  }
  // "qué dice Juan 3 16" / "el versículo que dice ..." sin verbo "busca".
  const dice = t.match(/\b(?:que|donde)\s+(?:dice|diga)\b\s*(.*)$/);
  if (dice && dice[1].trim().length >= 4 && !contiene(t, ['matutina', 'leccion'])) {
    return { tipo: 'buscarVersiculo', texto: dice[1].trim(), ambito: 'biblia' };
  }
  // Una cita bíblica dicha directa ("Juan 3 16", "lee Génesis 5 3", "dime el
  // versículo Salmos 23 1"): se lee de la Biblia completa, esté o no en las
  // lecciones. (Las intenciones con cita —dónde se cita, relacionados— ya se
  // atendieron arriba.)
  if (citaHablada(t) && !contiene(t, ['matutina', 'devocional'])) {
    return { tipo: 'buscarVersiculo', texto: t, ambito: 'biblia' };
  }

  // Pedir una lección concreta ("lección 3", "lección tres") o la vigente
  // ("la lección de hoy", "la lección de esta semana").
  if (t.includes('leccion')) {
    const n = primerNumero(t);
    if (n && n >= 1) return { tipo: 'abrirLeccion', numero: n };
    if (contiene(t, ['hoy', 'esta semana', 'de la semana', 'actual', 'vigente', 'del sabado', 'corresponde', 'toca'])) {
      return { tipo: 'abrirLeccionActual' };
    }
    return { tipo: 'ir', destino: 'estudio' };
  }

  // Pedir una matutina / versículo (por fecha, o de hoy por defecto).
  if (contiene(t, ['matutina', 'versiculo', 'devocional', 'lectura del dia'])) {
    return { tipo: 'abrirMatutina', fecha: fechaDeTexto(t) ?? fechaHoyISO() };
  }

  // Navegación por pantalla.
  if (contiene(t, ['inicio', 'principal'])) return { tipo: 'ir', destino: 'inicio' };
  if (t.includes('calendario')) return { tipo: 'ir', destino: 'calendario' };
  if (contiene(t, ['estudio', 'lecciones'])) return { tipo: 'ir', destino: 'estudio' };

  // Controles de lectura.
  if (contiene(t, ['pausa', 'pausar', 'espera'])) return { tipo: 'pausar' };
  if (contiene(t, ['detente', 'deten', 'detener', 'basta', 'silencio', 'callar', 'calla'])) {
    return { tipo: 'detener' };
  }
  if (contiene(t, ['lee', 'escucha', 'escuchar', 'reproduce', 'reproducir', 'lectura'])) {
    return { tipo: 'leer' };
  }

  // Navegación relativa (respecto a lo último leído).
  if (contiene(t, ['siguiente', 'proxima', 'proximo', 'adelante', 'avanza'])) {
    return { tipo: 'siguiente' };
  }
  if (contiene(t, ['anterior', 'previa', 'previo', 'regresa', 'atras', 'retrocede'])) {
    return { tipo: 'anterior' };
  }

  return { tipo: 'desconocido' };
}
