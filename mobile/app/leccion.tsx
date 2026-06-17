import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getLeccion, type Leccion, type Pregunta } from '../lib/supabase';
import { fechaDiaMes } from '../lib/fechas';
import { citaParaVoz, detenerVoz, reproducirPartes } from '../lib/voz';
import { getVelocidad, setVelocidad } from '../lib/almacen';
import { SelectorVelocidad } from '../components/SelectorVelocidad';

type Datos = { leccion: Leccion; preguntas: Pregunta[]; citasTexto: Record<string, string> };

// Segmentos de audio de una pregunta: la pregunta, cada cita anunciada + su
// texto, y la nota (precedida por "Nota").
function segmentosDePregunta(p: Pregunta, mapa: Record<string, string>): string[] {
  const segs: string[] = [p.pregunta];
  for (const c of p.citas ?? []) {
    const t = mapa[c];
    if (t) {
      segs.push(`${citaParaVoz(c)}.`);
      segs.push(t);
    }
  }
  if (p.nota) segs.push(`Nota. ${p.nota}`);
  return segs;
}

export default function LeccionDetalle() {
  const { numero } = useLocalSearchParams<{ numero?: string }>();
  const [data, setData] = useState<Datos | null>(null);
  const [loading, setLoading] = useState(true);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [audioActivo, setAudioActivo] = useState<'todo' | number | null>(null);
  const [velocidad, setVel] = useState(1.0);

  useEffect(() => {
    (async () => {
      if (numero) setData(await getLeccion(Number(numero)));
      setVel(await getVelocidad());
      setLoading(false);
    })();
  }, [numero]);

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

  const reproducir = (id: 'todo' | number, partes: string[]) => {
    if (audioActivo === id) {
      detenerVoz();
      setAudioActivo(null);
      return;
    }
    setAudioActivo(id);
    reproducirPartes(partes, { rate: velocidad, onFin: () => setAudioActivo(null) });
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

  const segmentosLeccion = (): string[] => {
    const segs: string[] = [leccion.titulo, 'Versículo central.', `${citaParaVoz(leccion.versiculo_central_cita)}.`];
    if (leccion.versiculo_central_texto) segs.push(leccion.versiculo_central_texto);
    segs.push(leccion.introduccion);
    for (const p of preguntas) {
      segs.push(`Pregunta ${p.orden}.`);
      segs.push(...segmentosDePregunta(p, citasTexto));
    }
    return segs;
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {leccion.serie ? <Text style={styles.serie}>{leccion.serie}</Text> : null}
      <Text style={styles.titulo}>{leccion.titulo}</Text>
      <Text style={styles.meta}>
        Lección {leccion.numero} · {fechaDiaMes(leccion.fecha)}
      </Text>

      {leccion.lectura_biblica ? (
        <Text style={styles.lectura}>Lectura bíblica: {leccion.lectura_biblica}</Text>
      ) : null}

      <View style={styles.central}>
        <Text style={styles.centralLabel}>Versículo central · {leccion.versiculo_central_cita}</Text>
        {leccion.versiculo_central_texto ? (
          <Text style={styles.centralTexto}>{leccion.versiculo_central_texto}</Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.btnLeccion, pressed && styles.btnLeccionPressed]}
        onPress={() => reproducir('todo', segmentosLeccion())}
      >
        <Ionicons
          name={audioActivo === 'todo' ? 'stop-circle' : 'volume-high-outline'}
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.btnLeccionText}>
          {audioActivo === 'todo' ? 'Detener' : 'Escuchar lección'}
        </Text>
      </Pressable>

      <SelectorVelocidad value={velocidad} onChange={cambiarVelocidad} />

      <Text style={styles.intro}>{leccion.introduccion}</Text>

      {preguntas.map((p) => {
        const abiertasDeP = (p.citas ?? []).filter((c) => abiertas.has(`${p.id}|${c}`));
        return (
          <View key={p.id} style={styles.pregunta}>
            <View style={styles.preguntaHead}>
              <Text style={styles.preguntaTexto}>
                <Text style={styles.preguntaNum}>{p.orden}. </Text>
                {p.pregunta}
              </Text>
              <Pressable
                onPress={() => reproducir(p.id, segmentosDePregunta(p, citasTexto))}
                hitSlop={10}
                style={styles.vozBtn}
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
                <Text style={styles.citaBoxTexto}>{citasTexto[c] ?? 'Texto no disponible.'}</Text>
              </View>
            ))}

            {p.nota ? <Text style={styles.nota}>{p.nota}</Text> : null}
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
  meta: { fontSize: 14, color: '#5F5E5A', marginTop: 4, textTransform: 'capitalize' },
  lectura: { fontSize: 14, color: '#5F5E5A', marginTop: 10 },
  central: { backgroundColor: '#E6F1FB', borderRadius: 16, padding: 18, marginTop: 16 },
  centralLabel: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 8 },
  centralTexto: { fontSize: 18, lineHeight: 28, color: '#042C53', fontStyle: 'italic', fontFamily: 'serif' },
  btnLeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
  },
  btnLeccionPressed: { opacity: 0.85 },
  btnLeccionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  intro: { fontSize: 16, lineHeight: 26, color: '#2C2C2A', marginTop: 16 },
  pregunta: { marginTop: 22 },
  preguntaHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  preguntaTexto: { flex: 1, fontSize: 16, lineHeight: 24, color: '#2C2C2A' },
  vozBtn: { paddingTop: 2 },
  preguntaNum: { fontWeight: '600', color: '#185FA5' },
  citas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cita: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B5D4F4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  citaActiva: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  citaText: { fontSize: 13, fontWeight: '600', color: '#185FA5' },
  citaTextActiva: { color: '#FFFFFF' },
  citaBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#185FA5', padding: 14, marginTop: 10 },
  citaBoxTitulo: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 6 },
  citaBoxTexto: { fontSize: 16, lineHeight: 25, color: '#2C2C2A', fontFamily: 'serif' },
  nota: { fontSize: 14, lineHeight: 22, color: '#5F5E5A', marginTop: 10, fontStyle: 'italic' },
});
