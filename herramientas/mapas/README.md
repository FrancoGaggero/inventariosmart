# Generador de mapas

Genera el contorno de Argentina que usa la sección "Hecho para Argentina" de la portada (change `landing-3d`, ADR 0026). La salida es `apps/web/src/features/landing/3d/datos/argentina.ts`, que se commitea. La portada no descarga ningún mapa de otro dominio.

Está fuera del workspace de pnpm, igual que `herramientas/visuales`, así que no suma dependencias a CI.

## Fuente y licencia

- **Archivo:** [Natural Earth](https://www.naturalearthdata.com/) 1:10m, `ne_10m_admin_0_countries_arg.geojson`, del repo `nvkelso/natural-earth-vector`, tag `v5.1.2`.
- **Licencia:** dominio público ([condiciones de uso](https://www.naturalearthdata.com/about/terms-of-use/)).
- **Vista de país:** es la vista de **Argentina**, que incluye las Islas Malvinas, Georgias del Sur y Sandwich del Sur como territorio argentino.
- **Sector antártico:** se recorta de la Antártida, entre 74° O y 25° O y al sur de 60° S, como en el mapa bicontinental de la Ley 26.651.
- **Archivo original:** pesa 12,6 MB y queda en `fuente/`, ignorada por git. El script lo baja si falta y verifica su SHA-256 antes de usarlo.

## Regenerar

```bash
npm install
node generar-argentina.mjs
```

**Qué hace el script:**

1. Separa el mapa principal (continente, Tierra del Fuego, Isla de los Estados y Malvinas) del recuadro (Georgias, Sandwich y el sector antártico).
2. Descarta las islas diminutas, salvo las de una lista blanca (Malvinas e Isla de los Estados).
3. Simplifica las costas con Douglas-Peucker, con una tolerancia más fina en las islas.
4. Redondea a 0,01° (alrededor de 1 km).

**Validaciones antes de escribir:**

- adentro del mapa: Malvinas (Soledad y Gran Malvina), Ushuaia y Buenos Aires;
- afuera: Santiago de Chile;
- adentro del recuadro: las Georgias;
- el sector antártico, dentro de su cuña.

Si alguna validación falla, no escribe nada. Al final formatea la salida con Prettier, para que `format:check` pase en CI. `datos/argentina.test.ts` repite las validaciones en los tests de la web.
