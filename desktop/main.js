// Programa de escritorio de "Lecciones y Matutinas" (Mac y Windows).
// Envuelve la MISMA app (exportada como web) en una ventana, y sirve desde el
// propio programa todo lo que necesita (la app, la voz de Jorge y los datos de
// búsqueda) con un protocolo propio app://matutinas/. Funciona sin internet.
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RECURSOS = app.isPackaged
  ? path.join(process.resourcesPath, 'recursos')
  : path.join(__dirname, 'recursos');
const WEB = path.join(RECURSOS, 'web');

// El protocolo debe registrarse ANTES de que la app esté lista.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

// Una sola ventana: abrir el programa otra vez trae la que ya está.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let ventana = null;
app.on('second-instance', () => {
  if (!ventana) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.focus();
});

// app://matutinas/<ruta> -> archivo dentro de recursos/. Las rutas sin archivo
// (pantallas de la app, como /estudio) caen en index.html.
function resolver(urlTexto) {
  const url = new URL(urlTexto);
  let ruta = decodeURIComponent(url.pathname);
  const segura = (base, rel) => {
    const abs = path.normalize(path.join(base, rel));
    return abs.startsWith(base) ? abs : null;
  };
  if (ruta.startsWith('/audio/') || ruta.startsWith('/datos/')) {
    const f = segura(RECURSOS, ruta);
    return f && fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
  }
  const f = segura(WEB, ruta === '/' ? '/index.html' : ruta);
  if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (path.extname(ruta)) return null; // un archivo que no existe: 404 de verdad
  return path.join(WEB, 'index.html');
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 900,
    height: 900,
    minWidth: 420,
    minHeight: 600,
    title: 'Lecciones y Matutinas',
    backgroundColor: '#E4E1D6',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // La voz debe poder sonar sin que haya que tocar la pantalla antes.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  ventana.loadURL('app://matutinas/');
  // Enlaces externos (si los hubiera) van al navegador, no a esta ventana.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.on('closed', () => {
    ventana = null;
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const archivo = resolver(request.url);
    if (!archivo) return new Response('No encontrado', { status: 404 });
    // Se pasan las cabeceras (Range) para que el audio pueda saltar y cargarse por partes.
    return net.fetch(pathToFileURL(archivo).toString(), { headers: request.headers });
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }, { type: 'separator' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'resetZoom', label: 'Tamaño normal' }] },
      { label: 'Ventana', submenu: [{ role: 'minimize', label: 'Minimizar' }, { role: 'close', label: 'Cerrar' }] },
    ])
  );
  crearVentana();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
