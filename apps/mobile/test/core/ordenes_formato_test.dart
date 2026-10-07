import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/modelos/ordenes.dart';
import 'package:inventariosmart_mobile/core/ordenes_formato.dart';

import '../fixtures.dart';

// Casos tomados de apps/web/src/lib/canales.test.ts (CP-16.5).

void main() {
  group('confirmación según el canal (CP-16.5)', () {
    const email = 'compras@sur.com';
    const whatsapp = '5491123456789';

    test('el botón dice por dónde sale', () {
      expect(textoConfirmar('EMAIL'), 'Confirmar y enviar por correo');
      expect(textoConfirmar('WHATSAPP'), 'Confirmar y enviar por WhatsApp');
      expect(textoConfirmar(null), 'Confirmar');
    });

    test('los canales disponibles salen de los datos cargados', () {
      expect(canalesDe(email: email, whatsapp: whatsapp), ['EMAIL', 'WHATSAPP']);
      expect(canalesDe(email: null, whatsapp: whatsapp), ['WHATSAPP']);
      expect(canalesDe(email: null, whatsapp: null), isEmpty);
    });

    test('explica qué pasa al confirmar', () {
      expect(avisoDeEnvio('EMAIL', email: email, whatsapp: whatsapp), contains('compras@sur.com'));
      expect(avisoDeEnvio('WHATSAPP', email: email, whatsapp: whatsapp), contains('+54 9 11 2345-6789'));
      expect(avisoDeEnvio('WHATSAPP', email: email, whatsapp: whatsapp), contains('Lo enviás vos'));
      expect(avisoDeEnvio(null, email: null, whatsapp: null), contains('otro medio'));
    });

    test('cuenta cómo salió una orden enviada', () {
      const fecha = '28 sept, 10:30';
      expect(
        fraseEnviada(canal: 'WHATSAPP', enviadaA: '011 15-2345-6789', fecha: fecha),
        'Enviada por WhatsApp a 011 15-2345-6789 el 28 sept, 10:30.',
      );
      expect(
        fraseEnviada(canal: 'EMAIL', enviadaA: 'compras@sur.com', fecha: fecha),
        'Enviada por correo a compras@sur.com el 28 sept, 10:30.',
      );
      expect(fraseEnviada(canal: 'OTRO', enviadaA: null, fecha: fecha), 'Marcada como enviada el 28 sept, 10:30.');
    });
  });

  test('formatearWhatsApp como shared', () {
    expect(formatearWhatsApp('5491123456789'), '+54 9 11 2345-6789');
    expect(formatearWhatsApp('5493512345678'), '+54 9 351 234-5678');
    expect(formatearWhatsApp('12025550123'), '+12025550123');
  });

  test('frase del estado, texto para copiar y aviso al confirmar', () {
    final borrador = OrdenCompra.fromJson(ordenJson());
    expect(fraseEstado(borrador), startsWith('Borrador creado el '));
    expect(fraseEstado(borrador), endsWith('Nada se envía hasta que confirmes.'));
    expect(textoParaCopiar(borrador), '${borrador.asunto}\n\n${borrador.texto}');

    final wa = OrdenCompra.fromJson(ordenJson(estado: 'CONFIRMADA', canal: 'WHATSAPP', conWhatsappUrl: true));
    expect(fraseEstado(wa), contains('por Ana'));
    expect(avisoConfirmada(wa), 'Orden OC-0007 confirmada. Abrí WhatsApp para enviarle el mensaje a Distribuidora Norte.');

    final sinCanal = OrdenCompra.fromJson(ordenJson(estado: 'CONFIRMADA', motivoNoEnvio: 'SIN_EMAIL'));
    expect(avisoConfirmada(sinCanal), contains('enviala por otro medio'));

    final enviada = OrdenCompra.fromJson(ordenJson(estado: 'ENVIADA', canal: 'WHATSAPP', enviadaA: '011 15-2345-6789'));
    expect(fraseEstado(enviada), startsWith('Enviada por WhatsApp a 011 15-2345-6789 el '));
    expect(cantidadDeItems(1), '1 ítem');
    expect(cantidadDeItems(3), '3 ítems');
  });
}
