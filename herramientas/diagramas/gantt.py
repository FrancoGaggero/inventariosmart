"""Genera docs/entrega/gantt-v3.csv y valida sus dependencias.

Cada tarea declara sus predecesoras con el tipo de dependencia:
- FC (fin-comienzo): la tarea empieza el mismo día o después de que termina la predecesora.
- CC (comienzo-comienzo): la tarea empieza el mismo día o después de que empieza la predecesora.
Si alguna no se cumple con las fechas reales, el script falla y no escribe nada.

Uso, desde la raíz: python herramientas/diagramas/gantt.py
"""
import csv
import datetime as dt
import io
import sys

sys.stdout.reconfigure(encoding='utf-8')

R = 'Franco Gaggero'


def d(s):
    return dt.datetime.strptime(s, '%d/%m/%Y').date()


def habiles(a, b):
    a, b = d(a), d(b)
    n = 0
    while a <= b:
        n += a.weekday() < 5
        a += dt.timedelta(days=1)
    return max(n, 1)


# (n, edt, tarea, inicio, fin, dependencias "EDT:tipo, ...", % comp., change, observaciones)
FILAS = [
    ('ETAPA 1 — DETECCIÓN DE LA NECESIDAD Y ANÁLISIS',),
    (1, '1.1', 'Observación del problema y definición del dominio', '02/03/2026', '04/03/2026', '', '100%', '', ''),
    (2, '1.2', 'Entrevista en profundidad (comerciante de repuestos)', '05/03/2026', '10/03/2026', '1.1:FC', '100%', '', ''),
    (3, '1.3', 'Diseño y aplicación de la encuesta cuantitativa (n=24)', '11/03/2026', '17/03/2026', '1.2:FC', '100%', '', ''),
    (4, '1.4', 'Análisis de los resultados de la encuesta', '18/03/2026', '20/03/2026', '1.3:FC', '100%', '', ''),
    (5, '1.5', 'Elaboración del mapa de empatía (Carlos)', '23/03/2026', '25/03/2026', '1.4:FC', '100%', '', ''),
    (6, '1.6', 'Definición del buyer persona', '26/03/2026', '27/03/2026', '1.5:FC', '100%', '', ''),
    ('', 'H1', 'HITO — Cierre de la etapa de análisis', '27/03/2026', '27/03/2026', '1.6:FC', '100%', '', ''),
    ('ETAPA 2 — IDEACIÓN, VALIDACIÓN Y VIABILIDAD',),
    (7, '2.1', 'Benchmarking y análisis de la competencia', '31/03/2026', '03/04/2026', 'H1:FC', '100%', '', ''),
    (8, '2.2', 'Cuadro comparativo de soluciones y análisis FODA', '06/04/2026', '08/04/2026', '2.1:FC', '100%', '', ''),
    (9, '2.3', 'Sesión de brainstorming', '09/04/2026', '09/04/2026', '2.2:FC', '100%', '', ''),
    (10, '2.4', 'Técnica Seis Sombreros (Edward de Bono)', '10/04/2026', '10/04/2026', '2.3:FC', '100%', '', ''),
    (11, '2.5', 'Técnica Fresh Eyes (perspectiva externa)', '13/04/2026', '13/04/2026', '2.4:FC', '100%', '', ''),
    (12, '2.6', 'Definición de la idea central del proyecto', '14/04/2026', '15/04/2026', '2.5:FC', '100%', '', ''),
    (13, '2.7', 'Desarrollo SCAMPER aplicado a InventarioSmart', '16/04/2026', '22/04/2026', '2.6:FC', '100%', '', ''),
    (14, '2.8', 'Validación técnica y comercial. Modelo de negocio SaaS', '23/04/2026', '24/04/2026', '2.7:FC', '100%', '', ''),
    (15, '2.9', 'Revisión integral de la documentación (Propuesta v2.0)', '24/08/2026', '27/08/2026', '2.8:FC', '100%', '', 'Receso académico entre el 27/04 y el 24/08.'),
    ('', 'H2', 'HITO — Cierre de ideación y viabilidad', '27/08/2026', '27/08/2026', '2.9:FC', '100%', '', ''),
    ('ETAPA 3 — DISEÑO Y MODELADO (base al inicio y consolidación después de construir; ver nota 2)',),
    (16, '3.6', 'Diseño de arquitectura (base: stack, multi-tenencia, módulos)', '09/09/2026', '10/09/2026', 'H2:FC', '100%', 'sprint0-esqueleto', 'docs/arquitectura.html y ADR 0001 a 0005. Actualizado el 09/10 con lo construido.'),
    (17, '3.4', 'Modelo entidad-relación (DER) base', '09/09/2026', '10/09/2026', 'H2:FC', '100%', 'sprint0-esqueleto', 'Borrador del DER; cada change sumó sus tablas en su design.md.'),
    (18, '3.1', 'Separación de los requisitos funcionales Web / Mobile', '02/10/2026', '02/10/2026', '4.10:FC', '100%', 'mobile-redesign', 'Criterio de ADR 0024.'),
    (19, '3.8', 'Refinamiento de wireframes e identidad visual', '24/09/2026', '06/10/2026', 'H4a:FC', '100%', 'web-visual-polish, web-redesign, mobile-redesign, app-animations', 'ADR 0022, 0024 y 0025.'),
    (20, '3.2', 'Diagrama de casos de uso (UML)', '09/10/2026', '09/10/2026', '3.1:FC, 4.21:FC', '100%', '', 'Consolidado desde los specs de las 19 HU.'),
    (21, '3.3', 'Especificación de los casos de uso (CU-01 a CU-19)', '09/10/2026', '09/10/2026', '3.2:CC', '100%', '', ''),
    (22, '3.5', 'Diagrama de clases', '09/10/2026', '09/10/2026', '3.4:FC, 4.21:FC', '100%', '', 'Generado del modelo construido.'),
    (23, '3.7', 'Diagrama de componentes', '09/10/2026', '09/10/2026', '3.6:FC, 4.21:FC', '100%', '', ''),
    ('', 'H3', 'HITO — Cierre del diseño técnico', '09/10/2026', '09/10/2026', '3.3:FC, 3.5:FC, 3.7:FC, 3.8:FC', '100%', '', ''),
    ('ETAPA 4 — DESARROLLO E IMPLEMENTACIÓN (Fases 1, 2 y 3)',),
    (24, '4.1', 'Setup de repositorios y entorno de desarrollo', '09/09/2026', '09/09/2026', 'H2:FC', '100%', 'sprint0-esqueleto', 'Monorepo, CI, Render, Vercel y Neon.'),
    (25, '4.2', 'Modelo de datos y backend base (NestJS + Prisma)', '09/09/2026', '10/09/2026', '4.1:FC, 3.4:CC', '100%', 'sprint0-esqueleto', ''),
    (26, '4.3', 'Autenticación, usuarios y roles — HU-11', '10/09/2026', '10/09/2026', '4.2:FC', '100%', 'auth-tenancy', 'Incluye RLS por comercio.'),
    (27, '4.4', 'Módulo de inventario — HU-01', '10/09/2026', '10/09/2026', '4.3:FC', '100%', 'product-catalog', ''),
    (28, '4.5', 'Registro de movimientos de stock — HU-10', '22/09/2026', '22/09/2026', '4.4:FC', '100%', 'stock-movements', ''),
    (29, '4.6', 'Proveedores y listas de precios — HU-02', '22/09/2026', '22/09/2026', '4.5:FC', '100%', 'suppliers-price-lists', ''),
    (30, '4.7', 'Gastos y motor de rentabilidad — HU-03, HU-13', '22/09/2026', '23/09/2026', '4.6:FC', '100%', 'operating-expenses, profitability-engine', ''),
    (31, '4.8', 'Dashboard financiero — HU-04', '23/09/2026', '23/09/2026', '4.7:FC', '100%', 'financial-dashboard', ''),
    (32, '4.9', 'Importación desde Excel y onboarding — HU-05', '23/09/2026', '23/09/2026', '4.8:FC', '100%', 'excel-import-onboarding', ''),
    (33, '4.10', 'Aplicación mobile Flutter (pantallas del MVP)', '23/09/2026', '23/09/2026', '4.9:FC', '100%', 'mobile-mvp', ''),
    ('', 'H4a', 'HITO — MVP Fase 1 funcional (web y mobile)', '23/09/2026', '23/09/2026', '4.10:FC', '100%', '', 'Adelantado del 04/12 al 23/09.'),
    (34, '4.11', 'Alertas predictivas de reposición — HU-06', '23/09/2026', '23/09/2026', 'H4a:FC', '100%', 'restock-alerts', 'Fase 2.'),
    (35, '4.12', 'Órdenes de compra en modo copiloto — HU-07', '24/09/2026', '24/09/2026', '4.11:FC', '100%', 'purchase-orders-copilot', 'Fase 2.'),
    (36, '4.13', 'Reportes semanales — HU-09', '24/09/2026', '24/09/2026', '4.12:FC', '100%', 'weekly-reports', 'Fase 2.'),
    (37, '4.14', 'Precios frente a la inflación — HU-15', '28/09/2026', '28/09/2026', '4.13:FC', '100%', 'inflation-insights', 'Historia nueva (v3.0).'),
    (38, '4.15', 'Envío de órdenes por WhatsApp — HU-16', '28/09/2026', '28/09/2026', '4.12:FC', '100%', 'purchase-orders-whatsapp', 'Historia nueva (v3.0).'),
    (39, '4.16', 'Remarcación asistida — HU-17', '28/09/2026', '28/09/2026', '4.14:FC', '100%', 'bulk-repricing', 'Historia nueva (v3.0).'),
    (40, '4.17', 'Comparador de proveedores — HU-12', '28/09/2026', '28/09/2026', '4.6:FC', '100%', 'supplier-comparison', 'Fase 2.'),
    (41, '4.18', 'Asistente conversacional con IA — HU-08', '28/09/2026', '02/10/2026', '4.12:FC', '100%', 'ai-assistant, assistant-top-sellers, assistant-stock-insights', 'Fase 3.'),
    (42, '4.19', 'Gestión de plan y suscripción — HU-14', '29/09/2026', '29/09/2026', '4.3:FC', '100%', 'subscription-plans', 'Fase 3.'),
    (43, '4.20', 'Pérdidas por falta de stock — HU-18', '01/10/2026', '01/10/2026', '4.5:FC', '100%', 'stockout-losses', 'Historia nueva (v3.0).'),
    (44, '4.21', 'Stock parado — HU-19', '01/10/2026', '01/10/2026', '4.5:FC', '100%', 'dead-stock', 'Historia nueva (v3.0).'),
    (45, '4.22', 'App Android: análisis, asistente y órdenes en el celular', '02/10/2026', '07/10/2026', '4.10:FC, 3.1:CC', '100%', 'mobile-redesign, mobile-stock-insights, mobile-assistant, mobile-orders', ''),
    (46, '4.23', 'Portada con escenas 3D', '15/10/2026', '16/10/2026', '3.8:FC', '100%', 'landing-3d', 'ADR 0026.'),
    ('', 'H4', 'HITO — Producto completo Fases 1 a 3 (web y mobile)', '16/10/2026', '16/10/2026', '4.22:FC, 4.23:FC', '100%', '', ''),
    ('ETAPA 5 — PRUEBAS, DOCUMENTACIÓN Y ENTREGA',),
    (47, '5.1', 'Diseño y ejecución de los casos de prueba (CP)', '10/09/2026', '10/12/2026', '4.3:CC', '95%', '', '426 casos especificados con cada historia; los automatizados corren en CI en cada cambio. Quedan 21 de verificación manual.'),
    (48, '5.7', 'Respaldo diario de la base (RNF-09)', '09/11/2026', '20/11/2026', 'H4:FC', '0%', 'database-backups', 'pg_dump diario, 30 días de retención y restauración probada.'),
    (49, '5.3', 'Carga de datos de demostración y usuario de prueba', '09/10/2026', '09/10/2026', '4.21:FC', '100%', '', 'Usuario de prueba informado en la planilla de seguimiento.'),
    (50, '5.4', 'Redacción del manual de usuario', '09/10/2026', '04/12/2026', '4.22:CC', '60%', '', 'Versión 1.0 redactada; faltan las capturas.'),
    (51, '5.2', 'Corrección de defectos detectados', '11/12/2026', '14/12/2026', '5.1:FC, 5.7:FC', '0%', '', ''),
    (52, '5.5', 'Grabación y edición del video DEMO', '15/12/2026', '16/12/2026', '5.2:FC, 5.4:FC', '0%', '', ''),
    (53, '5.6', 'Consolidación del formulario de entrega PL03', '17/12/2026', '18/12/2026', '5.5:FC', '50%', '', 'PL03 v3 con enlaces y estados actualizados.'),
    ('', 'H5', 'HITO — ENTREGA FINAL', '18/12/2026', '18/12/2026', '5.6:FC', '0%', '', ''),
]

# --- validación de dependencias ---------------------------------------------------------------
tareas = {f[1]: f for f in FILAS if len(f) > 1}
errores = []
for f in FILAS:
    if len(f) == 1 or not f[5]:
        continue
    _, edt, _, ini, fin, deps, *_ = f
    if d(fin) < d(ini):
        errores.append(f'{edt}: termina antes de empezar.')
    for dep in deps.split(', '):
        pred, tipo = dep.split(':')
        if pred not in tareas:
            errores.append(f'{edt}: depende de {pred}, que no existe.')
            continue
        p = tareas[pred]
        if tipo == 'FC' and d(ini) < d(p[4]):
            errores.append(f'{edt} empieza el {ini} y su predecesora {pred} (FC) termina el {p[4]}.')
        elif tipo == 'CC' and d(ini) < d(p[3]):
            errores.append(f'{edt} empieza el {ini} y su predecesora {pred} (CC) empieza el {p[3]}.')
        elif tipo not in ('FC', 'CC'):
            errores.append(f'{edt}: tipo de dependencia desconocido {tipo}.')
if errores:
    for e in errores:
        print('✗', e)
    sys.exit(1)

with io.open('docs/entrega/gantt-v3.csv', 'w', encoding='utf-8', newline='') as salida:
    w = csv.writer(salida)
    w.writerow(['DIAGRAMA DE GANTT — InventarioSmart · v3.1 · 05/11/2026 · Franco Gaggero (proyecto individual)'])
    w.writerow(['#', 'EDT', 'Tarea / actividad', 'Responsable', 'Inicio', 'Fin', 'Días háb.', 'Depende de', '% comp.', 'Change de OpenSpec', 'Observaciones'])
    total = hechas = 0
    for f in FILAS:
        if len(f) == 1:
            w.writerow([f[0]])
            continue
        n, edt, tarea, ini, fin, deps, pc, change, obs = f
        if n != '':
            total += 1
            hechas += pc == '100%'
        w.writerow([n, edt, tarea, R, ini, fin, habiles(ini, fin), deps or '—', pc, change, obs])
    w.writerow([])
    w.writerow(['AVANCE GENERAL', f'Tareas: {total}', f'Finalizadas: {hechas}', f'Avance por tareas: {round(100 * hechas / total, 1)} %'])
    w.writerow(['NOTAS'])
    w.writerow(['1. Fechas reales: la de inicio y fin de cada change de OpenSpec según sus commits. Las tareas futuras están planificadas.'])
    w.writerow(['2. Proceso de diseño: la arquitectura y el DER base se hicieron antes de construir (09/09 y 10/09). Durante la construcción, cada historia tuvo su diseño propio (design.md, specs y ADR) antes de programarla. Los diagramas UML (casos de uso, clases y componentes) y el DER final se consolidaron el 09/10, después de construir, a partir del sistema real. Por eso las tareas 3.2, 3.3, 3.5 y 3.7 dependen de la última historia (4.21).'])
    w.writerow(['3. Tipos de dependencia: FC = fin-comienzo (la tarea empieza cuando termina la predecesora, el mismo día o después); CC = comienzo-comienzo (empieza junto con la predecesora o después; se usa para tareas que avanzaron en paralelo, como los casos de prueba, que se escribieron con cada historia).'])
    w.writerow(['4. Las etapas 3 y 4 se superponen: el desarrollo guiado por especificación diseña cada historia justo antes de construirla.'])
    w.writerow(['5. Días hábiles sin sábados ni domingos; no descuenta feriados.'])
print(f'✓ docs/entrega/gantt-v3.csv: {total} tareas, {hechas} finalizadas, dependencias válidas.')
