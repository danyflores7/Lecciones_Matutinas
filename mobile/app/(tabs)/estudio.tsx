import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getLecciones, type Leccion } from '../../lib/supabase';
import { fechaDiaMes, fechaHoyISO, MESES } from '../../lib/fechas';
import { guardarCache, leerCache } from '../../lib/cache';

type Mes = { key: string; label: string; total: number; lecciones: Leccion[] };
type Fila = { tipo: 'mes'; mes: Mes; abierto: boolean } | { tipo: 'leccion'; l: Leccion };

function mesLabel(fechaISO: string): string {
  const n = MESES[Number(fechaISO.slice(5, 7)) - 1];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export default function Estudio() {
  const router = useRouter();
  const [items, setItems] = useState<Leccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mesHoy = fechaHoyISO().slice(0, 7);
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set([mesHoy]));

  useEffect(() => {
    (async () => {
      const cacheadas = await leerCache<Leccion[]>('lecciones');
      if (cacheadas) setItems(cacheadas);
      try {
        const frescas = await getLecciones();
        setItems(frescas);
        guardarCache('lecciones', frescas);
        setError(null);
      } catch (e: any) {
        if (!cacheadas) setError(e?.message ?? 'No se pudieron cargar las lecciones.');
      }
      setLoading(false);
    })();
  }, []);

  const meses = useMemo<Mes[]>(() => {
    const out: Mes[] = [];
    for (const l of items) {
      const mk = l.fecha.slice(0, 7);
      let mes = out[out.length - 1];
      if (!mes || mes.key !== mk) {
        mes = { key: mk, label: mesLabel(l.fecha), total: 0, lecciones: [] };
        out.push(mes);
      }
      mes.total++;
      mes.lecciones.push(l);
    }
    return out;
  }, [items]);

  // Si el mes actual no tiene lecciones, abre el último mes disponible.
  const abiertosEfectivo = useMemo<Set<string>>(() => {
    if (meses.some((m) => m.key === mesHoy)) return abiertos;
    const ultimo = meses[meses.length - 1]?.key;
    return ultimo ? new Set([...abiertos, ultimo]) : abiertos;
  }, [meses, abiertos, mesHoy]);

  const filas = useMemo<Fila[]>(() => {
    const out: Fila[] = [];
    for (const mes of meses) {
      const abierto = abiertosEfectivo.has(mes.key);
      out.push({ tipo: 'mes', mes, abierto });
      if (abierto) for (const l of mes.lecciones) out.push({ tipo: 'leccion', l });
    }
    return out;
  }, [meses, abiertosEfectivo]);

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
      <Text style={styles.titulo}>Estudio</Text>
      <FlatList
        data={filas}
        keyExtractor={(f) => (f.tipo === 'mes' ? `m:${f.mes.key}` : `l:${f.l.fecha}`)}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.error}>{error ?? 'Aún no hay lecciones.'}</Text>}
        renderItem={({ item }) => {
          if (item.tipo === 'mes') {
            const esMesHoy = item.mes.key === mesHoy;
            return (
              <Pressable
                style={({ pressed }) => [styles.mesFila, esMesHoy && styles.mesFilaHoy, pressed && styles.pressed]}
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
          const l = item.l;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/leccion', params: { fecha: l.fecha } })}
            >
              <View style={styles.cardHead}>
                <Text style={styles.num}>Lección {l.numero}</Text>
                <Text style={styles.fecha}>{fechaDiaMes(l.fecha)}</Text>
              </View>
              <Text style={styles.cardTitulo}>{l.titulo}</Text>
              {l.serie ? <Text style={styles.serie}>{l.serie}</Text> : null}
              <View style={styles.cardFoot}>
                <Text style={styles.central}>{l.versiculo_central_cita}</Text>
                <Ionicons name="chevron-forward" size={18} color="#B4B2A9" />
              </View>
            </Pressable>
          );
        }}
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
    marginBottom: 2,
    gap: 10,
  },
  mesFilaHoy: { borderWidth: 2, borderColor: '#185FA5' },
  mesNombre: { flex: 1, fontSize: 18, fontWeight: '700', color: '#042C53' },
  mesNombreHoy: { color: '#185FA5' },
  mesCount: { backgroundColor: '#E6F1FB', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, minWidth: 30, alignItems: 'center' },
  mesCountText: { fontSize: 12, fontWeight: '600', color: '#0C447C' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 10 },
  pressed: { opacity: 0.7 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  num: { fontSize: 13, fontWeight: '600', color: '#185FA5', textTransform: 'uppercase', letterSpacing: 0.5 },
  fecha: { fontSize: 13, color: '#5F5E5A', textTransform: 'capitalize' },
  cardTitulo: { fontSize: 17, fontWeight: '600', color: '#042C53' },
  serie: { fontSize: 13, color: '#5F5E5A', marginTop: 2 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  central: { fontSize: 14, fontWeight: '600', color: '#0C447C' },
  error: { color: '#A32D2D', fontSize: 13, textAlign: 'center', padding: 24 },
});
