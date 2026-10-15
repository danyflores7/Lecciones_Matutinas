import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getVersiculoPorFecha, type VersiculoDia } from '../lib/supabase';
import { fechaHoyISO, fechaLarga } from '../lib/fechas';
import { guardarCache, leerCache } from '../lib/cache';
import { getVersiculoLocal } from '../lib/contenido';
import { conEscala, useEscalaTexto } from '../lib/escala';

type Nivel = 'facil' | 'medio' | 'dificil';

// Cada cuántas palabras ocultables se oculta una.
const PASO: Record<Nivel, number> = { facil: 3, medio: 2, dificil: 1 };
const LETRAS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g;

function esOcultable(token: string): boolean {
  return (token.match(LETRAS)?.length ?? 0) >= 2;
}

function enmascarar(token: string): string {
  return token.replace(LETRAS, '_');
}

export default function Memorizar() {
  const params = useLocalSearchParams<{ fecha?: string }>();
  const fecha = params.fecha ?? fechaHoyISO();

  const [verse, setVerse] = useState<VersiculoDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState<Nivel>('medio');
  const [revelados, setRevelados] = useState<Set<number>>(new Set());
  const esc = useEscalaTexto();

  useEffect(() => {
    (async () => {
      const local =
        (await getVersiculoLocal(fecha)) ?? (await leerCache<VersiculoDia>(`verse:${fecha}`));
      if (local) setVerse(local);
      try {
        const v = await getVersiculoPorFecha(fecha);
        if (v) {
          setVerse(v);
          guardarCache(`verse:${fecha}`, v);
        }
      } catch {
        // sin red: usamos lo cacheado
      }
      setLoading(false);
    })();
  }, [fecha]);

  const tokens = useMemo(() => (verse?.texto ?? '').split(' '), [verse]);

  const ocultos = useMemo(() => {
    const set = new Set<number>();
    const paso = PASO[nivel];
    let n = 0;
    tokens.forEach((t, i) => {
      if (esOcultable(t)) {
        if (n % paso === paso - 1) set.add(i);
        n++;
      }
    });
    return set;
  }, [tokens, nivel]);

  const cambiarNivel = (n: Nivel) => {
    setNivel(n);
    setRevelados(new Set());
  };

  const revelar = (i: number) =>
    setRevelados((prev) => {
      const s = new Set(prev);
      s.add(i);
      return s;
    });

  // Revela la siguiente palabra oculta en orden (también sirve con TalkBack,
  // donde las palabras sueltas del versículo no se pueden tocar una por una).
  const revelarSiguiente = () => {
    const siguiente = [...ocultos].sort((a, b) => a - b).find((i) => !revelados.has(i));
    if (siguiente !== undefined) revelar(siguiente);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    );
  }

  if (!verse) {
    return (
      <View style={styles.centered}>
        <Text style={styles.vacio}>No se encontró el versículo para esta fecha.</Text>
      </View>
    );
  }

  const totalOcultos = ocultos.size;
  const reveladosCount = [...ocultos].filter((i) => revelados.has(i)).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.fecha}>{fechaLarga(verse.fecha, verse.dia_semana)}</Text>
      <Text style={styles.tema}>{verse.tema}</Text>
      <Text style={styles.cita}>{verse.cita}</Text>

      <View style={styles.niveles} accessibilityRole="radiogroup" accessibilityLabel="Dificultad">
        {(['facil', 'medio', 'dificil'] as Nivel[]).map((n) => (
          <Pressable
            key={n}
            onPress={() => cambiarNivel(n)}
            accessibilityRole="radio"
            accessibilityState={{ checked: nivel === n }}
            style={[styles.nivelBtn, nivel === n && styles.nivelBtnActivo]}
          >
            <Text style={[styles.nivelText, nivel === n && styles.nivelTextActivo]}>
              {n === 'facil' ? 'Fácil' : n === 'medio' ? 'Medio' : 'Difícil'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={styles.card}
        accessible
        accessibilityLabel={tokens
          .map((t, i) => (ocultos.has(i) && !revelados.has(i) ? 'espacio en blanco' : t))
          .join(' ')}
      >
        <Text style={[styles.versiculo, conEscala(styles.versiculo, esc)]}>
          {tokens.map((t, i) => {
            const oculto = ocultos.has(i) && !revelados.has(i);
            return (
              <Text
                key={i}
                onPress={oculto ? () => revelar(i) : undefined}
                style={oculto ? styles.blank : undefined}
              >
                {oculto ? enmascarar(t) : t}
                {i < tokens.length - 1 ? ' ' : ''}
              </Text>
            );
          })}
        </Text>
      </View>

      <Text style={styles.ayuda} accessibilityLiveRegion="polite">
        {totalOcultos === 0
          ? 'Sin palabras ocultas en este nivel.'
          : `Toca una palabra en blanco para revelarla.  ${reveladosCount} de ${totalOcultos} reveladas.`}
      </Text>

      <View style={styles.acciones}>
        <Pressable
          style={({ pressed }) => [
            styles.btnRevelar,
            reveladosCount === totalOcultos && styles.deshabilitado,
            pressed && { opacity: 0.85 },
          ]}
          onPress={revelarSiguiente}
          disabled={reveladosCount === totalOcultos}
          accessibilityRole="button"
          accessibilityState={{ disabled: reveladosCount === totalOcultos }}
        >
          <Text style={styles.btnRevelarText}>Revelar una palabra</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.reiniciar, pressed && { opacity: 0.7 }]}
          onPress={() => setRevelados(new Set())}
          accessibilityRole="button"
          accessibilityLabel="Reiniciar: volver a ocultar las palabras"
        >
          <Text style={styles.reiniciarText}>Reiniciar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFE8', padding: 24 },
  vacio: { fontSize: 15, color: '#5F5E5A', textAlign: 'center' },
  fecha: { fontSize: 14, color: '#5F5E5A' },
  tema: { fontSize: 18, fontWeight: '600', color: '#185FA5', marginTop: 2 },
  cita: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginTop: 6, marginBottom: 14 },
  niveles: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  nivelBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6E6C66',
    alignItems: 'center',
  },
  nivelBtnActivo: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  nivelText: { fontSize: 14, fontWeight: '600', color: '#3D3C39' },
  nivelTextActivo: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22 },
  versiculo: {
    fontSize: 22,
    lineHeight: 36,
    color: '#042C53',
    fontFamily: 'serif',
  },
  blank: {
    color: '#185FA5',
    backgroundColor: '#E6F1FB',
    fontWeight: '600',
  },
  ayuda: { fontSize: 13, color: '#5F5E5A', marginTop: 16, textAlign: 'center' },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnRevelar: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#185FA5',
  },
  btnRevelarText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  deshabilitado: { opacity: 0.45 },
  reiniciar: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6E6C66',
    backgroundColor: '#FFFFFF',
  },
  reiniciarText: { fontSize: 15, fontWeight: '600', color: '#444441' },
});
