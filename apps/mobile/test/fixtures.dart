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

Map<String, dynamic> dashboardJson({bool conGastos = true, String periodo = '2026-09'}) => {
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
      },
    };
