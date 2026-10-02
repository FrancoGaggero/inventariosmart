## ADDED Requirements

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

## MODIFIED Requirements

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
