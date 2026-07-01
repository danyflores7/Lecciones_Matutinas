#!/usr/bin/env python3
# Compila las 26 lecciones del 2do semestre (Jul-Dic 2026) desde scratchpad/lecc/leccion_img*.json,
# baja RV1909 (central + citas) y genera db/seed_lecciones_2026_2.sql.
# Numeración 1-26 (como el cuaderno). Citas normalizadas a "Libro C:V" (coma/guion -> ':', sin espacio),
# separa ';', hereda libro en continuaciones. Lookup/conflicto por FECHA.
import json, os, re, subprocess, time, glob, calendar, sys, unicodedata, difflib
from collections import Counter

SCRATCH = "/private/tmp/claude-501/-Users-danielfloresrojas-Documents-local-App-Iglesia/0c66b6f1-a123-41ab-b4ec-1a60c7b0c15e/scratchpad/lecc"
OUT = os.path.join(os.path.dirname(__file__), 'seed_lecciones_2026_2.sql')

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
def deaccent(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
BOOK_NORM = {deaccent(k).lower(): k for k in BOOK}
ABBR = {'heb':'Hebreos','fil':'Filipenses','filip':'Filipenses','sal':'Salmos','apoc':'Apocalipsis',
        'ecl':'Eclesiastés','gal':'Gálatas','rom':'Romanos','ro':'Romanos','mat':'Mateo','mt':'Mateo',
        'mar':'Marcos','luc':'Lucas','stg':'Santiago','sant':'Santiago','prov':'Proverbios','pr':'Proverbios',
        'is':'Isaías','isa':'Isaías','jn':'Juan','deut':'Deuteronomio','gen':'Génesis','ex':'Éxodo',
        'hech':'Hechos','hechos':'Hechos','apo':'Apocalipsis','ap':'Apocalipsis'}
CHAPTERS_1 = {'Abdías','Filemón','2 Juan','3 Juan','Judas'}
ACROSTICO = ('ALEPH','BETH','GIMEL','DALETH','HE','VAU','ZAIN','CHETH','TETH','JOD','CAPH','LAMED',
             'MEM','NUN','SAMECH','AIN','PE','TZADI','COPH','RESH','SCHIN','SIN','TAU')
fuzzy_log = set()
def resolve_book(b):
    b = b.strip().rstrip('.')
    if b in BOOK: return b
    dl = deaccent(b).lower()
    if dl in BOOK_NORM: return BOOK_NORM[dl]
    if dl in ABBR: return ABBR[dl]
    m = difflib.get_close_matches(dl, list(BOOK_NORM.keys()), n=1, cutoff=0.80)
    if m:
        fuzzy_log.add(f'"{b}" -> {BOOK_NORM[m[0]]}')
        return BOOK_NORM[m[0]]
    return None

sabados = [f"2026-{m:02d}-{d:02d}" for m in range(7, 13)
           for d in range(1, calendar.monthrange(2026, m)[1] + 1) if calendar.weekday(2026, m, d) == 5]
NUMERO = {f: i + 1 for i, f in enumerate(sabados)}

def norm_cita(c):
    c = c.strip().rstrip(' .')
    if ':' not in c:  # "Daniel 12, 2" o "Génesis 2-17" -> "... 12:2"
        m = re.match(r'^(.+?\D)\s*(\d+)\s*[,\-]\s*(.+)$', c)
        if m: c = f'{m.group(1).strip()} {m.group(2)}:{m.group(3).strip()}'
    return re.sub(r'\s*:\s*', ':', c)

def normaliza_citas(raw_list):
    last_book, last_bc, out, subs = None, None, [], []
    for c in raw_list:
        subs.extend(str(c).split(';'))
    for c in subs:
        c0 = c.strip()
        if not c0: continue
        mv = re.match(r'^(?:verso|vers\.?|v\.?)\s*(\d+)$', c0, re.I)   # "Verso 4" -> hereda libro:capítulo
        if mv and last_bc:
            fin = f'{last_bc}:{mv.group(1)}'
        else:
            c = norm_cita(c0)
            if re.match(r'^\d+\s*:', c) and last_book:
                fin = f'{last_book} {c}'
            else:
                fin = c
        mb = re.match(r'^(.+?)\s+\d', fin)
        if mb and resolve_book(mb.group(1)): last_book = mb.group(1).strip()
        mc = re.match(r'^(.+?\s+\d+):', fin)
        if mc: last_bc = mc.group(1)
        out.append(fin)
    return out

os.makedirs('/tmp/gbcache', exist_ok=True)
def chapter(bn, cap):
    fn = f'/tmp/gbcache/{bn}_{cap}.json'
    if os.path.exists(fn):
        data = open(fn, encoding='utf-8').read()
    else:
        r = subprocess.run(['curl','-sfS','--max-time','30','-A','Mozilla/5.0',
            f'https://api.getbible.net/v2/valera/{bn}/{cap}.json'], capture_output=True, text=True)
        if r.returncode != 0: return None
        data = r.stdout; open(fn,'w',encoding='utf-8').write(data); time.sleep(0.05)
    try:
        return {int(v['verse']): re.sub(r'\s+',' ',v['text']).strip() for v in json.loads(data)['verses']}
    except Exception:
        return None

def normaliza(t, book, cap):
    if book == 'Salmos' and cap == 119:
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

def parse_vers(vspec):
    out = []
    for part in vspec.split(','):
        part = part.strip().strip('.')
        if not part: continue
        if '-' in part:
            a, b = [re.sub(r'\D', '', x) for x in part.split('-', 1)]
            if a and b and int(a) <= int(b) <= int(a) + 176: out += list(range(int(a), int(b) + 1))
        else:
            d = re.sub(r'\D', '', part)
            if d: out.append(int(d))
    return out

faltan = []
def cita_texto(cita, numbered):
    m = re.match(r'^(.+?)\s+(\d+):(.+)$', cita.strip())
    if not m: faltan.append(cita + ' (formato)'); return None
    book = resolve_book(m.group(1))
    if not book: faltan.append(cita + ' (libro?)'); return None
    cap, vspec = int(m.group(2)), m.group(3)
    if book in CHAPTERS_1 and cap != 1: vspec = f'{cap}, {vspec}'; cap = 1
    vs = chapter(BOOK[book], cap)
    if vs is None: faltan.append(f'{cita} (cap {cap} inexistente en {book})'); return None
    nums = parse_vers(vspec); partes = []
    for n in nums:
        if n not in vs: faltan.append(f'{cita} (v{n})'); continue
        t = normaliza(re.sub(r'\s+',' ',vs[n]).strip(), book, cap)
        partes.append(f'{n} {t}' if (numbered and len(nums) > 1) else t)
    return ('  ' if numbered else ' ').join(partes) if partes else None

# ---- Leer lecciones ----
lecciones = []
for fn in sorted(glob.glob(f"{SCRATCH}/leccion_img*.json")):
    d = json.load(open(fn, encoding='utf-8'))
    if d['fecha'] not in NUMERO:
        print('!! fecha fuera de rango:', d['fecha'], fn, file=sys.stderr); continue
    d['numero'] = NUMERO[d['fecha']]
    if d.get('numero_cuaderno') not in (None, d['numero']):
        print(f"  aviso numero: {os.path.basename(fn)} cuaderno={d.get('numero_cuaderno')} != {d['numero']}", file=sys.stderr)
    lecciones.append(d)
lecciones.sort(key=lambda x: x['fecha'])

# ---- Normaliza serie (unifica), titulo (sin punto), citas ----
cnt = {}
for l in lecciones:
    if l.get('serie'):
        k = deaccent(l['serie'].strip().rstrip('. ').lower())
        cnt.setdefault(k, Counter())[l['serie'].strip().rstrip('. ')] += 1
serie_canon = {k: c.most_common(1)[0][0] for k, c in cnt.items()}
for l in lecciones:
    if l.get('serie'): l['serie'] = serie_canon[deaccent(l['serie'].strip().rstrip('. ').lower())]
    if l.get('titulo'): l['titulo'] = l['titulo'].strip().rstrip('. ')
    if l.get('lectura_biblica'):
        lb = normaliza_citas([l['lectura_biblica']]); l['lectura_biblica'] = '; '.join(lb)
    cc = normaliza_citas([l['versiculo_central_cita']])
    l['_central_parts'] = cc
    l['versiculo_central_cita'] = '; '.join(cc)
    for p in l['preguntas']:
        p['citas'] = normaliza_citas(p.get('citas') or [])

# ---- Textos RV1909 ----
for l in lecciones:
    parts = [cita_texto(c, numbered=False) for c in l['_central_parts']]
    l['central_texto'] = ' '.join(p for p in parts if p) or None
citas = sorted({c for l in lecciones for p in l['preguntas'] for c in p['citas']})
citas_rows = [(c, cita_texto(c, numbered=True)) for c in citas]

def dq(tag, s): return f'${tag}$' + s + f'${tag}$' if s is not None else 'NULL'
def arr(cs): return 'ARRAY[' + ','.join("'" + c.replace("'", "''") + "'" for c in cs) + ']::text[]'

fechas = [l['fecha'] for l in lecciones]
# --- Trozos cargables, separados por '-- @@' ---
lrows = []
for l in lecciones:
    lrows.append("(%d, '%s', %s, %s, %s, %s, %s, %s, '2026-2')" % (
        l['numero'], l['fecha'], dq('s', l.get('serie')), dq('t', l['titulo']), dq('lb', l.get('lectura_biblica')),
        dq('vc', l['versiculo_central_cita']), dq('vt', l.get('central_texto')), dq('in', l['introduccion'])))
lecc_stmt = ("insert into lecciones (numero, fecha, serie, titulo, lectura_biblica, versiculo_central_cita, "
    "versiculo_central_texto, introduccion, semestre) values\n" + ',\n'.join(lrows) +
    "\non conflict (fecha) do update set numero=excluded.numero, serie=excluded.serie, titulo=excluded.titulo, "
    "lectura_biblica=excluded.lectura_biblica, versiculo_central_cita=excluded.versiculo_central_cita, "
    "versiculo_central_texto=excluded.versiculo_central_texto, introduccion=excluded.introduccion, semestre=excluded.semestre;")
delete_stmt = ("delete from lecciones_preguntas where leccion_id in (select id from lecciones where fecha in (%s));"
    % ','.join("'%s'" % f for f in fechas))
PH = "insert into lecciones_preguntas (leccion_id, orden, pregunta, citas, nota)\nselect l.id, p.orden, p.pregunta, p.citas, p.nota from (values\n"
PT = "\n) as p(fecha, orden, pregunta, citas, nota) join lecciones l on l.fecha = p.fecha::date;"
prows = []
for l in lecciones:
    for p in l['preguntas']:
        prows.append("('%s', %d, %s, %s, %s)" % (
            l['fecha'], p['orden'], dq('q', p['pregunta']), arr(p.get('citas') or []), dq('n', p.get('nota'))))
crows = [f"($c${c}$c$, $x${t}$x$)" for c, t in citas_rows if t is not None]
def batches(lst, n): return [lst[i:i+n] for i in range(0, len(lst), n)]
chunks = [lecc_stmt]
pb = batches(prows, (len(prows)+3)//4)          # preguntas en 4 lotes (~14KB)
chunks.append(delete_stmt + "\n" + PH + ',\n'.join(pb[0]) + PT)
for b in pb[1:]: chunks.append(PH + ',\n'.join(b) + PT)
for b in batches(crows, (len(crows)+6)//7):     # citas en 7 lotes (~16KB)
    chunks.append("insert into citas_texto (cita, texto) values\n" + ',\n'.join(b) +
                  "\non conflict (cita) do update set texto = excluded.texto;")
open(OUT, 'w', encoding='utf-8').write('\n-- @@\n'.join(chunks))
print("Chunks:", len(chunks), "| tamaños KB:", [len(c)//1024 for c in chunks])

print("Lecciones:", len(lecciones), "| numeros:", [l['numero'] for l in lecciones])
print("Preguntas:", sum(len(l['preguntas']) for l in lecciones), "| Citas únicas:", len(citas_rows))
print("Sin texto (central):", [l['numero'] for l in lecciones if not l['central_texto']])
if fuzzy_log: print("Libros corregidos (fuzzy):", sorted(fuzzy_log))
print("FALTAN (%d):" % len(faltan), faltan[:40])
print("SQL:", OUT, "(%d KB)" % (os.path.getsize(OUT)//1024))
