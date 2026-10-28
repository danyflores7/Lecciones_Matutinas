import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import type { Leccion, Pregunta } from '../lib/supabase';
import { getLeccionLocal } from '../lib/contenido';
import { getProgreso, setProgreso } from '../lib/progreso';
import { citaParaVoz, segmentosDePregunta } from '../lib/segmentos';
import { fechaDiaMes } from '../lib/fechas';
import { detenerVoz, reproducirPartes, useEstadoVoz } from '../lib/voz';
import { getVelocidad } from '../lib/almacen';
import { conEscala, useEscalaTexto } from '../lib/escala';

type Datos = { leccion: Leccion; preguntas: Pregunta[]; citasTexto: Record<string, string> };

// Estudio guiado (asistente paso a paso): una pregunta por pantalla, con
// "Pregunta N de M", sus citas ya abiertas y la nota. Recuerda dónde te
// quedaste para continuar después.
export default function Estudiar() {
  const params = useLocalSearchParams<{ fecha?: string; pregunta?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const esc = useEscalaTexto();
  const estadoVoz = useEstadoVoz();
  const scroll = useRef<ScrollView>(null);

  const [data, setData] = useState<Datos | null>(null);
  // -1 = pantalla de inicio de la lección (título, subtítulo, versículo central y nota central).
  const [idx, setIdx] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [terminada, setTerminada] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [velocidad, setVel] = useState(1.0);

  useEffect(() => {
    (async () => {
      if (!params.fecha) {
        setLoading(false);
        return;
      }
      const d = await getLeccionLocal(params.fecha);
      setData(d);
      setVel(await getVelocidad());
      if (d) {
        navigation.setOptions({ title: `Lección ${d.leccion.numero}` });
        const pedida = Number(params.pregunta);
        const guardado = await getProgreso(params.fecha);
        // Sin avance guardado (o apenas en la 1): se empieza por el inicio de la lección.
        const inicio =
          pedida >= 1
            ? pedida
            : guardado && !guardado.terminada && guardado.pregunta > 1
              ? guardado.pregunta
              : 0;
        setIdx(inicio === 0 ? -1 : Math.min(inicio, d.preguntas.length) - 1);
      }
      setLoading(false);
    })();
  }, [params.fecha, params.pregunta, navigation]);

  useEffect(() => {
    if (estadoVoz === 'inactivo') setEscuchando(false);
  }, [estadoVoz]);

  useEffect(() => {
    return () => {
      detenerVoz();
    };
  }, []);

  const total = data?.preguntas.length ?? 0;
  const p = idx >= 0 ? data?.preguntas[idx] : undefined;

  // Guarda el avance cada vez que cambia la pregunta.
  useEffect(() => {
    if (data && params.fecha && !terminada && idx >= 0) {
      setProgreso(params.fecha, { pregunta: idx + 1, total, terminada: false });
    }
  }, [idx, data, params.fecha, total, terminada]);

  const mover = useCallback(
    (n: number) => {
      detenerVoz();
      setEscuchando(false);
      setTerminada(false);
      setIdx((i) => Math.min(Math.max(i + n, -1), total - 1));
      scroll.current?.scrollTo({ y: 0, animated: false });
    },
    [total]
  );

  const terminar = useCallback(() => {
    detenerVoz();
    setTerminada(true);
    if (params.fecha) setProgreso(params.fecha, { pregunta: total, total, terminada: true });
  }, [params.fecha, total]);

  const escuchar = useCallback(() => {
    if (!data || (idx >= 0 && !p)) return;
    if (escuchando) {
      detenerVoz();
      setEscuchando(false);
      return;
    }
    setEscuchando(true);
    const l = data.leccion;
    // Inicio: mismas frases que "Escuchar lección" (ya están grabadas con la voz de Jorge).
    const partes =
      idx < 0
        ? [
            l.titulo,
            'Versículo central.',
            `${citaParaVoz(l.versiculo_central_cita)}.`,
            ...(l.versiculo_central_texto ? [l.versiculo_central_texto] : []),
            l.introduccion,
          ]
        : [`Pregunta ${p!.orden}.`, ...segmentosDePregunta(p!, data.citasTexto)];
    reproducirPartes(partes, { rate: velocidad });
  }, [data, p, idx, escuchando, velocidad]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  if (!data || (idx >= 0 && !p)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.vacio}>No se encontró la lección.</Text>
      </View>
    );
  }

  if (terminada) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={56} color="#1B7A3D" />
        <Text style={styles.finTitulo} accessibilityRole="header">¡Terminaste la lección {data.leccion.numero}!</Text>
        <Text style={styles.vacio}>Repasaste las {total} preguntas.</Text>
        <Pressable
          style={({ pressed }) => [styles.btnPrimario, styles.btnAncho, pressed && styles.pressed]}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimarioText}>Volver</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnSecundario, styles.btnAncho, pressed && styles.pressed]}
          onPress={() => {
            setTerminada(false);
            setIdx(-1);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.btnSecundarioText}>Empezar de nuevo</Text>
        </Pressable>
      </View>
    );
  }

  const enInicio = idx < 0;
  const pct = enInicio ? 0 : Math.round(((idx + 1) / total) * 100);
  const l = data.leccion;
  const ultima = idx === total - 1;
  const preparando = escuchando && estadoVoz === 'preparando';

  return (
    <View style={styles.screen}>
      <View style={styles.cabecera}>
        <Text style={styles.leccionTitulo} numberOfLines={1}>
          {data.leccion.titulo}
        </Text>
        <Text style={styles.paso} accessibilityLiveRegion="polite">
          {enInicio ? `Inicio de la lección · ${total} preguntas` : `Pregunta ${idx + 1} de ${total}`}
        </Text>
        <View
          style={styles.barraBg}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Avance en la lección"
          accessibilityValue={{ min: 0, max: total, now: Math.max(idx + 1, 0), text: enInicio ? 'Inicio de la lección' : `Pregunta ${idx + 1} de ${total}` }}
        >
          <View style={[styles.barra, { width: `${pct}%` }]} />
        </View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {enInicio ? (
          <>
            {l.serie ? <Text style={styles.serie}>{l.serie.replace(/,\s*$/, '')}</Text> : null}
            <Text style={[styles.tituloGrande, conEscala(styles.tituloGrande, esc)]} accessibilityRole="header">
              {l.titulo}
            </Text>
            <Text style={styles.meta}>
              Lección {l.numero} · {fechaDiaMes(l.fecha)}
            </Text>

            <View style={styles.centralBox}>
              <Text style={styles.centralLabel}>Versículo central · {l.versiculo_central_cita}</Text>
              {l.versiculo_central_texto ? (
                <Text style={[styles.centralTexto, conEscala(styles.centralTexto, esc)]}>
                  {l.versiculo_central_texto}
                </Text>
              ) : null}
            </View>

            {l.introduccion ? (
              <View style={styles.notaBox}>
                <Text style={styles.notaTitulo}>Nota central</Text>
                <Text style={[styles.nota, conEscala(styles.nota, esc)]}>{l.introduccion}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.btnSecundario, styles.espacioArriba, pressed && styles.pressed]}
              onPress={escuchar}
              accessibilityRole="button"
              accessibilityLabel={escuchando ? 'Detener la lectura' : 'Escuchar el inicio de la lección'}
            >
              {preparando ? (
                <ActivityIndicator color="#185FA5" />
              ) : (
                <Ionicons name={escuchando ? 'stop' : 'volume-high-outline'} size={20} color="#185FA5" />
              )}
              <Text style={styles.btnSecundarioText}>
                {preparando ? 'Preparando audio…' : escuchando ? 'Detener' : 'Escuchar el inicio'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
        <Text style={[styles.pregunta, conEscala(styles.pregunta, esc)]} accessibilityRole="header">
          {p!.pregunta}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.btnSecundario, pressed && styles.pressed]}
          onPress={escuchar}
          accessibilityRole="button"
          accessibilityLabel={escuchando ? 'Detener la lectura' : `Escuchar la pregunta ${idx + 1}`}
        >
          {preparando ? (
            <ActivityIndicator color="#185FA5" />
          ) : (
            <Ionicons name={escuchando ? 'stop' : 'volume-high-outline'} size={20} color="#185FA5" />
          )}
          <Text style={styles.btnSecundarioText}>
            {preparando ? 'Preparando audio…' : escuchando ? 'Detener' : 'Escuchar esta pregunta'}
          </Text>
        </Pressable>

        {(p!.citas ?? []).map((c) => (
          <View key={c} style={styles.citaBox}>
            <Text style={styles.citaTitulo}>{c}</Text>
            <Text style={[styles.citaTexto, conEscala(styles.citaTexto, esc)]}>
              {data.citasTexto[c] ?? 'Texto no disponible.'}
            </Text>
          </View>
        ))}

        {p!.nota ? (
          <View style={styles.notaBox}>
            <Text style={styles.notaTitulo}>Nota</Text>
            <Text style={[styles.nota, conEscala(styles.nota, esc)]}>{p!.nota}</Text>
          </View>
        ) : null}

          </>
        )}
      </ScrollView>

      <View style={styles.pie}>
        <Pressable
          style={({ pressed }) => [styles.btnSecundario, styles.flex, enInicio && styles.deshabilitado, pressed && styles.pressed]}
          onPress={() => mover(-1)}
          disabled={enInicio}
          accessibilityRole="button"
          accessibilityLabel={idx === 0 ? 'Volver al inicio de la lección' : 'Pregunta anterior'}
          accessibilityState={{ disabled: enInicio }}
        >
          <Ionicons name="chevron-back" size={20} color="#185FA5" />
          <Text style={styles.btnSecundarioText}>Anterior</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnPrimario, styles.flex, pressed && styles.pressed]}
          onPress={ultima ? terminar : () => mover(1)}
          accessibilityRole="button"
          accessibilityLabel={ultima ? 'Terminar la lección' : enInicio ? 'Empezar con la pregunta 1' : 'Pregunta siguiente'}
        >
          <Text style={styles.btnPrimarioText}>{ultima ? 'Terminar' : enInicio ? 'Empezar' : 'Siguiente'}</Text>
          <Ionicons name={ultima ? 'checkmark' : 'chevron-forward'} size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFE8', padding: 24, gap: 10 },
  vacio: { fontSize: 15, color: '#5F5E5A', textAlign: 'center' },
  finTitulo: { fontSize: 20, fontWeight: '700', color: '#042C53', textAlign: 'center' },
  cabecera: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  leccionTitulo: { fontSize: 14, color: '#5F5E5A' },
  paso: { fontSize: 18, fontWeight: '700', color: '#185FA5', marginTop: 2 },
  barraBg: { height: 8, borderRadius: 999, backgroundColor: '#C7DEF5', overflow: 'hidden', marginTop: 8 },
  barra: { height: 8, borderRadius: 999, backgroundColor: '#185FA5' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  serie: { fontSize: 13, fontWeight: '600', color: '#185FA5', textTransform: 'uppercase', letterSpacing: 0.5 },
  tituloGrande: { fontSize: 24, fontWeight: '700', color: '#042C53', marginTop: 4 },
  meta: { fontSize: 14, color: '#5F5E5A', marginTop: 4 },
  centralBox: { backgroundColor: '#E6F1FB', borderRadius: 16, padding: 18, marginTop: 16 },
  centralLabel: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 8 },
  centralTexto: { fontSize: 18, lineHeight: 28, color: '#042C53', fontFamily: 'serif' },
  espacioArriba: { marginTop: 16 },
  pregunta: { fontSize: 19, lineHeight: 28, fontWeight: '600', color: '#042C53', marginBottom: 14 },
  citaBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#185FA5', padding: 14, marginTop: 12 },
  citaTitulo: { fontSize: 13, fontWeight: '600', color: '#0C447C', marginBottom: 6 },
  citaTexto: { fontSize: 17, lineHeight: 26, color: '#2C2C2A', fontFamily: 'serif' },
  notaBox: { backgroundColor: '#FDF6EA', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#BA7A1F', padding: 14, marginTop: 12 },
  notaTitulo: { fontSize: 12, fontWeight: '700', color: '#854F0B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  nota: { fontSize: 15, lineHeight: 23, color: '#2C2C2A' },
  pie: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, backgroundColor: '#F1EFE8' },
  flex: { flex: 1 },
  btnAncho: { alignSelf: 'stretch' },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  btnPrimarioText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  btnSecundarioText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  deshabilitado: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
