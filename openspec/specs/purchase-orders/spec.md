# purchase-orders Specification

## Purpose
Órdenes de compra en modo copiloto (HU-07, RF-07): el sistema sugiere qué pedir y a quién a partir de las alertas de reposición, redacta el texto del pedido, deja que el dueño lo edite y no envía nada hasta que lo confirma con un clic (RN-06). Disponible desde el plan PRO.

## Requirements

### Requirement: Sugerencia de orden con productos críticos y proveedor más conveniente
El sistema SHALL sugerir al DUENIO órdenes de compra a partir de las alertas de reposición abiertas `ACTIVA` del comercio, tomando por defecto sólo las de severidad `CRITICA` y, si lo pide, también las `PROXIMA`; SHALL agrupar los productos por el proveedor más conveniente, que es el de menor costo neto vigente entre los proveedores activos con precio cargado para ese producto, resolviendo empates por menor lead time y luego por mayor confiabilidad; sin precio cargado SHALL usar el proveedor principal del producto; sin ninguno, el producto SHALL figurar aparte como "sin proveedor" y no integrar ninguna orden. Cada grupo SHALL incluir por producto la cantidad sugerida por la alerta (mínimo 1), el costo unitario neto de ese proveedor (o el costo de reposición del producto, o nulo si no hay ninguno) y el subtotal, más el total neto estimado y el lead time del proveedor. La sugerencia SHALL ser de sólo lectura: no crea órdenes ni envía nada (HU-07 criterio 1, RN-04, RN-06).

#### Scenario: CP-07.1 Sugerencia agrupada por proveedor más barato
- **GIVEN** un comercio PRO con alertas `ACTIVA` `CRITICA` para `FA-220` (cantidad sugerida 64) y `AM-1L` (cantidad sugerida 34), el proveedor "Norte" (lead time 5) con `FA-220` a 2340 y `AM-1L` a 900, y el proveedor "Sur" (lead time 7) con `FA-220` a 2000
- **WHEN** el DUENIO consulta `GET /api/v1/purchase-orders/suggest`
- **THEN** obtiene dos grupos: "Sur" con `FA-220` × 64 a `"2000.00"` (subtotal `"128000.00"`) y "Norte" con `AM-1L` × 34 a `"900.00"` (subtotal `"30600.00"`), cada uno con `totalNeto`, `leadTimeDias` y `motivoEleccion: "MENOR_COSTO"`; ninguna orden queda creada

#### Scenario: CP-07.1b Empate por costo y sin precio cargado
- **GIVEN** un producto en alerta crítica con el mismo costo en "Norte" (lead time 5, confiabilidad 3) y "Sur" (lead time 5, confiabilidad 5), y otro producto en alerta crítica sin precios cargados pero con proveedor principal "Este"
- **WHEN** el DUENIO consulta la sugerencia
- **THEN** el primero se asigna a "Sur" (`motivoEleccion: "MAYOR_CONFIABILIDAD"`) y el segundo a "Este" con `motivoEleccion: "PROVEEDOR_PRINCIPAL"` y `costoUnitarioNeto` igual al costo de reposición del producto

#### Scenario: CP-07.1c Producto sin proveedor y alertas que no se sugieren
- **GIVEN** un producto en alerta crítica sin precios ni proveedor principal, un producto con alerta `PROXIMA`, uno con alerta `POSPUESTA` y uno con alerta `ATENDIDA`
- **WHEN** el DUENIO consulta `GET /api/v1/purchase-orders/suggest` y luego `?severidad=TODAS`
- **THEN** la primera respuesta lista al producto sin proveedor en `sinProveedor` y ningún grupo incluye a los otros tres; la segunda suma el producto `PROXIMA` al grupo de su proveedor y sigue excluyendo los pospuestos y atendidos

### Requirement: Borrador de orden editable
El sistema SHALL permitir al DUENIO crear una orden en estado `BORRADOR` para un proveedor activo con uno o más ítems (producto activo del comercio, cantidad entera mayor a cero, alerta de origen opcional), asignándole un número correlativo único por comercio con formato `OC-0001`, y SHALL guardar por ítem el costo unitario neto vigente de ese proveedor al momento de crearla (o el costo de reposición del producto, o nulo). Mientras esté en `BORRADOR`, el DUENIO SHALL poder cambiar el proveedor, agregar, quitar o modificar ítems y cantidades, y editar notas; el total neto SHALL recalcularse. Una orden `CONFIRMADA`, `ENVIADA` o `CANCELADA` SHALL rechazar modificaciones (HU-07 criterio 4).

#### Scenario: CP-07.2 Crear y editar un borrador
- **GIVEN** la sugerencia de CP-07.1
- **WHEN** el DUENIO envía `POST /api/v1/purchase-orders` con el proveedor "Sur" y el ítem `FA-220` × 64, y luego `PATCH /api/v1/purchase-orders/:id` con cantidad 70 y un ítem nuevo `AM-1L` × 10
- **THEN** la primera responde 201 con `numero: "OC-0001"`, `estado: "BORRADOR"`, el ítem con `costoUnitarioNeto: "2000.00"` y `totalNeto: "128000.00"`; la segunda responde 200 con dos ítems, `AM-1L` con el costo de reposición del producto (`"900.00"`, la última lista de su proveedor principal "Norte", porque "Sur" no tiene precio cargado) y `totalNeto: "149000.00"`

#### Scenario: CP-07.2b Numeración por comercio
- **GIVEN** dos comercios PRO
- **WHEN** cada uno crea su primera orden y el primero crea una segunda
- **THEN** el primero obtiene `OC-0001` y `OC-0002`, y el segundo `OC-0001`

#### Scenario: CP-07.2c Datos inválidos
- **WHEN** el DUENIO crea una orden sin ítems, con cantidad 0, con un producto inactivo o de otro comercio, o con un proveedor dado de baja
- **THEN** la API responde 400 `VALIDACION` con `details` por campo (producto o proveedor ajeno: 404 `NO_ENCONTRADO`)

#### Scenario: CP-07.2d Orden cerrada no se edita
- **GIVEN** una orden `CONFIRMADA`
- **WHEN** el DUENIO envía `PATCH` con otra cantidad o intenta cancelarla
- **THEN** la API responde 409 `CONFLICTO` y la orden no cambia

### Requirement: Redacción automática del texto de la orden
El sistema SHALL redactar automáticamente, al crear la orden y cada vez que cambian sus ítems, cantidades o proveedor, un asunto y un cuerpo en español dirigidos al proveedor con: saludo con el nombre del proveedor (y contacto si existe), la lista de productos con código, nombre, cantidad y costo unitario neto (o "a confirmar"), el total neto estimado, el plazo de entrega esperado según el lead time del proveedor, y la firma con el nombre del comercio y el nombre y correo del dueño. El DUENIO SHALL poder reemplazar el texto por uno propio; a partir de entonces el sistema SHALL conservar el texto editado aunque cambien los ítems, y SHALL permitir volver al texto generado (HU-07 criterio 2).

#### Scenario: CP-07.3 Texto generado con los datos de la orden
- **GIVEN** la orden `OC-0001` de CP-07.2 para "Sur" (lead time 7, contacto "Marta")
- **WHEN** el DUENIO la consulta con `GET /api/v1/purchase-orders/:id`
- **THEN** `asunto` contiene "Orden de compra OC-0001" y el nombre del comercio, y `texto` contiene "Marta", "FA-220", "70 unidades", "2.000,00", "149.000,00", "7 días" y el nombre del comercio; `textoEditado` es `false`

#### Scenario: CP-07.3b Texto editado a mano se conserva
- **GIVEN** la misma orden
- **WHEN** el DUENIO envía `PATCH` con `texto: "Hola Marta, necesito 70 filtros FA-220 para el lunes."`, luego cambia la cantidad a 75, y después envía `PATCH` con `regenerarTexto: true`
- **THEN** tras el segundo cambio el texto sigue siendo el suyo (`textoEditado: true`); tras el tercero vuelve al generado con "75 unidades" y `textoEditado: false`

### Requirement: Confirmación explícita y envío
El sistema SHALL mantener toda orden en `BORRADOR` hasta que el DUENIO ejecute la confirmación explícita; ni la sugerencia ni el borrador SHALL enviar nada al proveedor ni exponer un enlace de envío (RN-06). Al confirmar, el sistema SHALL registrar quién y cuándo, pasar las alertas abiertas de los productos de la orden a `ATENDIDA` con referencia a la orden y resolver el canal: el que el DUENIO indique en la confirmación o, si no indica ninguno, el que corresponde al proveedor. Con canal `EMAIL`, SHALL enviar el asunto y el texto de la orden por correo con el correo del dueño como dirección de respuesta y dejar la orden `ENVIADA` con `canal: "EMAIL"`; si el proveedor de correo rechaza el envío, la orden SHALL quedar `CONFIRMADA` con `motivoNoEnvio: "ENVIO_FALLIDO"`. Con canal `WHATSAPP`, SHALL dejar la orden `CONFIRMADA` con `canal: "WHATSAPP"`, sin `motivoNoEnvio`, sin enviar ningún correo y con `whatsappUrl`, un enlace `https://wa.me/<número>?text=<mensaje>` con el asunto y el texto de la orden. Sin ningún canal disponible, la orden SHALL quedar `CONFIRMADA` con `motivoNoEnvio: "SIN_EMAIL"` y el texto disponible para enviarlo por otro medio. Indicar un canal para el que al proveedor le faltan datos SHALL rechazarse sin confirmar la orden. La confirmación SHALL ser idempotente en el sentido de que una orden ya confirmada no se reenvía (HU-07 criterio 3; HU-16).

#### Scenario: CP-07.4 Confirmar envía el correo y atiende las alertas
- **GIVEN** la orden `OC-0001` en `BORRADOR` para "Sur" con email `compras@sur.com`, y la alerta `ACTIVA` de `FA-220`
- **WHEN** el DUENIO envía `POST /api/v1/purchase-orders/:id/confirm`
- **THEN** la respuesta es 200 con `estado: "ENVIADA"`, `canal: "EMAIL"`, `confirmadaEn`, `confirmadaPor` y `enviadaEn`; se envió un solo correo a `compras@sur.com` con el asunto y el texto de la orden y respuesta al correo del dueño; la alerta de `FA-220` queda `ATENDIDA` con `ordenCompraId` igual a la orden

#### Scenario: CP-07.4b Proveedor sin email
- **GIVEN** un borrador para un proveedor sin email ni teléfono
- **WHEN** el DUENIO lo confirma
- **THEN** la orden queda `CONFIRMADA` con `motivoNoEnvio: "SIN_EMAIL"`, `canal` y `enviadaEn` nulos, no se envía ningún correo y las alertas igual pasan a `ATENDIDA`

#### Scenario: CP-07.4c Envío rechazado por el proveedor de correo
- **GIVEN** un borrador para un proveedor con email y un proveedor de correo que rechaza el envío
- **WHEN** el DUENIO lo confirma
- **THEN** la orden queda `CONFIRMADA` con `motivoNoEnvio: "ENVIO_FALLIDO"` y la respuesta no falla

#### Scenario: CP-07.4d Nada sale sin confirmar y no se reenvía
- **GIVEN** una sugerencia consultada, un borrador creado y editado, y una orden ya `ENVIADA`
- **WHEN** se revisan los correos enviados y el DUENIO vuelve a confirmar la orden enviada
- **THEN** sólo existe el correo de la confirmación original y la segunda confirmación responde 409 `CONFLICTO`

#### Scenario: CP-16.2 Confirmar por WhatsApp
- **GIVEN** la orden `OC-0002` en `BORRADOR` para "Este", sin email y con teléfono `011 15-2345-6789`, y la alerta `ACTIVA` de uno de sus productos
- **WHEN** el DUENIO consulta el borrador y luego envía `POST /api/v1/purchase-orders/:id/confirm`
- **THEN** el borrador tiene `whatsappUrl: null`; la confirmación responde 200 con `estado: "CONFIRMADA"`, `canal: "WHATSAPP"`, `motivoNoEnvio: null`, `enviadaEn: null` y `whatsappUrl` que empieza con `https://wa.me/5491123456789?text=` y cuyo mensaje decodificado contiene "OC-0002", el nombre del comercio y el texto de la orden; no se envía ningún correo y la alerta queda `ATENDIDA`

#### Scenario: CP-16.2b El dueño elige el canal al confirmar
- **GIVEN** un borrador para "Norte", con email y teléfono válido, cuyo canal es `EMAIL`
- **WHEN** el DUENIO envía `POST /api/v1/purchase-orders/:id/confirm` con `{ "canal": "WHATSAPP" }`
- **THEN** la orden queda `CONFIRMADA` con `canal: "WHATSAPP"` y `whatsappUrl`, y no se envía ningún correo

#### Scenario: CP-16.2c Canal sin datos
- **GIVEN** un borrador para un proveedor con email y sin teléfono válido
- **WHEN** el DUENIO confirma con `{ "canal": "WHATSAPP" }`
- **THEN** la API responde 400 `VALIDACION` con `details.canal`, la orden sigue en `BORRADOR` y las alertas no cambian

### Requirement: Listado, detalle y cancelación
El sistema SHALL listar las órdenes del comercio paginadas por cursor, de la más reciente a la más antigua, con filtro por estado (`BORRADOR`, `CONFIRMADA`, `ENVIADA`, `CANCELADA` o todas), mostrando número, proveedor, estado, cantidad de ítems, total neto y fechas; SHALL exponer el detalle con ítems (producto, alerta de origen, cantidad, costo, subtotal), asunto, texto y datos de confirmación y envío; y SHALL permitir al DUENIO cancelar un `BORRADOR`, que pasa a `CANCELADA` y se conserva.

#### Scenario: CP-07.5 Listado y detalle
- **GIVEN** un comercio con una orden `ENVIADA`, una `CONFIRMADA` y dos `BORRADOR`
- **WHEN** el DUENIO consulta `GET /api/v1/purchase-orders`, luego `?estado=BORRADOR` y el detalle de la enviada
- **THEN** obtiene 4 órdenes ordenadas por fecha descendente, luego las 2 en borrador, y el detalle con sus ítems, `asunto`, `texto`, `confirmadaPor`, `confirmadaEn` y `enviadaEn`

#### Scenario: CP-07.5b Cancelar un borrador
- **GIVEN** una orden `BORRADOR`
- **WHEN** el DUENIO envía `POST /api/v1/purchase-orders/:id/cancel`
- **THEN** la orden queda `CANCELADA` con `canceladaEn`, sigue apareciendo en el listado con ese estado y las alertas de sus productos no cambian

### Requirement: Plan, permisos y aislamiento de órdenes
Las órdenes de compra SHALL requerir plan PRO o superior (RF-15): en plan FREE todas las rutas responden 402 `PLAN_REQUERIDO`. El DUENIO SHALL sugerir, crear, editar, confirmar y cancelar; el CONTADOR SHALL sólo consultar sugerencia, listado y detalle; el EMPLEADO SHALL recibir 403 `SIN_PERMISO` en todas (CP-11.4). Un comercio SHALL ver y operar únicamente sus órdenes (RNF-10).

#### Scenario: CP-07.6 Plan FREE
- **GIVEN** un comercio en plan FREE
- **WHEN** el DUENIO consulta la sugerencia o el listado
- **THEN** la API responde 402 `PLAN_REQUERIDO`

#### Scenario: CP-07.6b Roles
- **GIVEN** un comercio PRO con un borrador
- **WHEN** el CONTADOR consulta el listado y luego intenta confirmarlo, y el EMPLEADO consulta el listado
- **THEN** el CONTADOR obtiene 200 y luego 403 `SIN_PERMISO`; el EMPLEADO obtiene 403 `SIN_PERMISO`

#### Scenario: CP-07.6c Aislamiento
- **GIVEN** dos comercios PRO con órdenes
- **WHEN** el dueño de uno lista sus órdenes, consulta, edita o confirma una orden del otro, o crea una orden con un proveedor del otro
- **THEN** sólo ve las propias y las operaciones sobre datos ajenos responden 404 `NO_ENCONTRADO`

### Requirement: Marcar la orden como enviada
El sistema SHALL permitir al DUENIO marcar como enviada una orden `CONFIRMADA`, que pasa a `ENVIADA` con `enviadaEn`, limpia `motivoNoEnvio` y registra el canal y el destinatario: `WHATSAPP` y el teléfono del proveedor si la orden se confirmó por WhatsApp; `OTRO` y sin destinatario en los demás casos. Una orden que no está `CONFIRMADA` SHALL no poder marcarse. El detalle de una orden confirmada por WhatsApp SHALL seguir exponiendo `whatsappUrl` mientras esté `CONFIRMADA`, para volver a abrirlo (HU-16).

#### Scenario: CP-16.3 Marcar enviada por WhatsApp
- **GIVEN** la orden `OC-0002` de CP-16.2, `CONFIRMADA` con `canal: "WHATSAPP"`
- **WHEN** el DUENIO consulta el detalle y luego envía `POST /api/v1/purchase-orders/:id/mark-sent`
- **THEN** el detalle trae el mismo `whatsappUrl`; la respuesta del marcado es 200 con `estado: "ENVIADA"`, `canal: "WHATSAPP"`, `enviadaEn`, `enviadaA: "011 15-2345-6789"` y `whatsappUrl: null`

#### Scenario: CP-16.3b Marcar enviada por otro medio
- **GIVEN** una orden `CONFIRMADA` con `motivoNoEnvio: "SIN_EMAIL"`
- **WHEN** el DUENIO envía `POST /api/v1/purchase-orders/:id/mark-sent`
- **THEN** la orden queda `ENVIADA` con `canal: "OTRO"`, `motivoNoEnvio: null` y `enviadaA: null`

#### Scenario: CP-16.3c Sólo las confirmadas
- **GIVEN** una orden `BORRADOR`, una `ENVIADA` y una `CANCELADA`
- **WHEN** el DUENIO intenta marcar cada una como enviada
- **THEN** la API responde 409 `CONFLICTO` en las tres y ninguna cambia

#### Scenario: CP-16.3d Permisos y aislamiento
- **GIVEN** un comercio PRO con una orden `CONFIRMADA` y otro comercio PRO
- **WHEN** el CONTADOR y el EMPLEADO intentan marcarla, y el dueño del otro comercio también
- **THEN** el CONTADOR y el EMPLEADO obtienen 403 `SIN_PERMISO`, el dueño ajeno 404 `NO_ENCONTRADO`, y la orden sigue `CONFIRMADA`

### Requirement: Mensaje de WhatsApp de la orden
El sistema SHALL armar el mensaje de WhatsApp con el asunto de la orden en la primera línea y el texto de la orden debajo, tal como el DUENIO lo dejó (generado o editado). Si el mensaje supera los 3.000 caracteres, SHALL recortarse en un salto de línea y terminar con una nota que indica que el detalle completo se envía aparte, de modo que el enlace siempre se pueda abrir (HU-16).

#### Scenario: CP-16.4 Mensaje con el texto editado
- **GIVEN** un borrador cuyo texto el DUENIO reemplazó por "Hola Marta, necesito 70 filtros FA-220 para el lunes."
- **WHEN** lo confirma por WhatsApp
- **THEN** el mensaje decodificado de `whatsappUrl` tiene el asunto en la primera línea y ese texto debajo, sin el texto generado

#### Scenario: CP-16.4b Mensaje largo
- **GIVEN** una orden con 150 productos cuyo texto supera los 3.000 caracteres
- **WHEN** el DUENIO la confirma por WhatsApp
- **THEN** el mensaje decodificado tiene 3.000 caracteres o menos, termina con la nota de detalle aparte y no corta ninguna línea por la mitad

### Requirement: Envío por WhatsApp en la web
La web SHALL mostrar en el formulario del proveedor el canal preferido y, debajo del teléfono, el número de WhatsApp tal como quedará o el aviso de que falta el código de área. En la orden en `BORRADOR`, el botón de confirmar SHALL decir por qué canal sale y el DUENIO SHALL poder cambiarlo cuando el proveedor tiene los dos. En una orden `CONFIRMADA` por WhatsApp, la web SHALL mostrar "Abrir WhatsApp", que abre el enlace en otra pestaña, y "Ya la envié", que la marca como enviada; en una `CONFIRMADA` sin canal, SHALL mostrar "Copiar texto" y "Ya la envié".

#### Scenario: CP-16.5 Confirmar y enviar desde la web
- **GIVEN** un borrador para un proveedor cuyo canal es WhatsApp
- **WHEN** el DUENIO abre la orden, toca "Confirmar y enviar por WhatsApp" (un clic, sin diálogo intermedio), luego "Abrir WhatsApp" y después "Ya la envié"
- **THEN** antes de confirmar no hay ningún enlace de WhatsApp; tras confirmar se abre WhatsApp en otra pestaña con el mensaje redactado; y al final la orden figura como enviada por WhatsApp al teléfono del proveedor, con fecha

#### Scenario: CP-16.5b Proveedor con teléfono sin código de área
- **GIVEN** el formulario de un proveedor
- **WHEN** el DUENIO escribe el teléfono `4567-8901` y elige WhatsApp como canal preferido
- **THEN** ve el aviso de que falta el código de área y, al guardar, el error en el canal preferido
