# Verificación visual · web-visual-polish

Método (design D6): en el navegador integrado de Claude Code, con la sesión de Franco en
`https://inventariosmart0.vercel.app` (comercio Lubricentro carfax, plan PRO), se emula cada
ancho y por pantalla se ejecuta:

```js
const d = document.documentElement;
({ w: d.clientWidth, docW: d.scrollWidth, ok: d.scrollWidth <= d.clientWidth });
```

más un barrido de `main *` y `header *` buscando cajas con `right > clientWidth` (fuera de los
contenedores `overflow-x-auto`, que scrollean por diseño). "OK" = sin desborde del documento ni
cajas fuera del ancho. Fecha: 24/09/2026, bundle `index-CD80u9sK.js` (commit `48acbb1`) y
posterior.

## Desborde por pantalla y ancho

| Pantalla       | 360 px | 768 px | 1024 px | 1280 px |
| -------------- | ------ | ------ | ------- | ------- |
| Inicio (`/`)   | OK ¹   | OK     | OK      | OK ²    |
| Inventario     | OK ³   | OK     | OK      | OK      |
| Alertas        | OK     | OK     | OK      | OK      |
| Órdenes        | OK     | OK     | OK      | OK      |
| Nueva orden    | OK     | OK     | OK      | OK      |
| Login          | OK ⁴   | —      | —       | OK ⁴    |
| Portada (`/`)  | OK ⁴   | —      | —       | OK ⁴    |

¹ Primera pasada (bundle `index-CYAfpXid.js`): las tarjetas KPI medían 400 px en una grilla de
328 px y el botón "Cerrar sesión" aparecía en móvil porque `.btn` fijaba `display` por encima de
`hidden`. Corregido en `48acbb1` (clases propias en `@layer components`, `min-w-0` en la
tarjeta): segunda pasada con KPI de 328 px y botón oculto.
² A 1280 px la cabecera con diez enlaces etiquetados más el nombre del comercio se superponía
(nav hasta 1024 px, bloque derecho desde ~909 px). Corregido: entre `lg` y `xl` los enlaces van
sólo con icono y tooltip, las etiquetas entran desde `xl` y el bloque del comercio desde `2xl`.
Re-medido después del deploy (ver abajo).
³ La fila de chips de filtro scrollea dentro de su contenedor `overflow-x-auto` (por diseño).
⁴ Medido en local (`http://localhost:5173`, sin sesión) a 474 y 1280 px.

## Navegación (design D1)

- 360 y 768 px: botón "Abrir menú" visible, la barra de enlaces oculta. Abrir por clic: panel
  `#menu-lateral` con los 10 enlaces (Inicio, Inventario, Movimientos, Rentabilidad, Gastos,
  Alertas, Órdenes, Proveedores, Usuarios, Comercio), foco en "Inicio", `body.overflow = hidden`,
  `aria-expanded = true`. Escape: se cierra, el foco vuelve a "Abrir menú", `body.overflow` vacío.
- 1024 y 1280 px: barra de enlaces visible (10 enlaces), botón de menú oculto.

## Tema claro (design D2)

- Inicio a 1280 px con `data-theme="light"`: fondo `rgb(244, 246, 251)`, texto `rgb(15, 23, 42)`,
  tarjetas blancas, anillos y barras legibles; sin desborde.
- Alertas a 1280 px en claro: estado vacío ilustrado legible; sin desborde.

## Pendiente de confirmar por Franco

Recorrido en producción con su propia pantalla (tema, menú, portada, KPI animados y listados en
tarjetas desde el celular).
