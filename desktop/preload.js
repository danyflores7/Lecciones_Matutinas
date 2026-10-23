// Le dice a la app web que corre dentro del programa de escritorio y dónde
// están el audio y los datos incluidos (los sirve main.js con app://).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('matutinasDesktop', {
  escritorio: true,
  plataforma: process.platform === 'darwin' ? 'Mac' : process.platform === 'win32' ? 'Windows' : 'Linux',
  audioBase: 'app://matutinas/audio/v1',
  datosBase: 'app://matutinas/datos/v1',
});
