## MODIFIED Requirements

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

## ADDED Requirements

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
