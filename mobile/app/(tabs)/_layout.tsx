import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const router = useRouter();
  const ruta = usePathname();
  // En Inicio ya está el botón grande "Modo por voz": ahí no se muestra el
  // flotante (además taparía los botones de la matutina).
  const mostrarFab = ruta !== '/';
  return (
    <View style={styles.raiz}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#185FA5',
          tabBarInactiveTintColor: '#5F5E5A',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#C9C7BE' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="estudio"
          options={{
            title: 'Estudio',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Calendario',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="buscar"
          options={{
            title: 'Buscar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>

      {/* Botón flotante del Modo por voz: en las demás pestañas. */}
      {mostrarFab ? (
        <Pressable
          onPress={() => router.navigate('/asistente')}
          accessibilityRole="button"
          accessibilityLabel="Abrir el modo por voz"
          accessibilityHint="Habla para navegar y escuchar el contenido"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="mic" size={30} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: '#185FA5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },
});
