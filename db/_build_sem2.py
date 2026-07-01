#!/usr/bin/env python3
# Genera db/seed_versiculos_2026_2.sql (Julio–Diciembre 2026) a partir de los
# JSON transcritos del cuaderno, llenando `texto` con Reina-Valera 1909
# (api.getbible.net). Reutiliza la lógica de db/_build_texts.py.
import json, re, os, time, html, subprocess, calendar

SCRATCH = '/private/tmp/claude-501/-Users-danielfloresrojas-Documents-local-App-Iglesia/0c66b6f1-a123-41ab-b4ec-1a60c7b0c15e/scratchpad/mat2'
OUT = os.path.join(os.path.dirname(__file__), 'seed_versiculos_2026_2.sql')

MES_NUM = {'Julio':7,'Agosto':8,'Septiembre':9,'Octubre':10,'Noviembre':11,'Diciembre':12}
MESES_UP = {7:'JULIO',8:'AGOSTO',9:'SEPTIEMBRE',10:'OCTUBRE',11:'NOVIEMBRE',12:'DICIEMBRE'}
DIAS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']  # weekday(): Lunes=0

BOOKNUM = {
 '1 Tesalonicenses':52,'2 Tesalonicenses':53,'1 Juan':62,'Apocalipsis':66,'Job':18,
 'Salmos':19,'Proverbios':20,'Mateo':40,'1 Corintios':46,'2 Corintios':47,'Efesios':49,
 'Colosenses':51,'1 Pedro':60,'2 Pedro':61,'Deuteronomio':5,'1 Timoteo':54,'2 Timoteo':55,
 'Tito':56,'Eclesiastés':21,'Isaías':23,'Romanos':45,'Éxodo':2,'Santiago':59,'1 Reyes':11,
 'Ezequiel':26,'Hebreos':58,'Hechos':44,'Miqueas':33,'Oseas':28,'Zacarías':38,'Marcos':41,
 '2 Crónicas':14,'Amós':30,'Juan':43,'Gálatas':48,'1 Samuel':9,'Génesis':1,'Judas':65,'Lucas':42,
 'Filipenses':50,
}

def parse_vers(v):
    v = v.strip()
    if '-' in v:
        a, b = v.split('-'); return int(a), int(b), v
    if ',' in v:
        nums = [int(x) for x in re.split(r',\s*', v)]
        return nums[0], nums[-1], v
    return int(v), None, v

orden = ['julio','agosto','septiembre','octubre','noviembre','diciembre']
rows, problemas = [], []
for fn in orden:
    data = json.load(open(f'{SCRATCH}/{fn}.json', encoding='utf-8'))
    mes = data['mes']; mnum = MES_NUM[mes]
    ndays = calendar.monthrange(2026, mnum)[1]
    if len(data['dias']) != ndays:
        problemas.append(f'{mes}: {len(data["dias"])} días transcritos != {ndays} reales')
    for d in data['dias']:
        dia = int(d['dia'])
        fecha = f'2026-{mnum:02d}-{dia:02d}'
        wd = DIAS_ES[calendar.weekday(2026, mnum, dia)]
        if wd != d['dia_semana']:
            problemas.append(f'{fecha}: transcrito "{d["dia_semana"]}" != real "{wd}"  ({d["libro"]} {d["capitulo"]}:{d["versiculo"]})')
        vi, vf, vraw = parse_vers(str(d['versiculo']))
        libro = d['libro'].strip()
        if libro not in BOOKNUM:
            problemas.append(f'{fecha}: libro desconocido "{libro}"')
        cita = f"{libro} {d['capitulo']}:{vraw}"
        rows.append([fecha, wd, d['tema'].strip(), cita, libro, int(d['capitulo']), vi, vf, None])

# ---- descarga RV1909 (idéntico a _build_texts.py) ----
cache = {}
os.makedirs('/tmp/gbcache', exist_ok=True)
def get_chapter(bn, cap):
    key = (bn, cap)
    if key in cache: return cache[key]
    fnj = f'/tmp/gbcache/{bn}_{cap}.json'
    if os.path.exists(fnj):
        data = open(fnj, encoding='utf-8').read()
    else:
        url = f'https://api.getbible.net/v2/valera/{bn}/{cap}.json'
        data = subprocess.run(['curl','-sfS','--max-time','30','-A','Mozilla/5.0',url],
                              capture_output=True, text=True, check=True).stdout
        open(fnj,'w',encoding='utf-8').write(data); time.sleep(0.05)
    d = json.loads(data)
    vs = {int(v['verse']): html.unescape(v['text']).replace('\n',' ').strip() for v in d['verses']}
    cache[key] = vs
    return vs

ACROSTICO = ('ALEPH','BETH','GIMEL','DALETH','HE','VAU','ZAIN','CHETH','TETH','JOD','CAPH',
             'LAMED','MEM','NUN','SAMECH','AIN','PE','TZADI','COPH','RESH','SCHIN','SIN','TAU')
def normaliza(t, libro, cap):
    if libro == 'Salmos' and cap == 119:
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

missing = []
for r in rows:
    libro, cap, vi, vf = r[4], r[5], r[6], r[7]
    if libro not in BOOKNUM: continue
    vs = get_chapter(BOOKNUM[libro], cap)
    end = vf if vf else vi
    parts = []
    for n in range(vi, end+1):
        if n in vs: parts.append(normaliza(re.sub(r'\s+',' ',vs[n]).strip(), libro, cap))
        else: missing.append((r[0], r[3], n))
    r[8] = ' '.join(parts)

def esc(s): return s.replace("'", "''")

HEADER = '''-- ============================================================================
-- Matutinas — Segundo semestre 2026 (Julio a Diciembre)
-- Versión bíblica: Reina-Valera 1909 (RV1909, dominio público)
-- Texto de los versículos: api.getbible.net (traducción "valera")
-- Generado por db/_build_sem2.py — Total: %d días
-- ============================================================================

create table if not exists versiculos_dia (
  id                bigint generated always as identity primary key,
  fecha             date    not null unique,
  dia_semana        text    not null,
  tema              text    not null,
  cita              text    not null,
  libro             text    not null,
  capitulo          int     not null,
  versiculo_inicio  int     not null,
  versiculo_fin     int,
  texto             text,
  semestre          text    not null default '2026-1'
);

insert into versiculos_dia
  (fecha, dia_semana, tema, cita, libro, capitulo, versiculo_inicio, versiculo_fin, texto, semestre)
values
''' % len(rows)

out = [HEADER]; last = None
for i, r in enumerate(rows):
    fecha, dia, tema, cita, libro, cap, vi, vf, texto = r
    month = int(fecha[5:7])
    if month != last:
        out.append(f'-- ===================== {MESES_UP[month]} 2026 =====================\n'); last = month
    vfsql = 'NULL' if vf is None else str(vf)
    end = '\non conflict (fecha) do nothing;' if i == len(rows)-1 else ','
    out.append(f"('{fecha}','{dia}','{esc(tema)}','{esc(cita)}','{esc(libro)}',{cap},{vi},{vfsql},'{esc(texto)}','2026-2'){end}\n")

open(OUT,'w',encoding='utf-8').write(''.join(out))

print('=== VALIDACIÓN ===')
print('Filas:', len(rows), '| capítulos descargados:', len(cache), '| texto vacío:', sum(1 for r in rows if not r[8]))
print('Problemas de día de semana / libro:', len(problemas))
for p in problemas: print('  ⚠️', p)
print('Versículos faltantes en RV1909:', missing if missing else 'ninguno')
print('\n--- Muestras ---')
for f in ('2026-07-01','2026-08-23','2026-10-19','2026-12-24','2026-12-31'):
    r = next(x for x in rows if x[0]==f)
    print(f"{f} [{r[1]}] {r[2]} — {r[3]}: {r[8][:90]}{'…' if len(r[8])>90 else ''}")
print('\nSQL escrito en', OUT)
