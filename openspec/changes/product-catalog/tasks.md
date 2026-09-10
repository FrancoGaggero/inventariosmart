## 1. Contrato compartido y modelo de datos

- [x] 1.1 Agregar en `packages/shared`: `ESTADOS_STOCK`, `calcularEstadoStock()`, `ProductoSchema`, `ProductoCreateSchema`, `ProductoPatchSchema` (rechaza `stockActual` con mensaje propio), `ListaProductosSchema` y el formato genérico de lista paginada `{ items, siguienteCursor }`, con tests unitarios. Listo cuando: `pnpm --filter @inventariosmart/shared test` pasa con los casos de validación de CP-01.1c y CP-01.4b
- [x] 1.2 Modelo `Producto` en `schema.prisma` (D1), migración `product_catalog` con `pg_trgm`, índices, `ENABLE`/`FORCE ROW LEVEL SECURITY` y políticas `producto_tenant` / `producto_sistema`; agregar `Producto` a `TENANT_MODELS`. Listo cuando: `prisma migrate deploy` aplica en Neon dev, `rls.e2e-spec.ts` pasa incluyendo `producto`, y `psql` como `app_api` sin contexto devuelve 0 filas (CP-01.7b)

## 2. API · módulo products

- [x] 2.1 `ProductsService.listar()` con búsqueda (`q`), filtros `estado` y `activo`, orden `(nombre, id)` y cursor base64url (D3, D4); mapeo a `Producto` con `estadoStock` derivado. Listo cuando: CP-01.3, CP-01.3b y CP-01.3e pasan
- [x] 2.2 `ProductsService.crear()`: alícuota por defecto del comercio, normalización del código, conflicto 409 (con sugerencia de reactivar si el existente está inactivo), límite del plan FREE con bloqueo de la fila de `comercio` (D6). Listo cuando: CP-01.1, CP-01.1b, CP-01.2, CP-01.2b, CP-01.2c, CP-01.6 y CP-01.6b pasan
- [x] 2.3 `ProductsService.obtener()`, `actualizar()` (rechaza `stockActual`; `activo: true` reactiva contando el límite) y `darDeBaja()` (baja lógica). Listo cuando: CP-01.4, CP-01.4b, CP-01.5 y CP-01.5b pasan
- [x] 2.4 `ProductsController` con `@Roles('DUENIO', 'EMPLEADO')` en lectura y `@Roles('DUENIO')` en escritura, DTOs Swagger (`ProductoDto`, `ProductoCreateBodyDto`, `ProductoPatchBodyDto`, `ListaProductosDto`) y `@ApiResponse` de 400/401/402/403/404/409. Listo cuando: CP-01.3c (EMPLEADO sin `costoReposicion`), CP-01.3d (CONTADOR 403) y CP-01.4c pasan
- [x] 2.5 Test e2e de aislamiento y rendimiento: dos comercios con el mismo código (CP-01.2c, CP-01.7); 300 productos en lote y búsqueda `q=` en menos de 500 ms. Listo cuando: `products.e2e-spec.ts` pasa completo junto con las suites existentes
- [x] 2.6 Regenerar el contrato y el cliente: `pnpm openapi`. Listo cuando: `docs/openapi.json` tiene las cinco rutas de D5 con sus esquemas de body y CI no reporta contrato desactualizado

## 3. Web · inventario

- [ ] 3.1 Cliente de datos: `useProductos({ q, estado, activo })` con paginación por cursor (`useInfiniteQuery`), `useProducto(id)` y mutaciones crear/editar/baja/reactivar con invalidación. Listo cuando: el listado carga páginas sucesivas con "Ver más" y las mutaciones refrescan sin recargar
- [ ] 3.2 Página `/productos`: buscador con debounce, chips Todos / OK / Bajo / Sin stock / Dados de baja, tabla (código, nombre, stock con chip de estado, precio; costo sólo para DUENIO), botón "Nuevo producto" (DUENIO) y acciones de baja/reactivar por fila con confirmación. Listo cuando: un EMPLEADO ve la tabla sin columna de costo ni acciones, y un DUENIO puede dar de baja y reactivar desde la fila
- [ ] 3.3 `ProductoForm` compartido por `/productos/nuevo` y `/productos/:id`: validación con los esquemas de `shared`, errores por campo desde `details`, alícuota precargada con el IVA del comercio, stock inicial sólo al crear, aviso "Disponible en el plan PRO" ante 402. Listo cuando: crear y editar terminan en la fila actualizada del listado y un código repetido muestra el mensaje del 409 junto al campo
- [ ] 3.4 Enlace "Inventario" en `AppShell` (DUENIO y EMPLEADO) y tarjeta de acceso en el inicio; `RequireRole` para las rutas de escritura. Listo cuando: CONTADOR no ve el enlace y, si escribe la URL, ve "No tenés permiso"

## 4. Verificación y cierre

- [x] 4.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, e2e de la API y `pnpm format:check` en verde; CI en verde. Listo cuando: el push a `main` muestra los dos jobs en verde
- [ ] 4.2 Desplegar y verificar en producción: migración aplicada en Neon production, `GET /products` con tu usuario, alta de un producto real desde la web publicada y su baja/reactivación. Listo cuando: el producto creado aparece en `https://inventariosmart0.vercel.app/productos`
- [x] 4.3 Actualizar README (rutas nuevas y convención de paginación), `docs/arquitectura.html` (§5 DER: `Producto` con `codigo_normalizado`, `costo_reposicion`) y el runbook si hubo aprendizajes. Listo cuando: los documentos reflejan D1 a D5
- [ ] 4.4 (manual, Franco) Mover HU-01 a Hecho en Trello, actualizar `Backlog_InventarioSmart_v2.xlsx` y la tarea 4.4 del Gantt. Listo cuando: Trello, backlog y Gantt coinciden
