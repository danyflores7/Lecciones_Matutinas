#!/usr/bin/env python3
# Construye biblia.json (RV1909 completa) desde el dump de getbible (valera.json).
# - Nombres canonicos: dict BOOK de db/_build_lecciones_sem2.py (66 libros, con acentos),
#   consistente con BOOKNUM de db/_build_sem2.py.
# - Limpieza: html.unescape, colapso de espacios, trim, quita encabezados acrosticos
#   de Salmos 119 y normaliza el arranque en MAYUSCULAS de los versiculos iniciales
#   de capitulo (identico a normaliza() de db/_build_sem2.py).
# Salida compacta: {"version":1,"libros":[{"n":"...","c":[["v1",...],...]},...]}
import json, html, re, sys, unicodedata

RAW = "/private/tmp/claude-501/-Users-danielfloresrojas-Documents-local-App-Iglesia/0c66b6f1-a123-41ab-b4ec-1a60c7b0c15e/scratchpad/datos/_build/valera_raw.json"
OUT = "/private/tmp/claude-501/-Users-danielfloresrojas-Documents-local-App-Iglesia/0c66b6f1-a123-41ab-b4ec-1a60c7b0c15e/scratchpad/datos/v1/biblia.json"

# Canon 1-66 (nombres EXACTOS de db/_build_lecciones_sem2.py BOOK; superconjunto de BOOKNUM)
BOOK = {
 'Génesis':1,'Éxodo':2,'Levítico':3,'Números':4,'Deuteronomio':5,'Josué':6,'Jueces':7,'Rut':8,
 '1 Samuel':9,'2 Samuel':10,'1 Reyes':11,'2 Reyes':12,'1 Crónicas':13,'2 Crónicas':14,'Esdras':15,
 'Nehemías':16,'Ester':17,'Job':18,'Salmos':19,'Proverbios':20,'Eclesiastés':21,'Cantares':22,
 'Isaías':23,'Jeremías':24,'Lamentaciones':25,'Ezequiel':26,'Daniel':27,'Oseas':28,'Joel':29,
 'Amós':30,'Abdías':31,'Jonás':32,'Miqueas':33,'Nahum':34,'Habacuc':35,'Sofonías':36,'Hageo':37,
 'Zacarías':38,'Malaquías':39,'Mateo':40,'Marcos':41,'Lucas':42,'Juan':43,'Hechos':44,'Romanos':45,
 '1 Corintios':46,'2 Corintios':47,'Gálatas':48,'Efesios':49,'Filipenses':50,'Colosenses':51,
 '1 Tesalonicenses':52,'2 Tesalonicenses':53,'1 Timoteo':54,'2 Timoteo':55,'Tito':56,'Filemón':57,
 'Hebreos':58,'Santiago':59,'1 Pedro':60,'2 Pedro':61,'1 Juan':62,'2 Juan':63,'3 Juan':64,'Judas':65,
 'Apocalipsis':66,
}
NUM2NAME = {v: k for k, v in BOOK.items()}

ACROSTICO = ('ALEPH','BETH','GIMEL','DALETH','HE','VAU','ZAIN','CHETH','TETH','JOD','CAPH',
             'LAMED','MEM','NUN','SAMECH','AIN','PE','TZADI','COPH','RESH','SCHIN','SIN','TAU')
ACRO_RE = re.compile(r'^(?:%s)\.?\s+' % '|'.join(ACROSTICO))

def normaliza(t, libro, cap):
    # identico a db/_build_sem2.py::normaliza
    if libro == 'Salmos' and cap == 119:
        t = ACRO_RE.sub('', t)
    toks = t.split(' '); run = 0
    for tok in toks:
        if any(c.isupper() for c in tok) and not any(c.islower() for c in tok): run += 1
        else: break
    if run:
        for i in range(run): toks[i] = toks[i].lower()
        t = ' '.join(toks)
        for i, c in enumerate(t):
            if c.isalpha(): t = t[:i] + c.upper() + t[i+1:]; break
    return t

def limpia(t):
    t = html.unescape(t).replace('\n', ' ')
    t = re.sub(r'<[^>]+>', '', t)          # sin etiquetas
    t = re.sub(r'\s+', ' ', t).strip()     # trim, sin dobles espacios
    return t

def deaccent(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

d = json.load(open(RAW, encoding='utf-8'))
books = d['books']
assert len(books) == 66, f"esperados 66 libros, hay {len(books)}"

libros_out, problemas = [], []
total_versos = 0
cap_counts = {}
for b in books:
    nr = int(b['nr'])
    canon = NUM2NAME[nr]
    caps = sorted(b['chapters'], key=lambda c: int(c['chapter']))
    # capitulos consecutivos 1..N
    nums = [int(c['chapter']) for c in caps]
    if nums != list(range(1, len(nums) + 1)):
        problemas.append(f"{canon}: capitulos no consecutivos {nums[:5]}...")
    c_out = []
    for c in caps:
        capn = int(c['chapter'])
        verses = sorted(c['verses'], key=lambda v: int(v['verse']))
        vnums = [int(v['verse']) for v in verses]
        if vnums != list(range(1, len(vnums) + 1)):
            problemas.append(f"{canon} {capn}: versiculos no consecutivos")
        vs = []
        for v in verses:
            t = normaliza(limpia(v['text']), canon, capn)
            if not t:
                problemas.append(f"{canon} {capn}:{v['verse']} texto vacio")
            if re.match(r'^\d', t):
                problemas.append(f"{canon} {capn}:{v['verse']} arranca con digito: {t[:40]}")
            vs.append(t)
        c_out.append(vs)
        total_versos += len(vs)
    cap_counts[canon] = len(c_out)
    libros_out.append({'n': canon, 'c': c_out})

# ---- validaciones ----
esperado_caps = {'Génesis': 50, 'Salmos': 150, 'Juan': 21, 'Apocalipsis': 22}
for k, v in esperado_caps.items():
    assert cap_counts[k] == v, f"{k}: {cap_counts[k]} caps != {v}"
assert 31000 <= total_versos <= 31200, f"total versos fuera de rango: {total_versos}"

jn316 = libros_out[42]['c'][2][15]   # Juan 3:16
sal231 = libros_out[18]['c'][22][0]  # Salmos 23:1
assert 'unigenito' in deaccent(jn316).lower(), f"Juan 3:16 sin 'unigenito': {jn316}"
assert 'pastor' in deaccent(sal231).lower(), f"Salmos 23:1 sin 'pastor': {sal231}"

if problemas:
    print("PROBLEMAS:", len(problemas))
    for p in problemas[:20]: print(" -", p)
    sys.exit(1)

out = {'version': 1, 'libros': libros_out}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

import os
print("OK  ->", OUT, f"({os.path.getsize(OUT):,} bytes)")
print("libros:", len(libros_out), "| versos:", total_versos,
      "| caps:", {k: cap_counts[k] for k in esperado_caps})
print("Juan 3:16:", jn316)
print("Salmos 23:1:", sal231)
