# ADR 0022 · Paleta ámbar cálida y navegación lateral con criterios de Material

**Estado:** aceptada · 02/10/2026. Reemplaza los valores de la paleta y la decisión de navegación de ADR 0012, y mantiene su mecanismo de tokens.

## Contexto

Franco quiso una identidad más cálida y profesional, a partir de dos capturas de referencia:

- fondos crema en tema claro y marrón casi negro en oscuro;
- acento ámbar dorado;
- una tarjeta destacada invertida;
- un nombre en serif cursiva en el saludo;
- navegación en una barra lateral agrupada.

La barra superior de ADR 0012 había llegado a 15 enlaces en una fila: un `ResizeObserver` escondía las etiquetas y "Falta de stock" y "Stock parado" ni siquiera estaban en el menú. Franco también pidió sumar criterios de Material Design y de UX.

## Decisión

1. **Mismos tokens, valores nuevos.**
   - Los nombres semánticos de ADR 0012 (`brand`, `ok`, `warn`, `crit`, `t1-3`, `line`, `fill`, `card`, `field`…) no cambian. Las unas 900 clases que los usan se repintan sin tocar las páginas.
   - Claro: crema #F4EFE6 y tinta #1F1A14. Oscuro: #14110D y crema #F3ECE1.
   - Ámbar #E0A54A en oscuro y #B87A22 en claro, siempre con texto oscuro encima: el blanco sobre ámbar no llega a AA.
   - `warn` pasa a terracota para no confundirse con el ámbar, y `violet` a ciruela.
   - Se suman `inverso`, `on-inverso` y `acento-inverso` para la superficie invertida, `--font-serif` (Instrument Serif itálica, sólo de acento), un radio de tarjeta de 20 px y las elevaciones `--shadow-1` a `--shadow-3`.
   - Se borran los tokens `navy*` y los degradados azul y violeta.
2. **Contraste como test.** `lib/contraste.test.ts` lee `index.css`, compone los colores con transparencia sobre su fondo y exige WCAG AA en los dos temas: 4,5:1 para texto y 3:1 para indicadores e interfaz. El ámbar claro propuesto (#C8892B) no pasaba y se oscureció.
3. **Criterios de Material 3, sin librería.**
   - Capa de estado como sombra interior del color del texto: 8 % al pasar el mouse, 12 % con foco o al apretar.
   - Botones lleno, tonal, con borde y de texto.
   - Tarjetas sólidas con elevación, una tarjeta invertida y píldoras de estado.
   - Navegación con indicador en píldora tonal.
   - Foco visible ámbar global y áreas táctiles de al menos 44 px.
4. **Navegación como datos.** `lib/navegacion.ts`, puro y probado, define las secciones General, Análisis, Compras, Asistente y Cuenta por rol y plan, y los cuatro accesos de la barra inferior. La vista sólo dibuja.
5. **Un shell por tamaño de pantalla.**
   - **Barra lateral fija desde `md`:** 256 px expandida o riel de íconos de 76 px. Guarda la preferencia y, la primera vez, arranca como riel por debajo de 1280 px. Lleva el comercio, la tarjeta del plan (sólo para el dueño, oculta en PREMIUM y en pantallas de menos de 720 px de alto) y la cuenta.
   - **Barra superior:** la fecha, la campana de alertas y "Registrar movimiento".
   - **En el celular:** barra inferior con cuatro accesos y "Más", que abre el menú completo como diálogo modal con el foco atrapado.
   - **Accesibilidad:** enlace "Ir al contenido".
6. **Colores fijos fuera.** Login y portada usan la superficie invertida en lugar del degradé con blancos. `GraficaBarras` toma `currentColor`, el logo es un componente (`ui/Logo`) en ámbar, y los overlays usan un velo del fondo. Los greps de ADR 0012 quedan vacíos salvo el logo de Google.
7. **Gráficos.** Los datos del comercio van en color y las referencias oficiales en gris. En la inflación: precios en ámbar, costos en ciruela, IPC en `t2` e IPC bienes en `t3` punteado.

## Alternativas consideradas

- **Material UI o Material Web:** traen sus propios estilos, que pelean con Tailwind y con el mecanismo de `data-theme`, y suman peso. Se toman los criterios, no la implementación.
- **Renombrar `brand` a `acento`:** tocaría unas 900 clases sin ningún cambio visible.
- **Texto blanco sobre el ámbar:** 2,9:1, por debajo de AA.
- **Cajón con hamburguesa también en el celular:** esconde los destinos frecuentes detrás de un toque. La barra inferior los deja a un toque y "Más" conserva el resto.
- **Mantener la barra superior con menos enlaces:** obligaba a sacar secciones, y el producto sigue sumando pantallas.

## Consecuencias

- El contenido tiene 256 px menos de ancho con la barra expandida. Por eso la barra arranca como riel por debajo de 1280 px y los KPI del panel pasan a cuatro columnas recién desde `xl`.
- Las pantallas que sumen colores tienen que usar los tokens. Si alguien escribe un color con bajo contraste en `index.css`, falla el test de contraste.
- La app Flutter conserva su paleta anterior, que queda como evolución.
