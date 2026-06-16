import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase, type VersiculoDia } from './lib/supabase';
import {
  cancelarRecordatorio,
  HORA_RECORDATORIO,
  pedirPermisoNotificaciones,
  programarRecordatorioDiario,
} from './lib/notifications';

const PREF_RECORDATORIO = 'recordatorio_activo';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaHoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fechaLarga(v: VersiculoDia): string {
  const dia = Number(v.fecha.slice(8, 10));
  const mes = MESES[Number(v.fecha.slice(5, 7)) - 1];
  return `${v.dia_semana} ${dia} de ${mes}`;
}

function horaTexto({ hour, minute }: { hour: number; minute: number }): string {
  const ampm = hour < 12 ? 'a.m.' : 'p.m.';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export default function App() {
  const [verse, setVerse] = useState<VersiculoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordatorio, setRecordatorio] = useState(false);

  const cargarVersiculo = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('versiculos_dia')
      .select('*')
      .eq('fecha', fechaHoyISO())
      .maybeSingle();

    if (error) setError(error.message);
    setVerse((data as VersiculoDia) ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      await cargarVersiculo();
      const guardado = await AsyncStorage.getItem(PREF_RECORDATORIO);
      setRecordatorio(guardado === '1');
      setLoading(false);
    })();
  }, [cargarVersiculo]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarVersiculo();
    setRefreshing(false);
  }, [cargarVersiculo]);

  const onToggleRecordatorio = useCallback(async (value: boolean) => {
    if (value) {
      const ok = await pedirPermisoNotificaciones();
      if (!ok) {
        setError('Activa los permisos de notificaciones para usar el recordatorio.');
        return;
      }
      await programarRecordatorioDiario();
    } else {
      await cancelarRecordatorio();
    }
    setRecordatorio(value);
    await AsyncStorage.setItem(PREF_RECORDATORIO, value ? '1' : '0');
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Matutinas</Text>
          <Text style={styles.brandSub}>Primer semestre 2026</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#185FA5" />
          </View>
        ) : verse ? (
          <>
            <Text style={styles.fecha}>{fechaLarga(verse)}</Text>
            <Text style={styles.tema}>{verse.tema}</Text>

            <View style={styles.card}>
              <Text style={styles.cita}>{verse.cita}</Text>
              <Text style={styles.texto}>{verse.texto ?? ''}</Text>
            </View>

            <View style={styles.recordatorio}>
              <View style={styles.recordatorioTexto}>
                <Text style={styles.recordatorioTitulo}>
                  Recordatorio diario · {horaTexto(HORA_RECORDATORIO)}
                </Text>
                <Text style={styles.recordatorioSub}>
                  Te avisamos cada mañana para repasar el versículo del día.
                </Text>
              </View>
              <Switch
                value={recordatorio}
                onValueChange={onToggleRecordatorio}
                trackColor={{ true: '#185FA5', false: '#D3D1C7' }}
              />
            </View>
          </>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.vacioTitulo}>No hay versículo para hoy</Text>
            <Text style={styles.vacioSub}>
              El plan cargado va del 1 de enero al 30 de junio de 2026.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F1EFE8',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  content: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 20 },
  brand: { fontSize: 26, fontWeight: '600', color: '#042C53' },
  brandSub: { fontSize: 14, color: '#5F5E5A', marginTop: 2 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  fecha: { fontSize: 14, color: '#5F5E5A', textTransform: 'capitalize' },
  tema: { fontSize: 18, fontWeight: '600', color: '#185FA5', marginTop: 2, marginBottom: 14 },
  card: {
    backgroundColor: '#E6F1FB',
    borderRadius: 18,
    padding: 22,
  },
  cita: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginBottom: 12 },
  texto: {
    fontSize: 21,
    lineHeight: 32,
    color: '#042C53',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  recordatorio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    gap: 12,
  },
  recordatorioTexto: { flex: 1 },
  recordatorioTitulo: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  recordatorioSub: { fontSize: 13, color: '#5F5E5A', marginTop: 3, lineHeight: 18 },
  vacioTitulo: { fontSize: 18, fontWeight: '600', color: '#2C2C2A' },
  vacioSub: { fontSize: 14, color: '#5F5E5A', textAlign: 'center' },
  error: { color: '#A32D2D', fontSize: 13, marginTop: 16, textAlign: 'center' },
});
