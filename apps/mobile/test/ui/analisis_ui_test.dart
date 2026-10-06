import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/app/theme.dart';
import 'package:inventariosmart_mobile/ui/analisis_ui.dart';
import 'package:inventariosmart_mobile/ui/imagen_animada.dart';

/// Nombre del asset de la primera imagen en pantalla.
String? assetMostrado(WidgetTester tester) {
  final imagenes = tester.widgetList<Image>(find.byType(Image));
  if (imagenes.isEmpty) return null;
  return (imagenes.first.image as AssetImage).assetName;
}

Future<void> montar(WidgetTester tester, Widget hijo, {Brightness brillo = Brightness.dark, bool sinAnimaciones = false}) =>
    tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(brillo),
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: sinAnimaciones),
          child: Scaffold(body: hijo),
        ),
      ),
    );

void main() {
  test('rutaAnimacion arma el nombre por tema y movimiento', () {
    expect(rutaAnimacion('vacio-cajas', Brightness.dark), 'assets/animaciones/vacio-cajas-oscuro.webp');
    expect(rutaAnimacion('vacio-cajas', Brightness.light), 'assets/animaciones/vacio-cajas-claro.webp');
    expect(rutaAnimacion('bienvenida', Brightness.light, quieta: true), 'assets/animaciones/bienvenida-claro.png');
  });

  testWidgets('Vacio con ilustración muestra la animación del tema (ADR 0025)', (tester) async {
    await montar(tester, const Vacio(titulo: 'Nada', texto: 'Nada por acá.', ilustracion: 'campana'));
    expect(assetMostrado(tester), 'assets/animaciones/vacio-campana-oscuro.webp');
    expect(find.byIcon(Icons.check_circle_outline), findsNothing);

    await montar(tester, const Vacio(titulo: 'Nada', texto: 'Nada por acá.', ilustracion: 'campana'), brillo: Brightness.light);
    // MaterialApp anima el cambio de tema; los tokens cambian a mitad de la transición.
    await tester.pump(const Duration(milliseconds: 300));
    expect(assetMostrado(tester), 'assets/animaciones/vacio-campana-claro.webp');
  });

  testWidgets('con "quitar animaciones" del sistema muestra el PNG fijo', (tester) async {
    await montar(tester, const Vacio(titulo: 'Nada', texto: '.', ilustracion: 'recibo'), sinAnimaciones: true);
    expect(assetMostrado(tester), 'assets/animaciones/vacio-recibo-oscuro.png');
  });

  testWidgets('sin ilustración, o si el archivo no existe, se ve el ícono', (tester) async {
    await montar(tester, const Vacio(titulo: 'Nada', texto: '.'));
    expect(find.byType(Image), findsNothing);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);

    await montar(tester, const Vacio(titulo: 'Nada', texto: '.', ilustracion: 'no-existe'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
  });

  test('los archivos de las seis ilustraciones y la bienvenida están en los assets', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    for (final n in ['vacio-cajas', 'vacio-campana', 'vacio-carrito', 'vacio-camion', 'vacio-recibo', 'vacio-flechas', 'bienvenida']) {
      for (final b in Brightness.values) {
        for (final quieta in [false, true]) {
          final datos = await rootBundle.load(rutaAnimacion(n, b, quieta: quieta));
          expect(datos.lengthInBytes, greaterThan(1000), reason: '$n $b $quieta');
        }
      }
    }
  });
}
