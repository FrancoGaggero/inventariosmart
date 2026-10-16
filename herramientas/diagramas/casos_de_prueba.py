"""Genera docs/entrega/casos-de-prueba.csv desde los escenarios CP de openspec y los tests que los citan.

Uso, desde la raíz: python herramientas/diagramas/casos_de_prueba.py
"""
import csv
import glob
import io
import os
import re

SPECS = sorted(glob.glob('openspec/specs/*/spec.md')) + sorted(glob.glob('openspec/changes/*/specs/*/spec.md'))
TESTS = [
    f
    for patron in (
        'apps/api/src/**/*.spec.ts',
        'apps/api/test/**/*.ts',
        'apps/web/src/**/*.test.ts',
        'apps/web/src/**/*.test.tsx',
        'packages/shared/src/**/*.test.ts',
        'apps/mobile/test/**/*_test.dart',
    )
    for f in glob.glob(patron, recursive=True)
]
contenido_tests = {f.replace('\\', '/'): io.open(f, encoding='utf-8').read() for f in TESTS}

PLATAFORMA = {
    'apps/api': 'API',
    'apps/web': 'Web',
    'packages/shared': 'Reglas compartidas',
    'apps/mobile': 'Android',
}


def tests_de(cp):
    patron = re.compile(re.escape(cp) + r'(?![0-9a-z])')
    return sorted(f for f, texto in contenido_tests.items() if patron.search(texto))


def hu_de(cp, capacidad):
    m = re.match(r'CP-(\d+)\.', cp)
    if m:
        return f'HU-{m.group(1)}'
    return 'App Android (RNF-06)'


filas = []
vistos = set()
for spec in SPECS:
    capacidad = spec.replace('\\', '/').split('/')[-2]
    en_change = '/changes/' in spec.replace('\\', '/')
    texto = io.open(spec, encoding='utf-8').read()
    requisito = ''
    actual = None
    for linea in texto.splitlines():
        r = re.match(r'### Requirement: (.+)', linea)
        if r:
            requisito = r.group(1).strip()
            continue
        s = re.match(r'#### Scenario: (CP-[0-9M]+\.[0-9]+[a-z]?)\s+(.+)', linea)
        if s:
            actual = {
                'cp': s.group(1),
                'titulo': s.group(2).strip(),
                'requisito': requisito,
                'capacidad': capacidad,
                'pasos': {'GIVEN': [], 'WHEN': [], 'THEN': []},
                'ultimo': 'GIVEN',
                'change': en_change,
            }
            filas.append(actual)
            continue
        if linea.startswith('#'):
            actual = None
            continue
        p = re.match(r'\s*- \*\*(GIVEN|WHEN|THEN|AND)\*\*\s+(.+)', linea)
        if p and actual:
            clave = actual['ultimo'] if p.group(1) == 'AND' else p.group(1)
            actual['ultimo'] = clave
            actual['pasos'][clave].append(p.group(2).strip())

# Si un CP figura en un spec vigente y en una change activa, gana la change (es la versión nueva).
por_cp = {}
for f in filas:
    if f['cp'] not in por_cp or f['change']:
        por_cp[f['cp']] = f


def orden(cp):
    m = re.match(r'CP-(M|\d+)\.(\d+)([a-z]?)', cp)
    grupo = 1000 if m.group(1) == 'M' else int(m.group(1))
    return (grupo, int(m.group(2)), m.group(3))


os.makedirs('docs/entrega', exist_ok=True)
with io.open('docs/entrega/casos-de-prueba.csv', 'w', encoding='utf-8', newline='') as salida:
    w = csv.writer(salida)
    w.writerow(['Caso', 'Historia', 'Capacidad', 'Requisito', 'Caso de prueba', 'Precondición (dado)',
                'Acción (cuando)', 'Resultado esperado (entonces)', 'Verificación', 'Tests automatizados',
                'Resultado'])
    sin_test = []
    for cp in sorted(por_cp, key=orden):
        f = por_cp[cp]
        archivos = tests_de(cp)
        plataformas = sorted({v for k, v in PLATAFORMA.items() for a in archivos if a.startswith(k)})
        if not archivos:
            sin_test.append(cp)
        w.writerow([
            cp,
            hu_de(cp, f['capacidad']),
            f['capacidad'],
            f['requisito'],
            f['titulo'],
            ' · '.join(f['pasos']['GIVEN']),
            ' · '.join(f['pasos']['WHEN']),
            ' · '.join(f['pasos']['THEN']),
            ('Automatizada (' + ', '.join(plataformas) + ')') if archivos else 'Manual',
            '; '.join(os.path.basename(a) for a in archivos),
            'Aprobado en CI' if archivos else 'Pendiente de prueba manual',
        ])
print(len(por_cp), 'casos;', len(sin_test), 'sin test automatizado:', ' '.join(sin_test))
