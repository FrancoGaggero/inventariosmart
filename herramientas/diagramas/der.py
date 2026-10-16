"""Genera docs/diagramas/der.mmd (Mermaid erDiagram) desde apps/api/prisma/schema.prisma.

Uso, desde la raíz: python herramientas/diagramas/der.py && node herramientas/diagramas/renderizar.mjs der
"""
import io
import re

src = io.open('apps/api/prisma/schema.prisma', encoding='utf-8').read()

enums = set(re.findall(r'^enum (\w+) \{', src, re.M))
bloques = re.findall(r'^model (\w+) \{(.*?)^\}', src, re.M | re.S)
modelos = {m for m, _ in bloques}


def snake(s):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()


tablas = {}
salida_ent = []
relaciones = []
for nombre, cuerpo in bloques:
    m = re.search(r'@@map\("(\w+)"\)', cuerpo)
    tablas[nombre] = m.group(1) if m else snake(nombre)

for nombre, cuerpo in bloques:
    tabla = tablas[nombre]
    lineas = [l.strip() for l in cuerpo.splitlines()]
    uniques_compuestos = re.findall(r'@@unique\(\[([^\]]+)\]', cuerpo)
    fks = set()
    for l in lineas:
        r = re.search(r'@relation\((?:"\w+", )?fields: \[([^\]]+)\]', l)
        if r:
            for f in r.group(1).split(','):
                fks.add(f.strip())
    attrs = []
    for l in lineas:
        if not l or l.startswith('//') or l.startswith('@@'):
            continue
        partes = l.split()
        if len(partes) < 2:
            continue
        campo, tipo = partes[0], partes[1]
        base = tipo.rstrip('?[]')
        if base in modelos:
            # relación: si lleva fields, la tabla actual es la "muchos" (o uno opcional)
            r = re.search(r'fields: \[([^\]]+)\]', l)
            if r:
                fk = r.group(1).split(',')[0].strip()
                opcional = tipo.endswith('?')
                # ¿FK única? -> 1 a 1
                linea_fk = next((x for x in lineas if x.split() and x.split()[0] == fk), '')
                unico = '@unique' in linea_fk or '@id' in linea_fk
                izq = '|o' if opcional else '||'
                der = 'o|' if unico else 'o{'
                etiqueta = snake(campo)
                # comercio_id está en todas las tablas de negocio: se dibuja sólo comercio-usuario
                # para que el diagrama se lea; la FK queda marcada en cada tabla.
                if base == 'Comercio' and nombre != 'Usuario':
                    continue
                relaciones.append(f'    {tablas[base]} {izq}--{der} {tabla} : "{etiqueta}"')
            continue
        col = re.search(r'@map\("(\w+)"\)', l)
        col = col.group(1) if col else snake(campo)
        if base in enums:
            t = base.lower()
        else:
            t = {'String': 'text', 'Int': 'int', 'Decimal': 'decimal', 'Boolean': 'bool',
                 'DateTime': 'timestamptz', 'Json': 'jsonb', 'BigInt': 'bigint'}.get(base, base.lower())
            if '@db.Uuid' in l:
                t = 'uuid'
            elif '@db.VarChar' in l or '@db.Char' in l:
                t = 'varchar'
            elif '@db.Date' in l and '@db.DateTime' not in l:
                t = 'date'
            elif '@db.SmallInt' in l:
                t = 'smallint'
        if tipo.endswith('[]'):
            t += '_array'
        claves = []
        if '@id' in l:
            claves.append('PK')
        if campo in fks:
            claves.append('FK')
        if '@unique' in l:
            claves.append('UK')
        nulo = ' "opcional"' if tipo.endswith('?') else ''
        attrs.append(f'        {t} {col} {",".join(claves)}{nulo}'.rstrip())
    salida_ent.append(f'    {tabla} {{\n' + '\n'.join(attrs) + '\n    }')

texto = ('%% Generado con herramientas/diagramas/der.py desde apps/api/prisma/schema.prisma (no editar a mano).\n'
         '%% Todas las tablas con comercio_id FK referencian a comercio; sólo se dibuja comercio-usuario.\n')
texto += 'erDiagram\n' + '\n'.join(relaciones) + '\n' + '\n'.join(salida_ent) + '\n'
io.open('docs/diagramas/der.mmd', 'w', encoding='utf-8', newline='\n').write(texto)
print(len(bloques), 'tablas,', len(relaciones), 'relaciones')
