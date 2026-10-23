import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { VistaMatutina } from '../../components/VistaMatutina';
import { getVersiculoPorFecha, type Leccion, type VersiculoDia } from '../../lib/supabase';
import { fechaHoyISO, horaTexto } from '../../lib/fechas';
import { guardarCache, leerCache } from '../../lib/cache';
import { getLeccionesLocal, getVersiculoLocal, leccionVigente } from '../../lib/contenido';
import { bienvenidaVista, getProgreso, type Progreso } from '../../lib/progreso';
import {
  getHoraRecordatorio,
  getRecordatorioActivo,
  type Hora,
  registrarVisitaYRacha,
  setHoraRecordatorio,
  setRecordatorioActivo,
} from '../../lib/almacen';
import {
  cancelarRecordatorio,
  pedirPermisoNotificaciones,
  programarRecordatorioDiario,
} from '../../lib/notifications';

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

export default function Inicio() {
  const router = useRouter();

  const [verse, setVerse] = useState<VersiculoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sinRed, setSinRed] = useState(false);

  const [recordatorio, setRecordatorio] = useState(false);
  const [hora, setHora] = useState<Hora>({ hour: 6, minute: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [avisoRecordatorio, setAvisoRecordatorio] = useState<Aviso>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [racha, setRacha] = useState(0);
  const [leccion, setLeccion] = useState<Leccion | null>(null);
  const [progreso, setProgresoLeccion] = useState<Progreso | null>(null);

  const cargar = useCallback(async () => {
    const hoy = fechaHoyISO();
    // Primero lo que ya está en el teléfono (incluye la copia que trae la app),
    // luego la red para tener lo más reciente.
    const local =
      (await getVersiculoLocal(hoy)) ?? (await leerCache<VersiculoDia>(`verse:${hoy}`));
    if (local) {
      setVerse(local);
      setLoading(false); // se muestra ya; la red solo actualiza
    }
    let hayVerso = !!local;
    let fallo = false;
    try {
      const v = await getVersiculoPorFecha(hoy);
      if (v) {
        setVerse(v);
        guardarCache(`verse:${hoy}`, v);
        hayVerso = true;
      }
    } catch {
      fallo = true;
    }
    // Solo importa la red si no hubo nada local que mostrar.
    setSinRed(fallo && !hayVerso);
    if (hayVerso) setRacha(await registrarVisitaYRacha());
  }, []);

  useEffect(() => {
    (async () => {
      await cargar();
      setRecordatorio(await getRecordatorioActivo());
      setHora(await getHoraRecordatorio());
      setLoading(false);
      // Primera vez: explicar en 3 pasos qué hace la app.
      if (!(await bienvenidaVista())) router.push('/bienvenida');
    })();
  }, [cargar, router]);

  // La lección de esta semana y en qué pregunta se quedó (al volver a Inicio).
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const l = leccionVigente(await getLeccionesLocal(), fechaHoyISO());
        setLeccion(l);
        setProgresoLeccion(l ? await getProgreso(l.fecha) : null);
      })();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  // Activa el recordatorio a la hora dada. Devuelve false si no hay permiso.
  const activarRecordatorio = useCallback(async (h: Hora): Promise<boolean> => {
    const ok = await pedirPermisoNotificaciones();
    if (!ok) {
      setAvisoRecordatorio({
        tipo: 'error',
        texto: 'Para recibir el aviso, permite las notificaciones de la app en los ajustes del teléfono.',
      });
      return false;
    }
    await programarRecordatorioDiario(h.hour, h.minute);
    setRecordatorio(true);
    await setRecordatorioActivo(true);
    setAvisoRecordatorio({
      tipo: 'ok',
      texto: `Listo: te avisaré cada día a las ${horaTexto(h.hour, h.minute)}.`,
    });
    return true;
  }, []);

  const onToggleRecordatorio = useCallback(
    async (value: boolean) => {
      if (value) {
        await activarRecordatorio(hora);
      } else {
        await cancelarRecordatorio();
        setRecordatorio(false);
        await setRecordatorioActivo(false);
        setAvisoRecordatorio({ tipo: 'ok', texto: 'Recordatorio desactivado.' });
      }
    },
    [hora, activarRecordatorio]
  );

  const horaDate = useMemo(() => {
    const d = new Date();
    d.setHours(hora.hour, hora.minute, 0, 0);
    return d;
  }, [hora]);

  // Elegir una hora ya ES pedir el recordatorio: se activa al momento.
  const onChangeHora = useCallback(
    async (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS !== 'ios') setShowPicker(false);
      if (event.type === 'dismissed' || !selected) return;
      const nueva: Hora = { hour: selected.getHours(), minute: selected.getMinutes() };
      setHora(nueva);
      await setHoraRecordatorio(nueva);
      await activarRecordatorio(nueva);
    },
    [activarRecordatorio]
  );

  const textoLeccion = (() => {
    if (!leccion) return null;
    const total = progreso?.total ?? 0;
    if (progreso?.terminada) return 'Ya la terminaste. ¿Repasarla?';
    if (progreso && progreso.pregunta > 1) return `Continuar en la pregunta ${progreso.pregunta} de ${total}`;
    return 'Estudiar pregunta por pregunta';
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo-256.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <View style={styles.brandTextos}>
            <Text style={styles.brand} accessibilityRole="header">Lecciones y Matutinas</Text>
            <Text style={styles.brandSub}>Año 2026</Text>
          </View>
          {racha > 0 ? (
            <View
              style={styles.racha}
              accessible
              accessibilityLabel={`Racha: ${racha} ${racha === 1 ? 'día seguido' : 'días seguidos'} abriendo la matutina`}
            >
              <Ionicons name="flame" size={16} color="#854F0B" />
              <Text style={styles.rachaText}>
                {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modo por voz: escuchar y navegar hablando"
          style={({ pressed }) => [styles.vozModoBtn, pressed && styles.btnPressed]}
          onPress={() => router.navigate('/asistente')}
        >
          <Ionicons name="mic" size={22} color="#0C447C" />
          <Text style={styles.vozModoText}>Modo por voz</Text>
        </Pressable>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#185FA5" />
          </View>
        ) : verse ? (
          <VistaMatutina verse={verse} onError={setAviso} />
        ) : sinRed ? (
          <View style={styles.vacio}>
            <Ionicons name="cloud-offline-outline" size={36} color="#5F5E5A" />
            <Text style={styles.vacioTitulo}>No pude cargar la matutina de hoy</Text>
            <Text style={styles.vacioSub}>Revisa tu conexión a internet e inténtalo de nuevo.</Text>
            <Pressable
              style={({ pressed }) => [styles.btnSecundario, pressed && styles.btnPressed]}
              onPress={onRefresh}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={20} color="#185FA5" />
              <Text style={styles.btnSecundarioText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>No hay matutina para hoy</Text>
            <Text style={styles.vacioSub}>
              El plan cargado va del 1 de enero al 31 de diciembre de 2026.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.btnSecundario, pressed && styles.btnPressed]}
              onPress={() => router.navigate('/calendario')}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={20} color="#185FA5" />
              <Text style={styles.btnSecundarioText}>Abrir el calendario</Text>
            </Pressable>
          </View>
        )}

        {aviso ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {aviso}
          </Text>
        ) : null}

        {leccion && !loading ? (
          <Pressable
            style={({ pressed }) => [styles.leccionCard, pressed && styles.btnPressed]}
            onPress={() => router.push({ pathname: '/estudiar', params: { fecha: leccion.fecha } })}
            accessibilityRole="button"
            accessibilityLabel={`Lección de esta semana: lección ${leccion.numero}, ${leccion.titulo}. ${textoLeccion}`}
          >
            <View style={styles.leccionTextos}>
              <Text style={styles.leccionEtiqueta}>Lección de esta semana</Text>
              <Text style={styles.leccionTitulo} numberOfLines={2}>
                {leccion.numero}. {leccion.titulo}
              </Text>
              <Text style={styles.leccionAccion}>{textoLeccion}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6E6C66" />
          </Pressable>
        ) : null}

        {!loading && Platform.OS !== 'web' ? (
          <View style={styles.recordatorio}>
            <View style={styles.recordatorioFila}>
              <View style={styles.recordatorioTexto}>
                <Text style={styles.recordatorioTitulo}>Recordatorio de matutina</Text>
                <Text style={styles.recordatorioSub}>
                  {recordatorio
                    ? `Activo: cada día a las ${horaTexto(hora.hour, hora.minute)}.`
                    : 'Desactivado. Elige una hora y te aviso cada mañana.'}
                </Text>
              </View>
              <Switch
                value={recordatorio}
                onValueChange={onToggleRecordatorio}
                trackColor={{ true: '#185FA5', false: '#7A786F' }}
                accessibilityLabel="Recordatorio de matutina"
                accessibilityHint={`Aviso diario a las ${horaTexto(hora.hour, hora.minute)}`}
              />
            </View>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={({ pressed }) => [styles.horaBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Elegir la hora del recordatorio. Ahora: ${horaTexto(hora.hour, hora.minute)}`}
            >
              <Ionicons name="time-outline" size={18} color="#185FA5" />
              <Text style={styles.horaBtnText}>
                {recordatorio ? 'Cambiar hora' : 'Elegir hora'} ({horaTexto(hora.hour, hora.minute)})
              </Text>
            </Pressable>
            {avisoRecordatorio ? (
              <Text
                style={[styles.avisoRec, avisoRecordatorio.tipo === 'error' && styles.avisoRecError]}
                accessibilityLiveRegion="polite"
              >
                {avisoRecordatorio.texto}
              </Text>
            ) : null}
          </View>
        ) : null}

        {showPicker && Platform.OS !== 'web' ? (
          Platform.OS === 'ios' ? (
            <View style={styles.pickerIOS}>
              <DateTimePicker value={horaDate} mode="time" display="spinner" onChange={onChangeHora} />
              <Pressable
                style={styles.listoBtn}
                onPress={() => setShowPicker(false)}
                accessibilityRole="button"
              >
                <Text style={styles.listoText}>Listo</Text>
              </Pressable>
            </View>
          ) : (
            <DateTimePicker value={horaDate} mode="time" is24Hour={false} onChange={onChangeHora} />
          )
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustes: tamaño de letra, audio sin conexión y ayuda"
          style={({ pressed }) => [styles.ajustesRow, pressed && styles.btnPressed]}
          onPress={() => router.push('/ajustes')}
        >
          <Ionicons name="settings-outline" size={20} color="#185FA5" />
          <Text style={styles.ajustesText}>Ajustes (letra, audio y ayuda)</Text>
          <Ionicons name="chevron-forward" size={18} color="#6E6C66" />
        </Pressable>
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
  vacio: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  vacioTitulo: { fontSize: 18, fontWeight: '600', color: '#2C2C2A', textAlign: 'center' },
  vacioSub: { fontSize: 14, color: '#5F5E5A', textAlign: 'center' },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  btnSecundarioText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  btnPressed: { opacity: 0.85 },
  leccionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 22,
  },
  leccionTextos: { flex: 1 },
  leccionEtiqueta: { fontSize: 12, fontWeight: '700', color: '#185FA5', textTransform: 'uppercase', letterSpacing: 0.5 },
  leccionTitulo: { fontSize: 16, fontWeight: '600', color: '#042C53', marginTop: 4 },
  leccionAccion: { fontSize: 14, color: '#0C447C', marginTop: 6, fontWeight: '600' },
  recordatorio: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  recordatorioFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordatorioTexto: { flex: 1 },
  recordatorioTitulo: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  recordatorioSub: { fontSize: 13, color: '#5F5E5A', marginTop: 3, lineHeight: 18 },
  horaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingRight: 12,
  },
  horaBtnText: { fontSize: 14, fontWeight: '600', color: '#185FA5' },
  avisoRec: { fontSize: 13, color: '#1B7A3D', fontWeight: '600', lineHeight: 18 },
  avisoRecError: { color: '#A32D2D' },
  ajustesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  ajustesText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  vozModoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    backgroundColor: '#E6F1FB',
    borderWidth: 1,
    borderColor: '#185FA5',
    borderRadius: 14,
    marginBottom: 20,
  },
  vozModoText: { color: '#0C447C', fontSize: 17, fontWeight: '700' },
  pickerIOS: { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 12, paddingBottom: 8 },
  listoBtn: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 8 },
  listoText: { fontSize: 16, fontWeight: '600', color: '#185FA5' },
  error: { color: '#A32D2D', fontSize: 13, marginTop: 16, textAlign: 'center' },
});
