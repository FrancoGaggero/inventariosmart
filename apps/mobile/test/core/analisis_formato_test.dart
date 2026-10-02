import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/analisis_formato.dart';
import 'package:inventariosmart_mobile/core/formato.dart';
import 'package:inventariosmart_mobile/core/modelos/analisis.dart';

import '../fixtures.dart';

// Casos tomados de apps/web/src/lib/quiebres-formato.test.ts y stock-parado-formato.test.ts
// (con espacio común después de "$", como el resto de la app). Las frases de alertas no tienen
// test en la web: se prueban con casos propios.

TotalesQuiebres totalesQuiebres({String ganancia = '13000.00', int afectados = 3, int enCurso = 1}) =>
    TotalesQuiebres(
      gananciaPerdida: ganancia,
      ventaPerdida: '32500.00',
      unidadesPerdidas: '32.5',
      productosAfectados: afectados,
      enCurso: enCurso,
    );

TotalesStockParado totalesParado({int productos = 3, String? porcentaje = '34.00'}) =>
    TotalesStockParado(capitalParado: '34000.00', productos: productos, unidades: 15, porcentajeDelStock: porcentaje);

void main() {
  group('pérdidas por falta de stock (HU-18)', () {
    test('formatea montos sin centavos, días y unidades con un decimal', () {
      expect(formatoPesosEntero('13000.00'), r'$ 13.000');
      expect(formatoPesosEntero(null), '—');
      expect(diasLegibles(5), '5,0 días');
      expect(diasLegibles(1), '1,0 día');
      expect(diasLegibles(0.04), 'menos de un día');
      expect(unidadesLegibles('10.0'), '10,0 unidades');
      expect(unidadesLegibles(null), '—');
      expect(diasQuiebres, [30, 60, 90]);
    });

    test('la ganancia de un producto sin historial lo dice en lugar del monto', () {
      expect(textoGanancia(ProductoConQuiebres.fromJson(productoConQuiebresJson(sinHistorial: true))), sinHistorial);
      expect(sinHistorial, 'Sin historial suficiente');
      expect(textoGanancia(ProductoConQuiebres.fromJson(productoConQuiebresJson())), r'$ 4.000');
    });

    test('CP-18.6 la frase de totales', () {
      expect(
        fraseQuiebres(totalesQuiebres(), 30),
        'En los últimos 30 días 3 productos se quedaron sin stock (1 sigue así): dejaste de ganar unos \$\u00a013.000.',
      );
      expect(
        fraseQuiebres(totalesQuiebres(afectados: 1, enCurso: 0), 90),
        'En los últimos 90 días 1 producto se quedó sin stock: dejaste de ganar unos \$\u00a013.000.',
      );
      expect(
        fraseQuiebres(totalesQuiebres(ganancia: '0.00', enCurso: 3), 60),
        'En los últimos 60 días 3 productos se quedaron sin stock (3 siguen así).',
      );
      expect(
        fraseQuiebres(totalesQuiebres(afectados: 0, enCurso: 0), 30),
        'En los últimos 30 días ningún producto se quedó sin stock.',
      );
      expect(detallePanelQuiebres(2), 'de ganancia en los últimos 30 días · 2 productos sin stock');
    });
  });

  group('stock parado (HU-19)', () {
    test('formatea el capital, la última venta y los días', () {
      expect(formatoPesosEntero('21000.00'), r'$ 21.000');
      // 03:00 UTC es medianoche en Buenos Aires: la fecha no se corre de día.
      expect(formatoDia('2026-06-03T03:00:00.000Z'), '03/06/2026');
      expect(formatoDia('2026-06-03T02:59:00.000Z'), '02/06/2026');
      expect(diasSinVenderLegible(120), '120 días');
      expect(diasSinVenderLegible(1), '1 día');
      expect(diasStockParado, [30, 60, 90, 180]);
      expect(
        textoUltimaVenta(ProductoParado.fromJson(productoParadoJson())),
        'Última venta: 04/06/2026 · hace 120 días',
      );
      expect(
        textoUltimaVenta(ProductoParado.fromJson(productoParadoJson(ultimaVenta: null, diasSinVender: 30))),
        'Nunca se vendió · 30 días desde el alta',
      );
    });

    test('CP-19.5 la frase de totales', () {
      expect(
        fraseStockParado(totalesParado(), 90),
        'Tenés \$\u00a034.000 (el 34 % de tu stock) en 3 productos que no se vendieron en los últimos 90 días.',
      );
      expect(
        fraseStockParado(totalesParado(productos: 1, porcentaje: '12.50'), 30),
        'Tenés \$\u00a034.000 (el 12,5 % de tu stock) en 1 producto que no se vendió en los últimos 30 días.',
      );
      expect(fraseStockParado(totalesParado(productos: 0), 180), 'Ningún producto con stock lleva más de 180 días sin venderse.');
      expect(fraseStockParado(totalesParado(porcentaje: null), 90), contains('Tenés \$\u00a034.000 en 3 productos'));
      expect(detallePanelStockParado(2), 'en 2 productos sin ventas en 90 días');
    });
  });

  group('alertas de reposición (HU-06)', () {
    ResumenAlertas resumen(int activas, int criticas, int pospuestas) =>
        ResumenAlertas(activas: activas, criticas: criticas, pospuestas: pospuestas, calculadasEn: null);

    test('la frase de la cabecera', () {
      expect(fraseAlertas(null), 'Calculando con las ventas de los últimos 30 días…');
      expect(fraseAlertas(resumen(0, 0, 0)), 'Ningún producto se va a quedar sin stock antes de que llegue la reposición.');
      expect(fraseAlertas(resumen(0, 0, 1)), 'Sin alertas activas; 1 pospuesta.');
      expect(fraseAlertas(resumen(0, 0, 3)), 'Sin alertas activas; 3 pospuestas.');
      expect(fraseAlertas(resumen(1, 0, 0)), '1 producto va a quedarse sin stock antes de que llegue la reposición.');
      expect(
        fraseAlertas(resumen(4, 1, 0)),
        '4 productos van a quedarse sin stock antes de que llegue la reposición. Uno ya está por debajo del punto de reposición.',
      );
      expect(fraseAlertas(resumen(4, 2, 0)), endsWith('2 ya están por debajo del punto de reposición.'));
    });

    test('cobertura, velocidad y total del inicio', () {
      expect(formatearCobertura(null), 'sin ventas');
      expect(formatearCobertura(0), 'se agota hoy');
      expect(formatearCobertura(1), '1 día');
      expect(formatearCobertura(9), '9 días');
      expect(velocidadLegible('2.000'), '2');
      expect(velocidadLegible('1.500'), '1,5');
      expect(totalReposicion(3, 1), '3 productos por reponer en total, 1 crítico.');
      expect(totalReposicion(5, 2), '5 productos por reponer en total, 2 críticos.');
      expect(totalReposicion(1, 0), '1 producto por reponer.');
    });
  });
}
