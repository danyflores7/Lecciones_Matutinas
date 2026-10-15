# Publicar una versión: `tools/publicar.sh`

Un solo comando hace todo lo que antes eran ~10 pasos a mano: sube la versión
en los dos lugares donde vive, regenera el contenido incluido en la app, revisa
TypeScript y pruebas, compila el `.aab` y el `.apk` firmados, los copia a la
raíz y verifica firmas y versión. **No hace commit ni push**: al final imprime
los comandos sugeridos.

## Requisitos

- **Node.js** y las dependencias de la app: `cd mobile && npm ci`.
- **Android SDK** (viene con Android Studio) en `~/Library/Android/sdk` o donde
  diga `ANDROID_HOME`, con *Android SDK Build-Tools* (trae `apksigner` y `aapt2`).
- **Java 17 o más nuevo**. El script usa `JAVA_HOME` si está definida; si no, el
  `java` de la terminal; si tampoco hay, el que trae Android Studio.
- La carpeta **`mobile/android/`** (no está en git: vive solo en la Mac y se edita a mano, sin `expo prebuild`; ver `mantenimiento/decisiones/0004`).
- La **llave de subida** `Matutinas-upload-key.jks` (por omisión en la raíz del
  repo) y su contraseña en `MATUTINAS_KEY_PASS`.
- **Internet** para el snapshot de Supabase. Usa `SB_URL`/`SB_KEY` si están
  definidas; si no, las toma de `mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

### Variables de entorno (en `~/.zshrc`)

```zsh
# Lecciones y Matutinas: publicar
export ANDROID_HOME="$HOME/Library/Android/sdk"
export MATUTINAS_KEYSTORE="$HOME/Documents_local/App_Iglesia/Matutinas-upload-key.jks"
export MATUTINAS_KEY_PASS='PON-AQUI-LA-CONTRASENA'   # solo en tu equipo, nunca en git
```

Más seguro, sin la contraseña en texto plano: guárdala una vez en el Llavero de
macOS (te la pide sin mostrarla)…

```zsh
security add-generic-password -a "$USER" -s matutinas-upload-key -w
```

…y en `~/.zshrc` pon esta línea en lugar de la de `MATUTINAS_KEY_PASS`:

```zsh
export MATUTINAS_KEY_PASS="$(security find-generic-password -a "$USER" -s matutinas-upload-key -w 2>/dev/null)"
```

## Uso

```zsh
tools/publicar.sh 1.13.0                  # publicación completa
tools/publicar.sh 1.13.0 --sin-build      # prueba en seco: todo menos compilar
tools/publicar.sh 1.13.0 --sin-snapshot   # no regenera mobile/assets/contenido.json
```

Solo indicas la versión nueva (`versionName`). El `versionCode` se calcula solo
(el actual + 1). Los archivos se llaman `Matutinas-v<versionCode + 1>`, como
siempre: con `versionCode 15` salen `Matutinas-v16.aab` y `Matutinas-v16.apk`.

La **prueba en seco** deja `app.json` y `build.gradle` con la versión nueva para
que la revises, e imprime los dos comandos para deshacerlo. Deshazla antes de la
publicación de verdad.

## Qué hace cada paso y qué hacer si falla

Si cualquier paso falla, el script dice cuál fue, **deja `app.json`,
`build.gradle` y `contenido.json` como estaban** y quita las copias que no
pasaron la verificación. Corrige el problema y vuelve a correr el mismo comando.

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Repo y requisitos | Se mueve a la raíz del repo. Exige el árbol de git limpio (con `--sin-build` solo avisa). Revisa Node, `mobile/node_modules`, `build.gradle`, la llave, `MATUTINAS_KEY_PASS`, el SDK y Java. | Haz commit de tus cambios; `cd mobile && npm ci`; exporta la variable que diga el mensaje. |
| 2. Versión | Lee `mobile/app.json` y `mobile/android/app/build.gradle`; deben coincidir. Calcula la nueva y la escribe en los dos. | Deja ambos archivos con la última versión publicada en Play Console (esa es la verdad). La versión nueva debe ser mayor que la actual. |
| 3. Contenido | `npx --yes tsx tools/datos/snapshot_contenido.ts` regenera `mobile/assets/contenido.json` y revisa que no venga vacío. | Revisa internet y las claves. Si Supabase está pausado, reactívalo desde su panel. Para publicar con el contenido que ya está en el repo: `--sin-snapshot`. |
| 4. Calidad | `tsc --noEmit` y `npm test` (si existe el script `test`) en `mobile/`. | Corrige los errores, haz commit y vuelve a correr. |
| 5. Compilar | `gradlew bundleRelease assembleRelease`, firmado con la llave de subida (alias `upload`). Tarda varios minutos. | Lee el error de Gradle. Causas comunes: contraseña equivocada; versión de Java (`export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`); caché vieja (`mobile/android/gradlew -p mobile/android clean`); poco espacio en disco. |
| 6. Copiar | Copia `app-release.aab` y `app-release.apk` a la raíz como `Matutinas-vN.*`. Si ya existían, se detiene antes de compilar para no pisarlos. | Si Gradle no dejó los archivos, revisa `mobile/android/app/build/outputs/`. |
| 7. Verificar | `apksigner verify --print-certs` del `.apk`, `jarsigner -verify` del `.aab`, mismo certificado en ambos y que no sea la llave de depuración, y `aapt2 dump badging` para confirmar `versionCode` y `versionName`. Imprime el resumen. | **No subas nada.** Revisa que `MATUTINAS_KEYSTORE` apunte a la llave de subida correcta y vuelve a correr. |

Al terminar, sube el `.aab` a Play Console y haz el commit con los comandos que
imprime el script (`mobile/app.json` y `mobile/assets/contenido.json`;
`build.gradle` no va en git porque `mobile/android/` es generado).

## Notas de seguridad

- La contraseña solo sale de `MATUTINAS_KEY_PASS` y el script nunca la imprime
  (apaga `set -x` a propósito). Se le pasa a Gradle como `-P…`, así que mientras
  compila es visible en la lista de procesos (`ps`) para usuarios de esta Mac.
- La llave, `CLAVES-keystore.txt`, `*.aab` y `*.apk` están en `.gitignore`;
  no los agregues a git.
