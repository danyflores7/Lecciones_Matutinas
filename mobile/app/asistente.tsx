import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { interpretar, type Comando, type ObjetivoRelacionados } from '../lib/comandos';
import { citaHablada, normalizar } from '../lib/citas';
import {
  buscarTextoLocal,
  dondeSeCita,
  getLeccionLocal,
  getLeccionesLocal,
  getVersiculoLocal,
  leccionVigente,
} from '../lib/contenido';
import {
  getLeccion,
  getLecciones,
  getVersiculoPorFecha,
  type Leccion,
} from '../lib/supabase';
import {
  bibliaDisponible,
  buscarEnBiblia,
  leccionesSimilares,
  obtenerVersiculo,
  similaresDeLeccion,
  versiculosRelacionados,
} from '../lib/biblia';
import {
  citaParaVoz,
  segmentosDePregunta,
  segmentosLeccion,
  segmentosMatutina,
} from '../lib/segmentos';
import { continuar, detenerVoz, pausar, reproducirPartes } from '../lib/voz';
import { getVelocidad } from '../lib/almacen';
import { fechaDiaMes, fechaHoyISO, sumarDias } from '../lib/fechas';

type Ultimo = { tipo: 'matutina'; fecha: string } | { tipo: 'leccion'; numero: number } | null;
type ItemResultado = { etiqueta: string; sub?: string; partes: string[] };
type Resultados = { titulo: string; items: ItemResultado[]; pie?: string };

const AYUDA =
  'Puedes decir: matutina de hoy. Lección 3. La pregunta 2 de la lección 3. ' +
  'El versículo central de la lección 2. El título de la lección 3. ' +
  'Qué lección se parece a la lección 2. ' +
  'Busca el versículo que dice, de tal manera amó Dios al mundo. Dónde se cita Juan 3 16. ' +
  'Versículos relacionados con el versículo central de la lección 2. Preguntas similares. ' +
  'Siguiente. Anterior. Pausar.';

const BIENVENIDA = 'Te escucho. Di lo que quieres escuchar, o di ayuda.';

// OJO: sin androidIntentOptions de silencio. En los Pixel, el reconocedor de
// Google deja de entregar el resultado final cuando se le pasan esos extras
// (la app se quedaba en "Escuchando…" para siempre). La tolerancia a pausas
// se maneja con la red de seguridad del evento 'end' + los reintentos.
const OPCIONES_ESCUCHA = {
  lang: 'es-MX',
  interimResults: true,
  continuous: false,
} as const;

export default function Asistente() {
  const router = useRouter();
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('Toca el micrófono y di lo que quieres escuchar.');
  const [resultados, setResultados] = useState<Resultados | null>(null);
  const velocidad = useRef(1.0);
  const ultimo = useRef<Ultimo>(null);
  const ultimaCita = useRef<string | null>(null);
  const ultimaLeccionFecha = useRef<string | null>(null);
  const ultimaPregunta = useRef<number | null>(null); // orden, para "siguiente"
  const idxResultado = useRef(0);
  // Generación de comandos: cada comando nuevo la incrementa. Un handler
  // asíncrono viejo (p. ej. esperando red) se descarta si ya no es el vigente,
  // para que nunca pise al comando nuevo ni hable tras salir de la pantalla.
  const gen = useRef(0);
  const pausado = useRef(false);
  const sinVoz = useRef(0); // intentos seguidos sin escuchar nada
  const enfocado = useRef(true); // el manos-libres SOLO vive con la pantalla enfocada
  const permisoOk = useRef(false);
  const primerFoco = useRef(true);
  // Red de seguridad: si el reconocedor termina SIN resultado final (pasa en
  // algunos teléfonos), se usa la última transcripción parcial.
  const interimRef = useRef('');
  const finalRecibido = useRef(true);

  // Cierra el micrófono descartando lo que hubiera a medio transcribir.
  const cerrarMic = () => {
    finalRecibido.current = true;
    interimRef.current = '';
    ExpoSpeechRecognitionModule.stop();
  };
  const nuevoComando = () => {
    gen.current += 1;
    return gen.current;
  };
  const vigente = (g: number) => g === gen.current;

  // Vuelve a abrir el micrófono (modo conversación manos libres).
  const escucharAuto = () => {
    if (!enfocado.current) return; // nunca escuchar tapado por otra pantalla
    setTexto('');
    interimRef.current = '';
    finalRecibido.current = false;
    setEstado('Escuchando…');
    try {
      ExpoSpeechRecognitionModule.start(OPCIONES_ESCUCHA);
    } catch {
      setEstado('No pude iniciar el micrófono.');
    }
  };

  useEffect(() => {
    (async () => {
      velocidad.current = await getVelocidad();
      // Manos libres desde que se abre la pantalla: saluda y queda escuchando.
      const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (permiso.granted) {
        permisoOk.current = true;
        hablar(BIENVENIDA);
      } else {
        setEstado('Necesito permiso para usar el micrófono. Actívalo en los ajustes del teléfono.');
      }
    })();
    return () => {
      gen.current += 1; // invalida handlers pendientes
      detenerVoz();
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  // Al perder el foco (navegar a otra pantalla): cerrar micrófono e invalidar
  // comandos pendientes. Al recuperarlo, volver a escuchar.
  useFocusEffect(
    useCallback(() => {
      enfocado.current = true;
      if (primerFoco.current) {
        primerFoco.current = false; // el saludo del montaje ya abre el mic
      } else if (permisoOk.current) {
        sinVoz.current = 0;
        escucharAuto();
      }
      return () => {
        enfocado.current = false;
        gen.current += 1;
        cerrarMic();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useSpeechRecognitionEvent('start', () => setEscuchando(true));
  useSpeechRecognitionEvent('end', () => {
    setEscuchando(false);
    // Red de seguridad: la sesión terminó sin resultado final pero SÍ se
    // alcanzó a transcribir algo -> se usa esa transcripción como comando.
    if (!enfocado.current) return;
    if (!finalRecibido.current && interimRef.current.trim()) {
      const t = interimRef.current.trim();
      finalRecibido.current = true;
      interimRef.current = '';
      sinVoz.current = 0;
      manejar(t);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setEscuchando(false);
    if (!enfocado.current) return;
    if (e.error === 'no-speech' || e.error === 'speech-timeout') {
      // Si alcanzó a oír algo, úsalo; si no, reintenta un par de veces.
      if (interimRef.current.trim()) {
        const t = interimRef.current.trim();
        finalRecibido.current = true;
        interimRef.current = '';
        sinVoz.current = 0;
        manejar(t);
        return;
      }
      sinVoz.current += 1;
      if (sinVoz.current <= 2) {
        escucharAuto();
      } else {
        setEstado('Toca el micrófono cuando quieras hablar.');
      }
      return;
    }
    setEstado(`No pude escuchar (${e.error ?? 'error'}). Intenta de nuevo.`);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (!enfocado.current) return; // otra pantalla (u otra instancia) al frente
    const t = e.results?.[0]?.transcript ?? '';
    if (t) {
      setTexto(t);
      interimRef.current = t;
    }
    if (e.isFinal && t) {
      finalRecibido.current = true;
      interimRef.current = '';
      sinVoz.current = 0;
      manejar(t);
    }
  });

  // Al terminar de hablar la app, reabre el micrófono si no llegó otro comando.
  const reArmar = (g: number) => {
    if (!vigente(g) || pausado.current || !enfocado.current) return;
    escucharAuto();
  };

  const hablar = (frase: string) => {
    pausado.current = false;
    const g = gen.current;
    reproducirPartes([frase], { rate: velocidad.current, onFin: () => reArmar(g) });
  };
  const reproducir = (partes: string[]) => {
    pausado.current = false;
    const g = gen.current;
    reproducirPartes(partes, { rate: velocidad.current, onFin: () => reArmar(g) });
  };

  const escuchar = async () => {
    nuevoComando(); // invalida cualquier handler pendiente
    // Si hay lectura en PAUSA, se conserva (para poder decir "leer" y seguir);
    // si algo está sonando, se detiene para escuchar al usuario.
    if (!pausado.current) detenerVoz();
    sinVoz.current = 0;
    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) {
      setEstado('Necesito permiso para usar el micrófono. Actívalo en los ajustes del teléfono.');
      return;
    }
    permisoOk.current = true;
    escucharAuto();
  };

  // Presenta una lista de resultados: los muestra en pantalla y los lee TODOS
  // en secuencia (el usuario puede tocar uno o decir "siguiente"/"anterior").
  // resumenVoz permite decir la cita en forma hablada ("capítulo 3, versículo
  // 16") aunque en pantalla se vea "3:16".
  const presentar = (r: Resultados, resumen: string, resumenVoz?: string) => {
    setResultados(r);
    idxResultado.current = 0;
    setEstado(resumen);
    if (r.items.length) {
      reproducir([resumenVoz ?? resumen, ...r.items.flatMap((it) => it.partes)]);
    } else {
      hablar(resumenVoz ?? resumen);
    }
  };

  const leerResultado = (i: number) => {
    const r = resultados;
    if (!r || !r.items[i]) return;
    nuevoComando();
    // Cierra el micrófono si estaba abierto: si no, oiría la propia lectura.
    cerrarMic();
    sinVoz.current = 0;
    idxResultado.current = i;
    setEstado(`${i + 1} de ${r.items.length}: ${r.items[i].etiqueta}`);
    reproducir(r.items[i].partes);
  };

  const leerMatutina = async (fecha: string, g: number) => {
    // Local primero; si el paquete aún no se descarga, intenta por internet.
    let v = await getVersiculoLocal(fecha);
    if (!v) {
      try {
        v = await getVersiculoPorFecha(fecha);
      } catch {
        v = null;
      }
    }
    if (!vigente(g)) return; // llegó un comando más nuevo
    if (!v) {
      setEstado(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      hablar(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      return;
    }
    ultimo.current = { tipo: 'matutina', fecha };
    ultimaCita.current = v.cita;
    ultimaPregunta.current = null;
    setResultados(null);
    setEstado(`Leyendo la matutina del ${fechaDiaMes(fecha)} · ${v.cita}`);
    reproducir([`Matutina del ${fechaDiaMes(fecha)}.`, ...segmentosMatutina(v)]);
  };

  // Lista de lecciones: local primero, red como respaldo.
  const listaLecciones = async (): Promise<Leccion[]> => {
    const local = await getLeccionesLocal();
    if (local.length) return local;
    try {
      return await getLecciones();
    } catch {
      return [];
    }
  };

  // Resuelve "la lección N" (o, sin número, la última pedida / la vigente).
  const resolverLeccion = async (numero: number | null): Promise<Leccion | null> => {
    const lecciones = await listaLecciones();
    if (numero !== null) {
      const cands = lecciones
        .filter((l) => l.numero === numero)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      return cands[0] ?? null;
    }
    if (ultimaLeccionFecha.current) {
      const l = lecciones.find((x) => x.fecha === ultimaLeccionFecha.current);
      if (l) return l;
    }
    return leccionVigente(lecciones, fechaHoyISO());
  };

  // Datos completos de una lección (local con respaldo por red).
  const datosDeLeccion = async (lec: Leccion) => {
    let datos = await getLeccionLocal(lec.fecha);
    if (!datos) {
      try {
        datos = await getLeccion(lec.fecha);
      } catch {
        datos = null;
      }
    }
    return datos;
  };

  const leerLeccionDeFecha = async (lec: Leccion, g: number) => {
    let datos = await getLeccionLocal(lec.fecha);
    if (!datos) {
      try {
        datos = await getLeccion(lec.fecha);
      } catch {
        datos = null;
      }
    }
    if (!vigente(g)) return;
    if (!datos) {
      setEstado('No pude cargar la lección. Conéctate a internet una vez.');
      hablar('No pude cargar la lección. Conéctate a internet una vez.');
      return;
    }
    ultimo.current = { tipo: 'leccion', numero: lec.numero };
    ultimaLeccionFecha.current = lec.fecha;
    ultimaCita.current = lec.versiculo_central_cita;
    ultimaPregunta.current = null;
    setResultados(null);
    setEstado(`Leyendo la lección ${lec.numero}: ${lec.titulo}.`);
    reproducir([
      `Lección ${lec.numero}. ${lec.titulo}.`,
      ...segmentosLeccion(datos.leccion, datos.preguntas, datos.citasTexto),
    ]);
  };

  // "La lección de hoy / de esta semana": la del PRÓXIMO sábado (la que se
  // está estudiando), no la del sábado que ya pasó.
  const leerLeccionActual = async (g: number) => {
    const lecciones = await listaLecciones();
    if (!vigente(g)) return;
    const lec = leccionVigente(lecciones, fechaHoyISO());
    if (!lec) {
      setEstado('No encontré la lección de esta semana.');
      hablar('No encontré la lección de esta semana.');
      return;
    }
    return leerLeccionDeFecha(lec, g);
  };

  const leerLeccion = async (numero: number, g: number) => {
    const lecciones = await listaLecciones();
    if (!vigente(g)) return;
    const cands = lecciones
      .filter((l) => l.numero === numero)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const lec = cands[0];
    if (!lec) {
      setEstado(`No encontré la lección ${numero}.`);
      hablar(`No encontré la lección ${numero}.`);
      return;
    }
    const datos = await getLeccionLocal(lec.fecha);
    if (!vigente(g)) return;
    if (!datos) return leerLeccionDeFecha(lec, g);
    ultimo.current = { tipo: 'leccion', numero };
    ultimaLeccionFecha.current = lec.fecha;
    ultimaCita.current = lec.versiculo_central_cita;
    ultimaPregunta.current = null;
    setResultados(null);
    setEstado(`Leyendo la lección ${numero}: ${lec.titulo}.`);
    reproducir([
      `Lección ${numero}. ${lec.titulo}.`,
      ...segmentosLeccion(datos.leccion, datos.preguntas, datos.citasTexto),
    ]);
  };

  // "La pregunta 3 de la lección 2" (sin lección: la última o la vigente).
  const leerPregunta = async (leccionNum: number | null, orden: number, g: number) => {
    const lec = await resolverLeccion(leccionNum);
    const datos = lec ? await datosDeLeccion(lec) : null;
    if (!vigente(g)) return;
    if (!lec || !datos) {
      setEstado('No pude cargar la lección. Conéctate a internet una vez.');
      hablar('No pude cargar la lección. Conéctate a internet una vez.');
      return;
    }
    const p = datos.preguntas.find((x) => x.orden === orden);
    if (!p) {
      const msg = `La lección ${lec.numero} no tiene pregunta ${orden}; llega hasta la ${datos.preguntas.length}.`;
      setEstado(msg);
      hablar(msg);
      return;
    }
    ultimo.current = { tipo: 'leccion', numero: lec.numero };
    ultimaLeccionFecha.current = lec.fecha;
    ultimaPregunta.current = orden;
    if (p.citas?.length) ultimaCita.current = p.citas[0];
    setResultados(null);
    setEstado(`Lección ${lec.numero}, pregunta ${orden}.`);
    reproducir([
      `Lección ${lec.numero}. ${lec.titulo}.`,
      `Pregunta ${orden}.`,
      ...segmentosDePregunta(p, datos.citasTexto),
    ]);
  };

  // "Solo el versículo central de la lección N."
  const hVersiculoCentral = async (leccionNum: number | null, g: number) => {
    const lec = await resolverLeccion(leccionNum);
    if (!vigente(g)) return;
    if (!lec) {
      setEstado('No pude cargar la lección. Conéctate a internet una vez.');
      hablar('No pude cargar la lección. Conéctate a internet una vez.');
      return;
    }
    ultimaLeccionFecha.current = lec.fecha;
    ultimaCita.current = lec.versiculo_central_cita;
    ultimo.current = { tipo: 'leccion', numero: lec.numero };
    setResultados(null);
    setEstado(`Versículo central de la lección ${lec.numero}: ${lec.versiculo_central_cita}`);
    reproducir([
      'Versículo central.',
      `${citaParaVoz(lec.versiculo_central_cita)}.`,
      ...(lec.versiculo_central_texto ? [lec.versiculo_central_texto] : []),
    ]);
  };

  // "Solo el título de la lección N."
  const hTituloLeccion = async (leccionNum: number | null, g: number) => {
    const lec = await resolverLeccion(leccionNum);
    if (!vigente(g)) return;
    if (!lec) {
      setEstado('No pude cargar la lección. Conéctate a internet una vez.');
      hablar('No pude cargar la lección. Conéctate a internet una vez.');
      return;
    }
    ultimaLeccionFecha.current = lec.fecha;
    ultimo.current = { tipo: 'leccion', numero: lec.numero };
    setResultados(null);
    setEstado(`Lección ${lec.numero}: ${lec.titulo}`);
    reproducir([`Lección ${lec.numero}. ${lec.titulo}.`]);
  };

  // "¿Qué lección se parece a la lección N?" -> títulos de las más parecidas.
  const hLeccionesSimilares = async (leccionNum: number | null, g: number) => {
    const lec = await resolverLeccion(leccionNum);
    const datos = lec ? await datosDeLeccion(lec) : null;
    if (!vigente(g)) return;
    if (!lec || !datos) {
      setEstado('No pude cargar la lección. Conéctate a internet una vez.');
      hablar('No pude cargar la lección. Conéctate a internet una vez.');
      return;
    }
    if (!(await avisoDatos())) return;
    const sims = await leccionesSimilares(
      datos.preguntas.map((p) => p.id),
      lec.fecha
    );
    if (!vigente(g)) return;
    const items = sims.map((s) => ({
      etiqueta: `Lección ${s.numero}`,
      sub: s.titulo,
      partes: [`Lección ${s.numero}. ${s.titulo}.`],
    }));
    presentar(
      { titulo: `Lecciones parecidas a la lección ${lec.numero}`, items },
      items.length
        ? `La más parecida a la lección ${lec.numero} es la lección ${sims[0].numero}: ${sims[0].titulo}.`
        : `No encontré lecciones parecidas a la lección ${lec.numero}.`
    );
  };

  const relativo = (dir: 1 | -1, g: number) => {
    // Con resultados en pantalla, "siguiente/anterior" navega la lista.
    if (resultados?.items.length) {
      const i = idxResultado.current + dir;
      if (i < 0 || i >= resultados.items.length) {
        hablar(dir > 0 ? 'No hay más resultados.' : 'Es el primer resultado.');
        return;
      }
      leerResultado(i);
      return;
    }
    const u = ultimo.current;
    if (!u) {
      setEstado('Primero pide una matutina o una lección.');
      hablar('Primero pide una matutina o una lección.');
      return;
    }
    if (u.tipo === 'matutina') leerMatutina(sumarDias(u.fecha, dir), g);
    else if (u.tipo === 'leccion' && ultimaPregunta.current !== null) {
      // Estaba en una pregunta: "siguiente" pasa a la pregunta de al lado.
      const orden = ultimaPregunta.current + dir;
      if (orden >= 1) leerPregunta(u.numero, orden, g);
      else hablar('Es la primera pregunta.');
    } else if (u.numero + dir >= 1) leerLeccion(u.numero + dir, g);
    else hablar('Es la primera lección.');
  };

  // --- Búsquedas (sin IA: índices y reglas sobre datos locales) ---

  const avisoDatos = async (): Promise<boolean> => {
    if (await bibliaDisponible()) return true;
    const msg =
      'Los datos de búsqueda aún no se descargan. Conéctate a internet una vez y vuelve a intentar.';
    setEstado(msg);
    hablar(msg);
    return false;
  };

  const hBuscarVersiculo = async (
    textoBusqueda: string,
    ambito: 'biblia' | 'lecciones',
    g: number
  ) => {
    // ¿Dijo una cita concreta? ("Juan 3 16") -> lookup directo en la Biblia
    // COMPLETA (esté o no citada en las lecciones).
    const cita = citaHablada(normalizar(textoBusqueda));
    if (cita) {
      if (!cita.includes(':')) {
        const msg = 'Dime también el número del versículo. Por ejemplo: Salmos 23 1.';
        setEstado(msg);
        hablar(msg);
        return;
      }
      if (!(await avisoDatos())) return;
      const v = await obtenerVersiculo(cita);
      if (!vigente(g)) return;
      if (!v) {
        // El libro sí existe (citaHablada lo validó); el capítulo o el verso no.
        const msg = `${cita} no existe en la Biblia. Revisa el capítulo y el versículo.`;
        setEstado(msg);
        reproducir([`${citaParaVoz(cita)}, no existe en la Biblia.`, 'Revisa el capítulo y el versículo.']);
        return;
      }
      ultimaCita.current = v.cita;
      const lugares = await dondeSeCita(v.cita);
      if (!vigente(g)) return;
      const extra = lugares.length
        ? ` También se cita en ${lugares.length} ${lugares.length === 1 ? 'lugar' : 'lugares'} de la app; di "dónde se cita" para escucharlos.`
        : '';
      setResultados(null);
      setEstado(`${v.cita}${extra}`);
      reproducir([`${citaParaVoz(v.cita)}.`, v.texto, ...(extra ? [extra.trim()] : [])]);
      return;
    }
    // Fragmento recordado -> búsqueda por texto.
    setEstado('Buscando…');
    if (ambito === 'lecciones') {
      const res = await buscarTextoLocal(textoBusqueda);
      if (!vigente(g)) return;
      const items = res.map((r) => ({
        etiqueta: r.etiqueta,
        partes: [`${citaParaVoz(r.etiqueta)}.`, r.texto],
      }));
      presentar(
        { titulo: `Resultados en las lecciones para “${textoBusqueda}”`, items },
        items.length
          ? `Encontré ${items.length} en las lecciones:`
          : 'No encontré ese texto en las lecciones.'
      );
      if (items.length) ultimaCita.current = items[0].etiqueta;
      return;
    }
    if (!(await avisoDatos())) return;
    const res = await buscarEnBiblia(textoBusqueda);
    if (!vigente(g)) return;
    const items = res.map((r) => ({
      etiqueta: r.cita,
      partes: [`${citaParaVoz(r.cita)}.`, r.texto],
    }));
    presentar(
      { titulo: `Resultados en la Biblia para “${textoBusqueda}”`, items },
      items.length
        ? `Encontré ${items.length} ${items.length === 1 ? 'versículo' : 'versículos'}:`
        : 'No encontré ese texto en la Biblia. Intenta con otras palabras.'
    );
    if (items.length) ultimaCita.current = items[0].etiqueta;
  };

  const hDondeSeCita = async (citaPedida: string | null, g: number) => {
    const cita = citaPedida ?? ultimaCita.current;
    if (!cita) {
      hablar('Dime qué cita busco. Por ejemplo: dónde se cita Juan 3 16.');
      setEstado('Dime qué cita busco. Por ejemplo: “¿dónde se cita Juan 3:16?”');
      return;
    }
    const lugares = await dondeSeCita(cita);
    if (!vigente(g)) return;
    const items: ItemResultado[] = lugares.map((l) =>
      l.tipo === 'pregunta'
        ? {
            etiqueta: `Lección ${l.leccionNumero}, pregunta ${l.orden}`,
            sub: l.leccionTitulo,
            partes: [`Lección ${l.leccionNumero}, pregunta ${l.orden}.`, l.pregunta],
          }
        : l.tipo === 'central'
          ? {
              etiqueta: `Lección ${l.leccionNumero} (versículo central)`,
              sub: l.leccionTitulo,
              partes: [
                `Versículo central de la lección ${l.leccionNumero}, ${l.leccionTitulo}.`,
              ],
            }
          : {
              etiqueta: `Matutina del ${fechaDiaMes(l.fecha)}`,
              sub: l.tema,
              partes: [`Matutina del ${fechaDiaMes(l.fecha)}, del tema ${l.tema}.`],
            }
    );
    const citaVoz = citaParaVoz(cita);
    presentar(
      { titulo: `Dónde se cita ${cita}`, items },
      items.length
        ? `${cita} se cita en ${items.length} ${items.length === 1 ? 'lugar' : 'lugares'}:`
        : `No encontré ${cita} citado en las lecciones ni matutinas.`,
      items.length
        ? `${citaVoz} se cita en ${items.length} ${items.length === 1 ? 'lugar' : 'lugares'}.`
        : `No encontré ${citaVoz} citado en las lecciones ni matutinas.`
    );
  };

  const hVersiculosRelacionados = async (objetivo: ObjetivoRelacionados, g: number) => {
    // Resuelve el ancla: una cita suelta, el versículo central de una lección,
    // o TODAS las citas de una pregunta.
    let citas: string[] = [];
    let descripcion = ''; // para pantalla ("Juan 3:16")
    let descripcionVoz = ''; // para voz ("Juan capítulo 3, versículo 16")

    if (objetivo.tipo === 'cita') {
      const cita = objetivo.cita ?? ultimaCita.current;
      if (!cita) {
        hablar('Dime de qué versículo. Por ejemplo: versículos relacionados a Juan 3 16.');
        setEstado('Dime de qué versículo. Por ejemplo: “versículos relacionados a Juan 3:16”.');
        return;
      }
      citas = [cita];
      descripcion = cita;
      descripcionVoz = citaParaVoz(cita);
    } else {
      const lec = await resolverLeccion(objetivo.leccion);
      const datos = lec ? await datosDeLeccion(lec) : null;
      if (!vigente(g)) return;
      if (!lec || !datos) {
        setEstado('No pude cargar la lección. Conéctate a internet una vez.');
        hablar('No pude cargar la lección. Conéctate a internet una vez.');
        return;
      }
      if (objetivo.tipo === 'central') {
        citas = [lec.versiculo_central_cita];
        descripcion = `el versículo central de la lección ${lec.numero} (${lec.versiculo_central_cita})`;
        descripcionVoz = `el versículo central de la lección ${lec.numero}, ${citaParaVoz(lec.versiculo_central_cita)}`;
      } else {
        const p = datos.preguntas.find((x) => x.orden === objetivo.pregunta);
        if (!p) {
          const msg = `La lección ${lec.numero} no tiene pregunta ${objetivo.pregunta}.`;
          setEstado(msg);
          hablar(msg);
          return;
        }
        citas = p.citas ?? [];
        descripcion = `las citas de la pregunta ${p.orden} de la lección ${lec.numero}`;
        descripcionVoz = descripcion;
        if (!citas.length) {
          const msg = `La pregunta ${p.orden} de la lección ${lec.numero} no tiene citas bíblicas.`;
          setEstado(msg);
          hablar(msg);
          return;
        }
      }
    }

    if (!(await avisoDatos())) return;
    // Junta los relacionados de todas las citas ancla (sin repetir, sin
    // devolver las propias anclas), hasta 8.
    const anclas = new Set(citas);
    const vistos = new Set<string>();
    const items: ItemResultado[] = [];
    for (const c of citas) {
      const rel = await versiculosRelacionados(c);
      for (const r of rel) {
        if (anclas.has(r.cita) || vistos.has(r.cita)) continue;
        vistos.add(r.cita);
        items.push({ etiqueta: r.cita, partes: [`${citaParaVoz(r.cita)}.`, r.texto] });
        if (items.length >= 8) break;
      }
      if (items.length >= 8) break;
    }
    if (!vigente(g)) return;
    presentar(
      {
        titulo: `Versículos relacionados con ${descripcion}`,
        items,
        pie: 'Referencias cruzadas: openbible.info (CC-BY)',
      },
      items.length
        ? `Hay ${items.length} versículos relacionados con ${descripcion}:`
        : `No tengo versículos relacionados para ${descripcion}.`,
      items.length
        ? `Hay ${items.length} versículos relacionados con ${descripcionVoz}.`
        : `No tengo versículos relacionados para ${descripcionVoz}.`
    );
  };

  const hPreguntasSimilares = async (g: number) => {
    // Lección base: la última pedida por voz, o la vigente (la que se estudia
    // esta semana, la del próximo sábado).
    let fecha = ultimaLeccionFecha.current;
    if (!fecha) {
      fecha = leccionVigente(await getLeccionesLocal(), fechaHoyISO())?.fecha ?? null;
    }
    const datos = fecha ? await getLeccionLocal(fecha) : null;
    if (!vigente(g)) return;
    if (!datos) {
      hablar('Primero abre una lección, y luego te busco preguntas similares.');
      setEstado('Primero abre una lección (di, por ejemplo, “lección 3”).');
      return;
    }
    if (!(await avisoDatos())) return;
    const sims = await similaresDeLeccion(
      datos.preguntas.map((p) => p.id),
      datos.leccion.numero
    );
    if (!vigente(g)) return;
    const items = sims.map((s) => ({
      etiqueta: `Lección ${s.leccion_numero}, pregunta ${s.orden}`,
      sub: s.leccion_titulo,
      partes: [`Lección ${s.leccion_numero}, pregunta ${s.orden}.`, s.pregunta],
    }));
    presentar(
      { titulo: `Preguntas similares a la lección ${datos.leccion.numero}`, items },
      items.length
        ? `Encontré ${items.length} preguntas similares en otras lecciones:`
        : 'No encontré preguntas similares para esta lección.'
    );
  };

  const ejecutar = (c: Comando, g: number) => {
    switch (c.tipo) {
      case 'abrirMatutina':
        return leerMatutina(c.fecha, g);
      case 'abrirLeccion':
        return leerLeccion(c.numero, g);
      case 'abrirLeccionActual':
        return leerLeccionActual(g);
      case 'abrirPregunta':
        return leerPregunta(c.leccion, c.pregunta, g);
      case 'versiculoCentral':
        return hVersiculoCentral(c.leccion, g);
      case 'tituloLeccion':
        return hTituloLeccion(c.leccion, g);
      case 'leccionesSimilares':
        return hLeccionesSimilares(c.leccion, g);
      case 'buscarVersiculo':
        return hBuscarVersiculo(c.texto, c.ambito, g);
      case 'dondeSeCita':
        return hDondeSeCita(c.cita, g);
      case 'versiculosRelacionados':
        return hVersiculosRelacionados(c.objetivo, g);
      case 'preguntasSimilares':
        return hPreguntasSimilares(g);
      case 'siguiente':
        return relativo(1, g);
      case 'anterior':
        return relativo(-1, g);
      case 'leer': {
        // Tras una pausa, "leer" CONTINÚA donde iba (no reinicia).
        if (pausado.current) {
          pausado.current = false;
          if (continuar()) {
            setEstado('Continuando…');
            return;
          }
          // no había nada que continuar: cae a re-leer lo último
        }
        const u = ultimo.current;
        if (resultados?.items.length) return leerResultado(idxResultado.current);
        if (u?.tipo === 'matutina') return leerMatutina(u.fecha, g);
        if (u?.tipo === 'leccion') return leerLeccion(u.numero, g);
        setEstado('Primero pide una matutina o una lección.');
        return;
      }
      case 'pausar':
        pausar();
        pausado.current = true;
        setEstado('En pausa. Di "leer" para continuar.');
        // Reabre el micrófono: con el audio en pausa no hay riesgo de oírse,
        // y así "leer" funciona por voz sin tocar nada.
        sinVoz.current = 0;
        escucharAuto();
        return;
      case 'detener':
        detenerVoz();
        pausado.current = false;
        setEstado('Detenido.');
        return;
      case 'ir': {
        const destinos = { inicio: '/', calendario: '/calendario', estudio: '/estudio' } as const;
        const nombre = { inicio: 'Inicio', calendario: 'Calendario', estudio: 'Estudio' }[c.destino];
        setEstado(`Abriendo ${nombre}.`);
        hablar(`Abriendo ${nombre}.`);
        router.push(destinos[c.destino]);
        return;
      }
      case 'ayuda':
        setEstado(AYUDA);
        hablar(AYUDA);
        return;
      default:
        setEstado('No te entendí. Di "ayuda" para escuchar los comandos.');
        hablar('No te entendí. Di ayuda para escuchar los comandos.');
    }
  };

  const manejar = (transcript: string) => ejecutar(interpretar(transcript), nuevoComando());

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titulo}>Modo por voz</Text>
      <Text style={styles.ayuda}>
        Toca el micrófono y di, por ejemplo: “la matutina de hoy”, “lección 3”, “busca el
        versículo que dice…”, “¿dónde se cita Juan 3:16?” o “preguntas similares”.
      </Text>

      <Pressable
        onPress={escuchar}
        accessibilityRole="button"
        accessibilityLabel={escuchando ? 'Escuchando' : 'Tocar para hablar'}
        style={({ pressed }) => [
          styles.micBtn,
          escuchando && styles.micBtnActivo,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={escuchando ? 'mic' : 'mic-outline'} size={72} color="#FFFFFF" />
      </Pressable>
      <Text style={styles.micLabel}>{escuchando ? 'Escuchando…' : 'Tocar para hablar'}</Text>

      {texto ? (
        <View style={styles.oiste}>
          <Text style={styles.oisteLabel}>Escuché:</Text>
          <Text style={styles.oisteTexto}>“{texto}”</Text>
        </View>
      ) : null}

      <Text style={styles.estado} accessibilityLiveRegion="polite">
        {estado}
      </Text>

      {resultados ? (
        <View style={styles.resultados}>
          <Text style={styles.resultadosTitulo}>{resultados.titulo}</Text>
          {resultados.items.map((item, i) => (
            <Pressable
              key={`${item.etiqueta}-${i}`}
              onPress={() => leerResultado(i)}
              accessibilityRole="button"
              accessibilityLabel={`Escuchar ${item.etiqueta}`}
              style={({ pressed }) => [styles.resultado, pressed && styles.pressed]}
            >
              <Ionicons name="volume-high-outline" size={20} color="#185FA5" />
              <View style={styles.resultadoTextos}>
                <Text style={styles.resultadoEtiqueta}>{item.etiqueta}</Text>
                {item.sub ? <Text style={styles.resultadoSub}>{item.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
          {resultados.pie ? <Text style={styles.resultadosPie}>{resultados.pie}</Text> : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => ejecutar({ tipo: 'detener' }, nuevoComando())}
        accessibilityRole="button"
        accessibilityLabel="Detener la lectura"
        style={({ pressed }) => [styles.btnDetener, pressed && styles.pressed]}
      >
        <Ionicons name="stop" size={20} color="#185FA5" />
        <Text style={styles.btnDetenerText}>Detener lectura</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  titulo: { fontSize: 26, fontWeight: '700', color: '#042C53', marginBottom: 8 },
  ayuda: { fontSize: 16, lineHeight: 24, color: '#5F5E5A', textAlign: 'center', marginBottom: 28 },
  micBtn: {
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: '#185FA5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActivo: { backgroundColor: '#A32D2D' },
  pressed: { opacity: 0.85 },
  micLabel: { fontSize: 18, fontWeight: '600', color: '#042C53', marginTop: 16 },
  oiste: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  oisteLabel: { fontSize: 14, fontWeight: '600', color: '#185FA5', marginBottom: 6 },
  oisteTexto: { fontSize: 20, color: '#042C53', fontStyle: 'italic' },
  estado: {
    fontSize: 18,
    lineHeight: 26,
    color: '#2C2C2A',
    textAlign: 'center',
    marginTop: 24,
    alignSelf: 'stretch',
  },
  resultados: { alignSelf: 'stretch', marginTop: 20 },
  resultadosTitulo: { fontSize: 15, fontWeight: '600', color: '#185FA5', marginBottom: 10 },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  resultadoTextos: { flex: 1 },
  resultadoEtiqueta: { fontSize: 17, fontWeight: '600', color: '#042C53' },
  resultadoSub: { fontSize: 14, color: '#5F5E5A', marginTop: 2 },
  resultadosPie: { fontSize: 12, color: '#8A887F', textAlign: 'center', marginTop: 6 },
  btnDetener: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 32,
    alignSelf: 'stretch',
  },
  btnDetenerText: { color: '#185FA5', fontSize: 17, fontWeight: '600' },
});
