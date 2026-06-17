import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getLecciones, type Leccion } from '../../lib/supabase';
import { fechaDiaMes } from '../../lib/fechas';

export default function Estudio() {
  const router = useRouter();
  const [items, setItems] = useState<Leccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItems(await getLecciones());
      } catch (e: any) {
        setError(e?.message ?? 'No se pudieron cargar las lecciones.');
      }
      setLoading(false);
    })();
  }, []);

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
        data={items}
        keyExtractor={(it) => String(it.numero)}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.error}>{error ?? 'Aún no hay lecciones.'}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/leccion', params: { numero: String(item.numero) } })}
          >
            <View style={styles.cardHead}>
              <Text style={styles.num}>Lección {item.numero}</Text>
              <Text style={styles.fecha}>{fechaDiaMes(item.fecha)}</Text>
            </View>
            <Text style={styles.cardTitulo}>{item.titulo}</Text>
            {item.serie ? <Text style={styles.serie}>{item.serie}</Text> : null}
            <View style={styles.cardFoot}>
              <Text style={styles.central}>{item.versiculo_central_cita}</Text>
              <Ionicons name="chevron-forward" size={18} color="#B4B2A9" />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1EFE8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: '600', color: '#042C53', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  lista: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
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
