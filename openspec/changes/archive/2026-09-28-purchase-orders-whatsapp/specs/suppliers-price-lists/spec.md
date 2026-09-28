## ADDED Requirements

### Requirement: Canal de contacto del proveedor
El sistema SHALL permitir al DUENIO guardar en cada proveedor un canal preferido opcional (`EMAIL` o `WHATSAPP`) y SHALL informar en toda respuesta de proveedor el número de WhatsApp normalizado (`whatsapp`, sólo dígitos con código de país, o `null` si el teléfono no sirve) y el canal que corresponde (`canal`): el preferido si está definido; si no, `EMAIL` cuando tiene email; si no, `WHATSAPP` cuando tiene un número válido; si no, `null`. Un teléfono argentino SHALL normalizarse a `549` + código de área + número, quitando el `0` inicial, el `15` y cualquier separador; un número con código de otro país SHALL conservarse. Elegir como preferido un canal para el que faltan datos SHALL rechazarse (HU-16, RF-17).

#### Scenario: CP-16.1 Normalización del teléfono
- **GIVEN** un DUENIO que carga proveedores con los teléfonos `011 15-2345-6789`, `+54 9 351 234-5678`, `0351 15 234 5678`, `+54 11 2345-6789` y `4567-8901`
- **WHEN** consulta cada proveedor
- **THEN** `whatsapp` es `"5491123456789"`, `"5493512345678"`, `"5493512345678"`, `"5491123456789"` y `null` respectivamente, y `telefono` conserva el texto tal como se cargó

#### Scenario: CP-16.1b Canal que corresponde
- **GIVEN** el proveedor "Norte" con email y teléfono válido y sin canal preferido, "Sur" con los mismos datos y canal preferido `WHATSAPP`, "Este" sólo con teléfono válido y "Oeste" sin email ni teléfono
- **WHEN** el DUENIO consulta los proveedores
- **THEN** `canal` es `"EMAIL"` para "Norte", `"WHATSAPP"` para "Sur" y "Este", y `null` para "Oeste"

#### Scenario: CP-16.1c Canal preferido sin datos
- **WHEN** el DUENIO guarda un proveedor con canal preferido `WHATSAPP` y el teléfono `4567-8901`, o con canal preferido `EMAIL` y sin email
- **THEN** la API responde 400 `VALIDACION` con `details.canalPreferido` y el proveedor no cambia
