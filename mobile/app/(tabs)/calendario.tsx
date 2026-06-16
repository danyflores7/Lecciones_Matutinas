import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getTodosLosVersiculos, type VersiculoDia } from '../../lib/supabase';
import { diaDelMes, fechaHoyISO, mesAbrev } from '../../lib/fechas';

type Seccion = { title: string; data: VersiculoDia[] };

export default function Calendario() {
  const router = useRouter();
  const [items, setItems] = useState<VersiculoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getTodosLosVersiculos());
      } catch (e: any) {
        setError(e?.message ?? 'No se pudieron cargar los versículos.');
      }
      setLoading(false);
    })();
  }, []);

  // Agrupa por bloques contiguos del mismo tema (como las semanas del cuaderno).
  const secciones = useMemo<Seccion[]>(() => {
    const out: Seccion[] = [];
    for (const v of items) {
      const ultima = out[out.length - 1];
      if (ultima && ultima.title === v.tema) ultima.data.push(v);
      else out.push({ title: v.tema, data: [v] });
    }
    return out;
  }, [items]);

  const hoy = fechaHoyISO();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#185FA5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.titulo}>Calendario</Text>
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.fecha}
        contentContainerStyle={styles.lista}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.seccion}>{section.title}</Text>}
        renderItem={({ item }) => {
          const esHoy = item.fecha === hoy;
          return (
            <Pressable
              style={({ pressed }) => [styles.fila, esHoy && styles.filaHoy, pressed && styles.filaPressed]}
              onPress={() => router.push({ pathname: '/memorizar', params: { fecha: item.fecha } })}
            >
              <View style={[styles.diaBox, esHoy && styles.diaBoxHoy]}>
                <Text style={[styles.diaNum, esHoy && styles.diaNumHoy]}>{diaDelMes(item.fecha)}</Text>
                <Text style={[styles.diaMes, esHoy && styles.diaNumHoy]}>{mesAbrev(item.fecha)}</Text>
              </View>
              <View style={styles.filaTexto}>
                <Text style={styles.cita}>{item.cita}</Text>
                <Text style={styles.dia} numberOfLines={1}>
                  {item.dia_semana}
                  {esHoy ? ' · hoy' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B4B2A9" />
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.error}>{error ?? 'Sin datos.'}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1EFE8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: '600', color: '#042C53', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  lista: { paddingHorizontal: 16, paddingBottom: 32 },
  seccion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#185FA5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  filaHoy: { borderWidth: 2, borderColor: '#185FA5' },
  filaPressed: { opacity: 0.7 },
  diaBox: { width: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F1FB', borderRadius: 10, paddingVertical: 6 },
  diaBoxHoy: { backgroundColor: '#185FA5' },
  diaNum: { fontSize: 18, fontWeight: '600', color: '#0C447C' },
  diaNumHoy: { color: '#FFFFFF' },
  diaMes: { fontSize: 11, color: '#0C447C', textTransform: 'uppercase' },
  filaTexto: { flex: 1 },
  cita: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  dia: { fontSize: 13, color: '#5F5E5A', marginTop: 2, textTransform: 'capitalize' },
  error: { color: '#A32D2D', fontSize: 13, textAlign: 'center', padding: 24 },
});
