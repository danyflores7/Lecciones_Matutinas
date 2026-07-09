import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { sincronizarContenido } from '../lib/contenido';
import { descargarSemana, limpiarViejo } from '../lib/audio';
import { descargarDatos } from '../lib/biblia';
import { prepararAudio } from '../lib/voz';

export default function RootLayout() {
  const router = useRouter();
  // Botón de micrófono en el encabezado (acceso al modo por voz desde
  // lección, memorizar y ajustes).
  const micHeader = () => (
    <Pressable
      onPress={() => router.push('/asistente')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Abrir el modo por voz"
    >
      <Ionicons name="mic" size={24} color="#185FA5" />
    </Pressable>
  );

  useEffect(() => {
    prepararAudio();
    (async () => {
      // Al abrir la app (si hay red), baja TODO el texto del año para usarla
      // 100% sin internet después. Silencioso: si falla, se usa lo guardado.
      try {
        await sincronizarContenido();
      } catch {
        // sin red
      }
      // Con el contenido listo, baja los audios de la semana y borra lo viejo.
      descargarSemana().catch(() => {});
      limpiarViejo().catch(() => {});
      // Y los datos de búsqueda (Biblia completa + relacionados), una sola vez.
      descargarDatos().catch(() => {});
    })();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F1EFE8' },
        headerTintColor: '#042C53',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F1EFE8' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="memorizar"
        options={{ title: 'Memorizar', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen
        name="leccion"
        options={{ title: 'Lección', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen
        name="ajustes"
        options={{ title: 'Audio sin conexión', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen name="asistente" options={{ title: 'Modo por voz', headerBackTitle: 'Atrás' }} />
    </Stack>
  );
}
