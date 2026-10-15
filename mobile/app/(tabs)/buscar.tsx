import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { citaHablada, normalizar, parseCita } from '../../lib/citas';
import { bibliaDisponible, buscarEnBiblia, obtenerVersiculo, versiculosRelacionados } from '../../lib/biblia';
import { buscarTextoLocal, dondeSeCita, type LugarCita } from '../../lib/contenido';
import { fechaDiaMes } from '../../lib/fechas';

type Ambito = 'biblia' | 'lecciones';

// Una fila de resultados: un versículo (con su texto) o un lugar de la app.
type Resultado =
  | { tipo: 'titulo'; id: string; texto: string }
  | { tipo: 'versiculo'; id: string; cita: string; texto: string }
  | { tipo: 'lugar'; id: string; lugar: LugarCita }
  | { tipo: 'aviso'; id: string; texto: string };

const EJEMPLOS = ['Juan 3:16', 'Salmos 23', 'no temas', 'bienaventurados'];

// Si lo escrito es una cita ("Juan 3:16", "juan 3 16", "1 Juan 4:8"), la
// devuelve en forma canónica; si no, null.
function citaEscrita(q: string): string | null {
  const hablada = citaHablada(normalizar(q).replace(/[^a-z0-9: ]/g, ' ').replace(/\s+/g, ' ').trim());
  if (hablada) return hablada;
  const directa = parseCita(q.replace(/\s*[.,]\s*/g, ':'));
  return directa ? `${directa.libro} ${directa.capitulo}:${directa.verso ?? 1}` : null;
}

export default function Buscar() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [ambito, setAmbito] = useState<Ambito>('biblia');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [resumen, setResumen] = useState('');

  const buscar = useCallback(
    async (texto = q, en: Ambito = ambito) => {
      const consulta = texto.trim();
      if (!consulta) return;
      Keyboard.dismiss();
      setBuscando(true);
      const out: Resultado[] = [];
      const cita = citaEscrita(consulta);
      if (cita) {
        // Una cita: su texto, dónde se cita en la app y versículos relacionados.
        const v = await obtenerVersiculo(cita);
        if (v) out.push({ tipo: 'versiculo', id: `v:${v.cita}`, cita: v.cita, texto: v.texto });
        else if (!(await bibliaDisponible()))
          out.push({ tipo: 'aviso', id: 'sinbiblia', texto: 'La Biblia completa aún se está descargando. Conéctate a internet un momento y vuelve a intentar.' });
        else out.push({ tipo: 'aviso', id: 'noexiste', texto: `No encontré ${cita}. Revisa el capítulo y el versículo.` });
        const lugares = await dondeSeCita(cita);
        if (lugares.length) {
          out.push({ tipo: 'titulo', id: 't:lugares', texto: `Dónde aparece en la app (${lugares.length})` });
          lugares.forEach((l, i) => out.push({ tipo: 'lugar', id: `l:${i}`, lugar: l }));
        }
        const rel = await versiculosRelacionados(cita);
        if (rel.length) {
          out.push({ tipo: 'titulo', id: 't:rel', texto: 'Versículos relacionados' });
          rel.slice(0, 6).forEach((r) => out.push({ tipo: 'versiculo', id: `r:${r.cita}`, cita: r.cita, texto: r.texto }));
        }
        setResumen(v ? `${v.cita}` : '');
      } else {
        const encontrados =
          en === 'biblia' ? await buscarEnBiblia(consulta, 12) : (await buscarTextoLocal(consulta, 12)).map((r) => ({ cita: r.etiqueta, texto: r.texto }));
        encontrados.forEach((r) => out.push({ tipo: 'versiculo', id: `b:${r.cita}`, cita: r.cita, texto: r.texto }));
        if (!encontrados.length) {
          const sinBiblia = en === 'biblia' && !(await bibliaDisponible());
          out.push({
            tipo: 'aviso',
            id: 'nada',
            texto: sinBiblia
              ? 'La Biblia completa aún se está descargando. Conéctate a internet un momento o busca en "Lecciones".'
              : 'No encontré ese texto. Prueba con menos palabras o con otras que recuerdes.',
          });
        }
        setResumen(
          encontrados.length
            ? `${encontrados.length} ${encontrados.length === 1 ? 'resultado' : 'resultados'} en ${en === 'biblia' ? 'la Biblia' : 'las lecciones y matutinas'}`
            : ''
        );
      }
      setResultados(out);
      setBuscando(false);
    },
    [q, ambito]
  );

  const abrirLugar = (l: LugarCita) => {
    if (l.tipo === 'matutina') router.push({ pathname: '/matutina', params: { fecha: l.fecha } });
    else if (l.tipo === 'pregunta')
      router.push({ pathname: '/estudiar', params: { fecha: l.leccionFecha, pregunta: String(l.orden) } });
    else router.push({ pathname: '/leccion', params: { fecha: l.leccionFecha } });
  };

  const etiquetaLugar = (l: LugarCita) =>
    l.tipo === 'matutina'
      ? { arriba: `Matutina del ${fechaDiaMes(l.fecha)}`, abajo: l.tema }
      : l.tipo === 'central'
        ? { arriba: `Lección ${l.leccionNumero} · versículo central`, abajo: l.leccionTitulo }
        : { arriba: `Lección ${l.leccionNumero} · pregunta ${l.orden}`, abajo: l.pregunta };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.titulo} accessibilityRole="header">Buscar</Text>

      <View style={styles.cajaFila}>
        <View style={styles.caja}>
          <Ionicons name="search" size={20} color="#5F5E5A" />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => buscar()}
            placeholder="Juan 3:16 o unas palabras"
            placeholderTextColor="#6E6C66"
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Buscar una cita o unas palabras"
            autoCorrect={false}
          />
          {q ? (
            <Pressable
              onPress={() => {
                setQ('');
                setResultados(null);
              }}
              style={styles.limpiar}
              accessibilityRole="button"
              accessibilityLabel="Borrar la búsqueda"
            >
              <Ionicons name="close-circle" size={20} color="#6E6C66" />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => buscar()}
          style={({ pressed }) => [styles.btnBuscar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Buscar"
        >
          <Text style={styles.btnBuscarText}>Buscar</Text>
        </Pressable>
      </View>

      <View style={styles.ambitos} accessibilityRole="radiogroup" accessibilityLabel="Dónde buscar palabras">
        {(['biblia', 'lecciones'] as Ambito[]).map((a) => (
          <Pressable
            key={a}
            onPress={() => {
              setAmbito(a);
              if (q.trim() && resultados) buscar(q, a);
            }}
            style={[styles.ambito, ambito === a && styles.ambitoActivo]}
            accessibilityRole="radio"
            accessibilityState={{ checked: ambito === a }}
          >
            <Text style={[styles.ambitoText, ambito === a && styles.ambitoTextActivo]}>
              {a === 'biblia' ? 'En toda la Biblia' : 'En lecciones y matutinas'}
            </Text>
          </Pressable>
        ))}
      </View>

      {buscando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color="#185FA5" />
        </View>
      ) : resultados === null ? (
        <View style={styles.ayuda}>
          <Text style={styles.ayudaTexto}>
            Escribe una cita para leerla y ver dónde aparece en las lecciones, o unas palabras que
            recuerdes para encontrar el versículo.
          </Text>
          <View style={styles.ejemplos}>
            {EJEMPLOS.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  setQ(e);
                  buscar(e);
                }}
                style={({ pressed }) => [styles.ejemplo, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Buscar ${e}`}
              >
                <Text style={styles.ejemploText}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={resultados}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.lista}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            resumen ? (
              <Text style={styles.resumen} accessibilityLiveRegion="polite">
                {resumen}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.tipo === 'titulo') {
              return (
                <Text style={styles.seccion} accessibilityRole="header">
                  {item.texto}
                </Text>
              );
            }
            if (item.tipo === 'aviso') return <Text style={styles.aviso}>{item.texto}</Text>;
            if (item.tipo === 'versiculo') {
              return (
                <View style={styles.tarjeta} accessible accessibilityLabel={`${item.cita}. ${item.texto}`}>
                  <Text style={styles.cita}>{item.cita}</Text>
                  <Text style={styles.texto}>{item.texto}</Text>
                </View>
              );
            }
            const e = etiquetaLugar(item.lugar);
            return (
              <Pressable
                onPress={() => abrirLugar(item.lugar)}
                style={({ pressed }) => [styles.tarjeta, styles.tarjetaLugar, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${e.arriba}. ${e.abajo}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.lugarArriba}>{e.arriba}</Text>
                  <Text style={styles.lugarAbajo} numberOfLines={2}>
                    {e.abajo}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6E6C66" />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1EFE8' },
  titulo: { fontSize: 26, fontWeight: '600', color: '#042C53', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  cajaFila: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  caja: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6E6C66',
    paddingLeft: 12,
  },
  input: { flex: 1, fontSize: 16, color: '#2C2C2A', paddingVertical: 10 },
  limpiar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnBuscar: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#185FA5',
  },
  btnBuscarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  ambitos: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  ambito: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3D79B8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  ambitoActivo: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  ambitoText: { fontSize: 13, fontWeight: '600', color: '#185FA5', textAlign: 'center' },
  ambitoTextActivo: { color: '#FFFFFF' },
  centrado: { paddingVertical: 48, alignItems: 'center' },
  ayuda: { paddingHorizontal: 20, paddingTop: 20 },
  ayudaTexto: { fontSize: 15, lineHeight: 22, color: '#5F5E5A' },
  ejemplos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  ejemplo: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#E6F1FB',
  },
  ejemploText: { fontSize: 14, fontWeight: '600', color: '#0C447C' },
  lista: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  resumen: { fontSize: 13, color: '#5F5E5A', marginBottom: 4 },
  seccion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#185FA5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  aviso: { fontSize: 15, color: '#5F5E5A', textAlign: 'center', paddingVertical: 24, lineHeight: 22 },
  tarjeta: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginTop: 8 },
  tarjetaLugar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cita: { fontSize: 14, fontWeight: '700', color: '#0C447C', marginBottom: 4 },
  texto: { fontSize: 16, lineHeight: 24, color: '#2C2C2A', fontFamily: 'serif' },
  lugarArriba: { fontSize: 13, fontWeight: '700', color: '#185FA5' },
  lugarAbajo: { fontSize: 15, color: '#2C2C2A', marginTop: 2 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
});
