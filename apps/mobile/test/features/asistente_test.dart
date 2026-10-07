import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Dueño PREMIUM con el asistente respondiendo.
ServidorFalso servidorAsistente({String plan = 'PREMIUM', Map<String, dynamic>? respuesta}) => servidorBase(plan: plan)
  ..responder('POST', '/assistant/messages', RespuestaFalsa.creado(respuesta ?? respuestaAsistenteJson()))
  ..responder('GET', '/assistant/conversations', RespuestaFalsa.ok(conversacionesJson()))
  ..responder('GET', '/assistant/conversations/$idConversacion', RespuestaFalsa.ok(conversacionJson()));

Future<void> abrirAsistente(WidgetTester tester, ServidorFalso servidor) async {
  await levantar(tester, servidor, auth: authConSesion());
  await tocar(tester, 'Más');
  await tocar(tester, 'Asistente con IA');
}

Map<String, dynamic> cuerpo(ServidorFalso s, int i) =>
    jsonDecode(jsonEncode(s.pedidosA('POST', '/assistant/messages')[i].data)) as Map<String, dynamic>;

Finder botonEnviar() => find.widgetWithIcon(IconButton, Icons.send);

bool habilitado(WidgetTester tester, Finder f) => tester.widget<IconButton>(f).onPressed != null;

Future<void> escribirConsulta(WidgetTester tester, String texto) async {
  await tester.enterText(find.byType(TextField), texto);
  await tester.pump();
}

void main() {
  testWidgets('CP-M.12 pregunta sugerida: espera, respuesta y "Consulté: …"', (tester) async {
    final listo = Completer<void>();
    final servidor = servidorAsistente()..demoras['POST /assistant/messages'] = () => listo.future;
    await abrirAsistente(tester, servidor);

    expect(find.text('¿Qué querés saber?'), findsOneWidget);
    expect(find.textContaining('Las respuestas las genera un modelo de inteligencia artificial'), findsOneWidget);
    await tocar(tester, '¿Qué productos tengo que reponer?');

    expect(find.text('Consultando tus datos…'), findsOneWidget);
    expect(find.text('¿Qué productos tengo que reponer?'), findsOneWidget);
    expect(cuerpo(servidor, 0), {'mensaje': '¿Qué productos tengo que reponer?'});

    listo.complete();
    await bombear(tester);
    expect(find.text('Consultando tus datos…'), findsNothing);
    expect(find.text('Consulté: Alertas de reposición.'), findsOneWidget);
    expect(find.text('Tenés 2 productos para reponer:'), findsOneWidget);
  });

  testWidgets('CP-M.12b la respuesta se ve en párrafos y viñetas, sin asteriscos', (tester) async {
    final servidor = servidorAsistente(
      respuesta: respuestaAsistenteJson(
        mensaje: mensajeAsistenteJson(contenido: 'El más vendido fue **FA-220**.\n- Vendiste 30\n- Ganaste \$ 26.925'),
      ),
    );
    await abrirAsistente(tester, servidor);
    await escribirConsulta(tester, '¿Qué vendí?');
    await tester.tap(botonEnviar());
    await bombear(tester);

    expect(find.text('El más vendido fue FA-220.'), findsOneWidget);
    expect(find.text('Vendiste 30'), findsOneWidget);
    expect(find.text(r'Ganaste $ 26.925'), findsOneWidget);
    expect(find.textContaining('**'), findsNothing);
  });

  testWidgets('CP-M.12c la segunda consulta sigue la misma conversación', (tester) async {
    final servidor = servidorAsistente();
    await abrirAsistente(tester, servidor);
    await tocar(tester, '¿Qué fue lo que más vendí este mes?');
    await escribirConsulta(tester, '¿y el segundo?');
    await tester.tap(botonEnviar());
    await bombear(tester);

    expect(cuerpo(servidor, 0).containsKey('conversacionId'), isFalse);
    expect(cuerpo(servidor, 1), {'conversacionId': idConversacion, 'mensaje': '¿y el segundo?'});
    expect(find.text('¿y el segundo?'), findsOneWidget);
    expect(find.text('Consulté: Alertas de reposición.'), findsNWidgets(2));
  });

  testWidgets('CP-M.12d el contador y el botón respetan el largo', (tester) async {
    final servidor = servidorAsistente();
    await abrirAsistente(tester, servidor);

    expect(find.text('0 / 1.000'), findsOneWidget);
    expect(habilitado(tester, botonEnviar()), isFalse);
    await escribirConsulta(tester, '   ');
    expect(habilitado(tester, botonEnviar()), isFalse);
    await escribirConsulta(tester, 'a' * 1001);
    expect(find.text('1.001 / 1.000'), findsOneWidget);
    expect(habilitado(tester, botonEnviar()), isFalse);
    await escribirConsulta(tester, '¿Cómo vengo?');
    expect(habilitado(tester, botonEnviar()), isTrue);
    expect(servidor.pedidosA('POST', '/assistant/messages'), isEmpty);
  });

  testWidgets('un segundo toque mientras espera no repite la consulta', (tester) async {
    final listo = Completer<void>();
    final servidor = servidorAsistente()..demoras['POST /assistant/messages'] = () => listo.future;
    await abrirAsistente(tester, servidor);
    await escribirConsulta(tester, 'Hola');
    await tester.tap(botonEnviar());
    await tester.pump();
    await escribirConsulta(tester, 'Hola otra vez');
    expect(habilitado(tester, botonEnviar()), isFalse);
    await tester.tap(botonEnviar(), warnIfMissed: false);
    listo.complete();
    await bombear(tester);

    expect(servidor.pedidosA('POST', '/assistant/messages'), hasLength(1));
  });

  testWidgets('CP-M.12e una orden en borrador se muestra como borrador sin enviar', (tester) async {
    final servidor = servidorAsistente(
      respuesta: respuestaAsistenteJson(
        mensaje: mensajeAsistenteJson(
          contenido: 'Te dejé la orden en borrador.',
          fuentes: const [{'herramienta': 'preparar_orden', 'nombre': 'Orden en borrador'}],
          acciones: const [
            {'tipo': 'ORDEN_BORRADOR', 'ordenId': 'o1', 'numero': 'OC-0007', 'proveedor': 'Distribuidora Norte'},
          ],
        ),
      ),
    );
    await abrirAsistente(tester, servidor);
    await escribirConsulta(tester, 'Armame un pedido para Distribuidora Norte');
    await tester.tap(botonEnviar());
    await bombear(tester);

    expect(find.text('Orden OC-0007 para Distribuidora Norte'), findsOneWidget);
    expect(find.textContaining('Todavía no se envió'), findsOneWidget);
    expect(find.text('Consulté: Orden en borrador.'), findsOneWidget);

    // Tocar la tarjeta abre el detalle de esa orden (mobile-orders).
    servidor.responder('GET', '/purchase-orders/o1', RespuestaFalsa.ok(ordenJson(id: 'o1')));
    await tocar(tester, 'Orden OC-0007 para Distribuidora Norte');
    expect(servidor.pedidosA('GET', '/purchase-orders/o1'), hasLength(1));
    expect(find.textContaining('Borrador creado el'), findsOneWidget);
  });

  testWidgets('CP-M.12f historial: abrir una conversación y seguirla', (tester) async {
    final hoy = DateTime.now();
    final ayer = hoy.subtract(const Duration(days: 1));
    final servidor = servidorAsistente()
      ..responder(
        'GET',
        '/assistant/conversations',
        RespuestaFalsa.ok(conversacionesJson(items: [
          {'id': idConversacion, 'titulo': 'Reposición de hoy', 'creadoEn': hoy.toUtc().toIso8601String(), 'actualizadoEn': hoy.toUtc().toIso8601String()},
          {'id': idConversacion2, 'titulo': 'Ventas de ayer', 'creadoEn': ayer.toUtc().toIso8601String(), 'actualizadoEn': ayer.toUtc().toIso8601String()},
        ])),
      );
    await abrirAsistente(tester, servidor);
    await tester.tap(find.byTooltip('Conversaciones'));
    await bombear(tester);

    final titulos = tester.widgetList<ListTile>(find.byType(ListTile)).map((t) => (t.title as Text).data).toList();
    expect(titulos, ['Reposición de hoy', 'Ventas de ayer']);
    expect(find.textContaining('hoy '), findsOneWidget);
    expect(find.text('ayer'), findsOneWidget);

    await tocar(tester, 'Reposición de hoy');
    expect(servidor.pedidosA('GET', '/assistant/conversations/$idConversacion'), hasLength(1));
    expect(find.text('¿Qué productos tengo que reponer?'), findsOneWidget);
    expect(find.text('Consulté: Alertas de reposición.'), findsOneWidget);

    await escribirConsulta(tester, '¿Y para mañana?');
    await tester.tap(botonEnviar());
    await bombear(tester);
    expect(cuerpo(servidor, 0)['conversacionId'], idConversacion);
  });

  testWidgets('CP-M.12g "Nueva conversación" arranca de cero', (tester) async {
    final servidor = servidorAsistente();
    await abrirAsistente(tester, servidor);
    await tocar(tester, '¿Qué fue lo que más vendí este mes?');
    await tester.tap(find.byTooltip('Nueva conversación'));
    await bombear(tester);

    expect(find.text('¿Qué querés saber?'), findsOneWidget);
    await tocar(tester, '¿Cuál fue mi producto más rentable del mes?');
    expect(cuerpo(servidor, 1).containsKey('conversacionId'), isFalse);
  });

  testWidgets('"Cargar más" en las conversaciones', (tester) async {
    final servidor = servidorAsistente()
      ..manejar('GET', '/assistant/conversations', (req) => req.uri.queryParameters['cursor'] == 'c1'
          ? RespuestaFalsa.ok(conversacionesJson(items: [
              {'id': idConversacion2, 'titulo': 'Más vieja', 'creadoEn': '2026-09-01T12:00:00.000Z', 'actualizadoEn': '2026-09-01T12:00:00.000Z'},
            ]))
          : RespuestaFalsa.ok(conversacionesJson(siguienteCursor: 'c1')));
    await abrirAsistente(tester, servidor);
    await tester.tap(find.byTooltip('Conversaciones'));
    await bombear(tester);
    await tocar(tester, 'Cargar más');

    expect(find.text('¿Qué productos tengo que reponer?'), findsOneWidget);
    expect(find.text('Más vieja'), findsOneWidget);
    expect(find.text('Cargar más'), findsNothing);
  });

  testWidgets('CP-M.12h límite diario: el mensaje de la API y la consulta queda escrita', (tester) async {
    final servidor = servidorAsistente()
      ..responder(
        'POST',
        '/assistant/messages',
        RespuestaFalsa.error(429, 'LIMITE_ALCANZADO', 'Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.'),
      );
    await abrirAsistente(tester, servidor);
    await escribirConsulta(tester, '¿Cuánto gasté?');
    await tester.tap(botonEnviar());
    await bombear(tester);

    expect(find.text('Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, '¿Cuánto gasté?');
    expect(find.text('Consultando tus datos…'), findsNothing);
  });

  testWidgets('CP-M.12i asistente no disponible: la consulta queda escrita', (tester) async {
    final servidor = servidorAsistente()
      ..responder(
        'POST',
        '/assistant/messages',
        RespuestaFalsa.error(503, 'SERVICIO_NO_DISPONIBLE', 'El asistente no está disponible en este momento. Probá de nuevo en unos minutos.'),
      );
    await abrirAsistente(tester, servidor);
    await tocar(tester, '¿Qué productos tengo que reponer?');

    expect(find.textContaining('Tu consulta quedó escrita'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, '¿Qué productos tengo que reponer?');
  });

  testWidgets('CP-M.12j con plan PRO explica el PREMIUM y no consulta', (tester) async {
    final servidor = servidorAsistente(plan: 'PRO');
    await abrirAsistente(tester, servidor);

    expect(find.textContaining('Disponible en el plan PREMIUM'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(servidor.pedidos.where((p) => p.uri.path.contains('/assistant')), isEmpty);
  });

  testWidgets('CP-M.12k ningún pedido del asistente lleva el comercio ni el usuario', (tester) async {
    final servidor = servidorAsistente();
    await abrirAsistente(tester, servidor);
    await tocar(tester, '¿Qué productos tengo que reponer?');
    await tester.tap(find.byTooltip('Conversaciones'));
    await bombear(tester);
    await tocar(tester, '¿Qué productos tengo que reponer?');

    final pedidos = servidor.pedidos.where((p) => p.uri.path.contains('/assistant')).toList();
    expect(pedidos.length, greaterThanOrEqualTo(3));
    for (final p in pedidos) {
      final texto = '${p.uri} ${jsonEncode(p.data)}'.toLowerCase();
      expect(texto, isNot(contains('comercio')));
      expect(texto, isNot(contains('usuario')));
    }
  });
}
