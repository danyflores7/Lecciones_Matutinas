import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getLeccion, type Leccion, type Pregunta } from '../lib/supabase';
import { fechaDiaMes } from '../lib/fechas';
import { continuar, detenerVoz, pausar, reproducirPartes, useEstadoVoz } from '../lib/voz';
import { segmentosDePregunta, segmentosLeccion } from '../lib/segmentos';
import { getLeccionLocal } from '../lib/contenido';
import { getVelocidad, setVelocidad } from '../lib/almacen';
import { guardarCache, leerCache } from '../lib/cache';
import { conEscala, useEscalaTexto } from '../lib/escala';
import { SelectorVelocidad } from '../components/SelectorVelocidad';

type Datos = { leccion: Leccion; preguntas: Pregunta[]; citasTexto: Record<string, string> };

export default function LeccionDetalle() {
  const { fecha } = useLocalSearchParams<{ fecha?: string }>();
  const router = useRouter();
  const estadoVoz = useEstadoVoz();
  // Mientras se escucha la lección completa: en qué parte va.
  const [parteActual, setParteActual] = useState<string | null>(null);
  const [data, setData] = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [audioActivo, setAudioActivo] = useState<'todo' | number | null>(null);
  const [pausado, setPausado] = useState(false);
  const [velocidad, setVel] = useState(1.0);
  const esc = useEscalaTexto();

  useEffect(() => {
    (async () => {
      if (fecha) {
        const clave = `leccion:${fecha}`;
        const local = (await getLeccionLocal(fecha)) ?? (await leerCache<Datos>(clave));
        if (local) setData(local);
        try {
          const fresca = await getLeccion(fecha);
          if (fresca) {
            setData(fresca);
            guardarCache(clave, fresca);
          }
        } catch {
          // sin red: nos quedamos con lo cacheado
        }
      }
      setVel(await getVelocidad());
      setLoading(false);
    })();
  }, [fecha]);

  // Detiene la voz al salir de la pantalla.
  useEffect(() => {
    return () => {
      detenerVoz();
    };
  }, []);

  const toggle = (key: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });

  const limpiarAudio = () => {
    setAudioActivo(null);
    setPausado(false);
    setParteActual(null);
  };

  const togglePausa = () => {
    if (pausado) {
      continuar();
      setPausado(false);
    } else {
      pausar();
      setPausado(true);
    }
  };

  const detenerAudio = () => {
    detenerVoz();
    limpiarAudio();
  };

  const cambiarVelocidad = (v: number) => {
    setVel(v);
    setVelocidad(v);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.vacio}>No se encontró la lección.</Text>
      </View>
    );
  }

  const { leccion, preguntas, citasTexto } = data;

  const iniciarLeccion = () => {
    setAudioActivo('todo');
    setPausado(false);
    const segs = segmentosLeccion(leccion, preguntas, citasTexto);
    setParteActual('Introducción');
    reproducirPartes(segs, {
      rate: velocidad,
      onFin: limpiarAudio,
      // Ubica la parte: la última "Pregunta N." que ya sonó (o la introducción).
      onParte: (i) => {
        for (let j = i; j >= 0; j--) {
          const m = segs[j].match(/^Pregunta (\d+)\.$/);
          if (m) {
            setParteActual(`Pregunta ${m[1]} de ${preguntas.length}`);
            return;
          }
        }
        setParteActual('Introducción');
      },
    });
  };

  const reproducirPregunta = (p: Pregunta) => {
    if (audioActivo === p.id) {
      detenerAudio();
      return;
    }
    setAudioActivo(p.id);
    setPausado(false);
    reproducirPartes(segmentosDePregunta(p, citasTexto), { rate: velocidad, onFin: limpiarAudio });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {leccion.serie ? <Text style={styles.serie}>{leccion.serie}</Text> : null}
      <Text style={[styles.titulo, conEscala(styles.titulo, esc)]} accessibilityRole="header">
        {leccion.titulo}
      </Text>
      <Text style={styles.meta}>
        Lección {leccion.numero} · {fechaDiaMes(leccion.fecha)}
      </Text>

      {leccion.lectura_biblica ? (
        <Text style={styles.lectura}>Lectura bíblica: {leccion.lectura_biblica}</Text>
      ) : null}

      <View style={styles.central}>
        <Text style={styles.centralLabel}>Versículo central · {leccion.versiculo_central_cita}</Text>
        {leccion.versiculo_central_texto ? (
          <Text style={[styles.centralTexto, conEscala(styles.centralTexto, esc)]}>
            {leccion.versiculo_central_texto}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.btnEstudiar, pressed && styles.btnLeccionPressed]}
        onPress={() => router.push({ pathname: '/estudiar', params: { fecha: leccion.fecha } })}
        accessibilityRole="button"
        accessibilityHint="Muestra una pregunta a la vez y recuerda dónde te quedaste"
      >
        <Ionicons name="list-outline" size={20} color="#FFFFFF" />
        <Text style={styles.btnLeccionText}>Estudiar pregunta por pregunta</Text>
      </Pressable>

      {audioActivo === 'todo' ? (
        <>
        <Text style={styles.progresoAudio} accessibilityLiveRegion="polite">
          {estadoVoz === 'preparando' && !pausado ? 'Preparando audio…' : `Escuchando: ${parteActual ?? ''}`}
        </Text>
        <View style={styles.filaAudio}>
          <Pressable
            style={({ pressed }) => [styles.btnAudio, pressed && styles.btnLeccionPressed]}
            onPress={togglePausa}
            accessibilityRole="button"
          >
            <Ionicons name={pausado ? 'play' : 'pause'} size={20} color="#FFFFFF" />
            <Text style={styles.btnLeccionText}>{pausado ? 'Continuar' : 'Pausar'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btnAudioStop, pressed && styles.btnLeccionPressed]}
            onPress={detenerAudio}
            accessibilityRole="button"
          >
            <Ionicons name="stop" size={20} color="#185FA5" />
            <Text style={styles.btnAudioStopText}>Detener</Text>
          </Pressable>
        </View>
        </>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.btnEscuchar, pressed && styles.btnLeccionPressed]}
          onPress={iniciarLeccion}
          accessibilityRole="button"
        >
          <Ionicons name="volume-high-outline" size={20} color="#185FA5" />
          <Text style={styles.btnAudioStopText}>Escuchar lección completa</Text>
        </Pressable>
      )}

      <SelectorVelocidad value={velocidad} onChange={cambiarVelocidad} />

      <Text style={[styles.intro, conEscala(styles.intro, esc)]}>{leccion.introduccion}</Text>

      {preguntas.map((p) => {
        const abiertasDeP = (p.citas ?? []).filter((c) => abiertas.has(`${p.id}|${c}`));
        return (
          <View key={p.id} style={styles.pregunta}>
            <View style={styles.preguntaHead}>
              <Text style={[styles.preguntaTexto, conEscala(styles.preguntaTexto, esc)]}>
                <Text style={styles.preguntaNum}>{p.orden}. </Text>
                {p.pregunta}
              </Text>
              <Pressable
                onPress={() => reproducirPregunta(p)}
                style={styles.vozBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  audioActivo === p.id ? `Detener la pregunta ${p.orden}` : `Escuchar la pregunta ${p.orden}`
                }
              >
                <Ionicons
                  name={audioActivo === p.id ? 'stop-circle' : 'volume-high-outline'}
                  size={22}
                  color="#185FA5"
                />
              </Pressable>
            </View>

            {p.citas?.length ? (
              <View style={styles.citas}>
                {p.citas.map((c) => {
                  const activa = abiertas.has(`${p.id}|${c}`);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggle(`${p.id}|${c}`)}
                      style={[styles.cita, activa && styles.citaActiva]}
                      hitSlop={{ top: 2, bottom: 2 }}
                      accessibilityRole="button"
                      accessibilityLabel={`${activa ? 'Ocultar' : 'Mostrar'} el texto de ${c}`}
                      accessibilityState={{ expanded: activa }}
                    >
                      <Text style={[styles.citaText, activa && styles.citaTextActiva]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {abiertasDeP.map((c) => (
              <View key={c} style={styles.citaBox}>
                <Text style={styles.citaBoxTitulo}>{c}</Text>
                <Text style={[styles.citaBoxTexto, conEscala(styles.citaBoxTexto, esc)]}>
                  {citasTexto[c] ?? 'Texto no disponible.'}
                </Text>
              </View>
            ))}

            {p.nota ? (
              <View style={styles.notaBox}>
                <Text style={styles.notaTitulo}>Nota</Text>
                <Text style={[styles.nota, conEscala(styles.nota, esc)]}>{p.nota}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFE8', padding: 24 },
  vacio: { fontSize: 15, color: '#5F5E5A' },
  serie: { fontSize: 13, fontWeight: '600', color: '#185FA5', textTransform: 'uppercase', letterSpacing: 0.5 },
  titulo: { fontSize: 23, fontWeight: '600', color: '#042C53', marginTop: 4 },
  meta: { fontSize: 14, color: '#5F5E5A', marginTop: 4 },
  lectura: { fontSize: 14, color: '#5F5E5A', marginTop: 10 },
  central: { backgroundColor: '#E6F1FB', borderRadius: 16, padding: 18, marginTop: 16 },
  centralLabel: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 8 },
  centralTexto: { fontSize: 18, lineHeight: 28, color: '#042C53', fontFamily: 'serif' },
  btnEstudiar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    marginTop: 14,
  },
  btnEscuchar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    marginTop: 10,
  },
  progresoAudio: { fontSize: 14, fontWeight: '600', color: '#0C447C', marginTop: 12 },
  btnLeccionPressed: { opacity: 0.85 },
  btnLeccionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  filaAudio: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnAudio: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 13,
  },
  btnAudioStop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnAudioStopText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  intro: { fontSize: 16, lineHeight: 26, color: '#2C2C2A', marginTop: 16 },
  pregunta: { marginTop: 22 },
  preguntaHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  preguntaTexto: { flex: 1, fontSize: 16, lineHeight: 24, color: '#2C2C2A' },
  vozBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginRight: -10 },
  preguntaNum: { fontWeight: '600', color: '#185FA5' },
  citas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cita: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#3D79B8', borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  citaActiva: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  citaText: { fontSize: 13, fontWeight: '600', color: '#185FA5' },
  citaTextActiva: { color: '#FFFFFF' },
  citaBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#185FA5', padding: 14, marginTop: 10 },
  citaBoxTitulo: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 6 },
  citaBoxTexto: { fontSize: 16, lineHeight: 25, color: '#2C2C2A', fontFamily: 'serif' },
  notaBox: { backgroundColor: '#FDF6EA', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#BA7A1F', padding: 12, marginTop: 10 },
  notaTitulo: { fontSize: 12, fontWeight: '700', color: '#854F0B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  nota: { fontSize: 14, lineHeight: 22, color: '#2C2C2A' },
});
