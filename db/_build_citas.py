#!/usr/bin/env python3
# Lee las citas de db/seed_lecciones_2026_1.sql, baja su texto en RV1909
# (api.getbible.net) y emite UPSERTs para la tabla citas_texto.
import json, os, re, subprocess, sys, time

SRC = os.path.join(os.path.dirname(__file__), 'seed_lecciones_2026_1.sql')

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
LETRAS = re.compile(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]')

# Extrae citas: cadenas entre comillas simples que contienen "n:n".
texto_sql = open(SRC, encoding='utf-8').read()
citas = sorted(set(re.findall(r"'([^']*\d+:[\d,\- ]+)'", texto_sql)))

os.makedirs('/tmp/gbcache', exist_ok=True)
def chapter(bn, cap):
    fn = f'/tmp/gbcache/{bn}_{cap}.json'
    if os.path.exists(fn):
        data = open(fn, encoding='utf-8').read()
    else:
        data = subprocess.run(['curl','-sfS','--max-time','30','-A','Mozilla/5.0',
            f'https://api.getbible.net/v2/valera/{bn}/{cap}.json'],
            capture_output=True, text=True, check=True).stdout
        open(fn,'w',encoding='utf-8').write(data); time.sleep(0.05)
    return {int(v['verse']): re.sub(r'\s+',' ',v['text']).strip() for v in json.loads(data)['verses']}

def dropcap(t):
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

def versiculos(vspec):
    out = []
    for part in vspec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-'); out += list(range(int(a), int(b)+1))
        elif part:
            out.append(int(part))
    return out

faltan = []
rows = []
for cita in citas:
    m = re.match(r'^(.+) (\d+):(.+)$', cita)
    book, cap, vspec = m.group(1).strip(), int(m.group(2)), m.group(3)
    if book not in BOOK:
        faltan.append(cita); continue
    vs = chapter(BOOK[book], cap)
    nums = versiculos(vspec)
    partes = []
    for n in nums:
        if n not in vs: faltan.append(f'{cita} (v{n})'); continue
        t = dropcap(vs[n])
        partes.append(f'{n} {t}' if len(nums) > 1 else t)
    rows.append((cita, '  '.join(partes)))

if faltan:
    print('-- FALTAN:', faltan, file=sys.stderr)

print('-- citas:', len(rows), file=sys.stderr)
print('insert into citas_texto (cita, texto) values')
print(',\n'.join(f'($c${cita}$c$, $x${txt}$x$)' for cita, txt in rows))
print('on conflict (cita) do update set texto = excluded.texto;')
