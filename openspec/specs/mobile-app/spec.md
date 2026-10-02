# mobile-app Specification

## Purpose
La app Android es la herramienta de mostrador de InventarioSmart: con la misma cuenta que la web, quien atiende puede registrar una venta, consultar el stock y, si es dueño o contador, ver el panel resumido del mes. Esta capacidad describe lo que la app muestra y hace; las reglas de negocio y los permisos son los que ya definen `auth-tenancy`, `user-roles`, `financial-dashboard`, `product-catalog` y `stock-movements`.

## Requirements

### Requirement: Acceso desde el celular con la misma identidad que la web

La app SHALL permitir iniciar sesión con email y contraseña y con Google sobre la misma cuenta que la web (HU-11, RN-10), crear una cuenta con email, conservar la sesión entre aperturas, cerrar sesión desde la pestaña "Más", completar el nombre del comercio cuando el onboarding está pendiente y volver al login cuando la sesión deja de ser válida.

#### Scenario: CP-M.1 Login con email y contraseña (CP-11.1b)
- **GIVEN** una usuaria registrada con email y contraseña
- **WHEN** ingresa sus datos en la pantalla de acceso
- **THEN** la app muestra su inicio con el nombre del comercio y su rol

#### Scenario: CP-M.1b Login con Google (CP-11.1)
- **GIVEN** un dueño que ya entra a la web con su cuenta de Google
- **WHEN** toca "Continuar con Google" y elige esa cuenta
- **THEN** entra al mismo comercio que en la web, sin crear otro

#### Scenario: CP-M.1c Google sin configurar en Android
- **GIVEN** la app instalada sin la huella de la aplicación registrada en Firebase
- **WHEN** toca "Continuar con Google"
- **THEN** ve un mensaje que explica que Google no está disponible en esta instalación y que puede entrar con email y contraseña

#### Scenario: CP-M.1d Credenciales inválidas
- **WHEN** ingresa un email o una contraseña incorrectos
- **THEN** ve "El email o la contraseña no son correctos." y sigue en la pantalla de acceso

#### Scenario: CP-M.1e Crear cuenta con email
- **GIVEN** una persona sin cuenta
- **WHEN** elige "Crear cuenta", ingresa nombre, email y una contraseña de al menos 8 caracteres
- **THEN** queda autenticada y, como es su primer ingreso, la app le pide el nombre del comercio (CP-11.2)

#### Scenario: CP-M.1f Sesión persistente
- **GIVEN** una usuaria que inició sesión
- **WHEN** cierra la app y la vuelve a abrir
- **THEN** entra directo a su inicio, sin volver a ingresar sus datos

#### Scenario: CP-M.1g Onboarding pendiente (CP-11.2c)
- **GIVEN** un dueño cuyo comercio todavía no tiene nombre
- **WHEN** entra a la app
- **THEN** ve una única pantalla que le pide el nombre del comercio, y al guardarlo pasa al inicio; el resto de las pantallas no se muestra hasta completar ese paso

#### Scenario: CP-M.1h Cerrar sesión
- **GIVEN** una usuaria con sesión abierta, con cualquier rol
- **WHEN** entra a la pestaña "Más" y toca "Cerrar sesión"
- **THEN** vuelve a la pantalla de acceso y al reabrir la app no hay sesión

#### Scenario: CP-M.1i Sesión inválida o usuario dado de baja (CP-11.6)
- **GIVEN** una usuaria con sesión abierta cuyo acceso fue dado de baja por el dueño
- **WHEN** la app consulta la API y recibe una respuesta de no autenticado o sin permiso
- **THEN** la app cierra la sesión local y vuelve al login con un mensaje que explica que su acceso no está vigente

### Requirement: Panel resumido del mes

La app SHALL mostrar al DUENIO y al CONTADOR un panel del mes con cuatro indicadores (unidades en stock con su valorización, ventas netas con la variación contra el mes anterior, margen bruto con porcentaje, margen neto o su motivo), los tres productos más rentables y las alertas activas, con los mismos números que la web (HU-04, RN-01, RN-02), y permitir cambiar de mes.

#### Scenario: CP-M.2 Panel con datos del mes (CP-04.1)
- **GIVEN** un comercio con ventas y gastos cargados en el mes
- **WHEN** el dueño abre el inicio
- **THEN** ve unidades en stock y valorización, ventas netas del mes con el porcentaje de variación contra el mes anterior, margen bruto en pesos y porcentaje, margen neto en pesos y porcentaje, los tres productos con mayor margen generado y la cantidad de productos sin stock y con stock bajo

#### Scenario: CP-M.2b Sin gastos cargados (CP-04.4)
- **GIVEN** un comercio con ventas y sin gastos en el mes
- **WHEN** abre el inicio
- **THEN** el margen neto dice "No calculable" con la explicación "Cargá tus gastos del mes desde la web" y el aviso de gastos faltantes aparece entre las alertas

#### Scenario: CP-M.2c Cambio de mes
- **WHEN** toca la flecha hacia el mes anterior
- **THEN** el panel muestra los números de ese mes y el título indica el mes elegido

#### Scenario: CP-M.2d Actualización tras un movimiento (CP-04.2)
- **GIVEN** el panel del mes actual visible
- **WHEN** registra una venta desde la app y vuelve al inicio
- **THEN** las unidades vendidas y las ventas netas incluyen esa venta sin acción manual

#### Scenario: CP-M.2e El empleado no tiene panel (CP-11.4)
- **GIVEN** un usuario con rol EMPLEADO
- **WHEN** entra a la app
- **THEN** su inicio es el inventario y no existe la pestaña del panel

### Requirement: Inventario de mostrador

La app SHALL mostrar al DUENIO y al EMPLEADO el catálogo activo con búsqueda, filtro por estado de stock y carga por páginas, sin costos para el EMPLEADO (HU-01, CP-11.4b), y permitir al DUENIO un alta rápida de producto con las mismas validaciones que la web (RN-05, límite del plan FREE).

#### Scenario: CP-M.3 Búsqueda y chips de estado (CP-01.3)
- **GIVEN** un comercio con productos en estado OK, bajo y sin stock
- **WHEN** escribe parte de un código o nombre y elige el chip "Bajo"
- **THEN** la lista muestra sólo los productos activos que coinciden y tienen stock bajo, cada uno con código, nombre, stock actual, precio de venta y su estado en color

#### Scenario: CP-M.3b Carga por páginas (CP-01.3b)
- **GIVEN** más productos que los que entran en una página
- **WHEN** llega al final de la lista
- **THEN** se cargan los siguientes sin repetir ni saltear productos

#### Scenario: CP-M.3c Empleado sin costos (CP-01.3c)
- **GIVEN** un usuario EMPLEADO
- **WHEN** consulta el inventario
- **THEN** ve precio de venta y stock pero ningún costo ni margen

#### Scenario: CP-M.3d Contador sin inventario (CP-01.3d)
- **GIVEN** un usuario CONTADOR
- **WHEN** entra a la app
- **THEN** sólo ve el panel; no existen las pestañas de inventario ni de movimientos

#### Scenario: CP-M.3e Alta rápida (CP-01.1)
- **GIVEN** un dueño en el inventario
- **WHEN** toca "Nuevo producto", completa código, nombre, precio con IVA, costo, stock inicial y stock de seguridad, y guarda
- **THEN** el producto aparece en la lista con su stock inicial y el mensaje "Producto creado"

#### Scenario: CP-M.3f Código repetido (CP-01.2, RN-05)
- **WHEN** guarda un producto con un código que ya existe en el comercio
- **THEN** ve el mensaje de la API sobre el código repetido y el producto no se crea

#### Scenario: CP-M.3g Límite del plan (CP-01.6)
- **GIVEN** un comercio en plan FREE con 50 productos activos
- **WHEN** intenta el alta rápida
- **THEN** ve el mensaje del límite del plan tal como lo devuelve la API

#### Scenario: CP-M.3h El empleado no da de alta (CP-01.4c)
- **GIVEN** un usuario EMPLEADO
- **WHEN** consulta el inventario
- **THEN** no ve el botón "Nuevo producto"

### Requirement: Registrar movimiento desde el mostrador

La app SHALL permitir al DUENIO y al EMPLEADO registrar ventas, ingresos y ajustes con las mismas reglas que la web (HU-10, RN-07): elegir producto, cantidad, motivo en ingresos y ajustes y observación (la venta se registra al precio de venta vigente del producto, que la pantalla muestra); enviar cada intento con una clave de idempotencia; mostrar el stock resultante y el aviso de stock bajo.

#### Scenario: CP-M.4 Venta desde el mostrador (CP-10.1, CP-10.2)
- **GIVEN** un producto con stock 10 y precio de venta 3990
- **WHEN** registra una venta de 2 unidades con el precio sugerido
- **THEN** ve "Venta registrada. Stock resultante: 8" y el inventario muestra 8 unidades

#### Scenario: CP-M.4b Ingreso y ajuste con motivo (CP-10.1b, CP-10.1c)
- **WHEN** elige "Ingreso" o "Ajuste"
- **THEN** el formulario pide el motivo entre los admitidos para ese tipo y no permite enviar sin motivo; en un ajuste la cantidad puede ser negativa

#### Scenario: CP-M.4c Stock insuficiente (CP-10.3)
- **GIVEN** un producto con stock 3
- **WHEN** registra una venta de 5 unidades
- **THEN** ve el mensaje de stock insuficiente que devuelve la API y el stock sigue en 3

#### Scenario: CP-M.4d Reintento sin duplicar (CP-10.8)
- **GIVEN** una venta que se envió pero la respuesta se perdió por un corte de red
- **WHEN** toca "Reintentar" sin cambiar el formulario
- **THEN** el movimiento queda registrado una sola vez

#### Scenario: CP-M.4e Aviso de stock bajo (CP-10.10)
- **GIVEN** un producto con stock de seguridad 5 y stock 6
- **WHEN** vende 2 unidades
- **THEN** el resultado incluye "Quedan 4 unidades, por debajo del stock de seguridad (5)"

#### Scenario: CP-M.4f Vender desde el producto
- **WHEN** toca "Vender" en un producto del inventario
- **THEN** el formulario abre con tipo Venta, ese producto elegido y su precio de venta precargado

#### Scenario: CP-M.4g El contador no registra (CP-10.6b)
- **GIVEN** un usuario CONTADOR
- **WHEN** usa la app
- **THEN** no tiene acceso a la pantalla de registrar movimiento

### Requirement: Conexión, errores y aislamiento

La app SHALL mostrar los mensajes de error que devuelve la API en español, ofrecer reintentar cuando no hay conexión, avisar mientras la API tarda en responder y mostrar únicamente los datos del comercio de la persona autenticada (RNF-10, CP-11.5).

#### Scenario: CP-M.5 Sin conexión
- **GIVEN** el celular sin red
- **WHEN** abre cualquier pantalla que consulta la API
- **THEN** ve "No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo." y un botón "Reintentar" que vuelve a consultar

#### Scenario: CP-M.5b La API tarda en responder
- **GIVEN** la API dormida en el plan gratuito
- **WHEN** la primera consulta supera unos segundos
- **THEN** la app muestra "La API está despertando, puede tardar hasta un minuto" y espera sin fallar antes del minuto

#### Scenario: CP-M.5c Mensajes de la API
- **WHEN** la API rechaza una operación con un error de validación, conflicto o plan
- **THEN** la app muestra el `message` en español que devolvió la API, sin códigos técnicos

#### Scenario: CP-M.5d Aislamiento por comercio (CP-11.5)
- **GIVEN** dos comercios distintos con sus usuarios
- **WHEN** cada usuario abre la app
- **THEN** ve sólo los productos, movimientos y el panel de su comercio, porque todas las consultas se hacen con su identidad y sin parámetros de comercio

### Requirement: Configuración de la API

La app SHALL tomar la URL de la API en tiempo de compilación, apuntar al emulador local por defecto en desarrollo y a la API publicada en la compilación de entrega.

#### Scenario: CP-M.6 Compilación de entrega
- **WHEN** se compila el APK con la URL de la API publicada
- **THEN** la app instalada en un celular entra, muestra el panel y registra una venta contra los datos reales del comercio

### Requirement: Apariencia de la app

La app SHALL usar la misma paleta que la web (ámbar de marca sobre fondos cálidos, con los mismos colores de estado) en un tema claro y uno oscuro. Por defecto, el tema SHALL seguir al del sistema. La persona SHALL poder elegir Sistema, Claro u Oscuro, y la app SHALL recordar esa elección entre aperturas. Los textos y los indicadores de los dos temas MUST cumplir el contraste WCAG AA (RNF-01): 4,5:1 para texto y 3:1 para íconos, bordes de campos e indicadores.

#### Scenario: CP-M.7 El tema sigue al del sistema
- **GIVEN** un celular con el tema del sistema en claro y la app sin una elección guardada
- **WHEN** abre la app
- **THEN** ve fondos crema, texto oscuro y el ámbar de marca; con el sistema en oscuro ve fondos marrón casi negro y texto crema

#### Scenario: CP-M.7b Elegir el tema y que se recuerde
- **GIVEN** un dueño con el sistema en oscuro
- **WHEN** en "Más" elige "Claro", cierra la app y la vuelve a abrir
- **THEN** la app sigue en tema claro hasta que elija "Sistema" u "Oscuro"

#### Scenario: CP-M.7c Contraste suficiente en los dos temas
- **WHEN** se verifican los colores de texto, de los estados de stock y del botón principal contra su fondo en cada tema
- **THEN** todos cumplen 4,5:1 si son texto y 3:1 si son indicadores, y el texto sobre el ámbar de marca es oscuro

#### Scenario: CP-M.7d Mismos colores de estado que la web
- **GIVEN** un producto sin stock, uno con stock bajo y uno con stock suficiente
- **WHEN** el dueño los ve en el inventario
- **THEN** se distinguen con los mismos colores que en la web (rojo, terracota y verde) y además con su etiqueta escrita, no sólo con el color

### Requirement: Pestaña Más

La barra inferior SHALL terminar en una pestaña "Más" para todos los roles. La pestaña SHALL mostrar la cuenta (comercio, email, rol y plan), la elección de tema y "Cerrar sesión", y SHALL aclarar qué tareas se hacen desde la web. Las pestañas de negocio SHALL seguir dependiendo del rol, como hasta ahora (CP-M.2e, CP-M.3d, CP-M.4g).

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
