import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getVersiculoPorFecha, type VersiculoDia } from '../lib/supabase';
import { fechaHoyISO, fechaLarga } from '../lib/fechas';
import { guardarCache, leerCache } from '../lib/cache';

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

  useEffect(() => {
    (async () => {
      const cacheado = await leerCache<VersiculoDia>(`verse:${fecha}`);
      if (cacheado) setVerse(cacheado);
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

      <View style={styles.niveles}>
        {(['facil', 'medio', 'dificil'] as Nivel[]).map((n) => (
          <Pressable
            key={n}
            onPress={() => cambiarNivel(n)}
            style={[styles.nivelBtn, nivel === n && styles.nivelBtnActivo]}
          >
            <Text style={[styles.nivelText, nivel === n && styles.nivelTextActivo]}>
              {n === 'facil' ? 'Fácil' : n === 'medio' ? 'Medio' : 'Difícil'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.versiculo}>
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

      <Text style={styles.ayuda}>
        {totalOcultos === 0
          ? 'Sin palabras ocultas en este nivel.'
          : `Toca una palabra en blanco para revelarla.  ${reveladosCount}/${totalOcultos} reveladas.`}
      </Text>

      <Pressable style={({ pressed }) => [styles.reiniciar, pressed && { opacity: 0.7 }]} onPress={() => setRevelados(new Set())}>
        <Text style={styles.reiniciarText}>Reiniciar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EFE8', padding: 24 },
  vacio: { fontSize: 15, color: '#5F5E5A', textAlign: 'center' },
  fecha: { fontSize: 14, color: '#5F5E5A', textTransform: 'capitalize' },
  tema: { fontSize: 18, fontWeight: '600', color: '#185FA5', marginTop: 2 },
  cita: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginTop: 6, marginBottom: 14 },
  niveles: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  nivelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E3DB',
    alignItems: 'center',
  },
  nivelBtnActivo: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  nivelText: { fontSize: 14, fontWeight: '600', color: '#5F5E5A' },
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
  reiniciar: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B4B2A9',
  },
  reiniciarText: { fontSize: 15, fontWeight: '600', color: '#444441' },
});
