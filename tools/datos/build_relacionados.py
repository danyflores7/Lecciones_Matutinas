#!/usr/bin/env python3
# TAREA B — Versiculos relacionados.
# Fuente cross-refs: openbible.info cross_references.txt (CC-BY, header del propio archivo).
# Texto: RV1909 dump completo api.getbible.net/v2/valera.json (dominio publico).
# Salida: ../v1/relacionados_versiculos.json
import json, os, re, html, unicodedata
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'v1', 'relacionados_versiculos.json')

# ---- Canon BOOKNUM (db/_build_lecciones_sem2.py, 66 libros, orden KJV) ----
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
NUM2BOOK = {v: k for k, v in BOOK.items()}
def deaccent(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
BOOK_NORM = {deaccent(k).lower(): k for k in BOOK}

# OSIS (openbible.info) -> numero de libro (orden KJV 1-66)
OSIS = {
 'Gen':1,'Exod':2,'Lev':3,'Num':4,'Deut':5,'Josh':6,'Judg':7,'Ruth':8,'1Sam':9,'2Sam':10,
 '1Kgs':11,'2Kgs':12,'1Chr':13,'2Chr':14,'Ezra':15,'Neh':16,'Esth':17,'Job':18,'Ps':19,'Prov':20,
 'Eccl':21,'Song':22,'Isa':23,'Jer':24,'Lam':25,'Ezek':26,'Dan':27,'Hos':28,'Joel':29,'Amos':30,
 'Obad':31,'Jonah':32,'Mic':33,'Nah':34,'Hab':35,'Zeph':36,'Hag':37,'Zech':38,'Mal':39,'Matt':40,
 'Mark':41,'Luke':42,'John':43,'Acts':44,'Rom':45,'1Cor':46,'2Cor':47,'Gal':48,'Eph':49,'Phil':50,
 'Col':51,'1Thess':52,'2Thess':53,'1Tim':54,'2Tim':55,'Titus':56,'Phlm':57,'Heb':58,'Jas':59,
 '1Pet':60,'2Pet':61,'1John':62,'2John':63,'3John':64,'Jude':65,'Rev':66,
}

# ---- RV1909: dump completo -> texto[(bn,cap,ver)] ----
ACROSTICO = ('ALEPH','BETH','GIMEL','DALETH','HE','VAU','ZAIN','CHETH','TETH','JOD','CAPH','LAMED',
             'MEM','NUN','SAMECH','AIN','PE','TZADI','COPH','RESH','SCHIN','SIN','TAU')
def normaliza(t, bn, cap):
    t = html.unescape(t).replace('\n', ' ')
    t = re.sub(r'\s+', ' ', t).strip()
    if bn == 19 and cap == 119:
        t = re.sub(r'^(?:%s)\.?\s+' % '|'.join(ACROSTICO), '', t)
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

print('cargando valera.json ...')
VD = json.load(open(os.path.join(HERE, 'valera.json'), encoding='utf-8'))
assert len(VD['books']) == 66, 'el dump no trae 66 libros'
TEXT = {}
for b in VD['books']:
    bn = int(b['nr'])
    for ch in b['chapters']:
        cn = int(ch['chapter'])
        for v in ch['verses']:
            TEXT[(bn, cn, int(v['verse']))] = normaliza(v['text'], bn, cn)
print('versiculos RV1909:', len(TEXT))

# ---- Cross references: from(bn,c,v) -> lista [(votos, (bn,c,v))] ----
def parse_osis(ref):
    """'Gen.1.1' o 'Ps.148.4-Ps.148.5' -> (bn,cap,ver) del PRIMER verso, o None."""
    first = ref.split('-')[0]
    parts = first.split('.')
    if len(parts) != 3: return None
    bk, c, v = parts
    if bk not in OSIS: return None
    try: return (OSIS[bk], int(c), int(v))
    except ValueError: return None

XREF = defaultdict(list)
bad = 0
with open(os.path.join(HERE, 'cross_references.txt'), encoding='utf-8') as f:
    next(f)  # header
    for line in f:
        parts = line.rstrip('\n').split('\t')
        if len(parts) < 3: continue
        src = parse_osis(parts[0]); dst = parse_osis(parts[1])
        if not src or not dst: bad += 1; continue
        try: votes = int(parts[2])
        except ValueError: votes = 0
        XREF[src].append((votes, dst))
print('claves xref:', len(XREF), 'lineas descartadas:', bad)

# ---- Citas objetivo de la app ----
def load(fn, field):
    return [r[field] for r in json.load(open(os.path.join(HERE, fn), encoding='utf-8')) if r.get(field)]

objetivo = []
seen = set()
for c in (load('b_citas_texto.json', 'cita') +
          load('b_lecciones.json', 'versiculo_central_cita') +
          load('b_versiculos_dia.json', 'cita')):
    c = c.strip()
    if c and c not in seen:
        seen.add(c); objetivo.append(c)
print('citas objetivo unicas:', len(objetivo))

CHAPTERS_1 = {'Abdías', 'Filemón', '2 Juan', '3 Juan', 'Judas'}
ABBR = {'heb':'Hebreos','fil':'Filipenses','filip':'Filipenses','sal':'Salmos','apoc':'Apocalipsis',
        'ecl':'Eclesiastés','gal':'Gálatas','rom':'Romanos','ro':'Romanos','mat':'Mateo','mt':'Mateo',
        'mar':'Marcos','luc':'Lucas','stg':'Santiago','sant':'Santiago','prov':'Proverbios','pr':'Proverbios',
        'is':'Isaías','isa':'Isaías','jn':'Juan','deut':'Deuteronomio','gen':'Génesis','ex':'Éxodo',
        'hech':'Hechos','apo':'Apocalipsis','ap':'Apocalipsis'}
CITA_RE = re.compile(r'^(.+?)\s+(\d+)\s*:\s*(\d+(?:\s*[-,]\s*\d+)*)')
def parse_cita(cita):
    """'Libro C:V[-V2|, V2...]' -> (bn, cap, [versos en orden]).
    Tolera espacios tras ':', abreviaturas y libros de 1 capitulo ('Judas 14:15' -> cap 1, vv 14,15)."""
    m = CITA_RE.match(cita)
    if not m: return None
    book = m.group(1).strip()
    if book not in BOOK:
        dl = deaccent(book.rstrip('. ')).lower()
        book = BOOK_NORM.get(dl) or ABBR.get(dl)
        if not book: return None
    cap = int(m.group(2))
    nums = []
    for part in re.split(r',\s*', m.group(3)):
        if '-' in part:
            a, b = [int(x) for x in re.split(r'\s*-\s*', part)[:2]]
            nums.extend(range(a, min(b, a + 30) + 1))
        else:
            nums.append(int(part))
    if book in CHAPTERS_1:
        nums = [cap] + nums; cap = 1
    return (BOOK[book], cap, nums)

# ---- Construccion ----
relacionados = {}
sin_parse, sin_ref, sin_texto_ct = [], [], 0
for cita in objetivo:
    parsed = parse_cita(cita)
    if not parsed:
        sin_parse.append(cita); continue
    abn, acap, versos = parsed
    out = []
    for av in versos:  # ancla = primer verso; si tras filtrar queda vacio, cae al siguiente del rango
        refs = sorted(XREF.get((abn, acap, av), []), key=lambda x: -x[0])
        out, used = [], set()
        for votes, (bn, c, v) in refs:
            if bn == abn and c == acap: continue  # misma cita / mismo capitulo
            if (bn, c, v) in used: continue
            txt = TEXT.get((bn, c, v))
            if not txt: sin_texto_ct += 1; continue
            used.add((bn, c, v))
            out.append({'cita': f'{NUM2BOOK[bn]} {c}:{v}', 'texto': txt})
            if len(out) == 6: break
        if out: break
    if out:
        relacionados[cita] = out
    else:
        sin_ref.append(cita)

doc = {
    'version': 1,
    'fuente': 'OpenBible.info Cross References (Treasury of Scripture Knowledge ampliado)',
    'licencia': 'CC-BY (Creative Commons Attribution) — https://www.openbible.info/labs/cross-references/',
    'relacionados': relacionados,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)

n = len(objetivo); k = len(relacionados)
print(f'objetivo={n}  con_relacionados={k} ({100*k/n:.1f}%)')
print('sin parse:', len(sin_parse), sin_parse[:10])
print('sin refs:', len(sin_ref), sin_ref[:15])
print('refs sin texto RV1909 (saltadas):', sin_texto_ct)
sizes = [len(v) for v in relacionados.values()]
print('promedio relacionados/cita:', round(sum(sizes)/len(sizes), 2), ' con 6:', sum(1 for s in sizes if s == 6))
print('bytes:', os.path.getsize(OUT))
