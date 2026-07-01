import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getTodosLosVersiculos, type VersiculoDia } from '../../lib/supabase';
import { diaDelMes, fechaHoyISO, mesAbrev, MESES } from '../../lib/fechas';
import { guardarCache, leerCache } from '../../lib/cache';

type Grupo = { tema: string; dias: VersiculoDia[] };
type Mes = { key: string; label: string; total: number; grupos: Grupo[] };
type Fila =
  | { tipo: 'mes'; mes: Mes; abierto: boolean }
  | { tipo: 'tema'; id: string; titulo: string }
  | { tipo: 'dia'; v: VersiculoDia };

function mesLabel(fechaISO: string): string {
  const n = MESES[Number(fechaISO.slice(5, 7)) - 1];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export default function Calendario() {
  const router = useRouter();
  const [items, setItems] = useState<VersiculoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hoy = fechaHoyISO();
  const mesHoy = hoy.slice(0, 7);
  // Al abrir, solo el mes actual está expandido (mínimo scroll).
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set([mesHoy]));

  useEffect(() => {
    (async () => {
      const cacheados = await leerCache<VersiculoDia[]>('versiculos_todos');
      if (cacheados) setItems(cacheados);
      try {
        const frescos = await getTodosLosVersiculos();
        setItems(frescos);
        guardarCache('versiculos_todos', frescos);
        setError(null);
      } catch (e: any) {
        if (!cacheados) setError(e?.message ?? 'No se pudieron cargar los versículos.');
      }
      setLoading(false);
    })();
  }, []);

  // Agrupa por mes y, dentro, en bloques contiguos del mismo tema (semanas del cuaderno).
  const meses = useMemo<Mes[]>(() => {
    const out: Mes[] = [];
    for (const v of items) {
      const mk = v.fecha.slice(0, 7);
      let mes = out[out.length - 1];
      if (!mes || mes.key !== mk) {
        mes = { key: mk, label: mesLabel(v.fecha), total: 0, grupos: [] };
        out.push(mes);
      }
      mes.total++;
      const g = mes.grupos[mes.grupos.length - 1];
      if (g && g.tema === v.tema) g.dias.push(v);
      else mes.grupos.push({ tema: v.tema, dias: [v] });
    }
    return out;
  }, [items]);

  // Aplana a filas según qué meses estén abiertos.
  const filas = useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    for (const mes of meses) {
      const abierto = abiertos.has(mes.key);
      out.push({ tipo: 'mes', mes, abierto });
      if (abierto) {
        for (const g of mes.grupos) {
          out.push({ tipo: 'tema', id: g.dias[0].fecha, titulo: g.tema });
          for (const v of g.dias) out.push({ tipo: 'dia', v });
        }
      }
    }
    return out;
  }, [meses, abiertos]);

  const toggle = (key: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

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
      <FlatList
        data={filas}
        keyExtractor={(f) => (f.tipo === 'mes' ? `m:${f.mes.key}` : f.tipo === 'tema' ? `t:${f.id}` : `d:${f.v.fecha}`)}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          if (item.tipo === 'mes') {
            const esMesHoy = item.mes.key === mesHoy;
            return (
              <Pressable
                style={({ pressed }) => [styles.mesFila, esMesHoy && styles.mesFilaHoy, pressed && styles.filaPressed]}
                onPress={() => toggle(item.mes.key)}
              >
                <Text style={[styles.mesNombre, esMesHoy && styles.mesNombreHoy]}>{item.mes.label}</Text>
                <View style={styles.mesCount}>
                  <Text style={styles.mesCountText}>{item.mes.total}</Text>
                </View>
                <Ionicons name={item.abierto ? 'chevron-up' : 'chevron-down'} size={20} color="#185FA5" />
              </Pressable>
            );
          }
          if (item.tipo === 'tema') {
            return <Text style={styles.seccion}>{item.titulo}</Text>;
          }
          const v = item.v;
          const esHoy = v.fecha === hoy;
          return (
            <Pressable
              style={({ pressed }) => [styles.fila, esHoy && styles.filaHoy, pressed && styles.filaPressed]}
              onPress={() => router.push({ pathname: '/memorizar', params: { fecha: v.fecha } })}
            >
              <View style={[styles.diaBox, esHoy && styles.diaBoxHoy]}>
                <Text style={[styles.diaNum, esHoy && styles.diaNumHoy]}>{diaDelMes(v.fecha)}</Text>
                <Text style={[styles.diaMes, esHoy && styles.diaNumHoy]}>{mesAbrev(v.fecha)}</Text>
              </View>
              <View style={styles.filaTexto}>
                <Text style={styles.cita}>{v.cita}</Text>
                <Text style={styles.dia} numberOfLines={1}>
                  {v.dia_semana}
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
  mesFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  mesFilaHoy: { borderWidth: 2, borderColor: '#185FA5' },
  mesNombre: { flex: 1, fontSize: 18, fontWeight: '700', color: '#042C53' },
  mesNombreHoy: { color: '#185FA5' },
  mesCount: { backgroundColor: '#E6F1FB', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, minWidth: 30, alignItems: 'center' },
  mesCountText: { fontSize: 12, fontWeight: '600', color: '#0C447C' },
  seccion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#185FA5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
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
