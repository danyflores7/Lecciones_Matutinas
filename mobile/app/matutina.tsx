import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { VistaMatutina } from '../components/VistaMatutina';
import type { VersiculoDia } from '../lib/supabase';
import { fechaDiaMes, fechaHoyISO, sumarDias } from '../lib/fechas';
import { getVersiculoLocal } from '../lib/contenido';

// La matutina de UN día (desde el Calendario, la búsqueda o el modo por voz),
// con paso al día anterior y al siguiente.
export default function Matutina() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fecha?: string }>();
  const fecha = params.fecha ?? fechaHoyISO();
  const [verse, setVerse] = useState<VersiculoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hayAnterior, setHayAnterior] = useState(false);
  const [haySiguiente, setHaySiguiente] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setVerse(await getVersiculoLocal(fecha));
      setHayAnterior(!!(await getVersiculoLocal(sumarDias(fecha, -1))));
      setHaySiguiente(!!(await getVersiculoLocal(sumarDias(fecha, 1))));
      setLoading(false);
    })();
  }, [fecha]);

  const ir = (n: number) => router.setParams({ fecha: sumarDias(fecha, n) });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#185FA5" />
        </View>
      ) : verse ? (
        <VistaMatutina verse={verse} onError={setAviso} />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.vacio}>No hay matutina para el {fechaDiaMes(fecha)}.</Text>
        </View>
      )}

      {aviso ? <Text style={styles.error}>{aviso}</Text> : null}

      <View style={styles.navegacion}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, !hayAnterior && styles.deshabilitado, pressed && styles.pressed]}
          onPress={() => ir(-1)}
          disabled={!hayAnterior}
          accessibilityRole="button"
          accessibilityLabel={`Día anterior: ${fechaDiaMes(sumarDias(fecha, -1))}`}
          accessibilityState={{ disabled: !hayAnterior }}
        >
          <Ionicons name="chevron-back" size={20} color="#185FA5" />
          <Text style={styles.navText}>Día anterior</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.navBtn, !haySiguiente && styles.deshabilitado, pressed && styles.pressed]}
          onPress={() => ir(1)}
          disabled={!haySiguiente}
          accessibilityRole="button"
          accessibilityLabel={`Día siguiente: ${fechaDiaMes(sumarDias(fecha, 1))}`}
          accessibilityState={{ disabled: !haySiguiente }}
        >
          <Text style={styles.navText}>Día siguiente</Text>
          <Ionicons name="chevron-forward" size={20} color="#185FA5" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  vacio: { fontSize: 15, color: '#5F5E5A', textAlign: 'center' },
  error: { color: '#A32D2D', fontSize: 13, marginTop: 16, textAlign: 'center' },
  navegacion: { flexDirection: 'row', gap: 10, marginTop: 24 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
  },
  navText: { fontSize: 15, fontWeight: '600', color: '#185FA5' },
  deshabilitado: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
