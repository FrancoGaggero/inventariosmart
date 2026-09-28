## Context

Ver proposal.md – Why. Lo que existe y esta change reutiliza:

- `precio_proveedor` (HU-02, ADR 0007): historial de costos netos por producto y proveedor, de sólo inserción, con índices `(comercio_id, proveedor_id, producto_id, vigente_desde DESC, creado_en DESC)` y `(comercio_id, producto_id, vigente_desde DESC, id DESC)`.
- `proveedor.lead_time_dias` (0 a 365) y `proveedor.confiabilidad` (1 a 5), cargados por el dueño; `producto.proveedor_principal_id`.
- `ProductsService.actualizar` con `proveedorPrincipalId`: al cambiar el principal, el costo de reposición pasa al último costo de ese proveedor (RN-08, CP-01.4d). El comparador no necesita un endpoint nuevo para "Usar como principal".
- `elegirProveedor` en `packages/shared/src/ordenes.ts` (HU-07): menor costo, luego plazo, luego confiabilidad. No se toca.
- `oportunidadesCompra` de HU-09 ("comprar más barato"): compara sólo costos. No se toca.
- `PlanGuard` con `@RequierePlan('PREMIUM')`: `planRequerido` ya informa `details.planMinimo`.
- Proveedores y costos son sólo del DUENIO (CP-02.7).
- Lección de `inflation-insights` y del panel: las consultas no pueden depender de las estadísticas del planificador; los agregados van en una sola pasada y el cruce se hace en memoria.

Restricciones: sin tablas nuevas; respuesta del resumen en menos de 3 s con 5.000 productos y 3 proveedores cada uno, con tablas recién cargadas.

## Goals / Non-Goals

**Goals:**
- Que el dueño vea en una pantalla a quién le conviene comprarle cada insumo y cuánto ahorra.
- Un puntaje explicable: tres números y una cuenta que se puede hacer a mano.
- Que una lista importada cambie el resultado sin ningún paso extra.

**Non-Goals:**
- Pesos configurables, cambiar la regla de HU-07, historial de puntajes, precios externos, mobile.

## Decisions

### D1 · RN-13 en `packages/shared/src/comparador.ts`
`PESOS_PUNTAJE = { precio: 0.6, plazo: 0.25, confiabilidad: 0.15 }`, `MIN_PROVEEDORES_COMPARABLES = 2`. Funciones puras con tests:
- `puntuarProveedores(candidatos)`: recibe `{ proveedorId, nombre, costo, leadTimeDias, confiabilidad }[]` y devuelve cada uno con `puntajePrecio`, `puntajePlazo`, `puntajeConfiabilidad`, `puntaje` y `diferenciaPct`, ordenados por puntaje descendente con los desempates de la spec. El plazo usa `(mínimo + 1) ÷ (plazo + 1)` para admitir entrega en el día (plazo 0) sin dividir por cero. Un costo 0 no participa de la comparación.
- `recomendado(puntuados)`, `masBarato(puntuados)`.
- `ahorroEstimado(costoPrincipal, costoRecomendado, unidades30d)`: null si falta algún dato o si no es positivo.
- Esquemas zod: `ProveedorComparadoSchema`, `ComparacionProductoSchema` (`producto`, `proveedores[]`, `recomendado`, `masBarato`, `principal`, `comparable`, `unidades30d`, `ahorroEstimado`), `InsumoComparadoSchema`, `ResumenComparadorSchema` (`items`, `siguienteCursor`, `totales`), `ComparadorQuerySchema` (`soloOportunidades` como `'true' | 'false'`, `q`, `cursor`, `limit`).
Alternativa descartada: normalizar cada componente entre mínimo y máximo; con dos proveedores uno siempre saca 0 y el puntaje exagera diferencias chicas. La razón contra el mejor es proporcional. Queda en **ADR 0017**.

### D2 · Sin tablas: se calcula al leer
Una consulta trae el último costo de cada proveedor activo por producto:
```sql
SELECT DISTINCT ON (pp.proveedor_id, pp.producto_id)
       pp.producto_id, pp.proveedor_id, pp.costo_neto, pp.vigente_desde
FROM precio_proveedor pp
WHERE pp.comercio_id = $1 [AND pp.producto_id = $2]
ORDER BY pp.proveedor_id, pp.producto_id, pp.vigente_desde DESC, pp.creado_en DESC
```
Es una sola pasada sobre una tabla, con orden: el plan no depende de estadísticas. Proveedores activos, productos activos (con su principal) y unidades vendidas en 30 días salen de tres consultas simples más, y el cruce, el puntaje y el orden se hacen en memoria. Alternativa descartada: guardar puntajes y recalcular al importar; habría que invalidarlos también al editar un proveedor, darlo de baja o cambiar un principal.

### D3 · `SupplierComparisonService`
- `producto(id)`: 404 si el producto no es del comercio; arma `ComparacionProducto` con D1. `comparable` = dos o más proveedores.
- `resumen(q)`: calcula todos los insumos comparables, filtra por `q` (código o nombre) y `soloOportunidades`, ordena por ahorro estimado descendente (los nulos al final) y después por nombre, y pagina en memoria con un cursor de posición (`offset` opaco). `totales` se calcula sobre todo lo filtrado, no sobre la página. Paginar en memoria es aceptable: el conjunto completo ya se calculó para poder ordenar por ahorro.

### D4 · Endpoints y permisos

| Método y ruta | Roles | Plan |
| --- | --- | --- |
| `GET /supplier-comparison?soloOportunidades&q&cursor&limit` | DUENIO | PREMIUM |
| `GET /products/:id/supplier-comparison` | DUENIO | PREMIUM |

La segunda vive en `SupplierComparisonController` con `@Controller('products')` y ruta `:id/supplier-comparison`, para no sumar dependencias a `ProductsModule`. "Usar como principal" es el `PATCH /products/:id` existente.

### D5 · Web
- `features/proveedores/ComparadorPage.tsx` (`/proveedores/comparador`, DUENIO): frase con los totales ("Conviene cambiar de proveedor en 4 de 23 insumos: ahorrarías unos $ 86.400 por mes"), filtro, buscador, tabla (tarjetas por debajo de `md`) con recomendado, principal y ahorro; estado vacío cuando ningún insumo tiene dos proveedores, con enlace a importar listas; aviso de plan.
- `features/proveedores/ComparacionProductoPage.tsx` (`/proveedores/comparador/:productoId`): una tarjeta por proveedor con costo, plazo, estrellas, diferencia contra el más barato y barra de puntaje con sus tres componentes (`ui/Barra`), chips "Recomendado", "Más barato" y "Principal"; bloque "Cómo se calcula" con los pesos; "Usar como principal" con `ui/Confirmar`, que avisa que el costo de reposición del producto va a cambiar.
- Accesos: botón "Comparar precios" en `ProveedoresPage` y enlace "Comparar proveedores" en `ProductoFormPage`. Sin enlace nuevo en la barra de navegación.
- `lib/comparador.ts` (hooks; "Usar como principal" invalida productos, comparador, panel y rentabilidad) y `lib/comparador-formato.ts` (textos puros con test).
- La landing ya menciona el comparador en el plan Premium.

### D6 · Tests
Shared `comparador.test.ts`: los números de CP-12.1, CP-12.2, CP-12.2b y CP-12.4, desempates, costo 0, un solo proveedor, ahorro. e2e `supplier-comparison.e2e-spec.ts`: CP-12.1 a CP-12.5c, importación de lista que cambia el resultado, baja de proveedor, "usar como principal" por `PATCH /products/:id`, paginación y búsqueda, y carga sintética de 5.000 productos con 3 proveedores cada uno. Web: test de `comparador-formato`.

### D7 · Documentación
ADR 0017; README; `docs/arquitectura.html` (módulo `supplier-compare` con sus dos rutas y el plan, RN-13); `openspec/config.yaml` (RN-13); `openspec/CAPACIDADES.md`.

## Risks / Trade-offs

- [El comparador recomienda a uno y la sugerencia de órdenes elige a otro] → se documenta: HU-07 elige el más barato y el comparador pondera; si el dueño marca al recomendado como principal, las órdenes sin precios cargados ya lo usan. Unificar las reglas queda como decisión de producto.
- [La confiabilidad es subjetiva] → es la que carga el dueño; el detalle muestra los tres componentes para que se vea cuánto pesa.
- [Costos viejos] → cada proveedor muestra desde cuándo rige su costo.
- [Plan PREMIUM sin gestión de planes] → para la demo hay que cambiar el plan del comercio en la base, con aprobación de Franco.
- [Resumen calculado entero en cada consulta] → una pasada sobre `precio_proveedor`; con 15.000 precios entra en el presupuesto de 3 s y se cubre con la prueba de carga.

## Migration Plan

Sin migración. Deploy de API y web. Rollback: revertir el commit.

## Open Questions

- ¿La sugerencia de órdenes de HU-07 debería usar el puntaje de RN-13? Cambia casos ya aprobados; se decide después de usar el comparador.
