## ADDED Requirements

### Requirement: Consultas sobre el stock
El asistente SHALL poder consultar las pérdidas por falta de stock de los últimos 30, 60 o 90 días y el stock parado de los últimos 30, 60, 90 o 180 días, con los mismos cálculos y cifras que las páginas "Falta de stock" (RN-14) y "Stock parado" (RN-15). Cada consulta SHALL devolver los totales del período y como máximo 10 productos, en el mismo orden que la página. El asistente SHALL usar la de falta de stock para las preguntas sobre lo que se dejó de vender o de ganar por quedarse sin mercadería, y la de stock parado para las preguntas sobre productos que no se venden o plata inmovilizada. SHALL presentar la ganancia perdida como una estimación. Si un producto no tiene historial suficiente, SHALL decir que no se puede estimar en lugar de dar una cifra. Las consultas SHALL ver sólo los datos del comercio del usuario.

#### Scenario: CP-08.8 Cuánto perdí por quedarme sin stock
- **GIVEN** un comercio PREMIUM cuya página "Falta de stock" de los últimos 30 días informa una ganancia perdida de 4.000 en el producto `D-4000`
- **WHEN** el DUENIO pregunta "¿cuánto perdí este mes por quedarme sin stock?"
- **THEN** el asistente responde con la estimación de 4.000 y nombra a `D-4000`; `fuentes` incluye "Pérdidas por falta de stock"; y las cifras de la consulta coinciden con las de `GET /api/v1/stockouts?dias=30`

#### Scenario: CP-08.8b Qué productos no se venden
- **GIVEN** un comercio PREMIUM cuya página "Stock parado" de 90 días informa un capital parado de 21.000 en el producto `S-PARADO`, sin ventas hace 120 días
- **WHEN** el DUENIO pregunta "¿qué productos no se venden?"
- **THEN** el asistente nombra a `S-PARADO` con su capital parado y los días sin vender; `fuentes` incluye "Stock parado"; y las cifras de la consulta coinciden con las de `GET /api/v1/dead-stock?dias=90`

#### Scenario: CP-08.8c Período inválido y aislamiento
- **WHEN** el asistente pide las pérdidas por falta de stock con 45 días, o el stock parado con 365
- **THEN** la consulta vuelve al asistente como error con el motivo, sin calcular nada; y en un período válido, ninguna de las dos consultas trae productos de otro comercio
