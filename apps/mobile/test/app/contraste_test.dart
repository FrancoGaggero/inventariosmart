import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/app/theme.dart';

/// Contraste WCAG AA de la paleta en los dos temas (CP-M.7c, design D5). Usa las mismas fórmulas
/// y los mismos pares que `apps/web/src/lib/contraste.test.ts`, más el borde de los campos.

/// Un color con transparencia, compuesto sobre su fondo opaco.
Color sobre(Color frente, Color fondo) {
  final a = frente.a;
  return Color.from(
    alpha: 1,
    red: frente.r * a + fondo.r * (1 - a),
    green: frente.g * a + fondo.g * (1 - a),
    blue: frente.b * a + fondo.b * (1 - a),
  );
}

double luminancia(Color c) {
  double canal(double s) => s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
}

double relacion(Color frente, Color fondo) {
  final t = sobre(frente, fondo);
  final a = luminancia(t);
  final b = luminancia(fondo);
  final (mayor, menor) = a > b ? (a, b) : (b, a);
  return (mayor + 0.05) / (menor + 0.05);
}

/// [nombre, frente, fondo, mínimo]: 4,5 para texto; 3 para indicadores, íconos y bordes.
List<(String, Color, Color, double)> pares(Tokens k) => [
      ('t1 sobre bg', k.t1, k.bg, 4.5),
      ('t1 sobre card', k.t1, k.card, 4.5),
      ('t1 sobre bg2', k.t1, k.bg2, 4.5),
      ('t2 sobre bg', k.t2, k.bg, 4.5),
      ('t2 sobre card', k.t2, k.card, 4.5),
      ('t2 sobre bg2', k.t2, k.bg2, 4.5),
      ('onBrand sobre brand', k.onBrand, k.brand, 4.5),
      ('brand3 sobre bg', k.brand3, k.bg, 4.5),
      ('brand3 sobre card', k.brand3, k.card, 4.5),
      ('onInverso sobre inverso', k.onInverso, k.inverso, 4.5),
      ('acentoInverso sobre inverso', k.acentoInverso, k.inverso, 4.5),
      ('onWhatsapp sobre whatsapp', k.onWhatsapp, k.whatsapp, 4.5),
      ('t3 sobre card', k.t3, k.card, 3),
      ('ok sobre card', k.ok, k.card, 3),
      ('warn sobre card', k.warn, k.card, 3),
      ('crit sobre card', k.crit, k.card, 3),
      ('brand sobre bg', k.brand, k.bg, 3),
      ('brand sobre card', k.brand, k.card, 3),
      // El borde de los campos es t3 y no line2, que no llega a 3:1 (design D5).
      ('borde t3 sobre field', k.t3, k.field, 3),
      ('t1 en la barra inferior (bg2)', k.t1, k.bg2, 4.5),
      ('t1 sobre el ámbar tonal del indicador', k.t1, sobre(k.brand.withValues(alpha: 0.18), k.bg2), 4.5),
    ];

void main() {
  for (final (tema, k) in [('oscuro', Tokens.oscuro), ('claro', Tokens.claro)]) {
    group('tema $tema', () {
      for (final (nombre, frente, fondo, minimo) in pares(k)) {
        test('$nombre llega a $minimo:1', () {
          expect(relacion(frente, fondo), greaterThanOrEqualTo(minimo));
        });
      }
    });
  }

  test('el texto sobre el ámbar de marca es oscuro en los dos temas', () {
    for (final k in [Tokens.oscuro, Tokens.claro]) {
      expect(luminancia(k.onBrand), lessThan(luminancia(k.brand)));
    }
  });

  test('los dos temas son distintos', () {
    expect(Tokens.claro.bg, isNot(Tokens.oscuro.bg));
    expect(Tokens.de(Brightness.light), same(Tokens.claro));
    expect(Tokens.de(Brightness.dark), same(Tokens.oscuro));
  });
}
