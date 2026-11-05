"""Versión de docs/arquitectura.html para importar en Google Docs: sin CSS ni navegación, con los
diagramas como imágenes del repositorio público.

Uso, desde la raíz: python herramientas/diagramas/arquitectura_drive.py <salida.html>
"""
import io
import re
import sys

RAW = 'https://raw.githubusercontent.com/FrancoGaggero/inventariosmart/main/docs/diagramas/'
salida = sys.argv[1]
s = io.open('docs/arquitectura.html', encoding='utf-8').read()
s = re.sub(
    r'<style>.*?</style>',
    '<style>body{font-family:Arial,sans-serif;font-size:11pt}table{border-collapse:collapse}'
    'td,th{border:1px solid #888;padding:4px;vertical-align:top}th{background:#f2e6d3}</style>',
    s,
    flags=re.S,
)
s = re.sub(r'<nav class="toc".*?</nav>', '', s, flags=re.S)
s = re.sub(r'<svg\b.*?</svg>', f'<img src="{RAW}componentes.png" width="640" alt="Diagrama de componentes">', s, flags=re.S)
s = s.replace('src="diagramas/der.svg"', f'src="{RAW}der.png" width="640"')
s = s.replace('href="diagramas/der.svg"', 'href="https://github.com/FrancoGaggero/inventariosmart/blob/main/docs/diagramas/der.svg"')
s = re.sub(r'<div class="when">(.*?)</div><div class="what">(.*?)</div>', r'<p><b>\1</b>: \2</p>', s, flags=re.S)
s = re.sub(r'<span class="n">(D\d)</span><div><b>(.*?)</b><span>(.*?)</span></div>', r'<p><b>\1. \2</b> \3</p>', s, flags=re.S)
s = re.sub(r'<span class="n">(\d+)</span>', r'\1. ', s)
s = s.replace('<i></i>', '')
io.open(salida, 'w', encoding='utf-8').write(s)
print(len(s))
