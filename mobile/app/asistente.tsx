import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { interpretar, type Comando } from '../lib/comandos';
import { getLeccionLocal, getLeccionesLocal, getVersiculoLocal } from '../lib/contenido';
import { segmentosLeccion, segmentosMatutina } from '../lib/segmentos';
import { detenerVoz, pausar, reproducirPartes } from '../lib/voz';
import { getVelocidad } from '../lib/almacen';
import { fechaDiaMes, sumarDias } from '../lib/fechas';

type Ultimo = { tipo: 'matutina'; fecha: string } | { tipo: 'leccion'; numero: number } | null;

const AYUDA =
  'Puedes decir: matutina de hoy. La matutina del cinco de julio. Lección 3. ' +
  'Siguiente. Anterior. Pausar. O ir al calendario.';

export default function Asistente() {
  const router = useRouter();
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('Toca el micrófono y di lo que quieres escuchar.');
  const velocidad = useRef(1.0);
  const ultimo = useRef<Ultimo>(null);

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

  const reproducir = (partes: string[]) =>
    reproducirPartes(partes, { rate: velocidad.current });

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

  const leerMatutina = async (fecha: string) => {
    const v = await getVersiculoLocal(fecha);
    if (!v) {
      setEstado(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      hablar(`No encontré la matutina del ${fechaDiaMes(fecha)}.`);
      return;
    }
    ultimo.current = { tipo: 'matutina', fecha };
    setEstado(`Leyendo la matutina del ${fechaDiaMes(fecha)}.`);
    reproducir([`Matutina del ${fechaDiaMes(fecha)}.`, ...segmentosMatutina(v)]);
  };

  const leerLeccion = async (numero: number) => {
    const lecciones = await getLeccionesLocal();
    const cands = lecciones.filter((l) => l.numero === numero).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const lec = cands[0];
    if (!lec) {
      setEstado(`No encontré la lección ${numero}.`);
      hablar(`No encontré la lección ${numero}.`);
      return;
    }
    const datos = await getLeccionLocal(lec.fecha);
    if (!datos) return;
    ultimo.current = { tipo: 'leccion', numero };
    setEstado(`Leyendo la lección ${numero}: ${lec.titulo}.`);
    reproducir([
      `Lección ${numero}. ${lec.titulo}.`,
      ...segmentosLeccion(datos.leccion, datos.preguntas, datos.citasTexto),
    ]);
  };

  const relativo = (dir: 1 | -1) => {
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

  const ejecutar = (c: Comando) => {
    switch (c.tipo) {
      case 'abrirMatutina':
        return leerMatutina(c.fecha);
      case 'abrirLeccion':
        return leerLeccion(c.numero);
      case 'siguiente':
        return relativo(1);
      case 'anterior':
        return relativo(-1);
      case 'leer': {
        const u = ultimo.current;
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
        Toca el micrófono y di, por ejemplo: “la matutina de hoy”, “lección 3”, “siguiente” o
        “pausar”.
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
