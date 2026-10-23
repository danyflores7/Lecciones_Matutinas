import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { sincronizarSiHaceFalta } from '../lib/contenido';
import { descargarSemana, limpiarViejo } from '../lib/audio';
import { descargarDatos } from '../lib/biblia';
import { cargarEscala } from '../lib/escala';
import { prepararAudio } from '../lib/voz';

export default function RootLayout() {
  const router = useRouter();
  // Botón de micrófono en el encabezado (acceso al modo por voz desde
  // lección, memorizar y ajustes).
  const micHeader = () => (
    <Pressable
      onPress={() => router.navigate('/asistente')}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel="Abrir el modo por voz"
    >
      <Ionicons name="mic" size={24} color="#185FA5" />
    </Pressable>
  );

  useEffect(() => {
    // Escritorio/web: detener el audio justo después de empezarlo hace que el
    // navegador avise "play() interrumpido por pause()". No es un error real.
    if (Platform.OS === 'web') {
      const ignorar = (e: PromiseRejectionEvent) => {
        const n = (e.reason as Error | undefined)?.name;
        if (n === 'AbortError' || n === 'NetworkError') e.preventDefault();
      };
      window.addEventListener('unhandledrejection', ignorar);
    }
    cargarEscala();
    prepararAudio();
    (async () => {
      // Al abrir la app (si hay red y pasaron 12 h), baja TODO el texto del año
      // para usarla sin internet. Silencioso: si falla, se usa lo guardado.
      try {
        await sincronizarSiHaceFalta();
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

  const pila = (
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
        options={{ title: 'Ajustes', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen
        name="matutina"
        options={{ title: 'Matutina', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen
        name="estudiar"
        options={{ title: 'Estudiar', headerBackTitle: 'Atrás', headerRight: micHeader }}
      />
      <Stack.Screen name="bienvenida" options={{ title: 'Bienvenida', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="asistente" options={{ title: 'Modo por voz', headerBackTitle: 'Atrás' }} />
    </Stack>
  );

  // En escritorio (ventana ancha) la app se centra con un ancho cómodo de lectura.
  if (Platform.OS !== 'web') return pila;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E4E1D6' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 760, backgroundColor: '#F1EFE8' }}>{pila}</View>
    </View>
  );
}
