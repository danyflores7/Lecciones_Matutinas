import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { citaParaVoz, detenerVoz, reproducirPartes } from '../../lib/voz';
import { SelectorVelocidad } from '../../components/SelectorVelocidad';

import { getVersiculoPorFecha, type VersiculoDia } from '../../lib/supabase';
import { fechaHoyISO, fechaLarga, horaTexto } from '../../lib/fechas';
import { guardarCache, leerCache } from '../../lib/cache';
import {
  getHoraRecordatorio,
  getRecordatorioActivo,
  getVelocidad,
  type Hora,
  registrarVisitaYRacha,
  setHoraRecordatorio,
  setRecordatorioActivo,
  setVelocidad,
} from '../../lib/almacen';
import {
  cancelarRecordatorio,
  pedirPermisoNotificaciones,
  programarRecordatorioDiario,
} from '../../lib/notifications';

export default function Inicio() {
  const router = useRouter();
  const cardRef = useRef<View>(null);

  const [verse, setVerse] = useState<VersiculoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recordatorio, setRecordatorio] = useState(false);
  const [hora, setHora] = useState<Hora>({ hour: 6, minute: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [racha, setRacha] = useState(0);
  const [hablando, setHablando] = useState(false);
  const [velocidad, setVel] = useState(1.0);

  const cargar = useCallback(async () => {
    const hoy = fechaHoyISO();
    const cacheado = await leerCache<VersiculoDia>(`verse:${hoy}`);
    if (cacheado) {
      setVerse(cacheado);
      setError(null);
    }
    let hayVerso = !!cacheado;
    try {
      const v = await getVersiculoPorFecha(hoy);
      if (v) {
        setVerse(v);
        guardarCache(`verse:${hoy}`, v);
        hayVerso = true;
      } else if (!cacheado) {
        setVerse(null);
      }
      setError(null);
    } catch {
      if (!cacheado) setError('Sin conexión. Conéctate una vez para ver el versículo de hoy.');
    }
    if (hayVerso) setRacha(await registrarVisitaYRacha());
  }, []);

  useEffect(() => {
    (async () => {
      await cargar();
      setRecordatorio(await getRecordatorioActivo());
      setHora(await getHoraRecordatorio());
      setVel(await getVelocidad());
      setLoading(false);
    })();
  }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const onToggleRecordatorio = useCallback(
    async (value: boolean) => {
      if (value) {
        const ok = await pedirPermisoNotificaciones();
        if (!ok) {
          setError('Activa los permisos de notificaciones para usar el recordatorio.');
          return;
        }
        await programarRecordatorioDiario(hora.hour, hora.minute);
      } else {
        await cancelarRecordatorio();
      }
      setRecordatorio(value);
      await setRecordatorioActivo(value);
    },
    [hora]
  );

  const horaDate = useMemo(() => {
    const d = new Date();
    d.setHours(hora.hour, hora.minute, 0, 0);
    return d;
  }, [hora]);

  const onChangeHora = useCallback(
    async (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS !== 'ios') setShowPicker(false);
      if (event.type === 'dismissed' || !selected) return;
      const nueva: Hora = { hour: selected.getHours(), minute: selected.getMinutes() };
      setHora(nueva);
      await setHoraRecordatorio(nueva);
      if (recordatorio) await programarRecordatorioDiario(nueva.hour, nueva.minute);
    },
    [recordatorio]
  );

  const alternarVoz = useCallback(() => {
    if (hablando) {
      detenerVoz();
      setHablando(false);
      return;
    }
    if (!verse?.texto) return;
    setHablando(true);
    reproducirPartes([`${citaParaVoz(verse.cita)}.`, verse.texto], {
      rate: velocidad,
      onFin: () => setHablando(false),
    });
  }, [hablando, verse, velocidad]);

  const cambiarVelocidad = useCallback((v: number) => {
    setVel(v);
    setVelocidad(v);
  }, []);

  // Detiene la voz al salir de la pantalla.
  useEffect(() => {
    return () => {
      detenerVoz();
    };
  }, []);

  const compartir = useCallback(async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir versículo' });
      } else {
        setError('Compartir no está disponible en este dispositivo.');
      }
    } catch {
      setError('No se pudo compartir el versículo.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/logo-256.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandTextos}>
            <Text style={styles.brand}>Lecciones y Matutinas</Text>
            <Text style={styles.brandSub}>Primer semestre 2026</Text>
          </View>
          {racha > 0 ? (
            <View style={styles.racha}>
              <Ionicons name="flame" size={16} color="#854F0B" />
              <Text style={styles.rachaText}>
                {racha} {racha === 1 ? 'día' : 'días'}
              </Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#185FA5" />
          </View>
        ) : verse ? (
          <>
            <Text style={styles.fecha}>{fechaLarga(verse.fecha, verse.dia_semana)}</Text>
            <Text style={styles.tema}>{verse.tema}</Text>

            <View ref={cardRef} collapsable={false} style={styles.card}>
              <Text style={styles.cita}>{verse.cita}</Text>
              <Text style={styles.texto}>{verse.texto ?? ''}</Text>
              <Text style={styles.cardFooter}>Matutinas · Reina-Valera 1909</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.btnPrimario, pressed && styles.btnPressed]}
              onPress={() => router.push({ pathname: '/memorizar', params: { fecha: verse.fecha } })}
            >
              <Ionicons name="school-outline" size={20} color="#FFFFFF" />
              <Text style={styles.btnPrimarioText}>Memorizar este versículo</Text>
            </Pressable>

            <View style={styles.filaBotones}>
              <Pressable
                style={({ pressed }) => [styles.btnSecundario, styles.btnFlex, pressed && styles.btnPressed]}
                onPress={alternarVoz}
              >
                <Ionicons name={hablando ? 'stop' : 'volume-high-outline'} size={20} color="#185FA5" />
                <Text style={styles.btnSecundarioText}>{hablando ? 'Detener' : 'Escuchar'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnSecundario, styles.btnFlex, pressed && styles.btnPressed]}
                onPress={compartir}
              >
                <Ionicons name="share-social-outline" size={20} color="#185FA5" />
                <Text style={styles.btnSecundarioText}>Compartir</Text>
              </Pressable>
            </View>

            <SelectorVelocidad value={velocidad} onChange={cambiarVelocidad} />

            <View style={styles.recordatorio}>
              <View style={styles.recordatorioTexto}>
                <Text style={styles.recordatorioTitulo}>Recordatorio diario</Text>
                <Text style={styles.recordatorioSub}>
                  Aviso cada mañana a las {horaTexto(hora.hour, hora.minute)}.
                </Text>
                <Pressable onPress={() => setShowPicker(true)} hitSlop={8}>
                  <Text style={styles.cambiar}>Cambiar hora</Text>
                </Pressable>
              </View>
              <Switch
                value={recordatorio}
                onValueChange={onToggleRecordatorio}
                trackColor={{ true: '#185FA5', false: '#D3D1C7' }}
              />
            </View>

            {showPicker ? (
              Platform.OS === 'ios' ? (
                <View style={styles.pickerIOS}>
                  <DateTimePicker value={horaDate} mode="time" display="spinner" onChange={onChangeHora} />
                  <Pressable style={styles.listoBtn} onPress={() => setShowPicker(false)}>
                    <Text style={styles.listoText}>Listo</Text>
                  </Pressable>
                </View>
              ) : (
                <DateTimePicker value={horaDate} mode="time" is24Hour={false} onChange={onChangeHora} />
              )
            ) : null}
          </>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.vacioTitulo}>No hay versículo para hoy</Text>
            <Text style={styles.vacioSub}>
              El plan cargado va del 1 de enero al 30 de junio de 2026. Revisa el Calendario.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  logo: { width: 52, height: 52 },
  brandTextos: { flex: 1 },
  brand: { fontSize: 21, fontWeight: '600', color: '#042C53', lineHeight: 25 },
  brandSub: { fontSize: 14, color: '#5F5E5A', marginTop: 2 },
  racha: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FAEEDA', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  rachaText: { fontSize: 13, fontWeight: '600', color: '#854F0B' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  fecha: { fontSize: 14, color: '#5F5E5A', textTransform: 'capitalize' },
  tema: { fontSize: 18, fontWeight: '600', color: '#185FA5', marginTop: 2, marginBottom: 14 },
  card: { backgroundColor: '#E6F1FB', borderRadius: 18, padding: 22 },
  cita: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginBottom: 12 },
  texto: { fontSize: 21, lineHeight: 32, color: '#042C53', fontStyle: 'italic', fontFamily: 'serif' },
  cardFooter: { fontSize: 12, color: '#185FA5', marginTop: 16, fontWeight: '600' },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  btnPrimarioText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  btnSecundarioText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  filaBotones: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnFlex: { flex: 1, marginTop: 0 },
  btnPressed: { opacity: 0.85 },
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
  cambiar: { fontSize: 13, fontWeight: '600', color: '#185FA5', marginTop: 6 },
  pickerIOS: { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 12, paddingBottom: 8 },
  listoBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 8 },
  listoText: { fontSize: 16, fontWeight: '600', color: '#185FA5' },
  vacioTitulo: { fontSize: 18, fontWeight: '600', color: '#2C2C2A' },
  vacioSub: { fontSize: 14, color: '#5F5E5A', textAlign: 'center' },
  error: { color: '#A32D2D', fontSize: 13, marginTop: 16, textAlign: 'center' },
});
