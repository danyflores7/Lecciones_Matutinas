import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { interpretar, type Comando } from '../lib/comandos';
import { citaHablada, normalizar } from '../lib/citas';
import {
  buscarTextoLocal,
  dondeSeCita,
  getLeccionLocal,
  getLeccionesLocal,
  getVersiculoLocal,
} from '../lib/contenido';
import {
  bibliaDisponible,
  buscarEnBiblia,
  obtenerVersiculo,
  similaresDeLeccion,
  versiculosRelacionados,
} from '../lib/biblia';
import { citaParaVoz, segmentosLeccion, segmentosMatutina } from '../lib/segmentos';
import { detenerVoz, pausar, reproducirPartes } from '../lib/voz';
import { getVelocidad } from '../lib/almacen';
import { fechaDiaMes, fechaHoyISO, sumarDias } from '../lib/fechas';

type Ultimo = { tipo: 'matutina'; fecha: string } | { tipo: 'leccion'; numero: number } | null;
type ItemResultado = { etiqueta: string; sub?: string; partes: string[] };
type Resultados = { titulo: string; items: ItemResultado[]; pie?: string };

const AYUDA =
  'Puedes decir: matutina de hoy. Lección 3. Busca el versículo que dice, de tal manera amó Dios al mundo. ' +
  'Dónde se cita Juan 3 16. Versículos relacionados. Preguntas similares. Siguiente. Anterior. Pausar.';

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
  const idxResultado = useRef(0);

  useEffect(() => {
    (async () => {
      velocidad.current = await getVelocidad();
    })();
    return () => {
      detenerVoz();
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  useSpeechRecognitionEvent('start', () => setEscuchando(true));
  useSpeechRecognitionEvent('end', () => setEscuchando(false));
  useSpeechRecognitionEvent('error', (e) => {
    setEscuchando(false);
    setEstado(`No pude escuchar (${e.error ?? 'error'}). Intenta de nuevo.`);
  });
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript ?? '';
    if (t) setTexto(t);
    if (e.isFinal && t) manejar(t);
  });

  const hablar = (frase: string) => reproducirPartes([frase], { rate: velocidad.current });
  const reproducir = (partes: string[]) => reproducirPartes(partes, { rate: velocidad.current });

  const escuchar = async () => {
    detenerVoz();
    const permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permiso.granted) {
      setEstado('Necesito permiso para usar el micrófono. Actívalo en los ajustes del teléfono.');
      return;
    }
    setTexto('');
    setEstado('Escuchando…');
    try {
      ExpoSpeechRecognitionModule.start({ lang: 'es-MX', interimResults: true, continuous: false });
    } catch {
      setEstado('No pude iniciar el micrófono.');
    }
  };

  // Presenta una lista de resultados: los muestra, lee el resumen y el primero.
  const presentar = (r: Resultados, resumen: string) => {
    setResultados(r);
    idxResultado.current = 0;
    setEstado(resumen);
    if (r.items.length) {
      reproducir([resumen, ...r.items[0].partes]);
    } else {
      hablar(resumen);
    }
  };

  const leerResultado = (i: number) => {
    const r = resultados;
    if (!r || !r.items[i]) return;
    idxResultado.current = i;
    setEstado(`${i + 1} de ${r.items.length}: ${r.items[i].etiqueta}`);
    reproducir(r.items[i].partes);
  };

  const leerMatutina = async (fecha: string) => {
    const v = await getVersiculoLocal(fecha);
    if (!v) {
      setEstado(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      hablar(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      return;
    }
    ultimo.current = { tipo: 'matutina', fecha };
    ultimaCita.current = v.cita;
    setResultados(null);
    setEstado(`Leyendo la matutina del ${fechaDiaMes(fecha)} · ${v.cita}`);
    reproducir([`Matutina del ${fechaDiaMes(fecha)}.`, ...segmentosMatutina(v)]);
  };

  const leerLeccion = async (numero: number) => {
    const lecciones = await getLeccionesLocal();
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
    if (!datos) return;
    ultimo.current = { tipo: 'leccion', numero };
    ultimaLeccionFecha.current = lec.fecha;
    ultimaCita.current = lec.versiculo_central_cita;
    setResultados(null);
    setEstado(`Leyendo la lección ${numero}: ${lec.titulo}.`);
    reproducir([
      `Lección ${numero}. ${lec.titulo}.`,
      ...segmentosLeccion(datos.leccion, datos.preguntas, datos.citasTexto),
    ]);
  };

  const relativo = (dir: 1 | -1) => {
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
    if (u.tipo === 'matutina') leerMatutina(sumarDias(u.fecha, dir));
    else if (u.numero + dir >= 1) leerLeccion(u.numero + dir);
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

  const hBuscarVersiculo = async (textoBusqueda: string, ambito: 'biblia' | 'lecciones') => {
    // ¿Dijo una cita concreta? ("Juan 3 16") -> lookup directo.
    const cita = citaHablada(normalizar(textoBusqueda));
    if (cita && cita.includes(':')) {
      if (!(await avisoDatos())) return;
      const v = await obtenerVersiculo(cita);
      if (v) {
        ultimaCita.current = v.cita;
        const lugares = await dondeSeCita(v.cita);
        const extra = lugares.length
          ? ` También se cita en ${lugares.length} ${lugares.length === 1 ? 'lugar' : 'lugares'} de la app; di "dónde se cita" para escucharlos.`
          : '';
        setResultados(null);
        setEstado(`${v.cita}${extra}`);
        reproducir([`${citaParaVoz(v.cita)}.`, v.texto, ...(extra ? [extra.trim()] : [])]);
        return;
      }
    }
    // Fragmento recordado -> búsqueda por texto.
    setEstado('Buscando…');
    if (ambito === 'lecciones') {
      const res = await buscarTextoLocal(textoBusqueda);
      const items = res.map((r) => ({
        etiqueta: r.etiqueta,
        partes: [`${citaParaVoz(r.etiqueta)}.`, r.texto],
      }));
      presentar(
        { titulo: `Resultados en las lecciones para “${textoBusqueda}”`, items },
        items.length
          ? `Encontré ${items.length} en las lecciones. Primero:`
          : 'No encontré ese texto en las lecciones.'
      );
      if (items.length) ultimaCita.current = items[0].etiqueta;
      return;
    }
    if (!(await avisoDatos())) return;
    const res = await buscarEnBiblia(textoBusqueda);
    const items = res.map((r) => ({
      etiqueta: r.cita,
      partes: [`${citaParaVoz(r.cita)}.`, r.texto],
    }));
    presentar(
      { titulo: `Resultados en la Biblia para “${textoBusqueda}”`, items },
      items.length
        ? `Encontré ${items.length} versículos. Primero:`
        : 'No encontré ese texto en la Biblia. Intenta con otras palabras.'
    );
    if (items.length) ultimaCita.current = items[0].etiqueta;
  };

  const hDondeSeCita = async (citaPedida: string | null) => {
    const cita = citaPedida ?? ultimaCita.current;
    if (!cita) {
      hablar('Dime qué cita busco. Por ejemplo: dónde se cita Juan 3 16.');
      setEstado('Dime qué cita busco. Por ejemplo: “¿dónde se cita Juan 3:16?”');
      return;
    }
    const lugares = await dondeSeCita(cita);
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
    presentar(
      { titulo: `Dónde se cita ${cita}`, items },
      items.length
        ? `${cita} se cita en ${items.length} ${items.length === 1 ? 'lugar' : 'lugares'}. Primero:`
        : `No encontré ${cita} citado en las lecciones ni matutinas.`
    );
  };

  const hVersiculosRelacionados = async (citaPedida: string | null) => {
    const cita = citaPedida ?? ultimaCita.current;
    if (!cita) {
      hablar('Dime de qué versículo. Por ejemplo: versículos relacionados a Juan 3 16.');
      setEstado('Dime de qué versículo. Por ejemplo: “versículos relacionados a Juan 3:16”.');
      return;
    }
    if (!(await avisoDatos())) return;
    const rel = await versiculosRelacionados(cita);
    const items = rel.map((r) => ({
      etiqueta: r.cita,
      partes: [`${citaParaVoz(r.cita)}.`, r.texto],
    }));
    presentar(
      {
        titulo: `Versículos relacionados con ${cita}`,
        items,
        pie: 'Referencias cruzadas: openbible.info (CC-BY)',
      },
      items.length
        ? `Hay ${items.length} versículos relacionados con ${cita}. Primero:`
        : `No tengo versículos relacionados para ${cita}.`
    );
  };

  const hPreguntasSimilares = async () => {
    // Lección base: la última pedida por voz, o la vigente (la más reciente).
    let fecha = ultimaLeccionFecha.current;
    if (!fecha) {
      const hoy = fechaHoyISO();
      const lecciones = (await getLeccionesLocal()).filter((l) => l.fecha <= hoy);
      fecha = lecciones.length ? lecciones[lecciones.length - 1].fecha : null;
    }
    const datos = fecha ? await getLeccionLocal(fecha) : null;
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
    const items = sims.map((s) => ({
      etiqueta: `Lección ${s.leccion_numero}, pregunta ${s.orden}`,
      sub: s.leccion_titulo,
      partes: [`Lección ${s.leccion_numero}, pregunta ${s.orden}.`, s.pregunta],
    }));
    presentar(
      { titulo: `Preguntas similares a la lección ${datos.leccion.numero}`, items },
      items.length
        ? `Encontré ${items.length} preguntas similares en otras lecciones. Primera:`
        : 'No encontré preguntas similares para esta lección.'
    );
  };

  const ejecutar = (c: Comando) => {
    switch (c.tipo) {
      case 'abrirMatutina':
        return leerMatutina(c.fecha);
      case 'abrirLeccion':
        return leerLeccion(c.numero);
      case 'buscarVersiculo':
        return hBuscarVersiculo(c.texto, c.ambito);
      case 'dondeSeCita':
        return hDondeSeCita(c.cita);
      case 'versiculosRelacionados':
        return hVersiculosRelacionados(c.cita);
      case 'preguntasSimilares':
        return hPreguntasSimilares();
      case 'siguiente':
        return relativo(1);
      case 'anterior':
        return relativo(-1);
      case 'leer': {
        const u = ultimo.current;
        if (resultados?.items.length) return leerResultado(idxResultado.current);
        if (u?.tipo === 'matutina') return leerMatutina(u.fecha);
        if (u?.tipo === 'leccion') return leerLeccion(u.numero);
        setEstado('Primero pide una matutina o una lección.');
        return;
      }
      case 'pausar':
        pausar();
        setEstado('En pausa. Di "leer" para continuar.');
        return;
      case 'detener':
        detenerVoz();
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

  const manejar = (transcript: string) => ejecutar(interpretar(transcript));

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
        onPress={() => ejecutar({ tipo: 'detener' })}
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
