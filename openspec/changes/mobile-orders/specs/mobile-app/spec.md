## ADDED Requirements

### Requirement: Órdenes de compra en el celular

La app SHALL mostrar al DUENIO y al CONTADOR de un comercio PRO o PREMIUM las órdenes de compra del comercio (HU-07, HU-16), con el listado filtrable por estado y el detalle: proveedor, líneas, total neto sin IVA y texto del mensaje. Sólo el DUENIO SHALL poder editar un borrador (cambiar cantidades y quitar líneas), cancelarlo y confirmarlo eligiendo el canal (RN-06). En una orden confirmada por WhatsApp SHALL poder abrir WhatsApp con el mensaje ya escrito y después marcarla como enviada. Cualquier rol con acceso SHALL poder copiar el texto de una orden que no es borrador. La app no SHALL enviar nada sin la confirmación explícita del dueño. En plan FREE SHALL explicar que las órdenes son del plan PRO sin consultar la API.

#### Scenario: CP-M.13 Listado por estado (CP-07.5)
- **GIVEN** un comercio PRO con una orden en borrador y otra enviada
- **WHEN** el dueño abre "Órdenes de compra" y elige "Borradores"
- **THEN** ve sólo la orden en borrador con su número, proveedor, cantidad de ítems, total neto y fecha

#### Scenario: CP-M.13b Detalle de una orden
- **WHEN** el dueño toca una orden
- **THEN** ve la frase de su estado, el proveedor, cada línea con cantidad, costo neto ("a confirmar" si falta) y subtotal, el total neto estimado sin IVA y el texto del mensaje

#### Scenario: CP-M.13c Editar el borrador (CP-07.2)
- **GIVEN** un borrador con dos líneas
- **WHEN** el dueño cambia una cantidad, quita la otra línea y toca "Guardar"
- **THEN** la app guarda la lista de líneas que quedó, avisa "Borrador guardado." y muestra los costos y el total que devolvió la API

#### Scenario: CP-M.13d Confirmar y enviar por WhatsApp (CP-16.2, CP-16.5)
- **GIVEN** un borrador para un proveedor con WhatsApp
- **WHEN** el dueño toca "Confirmar y enviar por WhatsApp"
- **THEN** la orden queda confirmada sin enviar nada todavía, aparece "Abrir WhatsApp", y al tocarlo se abre WhatsApp con el mensaje escrito para ese número

#### Scenario: CP-M.13e Ya la envié (CP-16.3)
- **GIVEN** la orden confirmada por WhatsApp
- **WHEN** el dueño toca "Ya la envié"
- **THEN** la orden pasa a enviada y la frase dice "Enviada por WhatsApp a {teléfono} el {fecha}."

#### Scenario: CP-M.13f Elegir el canal (CP-16.2b)
- **GIVEN** un proveedor con correo y WhatsApp
- **WHEN** el dueño elige "Correo" en "Enviar por" y confirma
- **THEN** la confirmación pide el canal correo y el botón decía "Confirmar y enviar por correo"

#### Scenario: CP-M.13g Proveedor sin canal (CP-07.4b)
- **GIVEN** un proveedor sin correo ni WhatsApp
- **WHEN** el dueño confirma la orden
- **THEN** la app avisa que la orden queda lista para copiar el texto y enviarla por otro medio, y ofrece "Copiar texto" y "Ya la envié"

#### Scenario: CP-M.13h Cancelar el borrador (CP-07.5b)
- **WHEN** el dueño toca "Cancelar borrador" y acepta la confirmación
- **THEN** la orden queda cancelada y vuelve al listado

#### Scenario: CP-M.13i El contador sólo consulta (CP-07.6b)
- **GIVEN** un CONTADOR de un comercio PRO
- **WHEN** abre una orden en borrador y otra confirmada
- **THEN** ve las dos sin botones de edición, confirmación, cancelación ni "Ya la envié", y en la confirmada puede copiar el texto

#### Scenario: CP-M.13j Orden que ya no es borrador (CP-07.2d)
- **GIVEN** un borrador que otra persona confirmó desde la web
- **WHEN** el dueño toca "Guardar" o "Confirmar" en el celular
- **THEN** ve el mensaje de la API ("Sólo se puede modificar una orden en borrador.") y la orden se recarga con su estado real

#### Scenario: CP-M.13k Plan FREE (CP-07.6)
- **GIVEN** un comercio en plan FREE
- **WHEN** el dueño abre "Órdenes de compra"
- **THEN** ve que las órdenes son del plan PRO, junto con las alertas que las alimentan, y la app no consulta las órdenes

#### Scenario: CP-M.13l Aislamiento (CP-07.6c)
- **GIVEN** dos comercios PRO con sus órdenes
- **WHEN** cada dueño abre "Órdenes de compra"
- **THEN** ve sólo las órdenes de su comercio, porque los pedidos se hacen con su identidad y sin parámetros de comercio

## MODIFIED Requirements

### Requirement: Pestaña Más

La barra inferior SHALL terminar en una pestaña "Más" para todos los roles. La pestaña SHALL mostrar la cuenta (comercio, email, rol y plan), la elección de tema y "Cerrar sesión", y SHALL aclarar qué tareas se hacen desde la web. Las pestañas de negocio SHALL seguir dependiendo del rol, como hasta ahora (CP-M.2e, CP-M.3d, CP-M.4g). Para el DUENIO y el CONTADOR, "Más" SHALL mostrar además una sección "Análisis" con "Alertas de reposición" en cualquier plan, y con "Falta de stock" y "Stock parado" desde el plan PRO. El EMPLEADO no SHALL ver esa sección. Sólo para el DUENIO, "Más" SHALL mostrar también una sección "Asistente" con "Asistente con IA" en cualquier plan; el CONTADOR y el EMPLEADO no SHALL verla. Para el DUENIO y el CONTADOR, "Más" SHALL mostrar una sección "Compras" con "Órdenes de compra" en cualquier plan; el EMPLEADO no SHALL verla.

#### Scenario: CP-M.8 Pestañas del dueño
- **GIVEN** un usuario DUENIO
- **WHEN** entra a la app
- **THEN** la barra inferior muestra Inicio, Inventario, Movimiento y Más, en ese orden

#### Scenario: CP-M.8b Pestañas del empleado y del contador
- **GIVEN** un usuario EMPLEADO y otro CONTADOR
- **WHEN** cada uno entra a la app
- **THEN** el empleado ve Inventario, Movimiento y Más; el contador ve Inicio y Más, sin inventario ni movimientos

#### Scenario: CP-M.8c La cuenta en "Más"
- **GIVEN** la dueña de "Repuestos Carlos" con plan PRO
- **WHEN** toca "Más"
- **THEN** ve el nombre del comercio, su email, "Dueño" y "Pro"

#### Scenario: CP-M.8d Lo que se hace desde la web
- **WHEN** un usuario abre "Más"
- **THEN** ve que importar planillas, proveedores y listas de precios, gastos, remarcación, usuarios y planes se manejan desde la web, con la dirección de la web

#### Scenario: CP-M.8e La cuenta es la de quien inició sesión
- **GIVEN** dos comercios distintos con sus usuarios
- **WHEN** cada usuario abre "Más"
- **THEN** ve sólo su comercio, su email, su rol y su plan, tomados de su propia identidad (CP-11.5)

#### Scenario: CP-M.8f Sección "Análisis" por rol y plan (CP-11.4)
- **GIVEN** un DUENIO y un CONTADOR de un comercio PRO, un DUENIO de un comercio FREE y un EMPLEADO
- **WHEN** cada uno abre "Más"
- **THEN** el dueño y el contador PRO ven "Alertas de reposición", "Falta de stock" y "Stock parado"; el dueño FREE ve sólo "Alertas de reposición"; el empleado no ve la sección "Análisis" y, si llega a una de esas pantallas, la app lo devuelve a su inicio

#### Scenario: CP-M.8g Sección "Asistente" sólo para el dueño (CP-08.5b)
- **GIVEN** un DUENIO de un comercio PRO, un CONTADOR y un EMPLEADO de un comercio PREMIUM
- **WHEN** cada uno abre "Más"
- **THEN** el dueño ve "Asistente con IA"; el contador y el empleado no lo ven y, si llegan a la pantalla del asistente, la app los devuelve a su inicio

#### Scenario: CP-M.8h Sección "Compras" (CP-07.6b)
- **GIVEN** un DUENIO de un comercio FREE, un CONTADOR de un comercio PRO y un EMPLEADO
- **WHEN** cada uno abre "Más"
- **THEN** el dueño y el contador ven "Órdenes de compra"; el empleado no la ve y, si llega a la pantalla de órdenes, la app lo devuelve a su inicio

### Requirement: Asistente con IA en el celular

La app SHALL permitir al DUENIO de un comercio PREMIUM hacerle consultas al asistente (HU-08, RN-09) con las mismas respuestas, fuentes y acciones que la web. La app SHALL mostrar las consultas que hizo el asistente ("Consulté: …"), los borradores de orden que preparó y un aviso permanente de que las respuestas las genera una inteligencia artificial. La app SHALL listar las conversaciones anteriores del dueño, de la más reciente a la más antigua, y permitir abrirlas, continuarlas y empezar una nueva. No SHALL enviar una consulta vacía ni de más de 1000 caracteres. Ante un error, la consulta escrita SHALL quedar en el campo. Con plan FREE o PRO, la app SHALL explicar que el asistente es del plan PREMIUM sin consultar la API.

#### Scenario: CP-M.12 Pregunta sugerida con su respuesta (CP-08.6)
- **GIVEN** un dueño PREMIUM sin conversaciones
- **WHEN** abre "Asistente con IA" y toca "¿Qué productos tengo que reponer?"
- **THEN** ve su pregunta, "Consultando tus datos…" mientras espera y después la respuesta con "Consulté: Alertas de reposición."

#### Scenario: CP-M.12b Respuesta con párrafos y listas
- **GIVEN** una respuesta del asistente con un párrafo, una lista con guiones y texto entre `**`
- **WHEN** se muestra en el chat
- **THEN** se ve el párrafo, la lista como viñetas y el texto sin los asteriscos

#### Scenario: CP-M.12c Seguir la conversación (CP-08.1c)
- **GIVEN** el dueño con una respuesta en pantalla
- **WHEN** escribe "¿y el segundo?" y la envía
- **THEN** la consulta va dentro de la misma conversación y la respuesta aparece debajo de la anterior

#### Scenario: CP-M.12d Largo de la consulta (CP-08.1b)
- **WHEN** el dueño escribe 1001 caracteres
- **THEN** el contador marca "1.001 / 1.000" en rojo y no puede enviarla; con el campo vacío tampoco

#### Scenario: CP-M.12e Orden en borrador (CP-08.3)
- **GIVEN** el dueño pide "armame un pedido para Distribuidora Norte"
- **WHEN** el asistente prepara la orden OC-0007
- **THEN** el mensaje muestra "Orden OC-0007 para Distribuidora Norte", aclara que es un borrador que todavía no se envió y, al tocarla, se abre el detalle de esa orden para revisarla y confirmarla

#### Scenario: CP-M.12f Historial (CP-08.1d)
- **GIVEN** un dueño con dos conversaciones, una de hoy y una de ayer
- **WHEN** abre "Conversaciones"
- **THEN** ve primero la de hoy con "hoy" y su hora, después la de ayer con "ayer", y al tocar una ve sus mensajes en orden con sus fuentes y puede seguirla

#### Scenario: CP-M.12g Nueva conversación
- **GIVEN** el dueño dentro de una conversación anterior
- **WHEN** toca "Nueva conversación" y envía una consulta
- **THEN** la consulta va sin conversación previa y arranca una nueva

#### Scenario: CP-M.12h Límite diario (CP-08.5c)
- **GIVEN** un comercio que ya hizo las consultas del día
- **WHEN** el dueño envía otra
- **THEN** ve el mensaje de la API que dice que se renueva mañana, y su consulta sigue escrita en el campo

#### Scenario: CP-M.12i Asistente no disponible (CP-08.5d)
- **GIVEN** el proveedor de IA caído
- **WHEN** el dueño envía una consulta
- **THEN** ve "El asistente no está disponible en este momento. Tu consulta quedó escrita: probá de nuevo en unos minutos." y la consulta sigue en el campo

#### Scenario: CP-M.12j Plan sin asistente (CP-08.6b, CP-08.5)
- **GIVEN** un dueño de un comercio PRO
- **WHEN** abre "Asistente con IA"
- **THEN** ve que es del plan PREMIUM y que el plan se cambia desde la web, no puede escribir y la app no consulta conversaciones ni mensajes

#### Scenario: CP-M.12k Aislamiento (CP-08.5e)
- **GIVEN** dos dueños PREMIUM de comercios distintos
- **WHEN** cada uno abre "Conversaciones"
- **THEN** ve sólo las suyas, porque los pedidos se hacen con su identidad y sin parámetros de comercio ni de usuario
