import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/abrir_enlace.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Servidor con una orden que cambia de estado como la API (CP-07.x, CP-16.x).
class ServidorOrdenes {
  ServidorOrdenes({String rol = 'DUENIO', String plan = 'PRO', Map<String, dynamic>? orden})
      : servidor = servidorPro(rol: rol, plan: plan) {
    actual = orden ?? ordenJson();
    servidor
      ..manejar('GET', '/purchase-orders', (req) {
        final estado = req.uri.queryParameters['estado'];
        final todas = [
          ordenResumenJson(estado: actual['estado'] as String),
          ordenResumenJson(id: idOrden2, numero: 'OC-0006', estado: 'ENVIADA', proveedor: 'Lubricantes Sur', canal: 'WHATSAPP'),
        ];
        return RespuestaFalsa.ok({
          'items': [for (final o in todas) if (estado == null || estado == 'TODAS' || o['estado'] == estado) o],
          'siguienteCursor': null,
        });
      })
      ..manejar('GET', '/purchase-orders/$idOrden', (_) => RespuestaFalsa.ok(actual))
      ..manejar('PATCH', '/purchase-orders/$idOrden', (req) {
        if (actual['estado'] != 'BORRADOR') return conflicto;
        final pedidos = ((req.data as Map)['items'] as List).cast<Map>();
        actual = {
          ...actual,
          'items': [
            for (final p in pedidos)
              {
                ...(actual['items'] as List).cast<Map<String, dynamic>>().firstWhere((l) => (l['producto'] as Map)['id'] == p['productoId']),
                'cantidad': p['cantidad'],
              },
          ],
          'totalNeto': '24000.00',
        };
        return RespuestaFalsa.ok(actual);
      })
      ..manejar('POST', '/purchase-orders/$idOrden/confirm', (req) {
        if (actual['estado'] != 'BORRADOR') return conflicto;
        final canal = (req.data as Map?)?['canal'] ?? (actual['proveedor'] as Map)['canal'];
        actual = {
          ...actual,
          'estado': 'CONFIRMADA',
          'canal': canal,
          'confirmadaEn': '2026-10-06T13:00:00.000Z',
          'confirmadaPor': {'id': 'u1', 'nombre': 'Ana'},
          'whatsappUrl': canal == 'WHATSAPP' ? 'https://wa.me/5491123456789?text=OC-0007' : null,
          'motivoNoEnvio': canal == null ? 'SIN_EMAIL' : null,
        };
        return RespuestaFalsa.ok(actual);
      })
      ..manejar('POST', '/purchase-orders/$idOrden/mark-sent', (_) {
        actual = {
          ...actual,
          'estado': 'ENVIADA',
          'enviadaEn': '2026-10-06T14:00:00.000Z',
          'enviadaA': actual['canal'] == 'WHATSAPP' ? '011 15-2345-6789' : null,
          'canal': actual['canal'] ?? 'OTRO',
          'whatsappUrl': null,
        };
        return RespuestaFalsa.ok(actual);
      })
      ..manejar('POST', '/purchase-orders/$idOrden/cancel', (_) {
        actual = {...actual, 'estado': 'CANCELADA', 'canceladaEn': '2026-10-06T13:30:00.000Z'};
        return RespuestaFalsa.ok(actual);
      });
  }

  final ServidorFalso servidor;
  late Map<String, dynamic> actual;

  static final conflicto = RespuestaFalsa.error(409, 'CONFLICTO', 'Sólo se puede modificar una orden en borrador.');

  Map<String, dynamic> cuerpo(String metodo, String ruta) =>
      jsonDecode(jsonEncode(servidor.pedidosA(metodo, ruta).last.data ?? {})) as Map<String, dynamic>;
}

final abiertos = <Uri>[];

Future<void> abrirOrden(WidgetTester tester, ServidorOrdenes s) async {
  abiertos.clear();
  await levantar(
    tester,
    s.servidor,
    auth: authConSesion(),
    extra: [
      abrirEnlaceProvider.overrideWithValue((uri) async {
        abiertos.add(uri);
        return true;
      }),
    ],
  );
  await ir(tester, '/mas/ordenes/$idOrden');
}

/// Botón de Material (lleno, con borde o de texto) por su etiqueta.
Finder boton(String texto) =>
    find.ancestor(of: find.text(texto), matching: find.byWidgetPredicate((w) => w is ButtonStyleButton)).first;

bool habilitado(WidgetTester tester, String texto) => tester.widget<ButtonStyleButton>(boton(texto)).onPressed != null;

Future<void> tocarBoton(WidgetTester tester, String texto) async {
  final f = boton(texto);
  await tester.ensureVisible(f);
  await tester.tap(f);
  await bombear(tester);
}

void main() {
  testWidgets('CP-M.13 listado por estado', (tester) async {
    final s = ServidorOrdenes();
    await levantar(tester, s.servidor, auth: authConSesion());
    await tocar(tester, 'Más');
    await tocar(tester, 'Órdenes de compra');

    expect(find.text('OC-0007'), findsOneWidget);
    expect(find.text('OC-0006'), findsOneWidget);
    expect(find.textContaining('2 ítems ·'), findsNWidgets(2));
    expect(find.text(r'$ 128.000,00'), findsNWidgets(2));

    await tocar(tester, 'Borradores');
    expect(s.servidor.pedidosA('GET', '/purchase-orders').last.uri.queryParameters['estado'], 'BORRADOR');
    expect(find.text('OC-0007'), findsOneWidget);
    expect(find.text('OC-0006'), findsNothing);

    await tocar(tester, 'OC-0007');
    expect(find.textContaining('Borrador creado el'), findsOneWidget);
  });

  testWidgets('CP-M.13b detalle con costo a confirmar, total y mensaje', (tester) async {
    final s = ServidorOrdenes(orden: ordenJson(costoAConfirmar: true));
    await abrirOrden(tester, s);

    expect(find.text('Distribuidora Norte'), findsOneWidget);
    expect(find.text('WhatsApp +54 9 11 2345-6789'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.textContaining('costo a confirmar'), findsOneWidget);
    expect(find.text('Total neto estimado (sin IVA)'), findsOneWidget);
    expect(find.text(r'$ 48.000,00'), findsOneWidget);
    expect(find.text('Orden de compra OC-0007 · Repuestos Carlos'), findsOneWidget);
    // En borrador no se copia: el texto todavía puede cambiar.
    expect(find.text('Copiar texto'), findsNothing);
  });

  testWidgets('CP-M.13c editar cantidades y quitar una línea', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);

    expect(habilitado(tester, 'Guardar'), isFalse);
    await tester.enterText(find.widgetWithText(TextField, 'Cantidad').first, '15');
    await tester.pump();
    await tester.tap(find.byTooltip('Quitar').last);
    await tester.pump();
    // Con una sola línea no se puede quitar más: se cancela el borrador.
    expect(tester.widget<IconButton>(find.widgetWithIcon(IconButton, Icons.delete_outline)).onPressed, isNull);
    await tocarBoton(tester, 'Guardar');

    expect(s.cuerpo('PATCH', '/purchase-orders/$idOrden'), {
      'items': [
        {'productoId': idProducto, 'cantidad': 15, 'alertaId': idAlerta},
      ],
    });
    expect(find.text('Borrador guardado.'), findsOneWidget);
    expect(find.text(r'$ 24.000,00'), findsOneWidget);
  });

  testWidgets('una cantidad inválida deshabilita guardar y confirmar', (tester) async {
    await abrirOrden(tester, ServidorOrdenes());
    await tester.enterText(find.widgetWithText(TextField, 'Cantidad').first, '0');
    await tester.pump();

    expect(find.text('Entre 1 y 1.000.000'), findsOneWidget);
    expect(habilitado(tester, 'Guardar'), isFalse);
    expect(habilitado(tester, 'Confirmar y enviar por WhatsApp'), isFalse);
  });

  testWidgets('CP-M.13d / CP-M.13e confirmar por WhatsApp, abrirlo y marcar enviada', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);

    expect(find.textContaining('Al confirmar vas a poder abrir WhatsApp'), findsOneWidget);
    await tocarBoton(tester, 'Confirmar y enviar por WhatsApp');
    // El canal es el del proveedor: no se manda si el dueño no lo eligió.
    expect(s.cuerpo('POST', '/purchase-orders/$idOrden/confirm'), isEmpty);
    expect(find.text('Orden OC-0007 confirmada. Abrí WhatsApp para enviarle el mensaje a Distribuidora Norte.'), findsOneWidget);
    expect(find.textContaining('Falta enviarla'), findsOneWidget);
    expect(abiertos, isEmpty);

    await tocarBoton(tester, 'Abrir WhatsApp');
    expect(abiertos.single.toString(), 'https://wa.me/5491123456789?text=OC-0007');

    await tocarBoton(tester, 'Ya la envié');
    expect(s.servidor.pedidosA('POST', '/purchase-orders/$idOrden/mark-sent'), hasLength(1));
    expect(find.text('Orden OC-0007 marcada como enviada.'), findsOneWidget);
    expect(find.textContaining('Enviada por WhatsApp a 011 15-2345-6789 el'), findsOneWidget);
  });

  testWidgets('CP-M.13d con cambios sin guardar, primero guarda y después confirma', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);
    await tester.enterText(find.widgetWithText(TextField, 'Cantidad').first, '30');
    await tester.pump();
    await tocarBoton(tester, 'Confirmar y enviar por WhatsApp');

    final metodos = s.servidor.pedidos.where((p) => p.uri.path.contains('/purchase-orders/$idOrden')).map((p) => '${p.method} ${p.uri.path.split('/').last}');
    expect(metodos.toList().indexOf('PATCH $idOrden'), lessThan(metodos.toList().indexOf('POST confirm')));
  });

  testWidgets('CP-M.13f elegir correo cuando el proveedor tiene los dos canales', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);
    await tocar(tester, 'Correo');

    expect(find.textContaining('Al confirmar se envía por correo a compras@norte.com'), findsOneWidget);
    await tocarBoton(tester, 'Confirmar y enviar por correo');
    expect(s.cuerpo('POST', '/purchase-orders/$idOrden/confirm'), {'canal': 'EMAIL'});
  });

  testWidgets('CP-M.13g proveedor sin canal: copiar texto y ya la envié', (tester) async {
    final copiado = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copiado.add((call.arguments as Map)['text'] as String);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    final s = ServidorOrdenes(
      orden: ordenJson(proveedorConEmail: false, proveedorConWhatsapp: false, canalProveedor: null),
    );
    await abrirOrden(tester, s);

    expect(find.textContaining('Este proveedor no tiene email ni WhatsApp'), findsOneWidget);
    await tocarBoton(tester, 'Confirmar');
    expect(find.textContaining('enviala por otro medio'), findsWidgets);
    expect(find.text('Abrir WhatsApp'), findsNothing);

    await tocarBoton(tester, 'Copiar texto');
    expect(copiado.single, startsWith('Orden de compra OC-0007 · Repuestos Carlos\n\nHola Marta'));
    expect(find.text('Texto copiado. Pegalo en WhatsApp o en tu correo.'), findsOneWidget);
    await tocarBoton(tester, 'Ya la envié');
    expect(find.textContaining('Marcada como enviada el'), findsOneWidget);
  });

  testWidgets('CP-M.13h cancelar el borrador con confirmación', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);
    await tocarBoton(tester, 'Cancelar borrador');
    expect(find.text('¿Cancelar la orden OC-0007? Se conserva como cancelada.'), findsOneWidget);

    await tocar(tester, 'Volver');
    expect(s.servidor.pedidosA('POST', '/purchase-orders/$idOrden/cancel'), isEmpty);

    await tocarBoton(tester, 'Cancelar borrador');
    await tocar(tester, 'Cancelar orden');
    expect(s.servidor.pedidosA('POST', '/purchase-orders/$idOrden/cancel'), hasLength(1));
    expect(find.text('Órdenes de compra'), findsOneWidget);
  });

  testWidgets('CP-M.13i el contador consulta sin acciones y puede copiar una confirmada', (tester) async {
    final s = ServidorOrdenes(rol: 'CONTADOR');
    await abrirOrden(tester, s);
    expect(find.text('Guardar'), findsNothing);
    expect(find.textContaining('Confirmar'), findsNothing);
    expect(find.text('Cancelar borrador'), findsNothing);
    expect(find.widgetWithText(TextField, 'Cantidad'), findsNothing);

    s.actual = ordenJson(estado: 'CONFIRMADA', canal: 'WHATSAPP', conWhatsappUrl: true);
    await ir(tester, '/mas/ordenes');
    await ir(tester, '/mas/ordenes/$idOrden');
    expect(find.text('Copiar texto'), findsOneWidget);
    expect(find.text('Ya la envié'), findsNothing);
    expect(find.text('Abrir WhatsApp'), findsNothing);
  });

  testWidgets('CP-M.13j si otra persona ya la confirmó, muestra el mensaje y recarga', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);
    s.actual = ordenJson(estado: 'CONFIRMADA', canal: 'WHATSAPP', conWhatsappUrl: true);
    await tocarBoton(tester, 'Confirmar y enviar por WhatsApp');

    expect(find.text('Sólo se puede modificar una orden en borrador.'), findsOneWidget);
    expect(find.textContaining('Confirmada el'), findsOneWidget);
    expect(find.text('Abrir WhatsApp'), findsOneWidget);
  });

  testWidgets('CP-M.13k en FREE explica el plan y no consulta las órdenes', (tester) async {
    final s = ServidorOrdenes(plan: 'FREE');
    await levantar(tester, s.servidor, auth: authConSesion());
    await tocar(tester, 'Más');
    await tocar(tester, 'Órdenes de compra');

    expect(find.textContaining('Disponible en el plan PRO, junto con las alertas'), findsOneWidget);
    expect(s.servidor.pedidosA('GET', '/purchase-orders'), isEmpty);
  });

  testWidgets('CP-M.13l ningún pedido de órdenes lleva el comercio', (tester) async {
    final s = ServidorOrdenes();
    await abrirOrden(tester, s);
    await tocarBoton(tester, 'Confirmar y enviar por WhatsApp');
    final pedidos = s.servidor.pedidos.where((p) => p.uri.path.contains('/purchase-orders')).toList();
    expect(pedidos, isNotEmpty);
    for (final p in pedidos) {
      expect('${p.uri} ${jsonEncode(p.data)}'.toLowerCase(), isNot(contains('comercio')));
    }
  });
}
