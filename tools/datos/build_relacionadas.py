#!/opt/anaconda3/bin/python3
# -*- coding: utf-8 -*-
"""
TAREA C - Preguntas similares (TOP 6 de OTRAS lecciones) para las 428 preguntas.
Deterministico: TF-IDF palabras (0.5) + TF-IDF char_wb 3-5 (0.3) + Jaccard de citas
ancladas al primer verso (0.2). Excluye pares de la misma leccion.

Uso: build_relacionadas.py [umbral]   (default 0.12; con "--analiza" solo imprime distribucion)
"""
import json, re, sys, unicodedata, os

BUILD = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BUILD, "..", "v1", "relacionadas_preguntas.json")

def load(name):
    with open(os.path.join(BUILD, name), encoding="utf-8") as f:
        return json.load(f)

preguntas = load("lecciones_preguntas.json")
lecciones = {l["id"]: l for l in load("lecciones.json")}
citas_rows = load("citas_texto.json")

def norm_ws(s):
    return re.sub(r"\s+", " ", (s or "").strip())

def sin_acentos(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")

def norm_texto(s):
    return norm_ws(sin_acentos((s or "").lower()))

# --- lookup de textos de citas (normalizando espacios) ---
citas_texto = {norm_ws(r["cita"]): r["texto"] for r in citas_rows}

# --- ancla de cita al primer verso: "Libro C:V-V2, V3" -> "libro|C|V" ---
def ancla(cita):
    c = norm_texto(cita)
    m = re.match(r"^(.*?)\s*(\d+)\s*:\s*(\d+)", c)
    if m:
        libro = norm_ws(m.group(1))
        return f"{libro}|{m.group(2)}|{m.group(3)}"
    return c  # sin verso: usa la cita normalizada tal cual

# --- documentos ---
docs, anclas_por_preg = [], []
for p in preguntas:
    partes = [p["pregunta"] or "", p.get("nota") or ""]
    A = set()
    for c in (p.get("citas") or []):
        t = citas_texto.get(norm_ws(c))
        if t:
            partes.append(t)
        A.add(ancla(c))
    docs.append(norm_texto(" ".join(partes)))
    anclas_por_preg.append(A)

STOP = norm_texto("""
a al algo alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aqui asi aun aunque
cada como con contra cual cuales cuando de del desde donde dos e el ella ellas ellos en entre era eran
es esa esas ese eso esos esta estaba estan estas este esto estos fue fueron ha habia han hasta hay la
las le les lo los mas me mi mientras muy nada ni no nos nuestra nuestro o os otra otras otro otros para
pero por porque que quien se sea segun ser si sin sino sobre son su sus tal tambien te tiene tienen toda
todas todo todos tras tu un una unas uno unos vosotros y ya yo el ellas les
a fin cuanto pues asimismo empero mas he aqui
""").split()
STOP = sorted(set(STOP))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

vw = TfidfVectorizer(analyzer="word", stop_words=STOP, max_features=30000,
                     sublinear_tf=True, token_pattern=r"(?u)\b\w\w+\b")
Mw = vw.fit_transform(docs)
Sw = cosine_similarity(Mw)

vc = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=60000,
                     sublinear_tf=True)
Mc = vc.fit_transform(docs)
Sc = cosine_similarity(Mc)

n = len(preguntas)
J = np.zeros((n, n))
for i in range(n):
    Ai = anclas_por_preg[i]
    if not Ai:
        continue
    for j in range(i + 1, n):
        Aj = anclas_por_preg[j]
        if not Aj:
            continue
        inter = len(Ai & Aj)
        if inter:
            J[i, j] = J[j, i] = inter / len(Ai | Aj)

S = 0.5 * Sw + 0.3 * Sc + 0.2 * J
np.fill_diagonal(S, -1.0)
lecc_de = np.array([p["leccion_id"] for p in preguntas])
for i in range(n):
    S[i, lecc_de == lecc_de[i]] = -1.0  # excluye misma leccion (incluye a si misma)

# --- distribucion para elegir umbral ---
orden_idx = np.argsort(-S, axis=1)[:, :6]
top_scores = np.take_along_axis(S, orden_idx, axis=1)

if "--analiza" in sys.argv:
    print("percentiles de score del vecino #1:", np.percentile(top_scores[:, 0], [0, 5, 25, 50, 75, 95, 100]).round(3).tolist())
    print("percentiles de score del vecino #6:", np.percentile(top_scores[:, 5], [0, 5, 25, 50, 75, 95, 100]).round(3).tolist())
    for th in (0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25):
        cnt = (top_scores > th).sum(axis=1)
        print(f"umbral {th:.2f}: promedio {cnt.mean():.2f} | con 0: {(cnt==0).sum()} | con <3: {(cnt<3).sum()} | con 6: {(cnt==6).sum()}")
    sys.exit(0)

UMBRAL = float(sys.argv[1]) if len(sys.argv) > 1 else 0.12

similares = {}
cuentas = []
for i, p in enumerate(preguntas):
    lst = []
    for j, sc in zip(orden_idx[i], top_scores[i]):
        if sc <= UMBRAL:
            break
        q = preguntas[int(j)]
        L = lecciones[q["leccion_id"]]
        lst.append({
            "leccion_numero": L["numero"],
            "leccion_titulo": L["titulo"],
            "leccion_fecha": L["fecha"],
            "orden": q["orden"],
            "pregunta": q["pregunta"],
            "citas": q.get("citas") or [],
        })
    similares[str(p["id"])] = lst
    cuentas.append(len(lst))

out = {"version": 1, "similares": similares}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

cuentas = np.array(cuentas)
print("umbral usado:", UMBRAL)
print("llaves:", len(similares))
print("promedio similares:", round(cuentas.mean(), 3))
print("distribucion (num similares -> preguntas):", {int(k): int((cuentas == k).sum()) for k in range(0, 7)})
print("archivo:", os.path.abspath(OUT), os.path.getsize(OUT), "bytes")

# 3 ejemplos: pregunta -> similar #1
rng_idx = [0, n // 2, n - 5]
for i in rng_idx:
    p = preguntas[i]
    if similares[str(p["id"])]:
        s0 = similares[str(p["id"])][0]
        print("EJ |", p["pregunta"][:90], "=>", s0["pregunta"][:90],
              f"(L{s0['leccion_numero']} score {top_scores[i,0]:.3f})")
