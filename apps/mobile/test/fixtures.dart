/// JSON de ejemplo con la forma del contrato OpenAPI (`docs/openapi.json`).
library;

const idProducto = '3f1c2a9e-5b6d-4c7e-8f90-1a2b3c4d5e61';
const idProducto2 = '8c2d1b7a-4e5f-4a6b-9c8d-2e3f4a5b6c7d';

Map<String, dynamic> meJson({
  String rol = 'DUENIO',
  String plan = 'FREE',
  bool onboardingPendiente = false,
  String nombreComercio = 'Repuestos Carlos',
}) =>
    {
      'usuario': {
        'id': 'u1',
        'email': 'ana@ejemplo.com',
        'nombre': 'Ana',
        'rol': rol,
        'activo': true,
        'estado': 'ACTIVO',
        'creadoEn': '2026-09-10T12:00:00.000Z',
      },
      'comercio': {
        'id': 'c1',
        'nombre': nombreComercio,
        'cuit': null,
        'plan': plan,
        'ivaDefault': '21.00',
        'moneda': 'ARS',
        'onboardingPendiente': onboardingPendiente,
      },
      'rol': rol,
      'plan': plan,
      'onboardingPendiente': onboardingPendiente,
    };

Map<String, dynamic> productoJson({
  String id = idProducto,
  String codigo = 'FA-220',
  String nombre = 'Filtro de aceite',
  int stockActual = 10,
  int stockSeguridad = 5,
  String estadoStock = 'OK',
  String precioVenta = '3990.00',
  bool conCosto = true,
}) =>
    {
      'id': id,
      'codigo': codigo,
      'nombre': nombre,
      'categoria': 'Filtros',
      'precioVenta': precioVenta,
      'alicuotaIva': '21.00',
      if (conCosto) 'costoReposicion': '2400.00',
      'stockActual': stockActual,
      'stockSeguridad': stockSeguridad,
      'estadoStock': estadoStock,
      'proveedorPrincipal': {'id': 'pr1', 'nombre': 'Distribuidora Norte'},
      'activo': true,
      'creadoEn': '2026-09-10T12:00:00.000Z',
      'actualizadoEn': '2026-09-10T12:00:00.000Z',
    };

Map<String, dynamic> movimientoJson({
  String id = 'm1',
  String tipo = 'VENTA',
  int cantidad = 2,
  int stockResultante = 8,
  String estadoStock = 'OK',
  String? motivo,
}) =>
    {
      'id': id,
      'tipo': tipo,
      'producto': {'id': idProducto, 'codigo': 'FA-220', 'nombre': 'Filtro de aceite'},
      'usuario': {'id': 'u1', 'nombre': 'Ana'},
      'cantidad': cantidad,
      'efectoStock': tipo == 'VENTA' ? -cantidad : cantidad,
      'stockResultante': stockResultante,
      'estadoStock': estadoStock,
      'precioUnitario': tipo == 'VENTA' ? '3297.52' : null,
      'motivo': motivo,
      'observacion': null,
      'fecha': '2026-09-23T14:05:00.000Z',
      'corrigeAId': null,
      'anuladoPorId': null,
      'creadoEn': '2026-09-23T14:05:00.000Z',
    };

Map<String, dynamic> dashboardJson({
  bool conGastos = true,
  String periodo = '2026-09',
  Map<String, dynamic>? reposicion,
  Map<String, dynamic>? quiebres,
  Map<String, dynamic>? stockParado,
}) =>
    {
      'periodo': periodo,
      'stock': {
        'productosActivos': 12,
        'unidades': 148,
        'valorizacion': '355200.00',
        'sinStock': 2,
        'stockBajo': 1,
      },
      'ventas': {
        'unidadesVendidas': 45,
        'ventasNetas': '148388.43',
        'costoVendido': '90000.00',
        'margenBruto': '58388.43',
        'margenBrutoPct': '39.35',
        'gastos': conGastos ? '5888.43' : '0.00',
        'margenNeto': conGastos ? '52500.00' : null,
        'margenNetoPct': conGastos ? '35.38' : null,
        'motivo': conGastos ? null : 'SIN_GASTOS',
      },
      'mesAnterior': {
        'periodo': '2026-08',
        'unidadesVendidas': 15,
        'ventasNetas': '49462.81',
        'variacionVentasPct': '200.00',
      },
      'topRentables': [
        {
          'producto': {'id': idProducto, 'codigo': 'FA-220', 'nombre': 'Filtro de aceite'},
          'unidadesVendidas': 30,
          'margenBruto': '897.52',
          'margenBrutoPct': '27.22',
          'margenBrutoMes': '26925.60',
        },
        {
          'producto': {'id': idProducto2, 'codigo': 'AM-1L', 'nombre': 'Aceite mineral 1 L'},
          'unidadesVendidas': 15,
          'margenBruto': '1200.00',
          'margenBrutoPct': '30.00',
          'margenBrutoMes': '18000.00',
        },
      ],
      'alertas': {
        'sinStock': {
          'total': 2,
          'items': [
            {'id': 'p3', 'codigo': 'BT-12', 'nombre': 'Batería 12V', 'stockActual': 0, 'stockSeguridad': 2},
          ],
        },
        'stockBajo': {
          'total': 1,
          'items': [
            {'id': 'p4', 'codigo': 'LM-H4', 'nombre': 'Lámpara H4', 'stockActual': 1, 'stockSeguridad': 4},
          ],
        },
        'faltanGastos': !conGastos,
        'reposicion': reposicion,
      },
      'quiebres': quiebres,
      'stockParado': stockParado,
    };

/// Bloque `alertas.reposicion` del panel con [n] productos, el primero crítico.
Map<String, dynamic> reposicionJson({int n = 3, int criticas = 1}) => {
      'total': n,
      'criticas': criticas,
      'items': [
        for (var i = 0; i < n; i++)
          {
            'id': 'al-$i',
            'producto': {'id': 'p$i', 'codigo': 'RP-$i', 'nombre': 'Repuesto $i'},
            'severidad': i < criticas ? 'CRITICA' : 'PROXIMA',
            'stock': i,
            'diasCobertura': i == 0 ? 0 : i * 2,
            'cantidadSugerida': 10 + i,
          },
      ],
    };

const idOrden = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const idOrden2 = '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f';

Map<String, dynamic> ordenResumenJson({
  String id = idOrden,
  String numero = 'OC-0007',
  String estado = 'BORRADOR',
  String proveedor = 'Distribuidora Norte',
  String? canal,
  String? motivoNoEnvio,
}) =>
    {
      'id': id,
      'numero': numero,
      'estado': estado,
      'proveedor': {'id': 'pv1', 'nombre': proveedor},
      'cantidadItems': 2,
      'totalNeto': '128000.00',
      'motivoNoEnvio': motivoNoEnvio,
      'canal': canal,
      'confirmadaEn': estado == 'BORRADOR' ? null : '2026-10-06T13:00:00.000Z',
      'enviadaEn': estado == 'ENVIADA' ? '2026-10-06T14:00:00.000Z' : null,
      'creadoEn': '2026-10-06T12:00:00.000Z',
    };

Map<String, dynamic> ordenJson({
  String id = idOrden,
  String estado = 'BORRADOR',
  String? canal,
  String? motivoNoEnvio,
  bool conWhatsappUrl = false,
  bool proveedorConEmail = true,
  bool proveedorConWhatsapp = true,
  String? canalProveedor = 'WHATSAPP',
  String? enviadaA,
  bool costoAConfirmar = false,
}) =>
    {
      'id': id,
      'numero': 'OC-0007',
      'estado': estado,
      'proveedor': {
        'id': 'pv1',
        'nombre': 'Distribuidora Norte',
        'contacto': 'Marta',
        'email': proveedorConEmail ? 'compras@norte.com' : null,
        'telefono': proveedorConWhatsapp ? '011 15-2345-6789' : null,
        'whatsapp': proveedorConWhatsapp ? '5491123456789' : null,
        'canal': canalProveedor,
        'leadTimeDias': 5,
        'confiabilidad': 90,
      },
      'items': [
        {
          'id': 'it1',
          'producto': {'id': idProducto, 'codigo': 'FA-220', 'nombre': 'Filtro de aceite', 'stockActual': 3},
          'alertaId': idAlerta,
          'cantidad': 20,
          'costoUnitarioNeto': '2400.00',
          'subtotal': '48000.00',
        },
        {
          'id': 'it2',
          'producto': {'id': idProducto2, 'codigo': 'AM-1L', 'nombre': 'Aceite mineral 1 L', 'stockActual': 1},
          'alertaId': null,
          'cantidad': 10,
          'costoUnitarioNeto': costoAConfirmar ? null : '8000.00',
          'subtotal': costoAConfirmar ? null : '80000.00',
        },
      ],
      'totalNeto': costoAConfirmar ? '48000.00' : '128000.00',
      'asunto': 'Orden de compra OC-0007 · Repuestos Carlos',
      'texto': 'Hola Marta, te paso el pedido:\n- Filtro de aceite FA-220: 20\n- Aceite mineral 1 L: 10',
      'textoEditado': false,
      'notas': null,
      'motivoNoEnvio': motivoNoEnvio,
      'canal': canal,
      'whatsappUrl': conWhatsappUrl ? 'https://wa.me/5491123456789?text=Orden%20de%20compra%20OC-0007' : null,
      'creadaPor': {'id': 'u1', 'nombre': 'Ana'},
      'confirmadaPor': estado == 'BORRADOR' || estado == 'CANCELADA' ? null : {'id': 'u1', 'nombre': 'Ana'},
      'confirmadaEn': estado == 'BORRADOR' || estado == 'CANCELADA' ? null : '2026-10-06T13:00:00.000Z',
      'enviadaEn': estado == 'ENVIADA' ? '2026-10-06T14:00:00.000Z' : null,
      'enviadaA': enviadaA,
      'canceladaEn': estado == 'CANCELADA' ? '2026-10-06T13:30:00.000Z' : null,
      'creadoEn': '2026-10-06T12:00:00.000Z',
      'actualizadoEn': '2026-10-06T12:00:00.000Z',
    };

const idConversacion = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
const idConversacion2 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

Map<String, dynamic> mensajeAsistenteJson({
  String id = 'm-asis',
  String rol = 'ASISTENTE',
  String contenido = 'Tenés 2 productos para reponer:\n- Filtro de aceite: pedí 20\n- Lámpara H4: pedí 12',
  List<Map<String, String>> fuentes = const [
    {'herramienta': 'alertas_de_reposicion', 'nombre': 'Alertas de reposición'},
  ],
  List<Map<String, String>> acciones = const [],
  String creadoEn = '2026-10-02T17:05:00.000Z',
}) =>
    {
      'id': id,
      'rol': rol,
      'contenido': contenido,
      'fuentes': fuentes,
      'acciones': acciones,
      'creadoEn': creadoEn,
    };

Map<String, dynamic> respuestaAsistenteJson({String conversacionId = idConversacion, Map<String, dynamic>? mensaje}) =>
    {'conversacionId': conversacionId, 'mensaje': mensaje ?? mensajeAsistenteJson()};

Map<String, dynamic> conversacionesJson({List<Map<String, dynamic>>? items, String? siguienteCursor}) => {
      'items': items ??
          [
            {'id': idConversacion, 'titulo': '¿Qué productos tengo que reponer?', 'creadoEn': '2026-10-02T12:00:00.000Z', 'actualizadoEn': '2026-10-02T12:05:00.000Z'},
          ],
      'siguienteCursor': siguienteCursor,
    };

Map<String, dynamic> conversacionJson({String id = idConversacion, List<Map<String, dynamic>>? mensajes}) => {
      'id': id,
      'titulo': '¿Qué productos tengo que reponer?',
      'creadoEn': '2026-10-02T12:00:00.000Z',
      'actualizadoEn': '2026-10-02T12:05:00.000Z',
      'mensajes': mensajes ??
          [
            mensajeAsistenteJson(id: 'm1', rol: 'USUARIO', contenido: '¿Qué productos tengo que reponer?', fuentes: const []),
            mensajeAsistenteJson(id: 'm2'),
          ],
    };

const idAlerta = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const idAlerta2 = '7b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e';

Map<String, dynamic> alertaJson({
  String id = idAlerta,
  String nombre = 'Filtro de aceite',
  String codigo = 'FA-220',
  String productoId = idProducto,
  String estado = 'ACTIVA',
  String severidad = 'CRITICA',
  int? diasCobertura = 2,
  bool conProveedor = true,
  String? pospuestaHasta,
}) =>
    {
      'id': id,
      'producto': {
        'id': productoId,
        'codigo': codigo,
        'nombre': nombre,
        'stockActual': 3,
        'stockSeguridad': 2,
        'estadoStock': 'BAJO',
      },
      'proveedor': conProveedor ? {'id': 'pv1', 'nombre': 'Distribuidora Sur', 'leadTimeDias': 5} : null,
      'estado': estado,
      'severidad': severidad,
      'stock': 3,
      'puntoReposicion': 12,
      'umbral': 16,
      'leadTimeDias': 5,
      'diasAnticipacion': 2,
      'cantidadSugerida': 20,
      'velocidadDiaria': '2.000',
      'diasCobertura': diasCobertura,
      'generadaEn': '2026-10-01T12:00:00.000Z',
      'actualizadaEn': '2026-10-02T12:00:00.000Z',
      'pospuestaHasta': pospuestaHasta,
      'atendidaEn': null,
      'resueltaEn': null,
      'notificadaEn': null,
      'ordenCompraId': null,
    };

Map<String, dynamic> resumenAlertasJson({int activas = 2, int criticas = 1, int pospuestas = 0}) => {
      'activas': activas,
      'criticas': criticas,
      'pospuestas': pospuestas,
      'calculadasEn': '2026-10-02T17:05:00.000Z',
    };

Map<String, dynamic> productoConQuiebresJson({
  String id = idProducto,
  String codigo = 'D-4000',
  String nombre = 'Batería 12V 65Ah',
  double diasSinStock = 5,
  bool enCurso = true,
  int quiebres = 1,
  bool sinHistorial = false,
}) =>
    {
      'producto': {'id': id, 'codigo': codigo, 'nombre': nombre},
      'quiebres': quiebres,
      'diasSinStock': diasSinStock,
      'enCurso': enCurso,
      'inicioUltimo': '2026-09-27T12:00:00.000Z',
      'demandaDiaria': sinHistorial ? null : '2.0',
      'unidadesPerdidas': sinHistorial ? null : '10.0',
      'ventaPerdida': sinHistorial ? null : '10000.00',
      'gananciaPerdida': sinHistorial ? null : '4000.00',
      'motivo': sinHistorial ? 'SIN_HISTORIAL' : null,
    };

Map<String, dynamic> quiebresJson({
  int dias = 30,
  List<Map<String, dynamic>>? items,
  String? siguienteCursor,
  String gananciaPerdida = '4000.00',
  int productosAfectados = 1,
  int enCurso = 1,
}) =>
    {
      'dias': dias,
      'desde': '2026-09-02T12:00:00.000Z',
      'hasta': '2026-10-02T12:00:00.000Z',
      'totales': {
        'gananciaPerdida': gananciaPerdida,
        'ventaPerdida': '10000.00',
        'unidadesPerdidas': '10.0',
        'productosAfectados': productosAfectados,
        'enCurso': enCurso,
      },
      'items': items ?? [productoConQuiebresJson()],
      'siguienteCursor': siguienteCursor,
    };

Map<String, dynamic> productoParadoJson({
  String id = idProducto2,
  String codigo = 'S-PARADO',
  String nombre = 'Kit de embrague',
  String? ultimaVenta = '2026-06-04T15:00:00.000Z',
  int diasSinVender = 120,
}) =>
    {
      'producto': {'id': id, 'codigo': codigo, 'nombre': nombre},
      'stock': 10,
      'costoReposicion': '2100.00',
      'capitalParado': '21000.00',
      'ultimaVenta': ultimaVenta,
      'diasSinVender': diasSinVender,
    };

Map<String, dynamic> stockParadoJson({
  int dias = 90,
  List<Map<String, dynamic>>? items,
  String? siguienteCursor,
  int productos = 1,
}) =>
    {
      'dias': dias,
      'desde': '2026-07-04T12:00:00.000Z',
      'hasta': '2026-10-02T12:00:00.000Z',
      'totales': {
        'capitalParado': productos == 0 ? '0.00' : '21000.00',
        'productos': productos,
        'unidades': productos == 0 ? 0 : 10,
        'porcentajeDelStock': productos == 0 ? null : '34.00',
      },
      'items': items ?? (productos == 0 ? <Map<String, dynamic>>[] : [productoParadoJson()]),
      'siguienteCursor': siguienteCursor,
    };
