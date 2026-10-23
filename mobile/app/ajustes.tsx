import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';

import {
  borrarAudios,
  cancelarDescarga,
  descargarTodo,
  esModoCompleto,
  estadoDescargaActual,
  suscribirDescarga,
  tamanoOcupado,
  type EstadoDescarga,
} from '../lib/audio';
import { conEscala, setEscala, TAMANOS, useEscalaTexto } from '../lib/escala';
import { leerTiempos } from '../lib/voz';
import { infoContenido } from '../lib/contenido';
import { bibliaDisponible } from '../lib/biblia';
import { fechaDiaMes } from '../lib/fechas';

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Confirmación en línea (sin ventana emergente): qué se va a confirmar.
type Confirmar = null | 'borrar' | 'datosMoviles';

type Diagnostico = { lineas: [string, string][] };

// "1.2 s en promedio (12 lecturas; 9 incluido, 3 local)" para comparar versiones.
async function resumenTiempos(): Promise<string> {
  const t = await leerTiempos();
  if (!t.length) return 'sin lecturas aún';
  const prom = t.reduce((a, x) => a + x.ms, 0) / t.length / 1000;
  const porFuente = new Map<string, number>();
  for (const x of t) porFuente.set(x.fuente ?? '?', (porFuente.get(x.fuente ?? '?') ?? 0) + 1);
  const det = [...porFuente].map(([f, n]) => `${n} ${f}`).join(', ');
  return `${prom.toFixed(1)} s en promedio (${t.length} lecturas: ${det})`;
}

// Datos que el mantenedor necesita cuando alguien reporta un problema.
async function armarDiagnostico(ocupado: number | null, completo: boolean): Promise<Diagnostico> {
  const c = await infoContenido();
  const version = Constants.expoConfig?.version ?? '?';
  const codigo = Constants.expoConfig?.android?.versionCode ?? '?';
  const fecha = c.fecha ? `${fechaDiaMes(c.fecha.slice(0, 10))} ${c.fecha.slice(0, 4)}` : '?';
  return {
    lineas: [
      ['Versión', `${version} (${codigo})`],
      [Platform.OS === 'web' ? 'Equipo' : 'Teléfono', Platform.OS === 'web' ? (window.matutinasDesktop?.plataforma ?? 'navegador') : `${Platform.OS} ${Platform.Version}`],
      [
        'Contenido',
        `${c.fuente === 'sincronizado' ? 'actualizado' : 'el que trae la app'} · ${fecha}`,
      ],
      ['Matutinas', `${c.matutinas} (${c.conNota} con nota) · ${c.lecciones} lecciones`],
      ['Audio', `${ocupado === null ? '…' : mb(ocupado)}${completo ? ' · completo' : ''}`],
      ['Arranque de la voz', await resumenTiempos()],
      ['Biblia para buscar', (await bibliaDisponible().catch(() => false)) ? 'descargada' : 'pendiente'],
    ],
  };
}

export default function Ajustes() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [completo, setCompleto] = useState(false);
  const [estado, setEstado] = useState<EstadoDescarga>(estadoDescargaActual());
  const [borrando, setBorrando] = useState(false);
  const [confirmar, setConfirmar] = useState<Confirmar>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnostico | null>(null);

  const refrescar = async () => {
    const bytes = await tamanoOcupado();
    const todo = await esModoCompleto();
    setOcupado(bytes);
    setCompleto(todo);
    setDiag(await armarDiagnostico(bytes, todo));
  };

  const enviarDiagnostico = () => {
    if (!diag) return;
    const texto = [
      'Lecciones y Matutinas · datos para soporte',
      ...diag.lineas.map(([k, v]) => `${k}: ${v}`),
    ].join('\n');
    Share.share({ message: texto }).catch(() => {});
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

  const iniciarDescarga = () => {
    setConfirmar(null);
    setAviso(null);
    descargarTodo().catch(() => setAviso('La descarga se interrumpió. Puedes reanudarla.'));
  };

  // Antes de bajar ~112 MB revisa la red: sin internet avisa, y con datos
  // móviles pide confirmación.
  const onDescargar = async () => {
    setAviso(null);
    try {
      const red = await Network.getNetworkStateAsync();
      if (!red.isConnected || red.isInternetReachable === false) {
        setAviso('No hay conexión a internet. Conéctate y vuelve a intentarlo.');
        return;
      }
      if (red.type === Network.NetworkStateType.CELLULAR) {
        setConfirmar('datosMoviles');
        return;
      }
    } catch {
      // Si no se puede saber la red, se intenta igual.
    }
    iniciarDescarga();
  };

  const onBorrar = async () => {
    setConfirmar(null);
    setBorrando(true);
    try {
      await borrarAudios();
    } catch {
      // ignorar
    }
    setBorrando(false);
    setAviso('Audios borrados. La app volverá a bajar sola los de esta semana.');
    refrescar();
  };

  const pct = estado.total ? Math.round((estado.hecho / estado.total) * 100) : 0;
  const yaCompleto = completo || estado.completo;
  const esc = useEscalaTexto();
  const sinAudios = ocupado === 0;
  const borrarDeshabilitado = borrando || estado.activa || sinAudios;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.seccion} accessibilityRole="header">Tamaño de letra</Text>
      <View style={styles.tamanos}>
        {TAMANOS.map((t) => (
          <Pressable
            key={t.v}
            onPress={() => setEscala(t.v)}
            accessibilityRole="radio"
            accessibilityLabel={`Letra ${t.l}`}
            accessibilityState={{ checked: esc === t.v }}
            style={({ pressed }) => [
              styles.tamanoBtn,
              esc === t.v && styles.tamanoBtnActivo,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tamanoText, esc === t.v && styles.tamanoTextActivo]}>
              {t.l}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.muestraCard}>
        <Text style={[styles.muestraTexto, conEscala(styles.muestraTexto, esc)]}>
          Porque de tal manera amó Dios al mundo…
        </Text>
        <Text style={styles.muestraNota}>Así se verán los versículos y las lecciones.</Text>
      </View>

      {Platform.OS === 'web' ? (
        <>
          <Text style={styles.seccion} accessibilityRole="header">Audio</Text>
          <View style={styles.completoCard}>
            <Ionicons name="checkmark-circle" size={24} color="#1B7A3D" />
            <Text style={styles.completoTexto}>La voz de Jorge ya viene incluida en el programa</Text>
          </View>
        </>
      ) : (
        <>
      <Text style={styles.seccion} accessibilityRole="header">Audio sin conexión</Text>
      <Text style={styles.desc}>
        La app descarga sola la narración de la semana para escucharla sin internet. Aquí
        puedes bajar todo de una vez o liberar espacio.
      </Text>

      <View style={styles.card} accessible accessibilityLabel={`Espacio usado por audios: ${ocupado === null ? 'calculando' : mb(ocupado)}`}>
        <Ionicons name="cloud-download-outline" size={22} color="#185FA5" />
        <Text style={styles.cardTexto}>
          Espacio usado: {ocupado === null ? '…' : mb(ocupado)}
        </Text>
      </View>

      {estado.activa ? (
        <View style={styles.progresoCard}>
          <View
            style={styles.barraBg}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Descarga del audio"
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <View style={[styles.barra, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progresoTexto} accessibilityLiveRegion="polite">
            Descargando… {pct}% ({estado.hecho} de {estado.total})
          </Text>
          <Text style={styles.notaIzq}>Puedes seguir usando la app; la descarga continúa sola.</Text>
          <Pressable
            style={({ pressed }) => [styles.btnSecundarioAzul, pressed && styles.pressed]}
            onPress={() => {
              cancelarDescarga();
              setAviso('Descarga detenida. Lo que ya bajó se conserva; puedes reanudarla después.');
            }}
            accessibilityRole="button"
          >
            <Ionicons name="close-circle-outline" size={20} color="#185FA5" />
            <Text style={styles.btnSecundarioAzulText}>Cancelar descarga</Text>
          </Pressable>
        </View>
      ) : yaCompleto ? (
        <View style={styles.completoCard}>
          <Ionicons name="checkmark-circle" size={24} color="#1B7A3D" />
          <Text style={styles.completoTexto}>Audio completo descargado</Text>
        </View>
      ) : confirmar === 'datosMoviles' ? (
        <View style={styles.confirmCard} accessibilityLiveRegion="polite">
          <Text style={styles.confirmTitulo}>Estás usando datos móviles</Text>
          <Text style={styles.confirmTexto}>
            La descarga completa ocupa unos 112 MB de tu plan de datos. ¿Descargar de todos modos?
          </Text>
          <View style={styles.confirmFila}>
            <Pressable
              style={({ pressed }) => [styles.btnSecundarioAzul, styles.flex, pressed && styles.pressed]}
              onPress={() => setConfirmar(null)}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecundarioAzulText}>Esperar a Wi-Fi</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnPrimario, styles.flex, pressed && styles.pressed]}
              onPress={iniciarDescarga}
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimarioText}>Descargar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, pressed && styles.pressed]}
            onPress={onDescargar}
            accessibilityRole="button"
            accessibilityHint="Unos 112 megabytes. Recomendado con Wi-Fi."
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.btnPrimarioText}>Descargar todo el audio</Text>
          </Pressable>
          <Text style={styles.nota}>
            Ocupa ~112 MB. Recomendado con Wi-Fi. Puedes seguir usando la app mientras baja.
          </Text>
        </>
      )}

      {confirmar === 'borrar' ? (
        <View style={styles.confirmCard} accessibilityLiveRegion="polite">
          <Text style={styles.confirmTitulo}>¿Borrar {ocupado ? mb(ocupado) : 'los audios'}?</Text>
          <Text style={styles.confirmTexto}>
            Se quitará la narración guardada en el teléfono. Podrás volver a descargarla cuando
            quieras.
          </Text>
          <View style={styles.confirmFila}>
            <Pressable
              style={({ pressed }) => [styles.btnSecundarioAzul, styles.flex, pressed && styles.pressed]}
              onPress={() => setConfirmar(null)}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecundarioAzulText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnPeligro, styles.flex, pressed && styles.pressed]}
              onPress={onBorrar}
              accessibilityRole="button"
            >
              <Text style={styles.btnPeligroText}>Sí, borrar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.btnSecundario,
            borrarDeshabilitado && styles.deshabilitado,
            pressed && styles.pressed,
          ]}
          onPress={() => setConfirmar('borrar')}
          disabled={borrarDeshabilitado}
          accessibilityRole="button"
          accessibilityState={{ disabled: borrarDeshabilitado }}
          accessibilityHint={sinAudios ? 'No hay audios descargados' : undefined}
        >
          <Ionicons name="trash-outline" size={20} color="#A32D2D" />
          <Text style={styles.btnSecundarioText}>
            {borrando ? 'Borrando…' : sinAudios ? 'No hay audios que borrar' : 'Borrar audios descargados'}
          </Text>
        </Pressable>
      )}

        </>
      )}

      {aviso ? (
        <Text style={styles.aviso} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      ) : null}

      <Text style={[styles.seccion, styles.seccionSep]} accessibilityRole="header">Ayuda</Text>
      <Pressable
        style={({ pressed }) => [styles.filaAyuda, pressed && styles.pressed]}
        onPress={() => router.push('/bienvenida')}
        accessibilityRole="button"
        accessibilityLabel="Cómo se usa la app"
      >
        <Ionicons name="help-circle-outline" size={22} color="#185FA5" />
        <Text style={styles.filaAyudaText}>¿Cómo se usa?</Text>
        <Ionicons name="chevron-forward" size={18} color="#6E6C66" />
      </Pressable>

      <Text style={[styles.seccion, styles.seccionSep]} accessibilityRole="header">
        Acerca de la app
      </Text>
      <View style={styles.acerca}>
        {(diag?.lineas ?? []).map(([k, v]) => (
          <View key={k} style={styles.acercaFila} accessible accessibilityLabel={`${k}: ${v}`}>
            <Text style={styles.acercaClave}>{k}</Text>
            <Text style={styles.acercaValor}>{v}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={({ pressed }) => [styles.btnSecundarioAzul, pressed && styles.pressed]}
        onPress={enviarDiagnostico}
        accessibilityRole="button"
        accessibilityHint="Abre WhatsApp, correo u otra app para enviar estos datos a quien te ayuda"
      >
        <Ionicons name="paper-plane-outline" size={20} color="#185FA5" />
        <Text style={styles.btnSecundarioAzulText}>Enviar estos datos (si algo falla)</Text>
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
  seccion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#185FA5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  seccionSep: { marginTop: 30 },
  tamanos: { flexDirection: 'row', gap: 8 },
  tamanoBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6E6C66',
    alignItems: 'center',
  },
  tamanoBtnActivo: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  tamanoText: { fontSize: 13, fontWeight: '600', color: '#3D3C39' },
  tamanoTextActivo: { color: '#FFFFFF' },
  muestraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    marginBottom: 24,
  },
  muestraTexto: { fontSize: 18, lineHeight: 28, color: '#042C53', fontFamily: 'serif' },
  muestraNota: { fontSize: 12, color: '#5F5E5A', marginTop: 8 },
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
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#6E6C66',
  },
  confirmTitulo: { fontSize: 16, fontWeight: '700', color: '#2C2C2A' },
  confirmTexto: { fontSize: 14, lineHeight: 21, color: '#5F5E5A', marginTop: 6 },
  confirmFila: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flex: { flex: 1 },
  btnPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: '#185FA5',
    borderRadius: 14,
    paddingVertical: 13,
  },
  btnPrimarioText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnSecundarioAzul: {
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
    marginTop: 12,
  },
  btnSecundarioAzulText: { color: '#185FA5', fontSize: 16, fontWeight: '600' },
  btnPeligro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#A32D2D',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  btnPeligroText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  nota: { fontSize: 13, color: '#5F5E5A', textAlign: 'center', marginTop: 8, marginBottom: 22 },
  notaIzq: { fontSize: 13, color: '#5F5E5A', marginTop: 6 },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B54848',
    borderRadius: 14,
    paddingVertical: 13,
  },
  btnSecundarioText: { color: '#A32D2D', fontSize: 16, fontWeight: '600' },
  deshabilitado: { opacity: 0.45, borderStyle: 'dashed' },
  aviso: { fontSize: 14, color: '#0C447C', textAlign: 'center', marginTop: 14, lineHeight: 20 },
  filaAyuda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  filaAyudaText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  acerca: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  acercaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C9C7BE',
  },
  acercaClave: { fontSize: 14, color: '#5F5E5A' },
  acercaValor: { flex: 1, fontSize: 14, fontWeight: '600', color: '#2C2C2A', textAlign: 'right' },
  creditos: { fontSize: 12, color: '#5F5E5A', textAlign: 'center', marginTop: 28, lineHeight: 18 },
  pressed: { opacity: 0.85 },
});
