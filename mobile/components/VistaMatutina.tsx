import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import type { VersiculoDia } from '../lib/supabase';
import { fechaLarga } from '../lib/fechas';
import { segmentosMatutina } from '../lib/segmentos';
import { detenerVoz, reproducirPartes, useEstadoVoz } from '../lib/voz';
import { getVelocidad, setVelocidad } from '../lib/almacen';
import { conEscala, useEscalaTexto } from '../lib/escala';
import { SelectorVelocidad } from './SelectorVelocidad';

// La matutina de un día: fecha, tema, versículo, nota del cuaderno y las
// acciones (Escuchar como acción principal; Memorizar y Compartir debajo).
// La usan Inicio (hoy) y la pantalla Matutina (cualquier día del calendario).
export function VistaMatutina({
  verse,
  onError,
}: {
  verse: VersiculoDia;
  onError?: (mensaje: string) => void;
}) {
  const router = useRouter();
  const cardRef = useRef<View>(null);
  const esc = useEscalaTexto();
  const estadoVoz = useEstadoVoz();
  // ¿La lectura en curso es la de esta tarjeta? (la voz es global)
  const [propia, setPropia] = useState(false);
  const [velocidad, setVel] = useState(1.0);

  useEffect(() => {
    getVelocidad().then(setVel);
  }, []);

  useEffect(() => {
    if (estadoVoz === 'inactivo') setPropia(false);
  }, [estadoVoz]);

  // Al cambiar de día (o salir) se detiene la lectura de esta tarjeta.
  useEffect(() => {
    return () => {
      detenerVoz();
    };
  }, [verse.fecha]);

  const activa = propia && estadoVoz !== 'inactivo';
  const preparando = activa && estadoVoz === 'preparando';

  const alternarVoz = useCallback(() => {
    if (activa) {
      detenerVoz();
      setPropia(false);
      return;
    }
    if (!verse.texto) return;
    setPropia(true);
    reproducirPartes(segmentosMatutina(verse), { rate: velocidad });
  }, [activa, verse, velocidad]);

  const cambiarVelocidad = useCallback((v: number) => {
    setVel(v);
    setVelocidad(v);
  }, []);

  const [copiado, setCopiado] = useState(false);
  const compartir = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Escritorio: se copia el versículo para pegarlo donde se quiera.
      try {
        await navigator.clipboard.writeText(`${verse.cita}\n${verse.texto ?? ''}\n— Reina-Valera 1909`);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      } catch {
        onError?.('No se pudo copiar el versículo.');
      }
      return;
    }
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir versículo' });
      } else {
        onError?.('Compartir no está disponible en este dispositivo.');
      }
    } catch {
      onError?.('No se pudo compartir el versículo.');
    }
  }, [onError, verse]);

  return (
    <View>
      <Text style={styles.fecha}>{fechaLarga(verse.fecha, verse.dia_semana)}</Text>
      <Text style={[styles.tema, conEscala(styles.tema, esc)]} accessibilityRole="header">
        {verse.tema}
      </Text>

      <View ref={cardRef} collapsable={false} style={styles.card}>
        <Text style={[styles.cita, conEscala(styles.cita, esc)]}>{verse.cita}</Text>
        <Text style={[styles.texto, conEscala(styles.texto, esc)]}>{verse.texto ?? ''}</Text>
        <Text style={styles.cardFooter}>Matutinas · Reina-Valera 1909</Text>
      </View>

      {verse.nota ? (
        <View style={styles.notaBox}>
          <View style={styles.notaHead}>
            <Ionicons name="create-outline" size={16} color="#854F0B" />
            <Text style={styles.notaTitulo}>Nota del día</Text>
          </View>
          <Text style={[styles.notaTexto, conEscala(styles.notaTexto, esc)]}>{verse.nota}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.btnPrimario, pressed && styles.pressed]}
        onPress={alternarVoz}
        accessibilityRole="button"
        accessibilityLabel={activa ? 'Detener la lectura' : 'Escuchar la matutina'}
      >
        {preparando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name={activa ? 'stop' : 'volume-high-outline'} size={20} color="#FFFFFF" />
        )}
        <Text style={styles.btnPrimarioText}>
          {preparando ? 'Preparando audio…' : activa ? 'Detener' : 'Escuchar'}
        </Text>
      </Pressable>

      <SelectorVelocidad value={velocidad} onChange={cambiarVelocidad} />

      <View style={styles.filaBotones}>
        <Pressable
          style={({ pressed }) => [styles.btnSecundario, styles.btnFlex, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/memorizar', params: { fecha: verse.fecha } })}
          accessibilityRole="button"
          accessibilityLabel="Memorizar este versículo"
        >
          <Ionicons name="school-outline" size={20} color="#185FA5" />
          <Text style={styles.btnSecundarioText}>Memorizar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnSecundario, styles.btnFlex, pressed && styles.pressed]}
          onPress={compartir}
          accessibilityRole="button"
          accessibilityLabel={Platform.OS === 'web' ? 'Copiar el versículo' : 'Compartir el versículo como imagen'}
        >
          <Ionicons
            name={Platform.OS === 'web' ? (copiado ? 'checkmark' : 'copy-outline') : 'share-social-outline'}
            size={20}
            color="#185FA5"
          />
          <Text style={styles.btnSecundarioText}>
            {Platform.OS === 'web' ? (copiado ? 'Copiado' : 'Copiar') : 'Compartir'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fecha: { fontSize: 14, color: '#5F5E5A' },
  tema: { fontSize: 18, fontWeight: '600', color: '#185FA5', marginTop: 2, marginBottom: 14 },
  card: { backgroundColor: '#E6F1FB', borderRadius: 18, padding: 22 },
  cita: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginBottom: 12 },
  // Letra derecha (sin cursiva): se lee mejor en pasajes largos.
  texto: { fontSize: 21, lineHeight: 32, color: '#042C53', fontFamily: 'serif' },
  cardFooter: { fontSize: 12, color: '#185FA5', marginTop: 16, fontWeight: '600' },
  notaBox: {
    backgroundColor: '#FDF6EA',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#BA7A1F',
    padding: 16,
    marginTop: 12,
  },
  notaHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notaTitulo: { fontSize: 13, fontWeight: '700', color: '#854F0B', textTransform: 'uppercase', letterSpacing: 0.5 },
  notaTexto: { fontSize: 16, lineHeight: 24, color: '#2C2C2A' },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  btnPrimarioText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  filaBotones: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
    paddingVertical: 12,
  },
  btnFlex: { flex: 1 },
  btnSecundarioText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
