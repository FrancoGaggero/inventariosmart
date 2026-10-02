import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/lista_paginada.dart';
import 'package:inventariosmart_mobile/core/modelos/modelos.dart';

import '../fixtures.dart';

void main() {
  test('Me.fromJson resuelve rol, plan y pestañas', () {
    final me = Me.fromJson(meJson(rol: 'EMPLEADO'));
    expect(me.usuario.email, 'ana@ejemplo.com');
    expect(me.comercio.nombre, 'Repuestos Carlos');
    expect(me.plan, 'FREE');
    expect(me.esEmpleado, isTrue);
    expect(me.vePanel, isFalse);
    expect(me.veInventario, isTrue);
    expect(Me.fromJson(meJson(rol: 'CONTADOR')).veInventario, isFalse);
    expect(Me.fromJson(meJson(rol: 'CONTADOR')).registraMovimientos, isFalse);
    expect(Me.fromJson(meJson(onboardingPendiente: true)).onboardingPendiente, isTrue);
  });

  test('Producto.fromJson con y sin costo (respuesta a EMPLEADO, CP-11.4b)', () {
    final p = Producto.fromJson(productoJson());
    expect(p.codigo, 'FA-220');
    expect(p.costoReposicion, '2400.00');
    expect(p.proveedorPrincipal?.nombre, 'Distribuidora Norte');
    final sinCosto = Producto.fromJson(productoJson(conCosto: false));
    expect(sinCosto.costoReposicion, isNull);
    expect(sinCosto.estadoStock, 'OK');
  });

  test('ProductoCreate.toJson omite opcionales vacíos', () {
    const c = ProductoCreate(codigo: 'X-1', nombre: 'Prod', precioVenta: '100.00', costoReposicion: '50.00');
    expect(c.toJson(), {
      'codigo': 'X-1',
      'nombre': 'Prod',
      'precioVenta': '100.00',
      'costoReposicion': '50.00',
      'stockInicial': 0,
      'stockSeguridad': 0,
    });
  });

  test('Movimiento.fromJson', () {
    final m = Movimiento.fromJson(movimientoJson(stockResultante: 8, estadoStock: 'OK'));
    expect(m.tipo, 'VENTA');
    expect(m.producto.codigo, 'FA-220');
    expect(m.stockResultante, 8);
    expect(m.precioUnitario, '3297.52');
    expect(m.motivo, isNull);
  });

  test('MovimientoCreate.toJson por tipo (CP-10.1)', () {
    expect(
      const MovimientoCreate(tipo: 'VENTA', productoId: 'p1', cantidad: 2, motivo: 'COMPRA').toJson(),
      {'tipo': 'VENTA', 'productoId': 'p1', 'cantidad': 2},
    );
    expect(
      const MovimientoCreate(tipo: 'INGRESO', productoId: 'p1', cantidad: 5, motivo: 'COMPRA', observacion: ' ok ')
          .toJson(),
      {'tipo': 'INGRESO', 'productoId': 'p1', 'cantidad': 5, 'motivo': 'COMPRA', 'observacion': 'ok'},
    );
    expect(
      const MovimientoCreate(tipo: 'AJUSTE', productoId: 'p1', cantidad: -3, motivo: 'ROTURA').toJson(),
      {'tipo': 'AJUSTE', 'productoId': 'p1', 'cantidad': -3, 'motivo': 'ROTURA'},
    );
  });

  test('motivosPorTipo replica shared', () {
    expect(motivosPorTipo['VENTA'], isEmpty);
    expect(motivosPorTipo['INGRESO'], ['COMPRA', 'DEVOLUCION', 'OTRO']);
    expect(motivosPorTipo['AJUSTE'], contains('USO_INTERNO'));
    for (final m in motivosAjuste) {
      expect(etiquetaMotivo.containsKey(m), isTrue, reason: m);
    }
  });

  test('Dashboard.fromJson con y sin gastos', () {
    final d = Dashboard.fromJson(dashboardJson());
    expect(d.periodo, '2026-09');
    expect(d.stock.unidades, 148);
    expect(d.ventas.margenNeto, '52500.00');
    expect(d.ventas.margenNetoCalculable, isTrue);
    expect(d.mesAnterior.variacionVentasPct, '200.00');
    expect(d.topRentables.first.producto.nombre, 'Filtro de aceite');
    expect(d.alertas.stockBajo.total, 1);

    final sinGastos = Dashboard.fromJson(dashboardJson(conGastos: false));
    expect(sinGastos.ventas.margenNeto, isNull);
    expect(sinGastos.ventas.motivo, 'SIN_GASTOS');
    expect(sinGastos.alertas.faltanGastos, isTrue);
  });

  test('planCumple ordena FREE < PRO < PREMIUM y veAnalisis excluye al EMPLEADO (D2)', () {
    expect(planCumple('FREE', 'PRO'), isFalse);
    expect(planCumple('PRO', 'PRO'), isTrue);
    expect(planCumple('PREMIUM', 'PRO'), isTrue);
    expect(planCumple('PRO', 'PREMIUM'), isFalse);
    expect(planCumple('FREE', 'FREE'), isTrue);
    expect(planCumple('OTRO', 'FREE'), isFalse);
    for (final (rol, ve) in [('DUENIO', true), ('CONTADOR', true), ('EMPLEADO', false)]) {
      expect(Me.fromJson(meJson(rol: rol)).veAnalisis, ve, reason: rol);
    }
    expect(Me.fromJson(meJson(plan: 'FREE')).tienePro, isFalse);
    expect(Me.fromJson(meJson(plan: 'PRO')).tienePro, isTrue);
    expect(Me.fromJson(meJson(plan: 'PREMIUM')).tienePro, isTrue);
  });

  test('Dashboard.fromJson con los bloques de análisis y sin ellos (FREE)', () {
    final pro = Dashboard.fromJson(dashboardJson(
      reposicion: reposicionJson(),
      quiebres: {'gananciaPerdida': '4000.00', 'ventaPerdida': '10000.00', 'productosAfectados': 1},
      stockParado: {'capitalParado': '21000.00', 'productos': 1},
    ));
    expect(pro.alertas.reposicion!.total, 3);
    expect(pro.alertas.reposicion!.criticas, 1);
    expect(pro.alertas.reposicion!.items.first.severidad, 'CRITICA');
    expect(pro.alertas.reposicion!.items.first.diasCobertura, 0);
    expect(pro.quiebres!.gananciaPerdida, '4000.00');
    expect(pro.stockParado!.capitalParado, '21000.00');

    final free = Dashboard.fromJson(dashboardJson());
    expect(free.alertas.reposicion, isNull);
    expect(free.quiebres, isNull);
    expect(free.stockParado, isNull);
  });

  test('Alerta y ResumenAlertas', () {
    final a = Alerta.fromJson(alertaJson(conProveedor: false, estado: 'POSPUESTA', pospuestaHasta: '2026-10-09T12:00:00.000Z'));
    expect(a.producto.codigo, 'FA-220');
    expect(a.producto.stockSeguridad, 2);
    expect(a.proveedor, isNull);
    expect(a.abierta, isTrue);
    expect(a.velocidadDiaria, '2.000');
    expect(a.pospuestaHasta, isNotNull);
    expect(Alerta.fromJson(alertaJson()).proveedor!.leadTimeDias, 5);
    expect(Alerta.fromJson(alertaJson(estado: 'RESUELTA')).abierta, isFalse);
    expect(Alerta.fromJson(alertaJson(diasCobertura: null)).diasCobertura, isNull);
    final r = ResumenAlertas.fromJson(resumenAlertasJson());
    expect((r.activas, r.criticas, r.pospuestas), (2, 1, 0));
  });

  test('ResultadoQuiebres con SIN_HISTORIAL y páginas', () {
    final r = ResultadoQuiebres.fromJson(quiebresJson(
      items: [productoConQuiebresJson(), productoConQuiebresJson(id: 'x', sinHistorial: true)],
      siguienteCursor: 'c1',
    ));
    expect(r.dias, 30);
    expect(r.totales.gananciaPerdida, '4000.00');
    expect(r.items.first.diasSinStock, 5.0);
    expect(r.items.last.motivo, 'SIN_HISTORIAL');
    expect(r.items.last.gananciaPerdida, isNull);
    expect(r.hayMas, isTrue);
    final todo = r.conPagina(ResultadoQuiebres.fromJson(quiebresJson(items: [productoConQuiebresJson(id: 'y')])));
    expect(todo.items.length, 3);
    expect(todo.hayMas, isFalse);
    expect(todo.totales.productosAfectados, 1);
  });

  test('ResultadoStockParado con ultimaVenta null y páginas', () {
    final r = ResultadoStockParado.fromJson(stockParadoJson(
      items: [productoParadoJson(), productoParadoJson(id: 'z', ultimaVenta: null)],
      siguienteCursor: 'c2',
    ));
    expect(r.dias, 90);
    expect(r.totales.porcentajeDelStock, '34.00');
    expect(r.items.first.capitalParado, '21000.00');
    expect(r.items.last.ultimaVenta, isNull);
    expect(r.hayMas, isTrue);
    expect(r.conPagina(ResultadoStockParado.fromJson(stockParadoJson())).items.length, 3);
    expect(ResultadoStockParado.fromJson(stockParadoJson(productos: 0)).totales.porcentajeDelStock, isNull);
  });

  test('ListaPaginada.fromJson', () {
    final lista = ListaPaginada.fromJson(
      {
        'items': [productoJson(), productoJson(codigo: 'AM-1L')],
        'siguienteCursor': 'abc',
      },
      Producto.fromJson,
    );
    expect(lista.items.map((p) => p.codigo), ['FA-220', 'AM-1L']);
    expect(lista.hayMas, isTrue);
    expect(ListaPaginada.fromJson({'items': [], 'siguienteCursor': null}, Producto.fromJson).hayMas, isFalse);
  });
}
