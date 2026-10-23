import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { marcarBienvenidaVista } from '../lib/progreso';

const PASOS_TELEFONO: { icono: keyof typeof Ionicons.glyphMap; titulo: string; texto: string }[] = [
  {
    icono: 'sunny-outline',
    titulo: 'La matutina de cada día',
    texto:
      'En Inicio está la matutina de hoy: léela, toca "Escuchar" para oírla o "Memorizar" para practicarla. En Calendario están todos los días del año.',
  },
  {
    icono: 'book-outline',
    titulo: 'Las lecciones de la semana',
    texto:
      'En Estudio está la lección de esta semana marcada. Con "Estudiar pregunta por pregunta" ves una pregunta a la vez y la app recuerda dónde te quedaste.',
  },
  {
    icono: 'mic-outline',
    titulo: 'Modo por voz',
    texto:
      'Toca el micrófono y habla. Por ejemplo: "la matutina de hoy", "la pregunta 3 de la lección 2", "¿dónde se cita Juan 3 16?" o "ayuda". La primera vez el teléfono te pedirá permiso para usar el micrófono; solo escucha mientras el botón está activo.',
  },
  {
    icono: 'search-outline',
    titulo: 'Buscar',
    texto:
      'En la pestaña Buscar puedes escribir una cita ("Salmos 23:1") o unas palabras que recuerdes ("no temas") y encontrar el versículo.',
  },
  {
    icono: 'cloud-offline-outline',
    titulo: 'Funciona sin internet',
    texto:
      'El texto de todo el año ya viene en la app. En Ajustes puedes cambiar el tamaño de la letra y descargar el audio para escucharlo sin conexión.',
  },
];

// Programa de escritorio (Mac y Windows): sin micrófono; los comandos se escriben.
const PASOS_ESCRITORIO: typeof PASOS_TELEFONO = [
  PASOS_TELEFONO[0],
  PASOS_TELEFONO[1],
  {
    icono: 'chatbubble-ellipses-outline',
    titulo: 'Modo por voz (escribiendo)',
    texto:
      'Escribe lo que quieres escuchar y la voz de Jorge te lo lee. Por ejemplo: "la matutina de hoy", "la pregunta 3 de la lección 2", "dónde se cita Juan 3 16" o "ayuda".',
  },
  PASOS_TELEFONO[3],
  {
    icono: 'cloud-offline-outline',
    titulo: 'Funciona sin internet',
    texto:
      'El texto de todo el año, la voz de Jorge y la Biblia ya vienen en el programa. En Ajustes puedes cambiar el tamaño de la letra.',
  },
];
const PASOS = Platform.OS === 'web' ? PASOS_ESCRITORIO : PASOS_TELEFONO;

export default function Bienvenida() {
  const router = useRouter();

  const empezar = async () => {
    await marcarBienvenidaVista();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.titulo} accessibilityRole="header">
        Bienvenido a Lecciones y Matutinas
      </Text>
      <Text style={styles.sub}>Así se usa, en pocas palabras:</Text>

      {PASOS.map((p, i) => (
        <View key={p.titulo} style={styles.paso} accessible accessibilityLabel={`Paso ${i + 1}. ${p.titulo}. ${p.texto}`}>
          <View style={styles.icono}>
            <Ionicons name={p.icono} size={26} color="#185FA5" />
          </View>
          <View style={styles.pasoTextos}>
            <Text style={styles.pasoTitulo}>{p.titulo}</Text>
            <Text style={styles.pasoTexto}>{p.texto}</Text>
          </View>
        </View>
      ))}

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={empezar}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>Empezar</Text>
      </Pressable>
      <Text style={styles.nota}>Puedes volver a ver esto en Ajustes → ¿Cómo se usa?</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  titulo: { fontSize: 24, fontWeight: '700', color: '#042C53' },
  sub: { fontSize: 15, color: '#5F5E5A', marginTop: 6, marginBottom: 12 },
  paso: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  icono: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoTextos: { flex: 1 },
  pasoTitulo: { fontSize: 16, fontWeight: '700', color: '#042C53' },
  pasoTexto: { fontSize: 15, lineHeight: 22, color: '#2C2C2A', marginTop: 4 },
  btn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#185FA5',
    borderRadius: 14,
    marginTop: 22,
  },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  nota: { fontSize: 13, color: '#5F5E5A', textAlign: 'center', marginTop: 12 },
  pressed: { opacity: 0.85 },
});
