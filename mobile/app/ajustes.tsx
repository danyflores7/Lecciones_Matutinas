import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  borrarAudios,
  descargarTodo,
  esModoCompleto,
  estadoDescargaActual,
  suscribirDescarga,
  tamanoOcupado,
  type EstadoDescarga,
} from '../lib/audio';

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Ajustes() {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [completo, setCompleto] = useState(false);
  const [estado, setEstado] = useState<EstadoDescarga>(estadoDescargaActual());
  const [borrando, setBorrando] = useState(false);

  const refrescar = async () => {
    setOcupado(await tamanoOcupado());
    setCompleto(await esModoCompleto());
  };

  useEffect(() => {
    refrescar();
    // Se suscribe al gestor de descarga: el progreso sigue vivo aunque salgas
    // de esta pantalla y vuelvas.
    const cancelar = suscribirDescarga((e) => {
      setEstado(e);
      if (!e.activa) refrescar();
    });
    return cancelar;
  }, []);

  const onBorrar = async () => {
    setBorrando(true);
    try {
      await borrarAudios();
    } catch {
      // ignorar
    }
    setBorrando(false);
    refrescar();
  };

  const pct = estado.total ? Math.round((estado.hecho / estado.total) * 100) : 0;
  const yaCompleto = completo || estado.completo;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.desc}>
        La app descarga sola la narración de la semana para escucharla sin internet. Aquí
        puedes bajar todo de una vez o liberar espacio.
      </Text>

      <View style={styles.card}>
        <Ionicons name="cloud-download-outline" size={22} color="#185FA5" />
        <Text style={styles.cardTexto}>
          Espacio usado: {ocupado === null ? '…' : mb(ocupado)}
        </Text>
      </View>

      {estado.activa ? (
        <View style={styles.progresoCard}>
          <View style={styles.barraBg}>
            <View style={[styles.barra, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progresoTexto}>
            Descargando… {pct}% ({estado.hecho}/{estado.total})
          </Text>
          <Text style={styles.nota}>Puedes seguir usando la app; la descarga continúa sola.</Text>
        </View>
      ) : yaCompleto ? (
        <View style={styles.completoCard}>
          <Ionicons name="checkmark-circle" size={24} color="#1B7A3D" />
          <Text style={styles.completoTexto}>Audio completo descargado</Text>
        </View>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, pressed && styles.pressed]}
            onPress={() => descargarTodo()}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.btnPrimarioText}>Descargar todo el audio</Text>
          </Pressable>
          <Text style={styles.nota}>
            Ocupa ~112 MB. Recomendado con Wi-Fi. Puedes seguir usando la app mientras baja.
          </Text>
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.btnSecundario, (borrando || pressed) && styles.pressed]}
        onPress={onBorrar}
        disabled={borrando || estado.activa || ocupado === 0}
      >
        <Ionicons name="trash-outline" size={20} color="#A32D2D" />
        <Text style={styles.btnSecundarioText}>
          {borrando ? 'Borrando…' : 'Borrar audios descargados'}
        </Text>
      </Pressable>

      <Text style={styles.creditos}>
        Texto bíblico: Reina-Valera 1909 (dominio público) · Referencias cruzadas:
        openbible.info (CC-BY)
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20, paddingBottom: 48 },
  desc: { fontSize: 15, lineHeight: 22, color: '#5F5E5A', marginBottom: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  cardTexto: { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  progresoCard: {
    backgroundColor: '#E6F1FB',
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
  },
  barraBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#C7DEF5',
    overflow: 'hidden',
  },
  barra: { height: 10, borderRadius: 999, backgroundColor: '#185FA5' },
  progresoTexto: { fontSize: 15, fontWeight: '600', color: '#0C447C', marginTop: 12 },
  completoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E4F4E8',
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
  },
  completoTexto: { fontSize: 16, fontWeight: '600', color: '#1B7A3D' },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnPrimarioText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  nota: { fontSize: 13, color: '#5F5E5A', textAlign: 'center', marginTop: 8, marginBottom: 22 },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5B4B4',
    borderRadius: 14,
    paddingVertical: 13,
  },
  btnSecundarioText: { color: '#A32D2D', fontSize: 16, fontWeight: '600' },
  creditos: { fontSize: 12, color: '#8A887F', textAlign: 'center', marginTop: 28, lineHeight: 18 },
  pressed: { opacity: 0.85 },
});
