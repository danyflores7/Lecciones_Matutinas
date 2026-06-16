#!/usr/bin/env python3
# Regenera db/seed_versiculos_2026_1.sql llenando la columna `texto`
# con la Reina-Valera 1909 (dominio público) desde api.getbible.net.
# Reproducible: vuelve a correr `python3 db/_build_texts.py` cuando quieras.
import json, re, os, time, html, subprocess

SRC = os.path.join(os.path.dirname(__file__), 'seed_versiculos_2026_1.sql')

BOOKNUM = {
 '1 Tesalonicenses':52,'2 Tesalonicenses':53,'1 Juan':62,'Apocalipsis':66,'Job':18,
 'Salmos':19,'Proverbios':20,'Mateo':40,'1 Corintios':46,'2 Corintios':47,'Efesios':49,
 'Colosenses':51,'1 Pedro':60,'2 Pedro':61,'Deuteronomio':5,'1 Timoteo':54,'2 Timoteo':55,
 'Tito':56,'Eclesiastés':21,'Isaías':23,'Romanos':45,'Éxodo':2,'Santiago':59,'1 Reyes':11,
 'Ezequiel':26,'Hebreos':58,'Hechos':44,'Miqueas':33,'Oseas':28,'Zacarías':38,'Marcos':41,
 '2 Crónicas':14,'Amós':30,'Juan':43,'Gálatas':48,'1 Samuel':9,'Génesis':1,'Judas':65,'Lucas':42,
}
MESES = {1:'ENERO',2:'FEBRERO',3:'MARZO',4:'ABRIL',5:'MAYO',6:'JUNIO'}

# Captura las 8 columnas de referencia; ignora la columna `texto` si ya existe
# (así el script es idempotente y se puede re-correr sobre su propia salida).
ROW = re.compile(r"^\('(\d{4}-\d{2}-\d{2})','([^']*)','([^']*)','([^']*)','([^']*)',(\d+),(\d+),(NULL|\d+)")

rows = []
for line in open(SRC, encoding='utf-8').read().splitlines():
    m = ROW.match(line.strip())
    if not m:
        continue
    fecha, dia, tema, cita, libro, cap, vi, vf = m.groups()
    rows.append([fecha, dia, tema, cita, libro, int(cap), int(vi), (None if vf=='NULL' else int(vf)), None])

# Corrección confirmada por el usuario: 20 may -> 2 Corintios 8:12
for r in rows:
    if r[0] == '2026-05-20':
        r[3], r[6], r[7] = '2 Corintios 8:12', 12, None

assert len(rows) == 181, f'esperaba 181, hay {len(rows)}'

cache = {}
os.makedirs('/tmp/gbcache', exist_ok=True)
def get_chapter(bn, cap):
    key = (bn, cap)
    if key in cache:
        return cache[key]
    fn = f'/tmp/gbcache/{bn}_{cap}.json'
    if os.path.exists(fn):
        data = open(fn, encoding='utf-8').read()
    else:
        url = f'https://api.getbible.net/v2/valera/{bn}/{cap}.json'
        data = subprocess.run(
            ['curl', '-sfS', '--max-time', '30', '-A', 'Mozilla/5.0', url],
            capture_output=True, text=True, check=True,
        ).stdout
        open(fn, 'w', encoding='utf-8').write(data)
        time.sleep(0.05)
    d = json.loads(data)
    vs = {int(v['verse']): html.unescape(v['text']).replace('\n', ' ').strip() for v in d['verses']}
    cache[key] = vs
    return vs

ACROSTICO = ('ALEPH','BETH','GIMEL','DALETH','HE','VAU','ZAIN','CHETH','TETH','JOD',
             'CAPH','LAMED','MEM','NUN','SAMECH','AIN','PE','TZADI','COPH','RESH',
             'SCHIN','SIN','TAU')

def normaliza(t, libro, cap, n):
    # 1) quita el encabezado hebreo del Salmo 119 (ej. "BETH ", "NUN. ")
    if libro == 'Salmos' and cap == 119:
        t = re.sub(r'^(?:%s)\.?\s+' % '|'.join(ACROSTICO), '', t)
    # 2) capitular RV1909: la(s) primera(s) palabra(s) vienen en MAYÚSCULAS
    #    (ej. "DE Jehová", "Y COMO fué", "A TODOS", "¡MIRAD"). Pasa esa racha
    #    inicial a minúsculas y deja solo la primera letra en mayúscula.
    toks = t.split(' ')
    run = 0
    for tok in toks:
        tiene_min = any(c.islower() for c in tok)
        tiene_may = any(c.isupper() for c in tok)
        if tiene_may and not tiene_min:
            run += 1
        else:
            break
    if run:
        for i in range(run):
            toks[i] = toks[i].lower()
        t = ' '.join(toks)
        for i, c in enumerate(t):
            if c.isalpha():
                t = t[:i] + c.upper() + t[i + 1:]
                break
    return t

missing = []
for r in rows:
    libro, cap, vi, vf = r[4], r[5], r[6], r[7]
    vs = get_chapter(BOOKNUM[libro], cap)
    end = vf if vf else vi
    parts = []
    for n in range(vi, end + 1):
        if n in vs:
            parts.append(normaliza(re.sub(r'\s+', ' ', vs[n]).strip(), libro, cap, n))
        else:
            missing.append((r[0], r[3], n))
    r[8] = ' '.join(parts)

if missing:
    print('FALTANTES:', missing)

def esc(s):
    return s.replace("'", "''")

HEADER = '''-- ============================================================================
-- Matutinas — Primer semestre 2026 (Enero a Junio)
-- Versión bíblica: Reina-Valera 1909 (RV1909, dominio público)
-- Texto de los versículos: api.getbible.net (traducción "valera")
-- Generado por db/_build_texts.py — Total: 181 días
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
  (fecha, dia_semana, tema, cita, libro, capitulo, versiculo_inicio, versiculo_fin, texto)
values
'''

out = [HEADER]
last_month = None
for i, r in enumerate(rows):
    fecha, dia, tema, cita, libro, cap, vi, vf, texto = r
    month = int(fecha[5:7])
    if month != last_month:
        out.append(f'-- ===================== {MESES[month]} 2026 =====================\n')
        last_month = month
    vfsql = 'NULL' if vf is None else str(vf)
    end = ';' if i == len(rows) - 1 else ','
    out.append(
        f"('{fecha}','{dia}','{esc(tema)}','{esc(cita)}','{esc(libro)}',"
        f"{cap},{vi},{vfsql},'{esc(texto)}'){end}\n"
    )

open(SRC, 'w', encoding='utf-8').write(''.join(out))

print('OK — filas:', len(rows), '| capítulos descargados:', len(cache))
print('texto vacío:', sum(1 for r in rows if not r[8]))
print('\n--- Muestras ---')
for f in ('2026-01-28','2026-03-15','2026-04-13','2026-05-20','2026-06-04'):
    r = next(x for x in rows if x[0] == f)
    print(f"{f} {r[3]}: {r[8][:120]}{'…' if len(r[8])>120 else ''}")
