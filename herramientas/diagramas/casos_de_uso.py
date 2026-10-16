"""Dibuja docs/diagramas/casos-de-uso.svg: diagrama UML de casos de uso con actores, elipses y relaciones.

Mermaid no tiene diagramas de casos de uso y su flowchart cruza las líneas; acá la disposición es fija:
actores primarios a la izquierda, casos en una columna, casos auxiliares al medio y externos a la derecha.
Uso, desde la raíz: python herramientas/diagramas/casos_de_uso.py && node herramientas/diagramas/renderizar.mjs casos-de-uso.svg
"""
import io
from xml.sax.saxutils import escape

CASOS = [
    ('CU11a', 'CU-11a Registrarse e iniciar sesión'),
    ('CU11b', 'CU-11b Gestionar usuarios y comercio'),
    ('CU14', 'CU-14 Gestionar plan'),
    ('CU01', 'CU-01 Administrar productos'),
    ('CU10', 'CU-10 Registrar movimiento de stock'),
    ('CU05', 'CU-05 Importar inventario'),
    ('CU02', 'CU-02 Administrar proveedores y listas'),
    ('CU12', 'CU-12 Comparar proveedores'),
    ('CU13', 'CU-13 Administrar gastos'),
    ('CU03', 'CU-03 Consultar rentabilidad'),
    ('CU04', 'CU-04 Visualizar dashboard'),
    ('CU06', 'CU-06 Generar alerta de reposición'),
    ('CU18', 'CU-18 Consultar pérdidas por falta de stock'),
    ('CU19', 'CU-19 Consultar stock parado'),
    ('CU07', 'CU-07 Generar orden de compra'),
    ('CU16', 'CU-16 Enviar la orden por WhatsApp'),
    ('CU08', 'CU-08 Consultar al asistente'),
    ('CU09', 'CU-09 Emitir reporte semanal'),
    ('CU15', 'CU-15 Comparar precios con la inflación'),
    ('CU17', 'CU-17 Remarcar precios en lote'),
]
DUENIO = [c for c, _ in CASOS]
EMPLEADO = ['CU11a', 'CU14', 'CU01', 'CU10']
CONTADOR = ['CU11a', 'CU14', 'CU10', 'CU13', 'CU03', 'CU04', 'CU06', 'CU18', 'CU19', 'CU07', 'CU09', 'CU15', 'CU17']
EXTERNOS = [  # (clave, nombre, casos)
    ('FB', 'Firebase Authentication', ['CU11a']),
    ('PRV', 'Proveedor', ['CU07', 'CU16']),
    ('MAIL', 'Servicio de correo (Resend)', ['CU06', 'CU07', 'CU09']),
    ('IA', 'Servicio de IA (Anthropic)', ['CU08']),
    ('SIS', 'Sistema (procesos programados)', ['CU06', 'CU09', 'CU15']),
    ('OFI', 'INDEC y BCRA', ['CU15']),
]
AUX = [  # (clave, nombre, entre qué filas se ubica)
    ('INC3', 'Actualizar costo vigente y márgenes', 'CU02'),
    ('INC2', 'Elegir canal de envío', 'CU07'),
    ('INC1', 'Dejar orden en borrador', 'CU08'),
]

FILA, Y0 = 50, 110
CX, RX, RY = 600, 175, 20
AUXX, AUXRX = 960, 135
fila = {c: Y0 + i * FILA for i, (c, _) in enumerate(CASOS)}
ANCHO = 1500
ALTO = Y0 + len(CASOS) * FILA + 185
pos_aux = {'INC3': fila['CU02'] + 25, 'INC2': fila['CU07'] - 25, 'INC1': fila['CU08'] + 25}
actores_izq = {'EMP': ('Empleado / Operador', 230), 'DUE': ('Dueño / Administrador', 600), 'CON': ('Contador / Asesor externo', 960)}
ext_y = {'FB': 150, 'MAIL': 450, 'PRV': 680, 'IA': 880, 'SIS': 1060, 'OFI': 1220}
AX_IZQ, AX_DER = 110, 1370

o = []
o.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ANCHO} {ALTO}" width="{ANCHO}" height="{ALTO}" font-family="Arial, Helvetica, sans-serif" font-size="13">')
o.append('<defs><marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="#555" stroke-width="1.4"/></marker></defs>')
o.append(f'<rect width="{ANCHO}" height="{ALTO}" fill="#fff"/>')
# límite del sistema
o.append(f'<rect x="380" y="60" width="770" height="{ALTO - 215}" rx="6" fill="#fafafa" stroke="#666" stroke-width="1.4"/>')
o.append('<text x="765" y="85" text-anchor="middle" font-weight="bold" font-size="15">InventarioSmart</text>')


def linea(x1, y1, x2, y2, color='#8a8a8a'):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1"/>')


def actor(x, y, nombre, color):
    o.append(f'<g stroke="{color}" stroke-width="1.8" fill="none"><circle cx="{x}" cy="{y - 34}" r="11"/>'
             f'<line x1="{x}" y1="{y - 23}" x2="{x}" y2="{y + 8}"/><line x1="{x - 17}" y1="{y - 12}" x2="{x + 17}" y2="{y - 12}"/>'
             f'<line x1="{x}" y1="{y + 8}" x2="{x - 13}" y2="{y + 30}"/><line x1="{x}" y1="{y + 8}" x2="{x + 13}" y2="{y + 30}"/></g>')
    o.append(f'<text x="{x}" y="{y + 50}" text-anchor="middle" font-weight="bold">{escape(nombre)}</text>')


# asociaciones de actores primarios (debajo de las elipses)
colores = {'DUE': '#b06d00', 'EMP': '#2f6f4f', 'CON': '#4a5a9a'}
for clave, casos in (('DUE', DUENIO), ('EMP', EMPLEADO), ('CON', CONTADOR)):
    _, y = actores_izq[clave]
    for c in casos:
        linea(AX_IZQ + 22, y - 12, CX - RX, fila[c], colores[clave] + '88')
for clave, _, casos in EXTERNOS:
    for c in casos:
        linea(CX + RX, fila[c], AX_DER - 22, ext_y[clave] - 12, '#77777788')

# relaciones «include» y «extend»
def flecha(x1, y1, x2, y2, etiqueta, dx=0, dy=-4):
    o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#555" stroke-width="1.1" stroke-dasharray="5 4" marker-end="url(#punta)"/>')
    o.append(f'<text x="{(x1 + x2) / 2 + dx}" y="{(y1 + y2) / 2 + dy}" text-anchor="middle" font-size="11" fill="#333">«{etiqueta}»</text>')


flecha(CX + RX, fila['CU02'], AUXX - AUXRX, pos_aux['INC3'], 'include')
flecha(CX + RX, fila['CU07'], AUXX - AUXRX, pos_aux['INC2'], 'include')
flecha(CX + RX - 30, fila['CU07'] + 14, AUXX - AUXRX + 10, pos_aux['INC1'] - 10, 'include', dx=-30, dy=-6)
flecha(AUXX - 40, pos_aux['INC1'] + 18, CX + RX - 40, fila['CU08'] + 16, 'extend', dx=40, dy=18)
# extensiones entre casos vecinos de la columna: curva por la izquierda del texto
for desde, hacia in (('CU16', 'CU07'), ('CU17', 'CU15')):
    y1, y2 = fila[desde] - RY + 2, fila[hacia] + RY - 2
    x = CX - RX + 30
    o.append(f'<path d="M{x},{y1} C{x - 60},{y1 - 10} {x - 60},{y2 + 10} {x},{y2}" fill="none" stroke="#555" stroke-width="1.1" stroke-dasharray="5 4" marker-end="url(#punta)"/>')
    o.append(f'<text x="{x - 40}" y="{(y1 + y2) / 2 + 4}" text-anchor="end" font-size="11" fill="#333">«extend»</text>')

# elipses
for c, nombre in CASOS:
    y = fila[c]
    o.append(f'<ellipse cx="{CX}" cy="{y}" rx="{RX}" ry="{RY}" fill="#fff5e6" stroke="#8a5a00" stroke-width="1.3"/>')
    o.append(f'<text x="{CX}" y="{y + 4.5}" text-anchor="middle">{escape(nombre)}</text>')
for c, nombre, _ in AUX:
    y = pos_aux[c]
    o.append(f'<ellipse cx="{AUXX}" cy="{y}" rx="{AUXRX}" ry="{RY}" fill="#fff" stroke="#8a5a00" stroke-width="1.1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{AUXX}" y="{y + 4.5}" text-anchor="middle" font-size="12">{escape(nombre)}</text>')

for clave, (nombre, y) in actores_izq.items():
    actor(AX_IZQ, y, nombre, colores[clave])
for clave, nombre, _ in EXTERNOS:
    actor(AX_DER, ext_y[clave], nombre, '#555')

o.append(f'<text x="20" y="{ALTO - 12}" font-size="11" fill="#555">CU-xx = HU-xx. Líneas: asociación actor–caso (color del actor). Punteadas con flecha: «include» y «extend». Elipses punteadas: casos auxiliares sin número.</text>')
o.append('</svg>')
io.open('docs/diagramas/casos-de-uso.svg', 'w', encoding='utf-8', newline='\n').write('<?xml version="1.0" encoding="UTF-8"?>\n' + '\n'.join(o) + '\n')
print('ok', ANCHO, ALTO)
