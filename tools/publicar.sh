#!/usr/bin/env bash
# publicar.sh - Publica una versión nueva de "Lecciones y Matutinas" (Android).
#
# Uso:
#   tools/publicar.sh <versionName> [--sin-build] [--sin-snapshot]
#
# Ejemplos:
#   tools/publicar.sh 1.13.0                 publicación completa
#   tools/publicar.sh 1.13.0 --sin-build     prueba en seco: todo menos compilar
#   tools/publicar.sh 1.13.0 --sin-snapshot  no regenera mobile/assets/contenido.json
#
# El versionCode se calcula solo (el actual + 1) y se escribe en mobile/app.json
# y en mobile/android/app/build.gradle. Los archivos finales quedan en la raíz
# como Matutinas-v<versionCode+1>.aab / .apk (v15 = versionCode 14).
#
# Variables de entorno:
#   MATUTINAS_KEY_PASS  contraseña de la llave de subida (obligatoria para compilar)
#   MATUTINAS_KEYSTORE  ruta a la llave (por omisión ./Matutinas-upload-key.jks)
#   ANDROID_HOME        SDK de Android (por omisión ~/Library/Android/sdk)
#   SB_URL / SB_KEY     Supabase para el snapshot (si faltan, se toman de mobile/.env)
#
# Si algo falla se detiene y deja app.json, build.gradle y contenido.json como
# estaban. Nunca hace commit ni push: al final imprime los comandos sugeridos.
# Más detalle en tools/README-publicar.md.

# xtrace apagado a propósito: con `bash -x` se vería la contraseña de la llave.
{ set +x; } 2>/dev/null
set -euo pipefail

# ---------------------------------------------------------------- utilidades
if [ -t 1 ]; then
  ROJO=$'\033[31m'; VERDE=$'\033[32m'; AMARILLO=$'\033[33m'; NEGRITA=$'\033[1m'; NORMAL=$'\033[0m'
else
  ROJO=''; VERDE=''; AMARILLO=''; NEGRITA=''; NORMAL=''
fi

uso() {
  # Imprime el encabezado de comentarios de este archivo.
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
}

# paso <número> <título> <qué hacer si falla>
paso() {
  PASO_ACTUAL="$1 - $2"
  PISTA="$3"
  printf '\n%s==> Paso %s/7: %s%s\n' "$NEGRITA" "$1" "$2" "$NORMAL"
}
info()  { printf '    %s\n' "$*"; }
aviso() { printf '%s    Aviso: %s%s\n' "$AMARILLO" "$*" "$NORMAL" >&2; }
# error <mensaje> [líneas extra...]: explica y termina (la limpieza la hace al_salir).
error() {
  printf '\n%sERROR: %s%s\n' "$ROJO" "$1" "$NORMAL" >&2
  shift
  local linea
  for linea in "$@"; do printf '       %s\n' "$linea" >&2; done
  exit 1
}

tamano() { awk -v b="$(wc -c < "$1")" 'BEGIN { printf "%.1f MB", b / 1048576 }'; }

# ------------------------------------------------------------ estado global
PASO_ACTUAL=''
PISTA=''
MODIFICADO=0          # 1 cuando ya se tocaron app.json / build.gradle / contenido.json
CONSERVAR_RESPALDO=0  # en la prueba en seco se conserva para poder deshacer
COPIA_AAB=''
COPIA_APK=''
TMP_BASE="${TMPDIR:-/tmp}"
RESPALDO="$(mktemp -d "${TMP_BASE%/}/publicar.XXXXXX")"

APP_JSON='mobile/app.json'
GRADLE='mobile/android/app/build.gradle'
CONTENIDO='mobile/assets/contenido.json'
AAB_SALIDA='mobile/android/app/build/outputs/bundle/release/app-release.aab'
APK_SALIDA='mobile/android/app/build/outputs/apk/release/app-release.apk'

# Al salir con error: decir qué paso falló, restaurar archivos y quitar copias a medias.
al_salir() {
  local estado=$?
  set +e
  if [ "$estado" -ne 0 ]; then
    if [ -n "$PASO_ACTUAL" ]; then
      printf '\n%sFalló el paso %s.%s\n' "$ROJO" "$PASO_ACTUAL" "$NORMAL" >&2
    fi
    if [ -n "$PISTA" ]; then
      printf 'Qué hacer: %s\n' "$PISTA" >&2
    fi
    if [ "$MODIFICADO" -eq 1 ]; then
      cp "$RESPALDO/app.json" "$APP_JSON"
      cp "$RESPALDO/build.gradle" "$GRADLE"
      cp "$RESPALDO/contenido.json" "$CONTENIDO"
      printf 'Dejé app.json, build.gradle y contenido.json como estaban (%s, versionCode %s).\n' \
        "$NOMBRE_ACTUAL" "$CODIGO_ACTUAL" >&2
    fi
    local f
    for f in "$COPIA_AAB" "$COPIA_APK"; do
      if [ -n "$f" ] && [ -f "$f" ]; then
        rm -f "$f"
        printf 'Quité %s porque no pasó la verificación (el original sigue en mobile/android/app/build).\n' "$f" >&2
      fi
    done
  fi
  if [ "$CONSERVAR_RESPALDO" -eq 0 ]; then rm -rf "$RESPALDO"; fi
  exit "$estado"
}
trap al_salir EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ---------------------------------------------------------------- argumentos
VERSION_NUEVA=''
SIN_BUILD=0
SIN_SNAPSHOT=0
for arg in "$@"; do
  case "$arg" in
    --sin-build)        SIN_BUILD=1 ;;
    --sin-snapshot)     SIN_SNAPSHOT=1 ;;
    -h|--help|--ayuda)  uso; exit 0 ;;
    -*)                 error "Opción desconocida: $arg" "Uso: tools/publicar.sh 1.13.0 [--sin-build] [--sin-snapshot]" ;;
    *)
      [ -z "$VERSION_NUEVA" ] || error "Sobra el argumento: $arg" "Solo se indica una versión, por ejemplo: tools/publicar.sh 1.13.0"
      VERSION_NUEVA="$arg"
      ;;
  esac
done
[ -n "$VERSION_NUEVA" ] || { uso; error "Falta la versión nueva (versionName), por ejemplo: tools/publicar.sh 1.13.0"; }
[[ "$VERSION_NUEVA" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || error "La versión debe tener la forma X.Y.Z (por ejemplo 1.13.0); recibí: $VERSION_NUEVA"

# Rutas que el usuario dio relativas a donde estaba, antes de movernos a la raíz.
DIR_INICIAL="$(pwd -P)"

# ========================================================================== 1
paso 1 "Revisar repo y requisitos" "Revisa el mensaje de arriba y vuelve a correr."

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$RAIZ"
TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || error "$RAIZ no es un repositorio de git."
[ "$(cd "$TOP" && pwd -P)" = "$RAIZ" ] && [ -f "$APP_JSON" ] && [ -f tools/datos/snapshot_contenido.ts ] \
  || error "No encuentro la raíz del repo de la app (con mobile/app.json) en $RAIZ."
info "Raíz del repo: $RAIZ"

# Árbol limpio: lo que se compila debe ser exactamente lo que está en git.
# (Se ignoran los worktrees de .claude/, que no forman parte de la app.)
SUCIOS="$(git status --porcelain | grep -v '^?? \.claude/' || true)"
if [ -n "$SUCIOS" ]; then
  if [ "$SIN_BUILD" -eq 1 ]; then
    aviso "el árbol de git tiene cambios sin commit (se permite con --sin-build)."
  else
    printf '%s\n' "$SUCIOS" >&2
    error "El árbol de git no está limpio (cambios de arriba)." \
      "Haz commit de esos cambios (o descártalos) y vuelve a correr." \
      "Para solo probar el proceso sin compilar: tools/publicar.sh $VERSION_NUEVA --sin-build"
  fi
else
  info "Árbol de git limpio (rama $(git rev-parse --abbrev-ref HEAD), commit $(git rev-parse --short HEAD))."
fi

for cmd in node npm npx; do
  command -v "$cmd" >/dev/null 2>&1 || error "No encuentro '$cmd'. Instala Node.js (o activa nvm) y vuelve a correr."
done
[ -x mobile/node_modules/.bin/tsc ] \
  || error "Faltan las dependencias de mobile/ (no existe mobile/node_modules/.bin/tsc)." "Instálalas con: (cd mobile && npm ci)"
[ -f "$GRADLE" ] \
  || error "No existe $GRADLE." \
    "La carpeta mobile/android/ no está en git y se edita a mano (NO uses expo prebuild: borraría los cambios del manifiesto). Recupérala de tu respaldo."

if [ "$SIN_BUILD" -eq 0 ]; then
  # Llave de subida: ruta y contraseña SOLO desde variables de entorno.
  KEYSTORE="${MATUTINAS_KEYSTORE:-$RAIZ/Matutinas-upload-key.jks}"
  case "$KEYSTORE" in /*) ;; *) KEYSTORE="$DIR_INICIAL/$KEYSTORE" ;; esac
  [ -f "$KEYSTORE" ] \
    || error "No encuentro la llave de subida en: $KEYSTORE" \
      "Indica dónde está con: export MATUTINAS_KEYSTORE=\"/ruta/a/Matutinas-upload-key.jks\""
  [ -n "${MATUTINAS_KEY_PASS:-}" ] \
    || error "Falta la variable MATUTINAS_KEY_PASS (contraseña de la llave de subida)." \
      "Escríbela sin que se vea en pantalla y vuelve a correr:" \
      "  read -rs MATUTINAS_KEY_PASS && export MATUTINAS_KEY_PASS" \
      "(o agrégala a tu ~/.zshrc; ver tools/README-publicar.md)."
  info "Llave de subida: $KEYSTORE (contraseña tomada de MATUTINAS_KEY_PASS)"

  # SDK de Android y build-tools (la versión más nueva que tenga apksigner y aapt2).
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  [ -d "$ANDROID_HOME/build-tools" ] \
    || error "No encuentro el SDK de Android en $ANDROID_HOME." \
      "Instálalo con Android Studio o indica la ruta: export ANDROID_HOME=\"/ruta/al/sdk\""
  BUILD_TOOLS=''
  while IFS= read -r v; do
    if [ -x "$ANDROID_HOME/build-tools/$v/apksigner" ] && [ -x "$ANDROID_HOME/build-tools/$v/aapt2" ]; then
      BUILD_TOOLS="$ANDROID_HOME/build-tools/$v"
    fi
  done < <(ls -1 "$ANDROID_HOME/build-tools" | sort -t. -k1,1n -k2,2n -k3,3n)
  [ -n "$BUILD_TOOLS" ] \
    || error "No hay build-tools con apksigner y aapt2 en $ANDROID_HOME/build-tools." \
      "Instálalos desde Android Studio > Settings > Android SDK > SDK Tools > Android SDK Build-Tools."
  APKSIGNER="$BUILD_TOOLS/apksigner"
  AAPT2="$BUILD_TOOLS/aapt2"
  info "Android SDK: $ANDROID_HOME (build-tools $(basename "$BUILD_TOOLS"))"

  # Java: JAVA_HOME si existe; si no, el de la terminal; si tampoco, el de Android Studio.
  JBR='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
  if [ -n "${JAVA_HOME:-}" ]; then
    [ -x "$JAVA_HOME/bin/java" ] || error "JAVA_HOME apunta a $JAVA_HOME pero ahí no hay bin/java."
  elif ! java -version >/dev/null 2>&1; then
    [ -x "$JBR/bin/java" ] \
      || error "No encuentro Java." "Instala Android Studio (trae su propio Java) o un JDK 17+ y vuelve a correr."
    export JAVA_HOME="$JBR"
  fi
  if [ -n "${JAVA_HOME:-}" ]; then export PATH="$JAVA_HOME/bin:$PATH"; fi
  for cmd in java jarsigner keytool; do
    command -v "$cmd" >/dev/null 2>&1 || error "No encuentro '$cmd' (viene con el JDK)." "Define JAVA_HOME, por ejemplo: export JAVA_HOME=\"$JBR\""
  done
  VERSION_JAVA="$(java -version 2>&1)"
  info "Java: ${VERSION_JAVA%%$'\n'*}"

  [ -x mobile/android/gradlew ] || error "No existe mobile/android/gradlew (o no es ejecutable)."
fi

# ========================================================================== 2
paso 2 "Calcular y escribir la versión" \
  "La versión nueva debe ser mayor que la actual, y $APP_JSON y $GRADLE deben tener la misma (la última publicada); corrígelo y vuelve a correr."

# Lee "versionName versionCode" de app.json (con node, no con sed).
leer_app_json() {
  node -e '
    const fs = require("fs");
    const e = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).expo || {};
    const nombre = e.version, codigo = e.android && e.android.versionCode;
    if (typeof nombre !== "string" || !Number.isInteger(codigo)) {
      console.error("app.json no tiene expo.version y/o expo.android.versionCode");
      process.exit(1);
    }
    console.log(nombre + " " + codigo);
  ' "$APP_JSON"
}

# Lee "versionName versionCode" de build.gradle; exige exactamente una línea de cada uno.
leer_gradle() {
  node -e '
    const t = require("fs").readFileSync(process.argv[1], "utf8");
    const c = [...t.matchAll(/^[ \t]*versionCode[ \t]+(\d+)[ \t]*$/gm)];
    const n = [...t.matchAll(/^[ \t]*versionName[ \t]+"([^"]+)"[ \t]*$/gm)];
    if (c.length !== 1 || n.length !== 1) {
      console.error(`build.gradle: esperaba 1 línea versionCode y 1 versionName; hay ${c.length} y ${n.length}`);
      process.exit(1);
    }
    console.log(n[0][1] + " " + c[0][1]);
  ' "$GRADLE"
}

LEIDO_JSON="$(leer_app_json)"
LEIDO_GRADLE="$(leer_gradle)"
read -r NOMBRE_ACTUAL CODIGO_ACTUAL <<<"$LEIDO_JSON"
read -r NOMBRE_GRADLE CODIGO_GRADLE <<<"$LEIDO_GRADLE"
info "app.json:     $NOMBRE_ACTUAL (versionCode $CODIGO_ACTUAL)"
info "build.gradle: $NOMBRE_GRADLE (versionCode $CODIGO_GRADLE)"
if [ "$NOMBRE_ACTUAL" != "$NOMBRE_GRADLE" ] || [ "$CODIGO_ACTUAL" != "$CODIGO_GRADLE" ]; then
  error "La versión de $APP_JSON y la de $GRADLE no coinciden." \
    "app.json:     $NOMBRE_ACTUAL / versionCode $CODIGO_ACTUAL" \
    "build.gradle: $NOMBRE_GRADLE / versionCode $CODIGO_GRADLE" \
    "Deja ambos con la última versión publicada en Play Console y vuelve a correr."
fi

node -e '
  const [a, b] = process.argv.slice(1).map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) process.exit(a[i] > b[i] ? 0 : 1);
  process.exit(1);
' "$VERSION_NUEVA" "$NOMBRE_ACTUAL" \
  || error "La versión nueva ($VERSION_NUEVA) debe ser mayor que la actual ($NOMBRE_ACTUAL)." \
    "Si acabas de hacer una prueba en seco (--sin-build), deshazla primero con los comandos que imprimió."

CODIGO_NUEVO=$((CODIGO_ACTUAL + 1))
ETIQUETA="v$((CODIGO_NUEVO + 1))"   # así se han nombrado: v15 = versionCode 14
AAB_FINAL="Matutinas-$ETIQUETA.aab"
APK_FINAL="Matutinas-$ETIQUETA.apk"
info "Nueva:        $VERSION_NUEVA (versionCode $CODIGO_NUEVO) -> $AAB_FINAL / .apk"

if [ "$SIN_BUILD" -eq 0 ]; then
  for f in "$AAB_FINAL" "$APK_FINAL"; do
    [ ! -e "$f" ] || error "Ya existe $f en la raíz; no lo voy a sobrescribir." \
      "Si es de una compilación fallida, muévelo a otra carpeta y vuelve a correr."
  done
fi

# Respaldos para poder restaurar si algo falla más adelante.
cp "$APP_JSON" "$RESPALDO/app.json"
cp "$GRADLE" "$RESPALDO/build.gradle"
cp "$CONTENIDO" "$RESPALDO/contenido.json"
MODIFICADO=1

node -e '
  const fs = require("fs");
  const [ruta, nombre, codigo] = process.argv.slice(1);
  const j = JSON.parse(fs.readFileSync(ruta, "utf8"));
  j.expo.version = nombre;
  j.expo.android.versionCode = Number(codigo);
  fs.writeFileSync(ruta, JSON.stringify(j, null, 2) + "\n");
' "$APP_JSON" "$VERSION_NUEVA" "$CODIGO_NUEVO"

node -e '
  const fs = require("fs");
  const [ruta, nombre, codigo] = process.argv.slice(1);
  const t = fs.readFileSync(ruta, "utf8")
    .replace(/^([ \t]*versionCode[ \t]+)\d+/m, (_, a) => a + codigo)
    .replace(/^([ \t]*versionName[ \t]+")[^"]+"/m, (_, a) => a + nombre + "\"");
  fs.writeFileSync(ruta, t);
' "$GRADLE" "$VERSION_NUEVA" "$CODIGO_NUEVO"

# Comprobar que ambos archivos quedaron con la versión nueva.
[ "$(leer_app_json)" = "$VERSION_NUEVA $CODIGO_NUEVO" ] && [ "$(leer_gradle)" = "$VERSION_NUEVA $CODIGO_NUEVO" ] \
  || error "Después de escribir, app.json y build.gradle no quedaron en $VERSION_NUEVA / $CODIGO_NUEVO."
info "Escrito en $APP_JSON y $GRADLE."

# ========================================================================== 3
if [ "$SIN_SNAPSHOT" -eq 1 ]; then
  paso 3 "Contenido incluido en la app: OMITIDO (--sin-snapshot)" ""
  aviso "se usará $CONTENIDO tal como está en el repo."
else
  paso 3 "Regenerar el contenido incluido en la app ($CONTENIDO)" \
    "Revisa SB_URL/SB_KEY (o mobile/.env) y tu conexión a internet. Si Supabase está pausado, reactívalo en su panel; o publica con el contenido actual usando --sin-snapshot."
  # En un subshell: las variables de mobile/.env no se quedan en el resto del script.
  (
    if [ -z "${SB_URL:-}" ] || [ -z "${SB_KEY:-}" ]; then
      [ -f mobile/.env ] || { echo "Faltan SB_URL/SB_KEY y no existe mobile/.env." >&2; exit 1; }
      echo "    SB_URL/SB_KEY no están definidas; las tomo de mobile/.env."
      set -a
      # shellcheck disable=SC1091
      . mobile/.env
      set +a
      SB_URL="${SB_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
      SB_KEY="${SB_KEY:-${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}}"
    fi
    [ -n "$SB_URL" ] && [ -n "$SB_KEY" ] \
      || { echo "mobile/.env no define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY." >&2; exit 1; }
    export SB_URL SB_KEY
    npx --yes tsx tools/datos/snapshot_contenido.ts
  )
  # Que no viaje vacío (p. ej. si la base respondió sin filas).
  node -e '
    const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const k of ["versiculos", "lecciones", "preguntas"]) {
      if (!Array.isArray(c[k]) || c[k].length === 0) { console.error(`contenido.json: "${k}" vino vacío`); process.exit(1); }
    }
  ' "$CONTENIDO"
fi

# ========================================================================== 4
paso 4 "Calidad: TypeScript y pruebas" \
  "Corrige los errores de arriba, haz commit y vuelve a correr (la versión ya quedó restaurada)."
info "tsc --noEmit ..."
(cd mobile && node_modules/.bin/tsc --noEmit)
info "TypeScript sin errores."
if node -e 'process.exit((require("./mobile/package.json").scripts || {}).test ? 0 : 1)'; then
  info "npm test ..."
else
  info "mobile/package.json todavía no tiene script \"test\"; sigo sin pruebas."
fi
(cd mobile && CI=true npm test --if-present)

# ------------------------------------------------- fin de la prueba en seco
if [ "$SIN_BUILD" -eq 1 ]; then
  paso 5 "Compilar: OMITIDO (--sin-build)" ""
  CONSERVAR_RESPALDO=1
  PASO_ACTUAL=''
  printf '\n%sPrueba en seco terminada (pasos 5 a 7 omitidos).%s\n' "$VERDE" "$NORMAL"
  echo "Quedaron cambiados:"
  echo "  $APP_JSON    $NOMBRE_ACTUAL ($CODIGO_ACTUAL) -> $VERSION_NUEVA ($CODIGO_NUEVO)"
  echo "  $GRADLE    $NOMBRE_ACTUAL ($CODIGO_ACTUAL) -> $VERSION_NUEVA ($CODIGO_NUEVO)"
  [ "$SIN_SNAPSHOT" -eq 1 ] || echo "  $CONTENIDO    (regenerado)"
  echo "Para deshacer y dejar todo como estaba:"
  echo "  git checkout -- $APP_JSON $CONTENIDO"
  echo "  cp \"$RESPALDO/build.gradle\" $GRADLE"
  exit 0
fi

# ========================================================================== 5
paso 5 "Compilar .aab y .apk firmados (tarda varios minutos)" \
  "Lee el error de Gradle de arriba. Causas comunes: MATUTINAS_KEY_PASS equivocada; versión de Java (prueba: export JAVA_HOME=\"/Applications/Android Studio.app/Contents/jbr/Contents/Home\"); caché vieja (mobile/android/gradlew -p mobile/android clean)."
MARCA="$RESPALDO/inicio-build"
touch "$MARCA"
{ set +x; } 2>/dev/null   # nunca mostrar la línea con la contraseña
mobile/android/gradlew -p mobile/android bundleRelease assembleRelease --no-daemon \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password="$MATUTINAS_KEY_PASS" \
  -Pandroid.injected.signing.key.alias=upload \
  -Pandroid.injected.signing.key.password="$MATUTINAS_KEY_PASS"

# ========================================================================== 6
paso 6 "Copiar a la raíz como $AAB_FINAL / $APK_FINAL" \
  "Gradle terminó pero no dejó los archivos esperados; revisa mobile/android/app/build/outputs/."
for f in "$AAB_SALIDA" "$APK_SALIDA"; do
  [ -f "$f" ] || error "No se generó $f."
  [ "$f" -nt "$MARCA" ] || error "$f es de una compilación anterior (no se regeneró)."
done
cp "$AAB_SALIDA" "$AAB_FINAL"; COPIA_AAB="$AAB_FINAL"
cp "$APK_SALIDA" "$APK_FINAL"; COPIA_APK="$APK_FINAL"
info "Listo."

# ========================================================================== 7
paso 7 "Verificar firmas y versión" \
  "NO subas nada a Play Console. Revisa que MATUTINAS_KEYSTORE sea la llave de subida correcta y vuelve a correr."

# .apk: firma válida y no de depuración.
SALIDA_APK="$("$APKSIGNER" verify --print-certs "$APK_FINAL" 2>&1)" \
  || { printf '%s\n' "$SALIDA_APK" >&2; error "apksigner: la firma del .apk no es válida."; }
# (Aquí y abajo se usa <<< en vez de "printf | grep -q": con pipefail, grep -q
#  puede cortar la tubería y dar un falso "no encontrado".)
if grep -q 'Android Debug' <<<"$SALIDA_APK"; then
  error "El .apk quedó firmado con la llave de DEPURACIÓN, no con la de subida."
fi
DUENO_APK="$(sed -n 's/^Signer #1 certificate DN: //p' <<<"$SALIDA_APK")"
HUELLA_APK="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<<"$SALIDA_APK")"
[ -n "$HUELLA_APK" ] || error "apksigner no mostró el certificado del .apk."
info "apksigner .apk: OK ($DUENO_APK)"

# .aab: jarsigner y huella del certificado (mensajes en inglés para poder leerlos).
SALIDA_AAB="$(jarsigner -J-Duser.language=en -verify "$AAB_FINAL" 2>&1)" \
  || { printf '%s\n' "$SALIDA_AAB" >&2; error "jarsigner: no pudo verificar el .aab."; }
grep -q '^jar verified\.' <<<"$SALIDA_AAB" \
  || { printf '%s\n' "$SALIDA_AAB" >&2; error "jarsigner: el .aab no está firmado o la firma no es válida."; }
CERT_AAB="$(keytool -J-Duser.language=en -printcert -jarfile "$AAB_FINAL" 2>&1)" \
  || { printf '%s\n' "$CERT_AAB" >&2; error "keytool no pudo leer el certificado del .aab."; }
if grep -q 'Android Debug' <<<"$CERT_AAB"; then
  error "El .aab quedó firmado con la llave de DEPURACIÓN, no con la de subida."
fi
HUELLA_AAB="$(awk '/SHA256:/ && !h { h = $2 } END { print h }' <<<"$CERT_AAB" | tr -d ':' | tr 'A-F' 'a-f')"
[ "$HUELLA_AAB" = "$HUELLA_APK" ] \
  || error "El .aab y el .apk están firmados con certificados distintos." "aab: $HUELLA_AAB" "apk: $HUELLA_APK"
info "jarsigner .aab: OK (mismo certificado que el .apk)"

# versionCode / versionName dentro del .apk.
BADGING="$("$AAPT2" dump badging "$APK_FINAL")"
APK_CODIGO="$(sed -n "1s/.* versionCode='\([0-9]*\)'.*/\1/p" <<<"$BADGING")"
APK_NOMBRE="$(sed -n "1s/.* versionName='\([^']*\)'.*/\1/p" <<<"$BADGING")"
[ "$APK_CODIGO" = "$CODIGO_NUEVO" ] && [ "$APK_NOMBRE" = "$VERSION_NUEVA" ] \
  || error "El .apk dice versionCode '$APK_CODIGO' / versionName '$APK_NOMBRE'; esperaba $CODIGO_NUEVO / $VERSION_NUEVA."
info "aapt2: versionCode $APK_CODIGO, versionName $APK_NOMBRE"

# ------------------------------------------------------------------ resumen
PASO_ACTUAL=''
printf '\n%s%sPublicación %s lista.%s\n' "$VERDE" "$NEGRITA" "$ETIQUETA" "$NORMAL"
echo "  Versión:  $VERSION_NUEVA (versionCode $CODIGO_NUEVO)"
echo "  $AAB_FINAL  $(tamano "$AAB_FINAL")   <- este se sube a Play Console"
echo "  $APK_FINAL  $(tamano "$APK_FINAL")   <- para instalar directo en un teléfono"
echo "  Certificado SHA-256: $HUELLA_APK"
[ "$SIN_SNAPSHOT" -eq 0 ] || echo "  (contenido.json NO se regeneró: --sin-snapshot)"
echo
echo "Comandos sugeridos (no se ejecutaron; build.gradle no va en git porque android/ es generado):"
echo "  git add $APP_JSON $CONTENIDO"
echo "  git commit -m \"App $ETIQUETA (versionCode $CODIGO_NUEVO, $VERSION_NUEVA): …\""
echo "  git push"
