import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/features/health/health_screen.dart';

void main() {
  testWidgets('HealthScreen muestra el estado cuando la API responde', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          healthProvider.overrideWith(
            (ref) async => const Health(status: 'ok', db: 'ok', version: '0.1.0', timestamp: '2026-09-09T00:00:00Z'),
          ),
        ],
        child: const MaterialApp(home: HealthScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Estado del servicio'), findsOneWidget);
    expect(find.text('Base de datos'), findsOneWidget);
    expect(find.text('ok'), findsNWidgets(2));
  });

  testWidgets('HealthScreen muestra el error de la API', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          healthProvider.overrideWith((ref) async => throw Exception('sin red')),
        ],
        child: const MaterialApp(home: HealthScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No se pudo consultar la API'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });
}
