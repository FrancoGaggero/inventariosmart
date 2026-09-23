import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/formato.dart';

void main() {
  group('formatoPesos', () {
    test('separa miles con punto y decimales con coma', () {
      expect(formatoPesos('1230000.00'), r'$ 1.230.000,00');
      expect(formatoPesos(3990), r'$ 3.990,00');
      expect(formatoPesos('0.5'), r'$ 0,50');
    });

    test('devuelve un guion si no es un número', () {
      expect(formatoPesos(null), '—');
      expect(formatoPesos('abc'), '—');
    });
  });

  test('formatoPorcentaje y formatoVariacion', () {
    expect(formatoPorcentaje('-12.5'), '-12,5 %');
    expect(formatoPorcentaje('38.25'), '38,3 %');
    expect(formatoPorcentaje(null), '—');
    expect(formatoVariacion('200'), '+200,0 %');
    expect(formatoVariacion('-12.5'), '-12,5 %');
    expect(formatoVariacion(null), 'sin datos');
  });

  test('formatoEntero', () {
    expect(formatoEntero(1234), '1.234');
    expect(formatoEntero(8), '8');
  });

  group('meses', () {
    test('mesActual usa Buenos Aires (UTC-3)', () {
      // 01:00 UTC del 1 de octubre sigue siendo 30 de septiembre en Buenos Aires.
      expect(mesActual(DateTime.utc(2026, 10, 1, 1)), '2026-09');
      expect(mesActual(DateTime.utc(2026, 10, 1, 3)), '2026-10');
    });

    test('sumarMeses cruza el año', () {
      expect(sumarMeses('2026-01', -1), '2025-12');
      expect(sumarMeses('2026-12', 1), '2027-01');
      expect(sumarMeses('2026-09', 0), '2026-09');
    });

    test('etiquetaMes', () {
      expect(etiquetaMes('2026-09'), 'Septiembre 2026');
      expect(etiquetaMes('raro'), 'raro');
    });
  });

  test('formatoFecha muestra día/mes/año y hora', () {
    final texto = formatoFecha('2026-09-23T14:05:00.000Z');
    expect(RegExp(r'^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$').hasMatch(texto), isTrue);
    expect(formatoFecha('no es fecha'), 'no es fecha');
  });
}
