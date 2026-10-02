import 'dart:io';

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/app/theme.dart';

/// Los colores de la app son los de la web (design D6): lee `apps/web/src/index.css` y compara
/// cada `--color-*` con su par en [Tokens]. Fuera del monorepo, el archivo no está y se saltea.
final css = File('../web/src/index.css');

Map<String, String> tokensDe(String bloque) => {
      for (final m in RegExp(r'--color-([a-z0-9-]+):\s*([^;]+);').allMatches(bloque)) m.group(1)!: m.group(2)!.trim(),
    };

String bloque(String texto, String inicio) {
  final i = texto.indexOf(inicio);
  if (i < 0) throw StateError('No encontré $inicio en index.css');
  return texto.substring(i, texto.indexOf('\n}', i));
}

Color colorCss(String valor) {
  final hex = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(valor);
  if (hex != null) return Color(0xFF000000 | int.parse(hex.group(1)!, radix: 16));
  final rgba = RegExp(r'^rgba?\(([^)]+)\)$').firstMatch(valor);
  if (rgba != null) {
    final p = rgba.group(1)!.split(',').map((x) => x.trim()).toList();
    return Color.fromRGBO(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]), p.length > 3 ? double.parse(p[3]) : 1);
  }
  throw FormatException('Color no soportado: $valor');
}

/// Nombre del token en la web → valor en [Tokens].
Map<String, Color> deTokens(Tokens k) => {
      'bg': k.bg,
      'bg-2': k.bg2,
      'card': k.card,
      'card-2': k.card2,
      'field': k.field,
      't1': k.t1,
      't2': k.t2,
      't3': k.t3,
      'line': k.line,
      'line-2': k.line2,
      'fill': k.fill,
      'brand': k.brand,
      'brand-2': k.brand2,
      'brand-3': k.brand3,
      'on-brand': k.onBrand,
      'ok': k.ok,
      'warn': k.warn,
      'crit': k.crit,
      'violet': k.violet,
      'whatsapp': k.whatsapp,
      'on-whatsapp': k.onWhatsapp,
      'inverso': k.inverso,
      'on-inverso': k.onInverso,
      'acento-inverso': k.acentoInverso,
    };

/// Igualdad por canales en 8 bits: los alfa como 0.045 no son exactos en punto flotante.
List<int> canales(Color c) => [c.a, c.r, c.g, c.b].map((v) => (v * 255).round()).toList();

void main() {
  final hayWeb = css.existsSync();
  final omitir = hayWeb ? false : 'No está apps/web/src/index.css (fuera del monorepo)';

  test('la app tiene los colores de la web en los dos temas', () {
    final texto = css.readAsStringSync();
    final oscuro = tokensDe(bloque(texto, '@theme {'));
    final claro = {...oscuro, ...tokensDe(bloque(texto, ":root[data-theme='light'] {"))};
    for (final (tema, web, app) in [('oscuro', oscuro, Tokens.oscuro), ('claro', claro, Tokens.claro)]) {
      for (final MapEntry(key: nombre, value: valor) in deTokens(app).entries) {
        expect(web.containsKey(nombre), isTrue, reason: 'La web no define --color-$nombre');
        expect(canales(valor), canales(colorCss(web[nombre]!)), reason: 'Tema $tema: --color-$nombre');
      }
    }
  }, skip: omitir);
}
