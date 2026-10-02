import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/asistente_formato.dart';
import 'package:inventariosmart_mobile/core/modelos/asistente.dart';

// Casos tomados de apps/web/src/lib/asistente-formato.test.ts.

FuenteAsistente f(String nombre) => FuenteAsistente(herramienta: 'x', nombre: nombre);

void main() {
  group('campo de la consulta', () {
    test('cuenta los caracteres contra el máximo', () {
      expect(contadorDeCaracteres(''), '0 / 1.000');
      expect(contadorDeCaracteres('a' * 1000), '1.000 / 1.000');
      expect(contadorDeCaracteres('a' * 1001), '1.001 / 1.000');
    });

    test('se puede enviar si hay texto, no supera el máximo y no hay otra consulta en curso', () {
      expect(puedeEnviar('¿Qué tengo que reponer?', false), isTrue);
      expect(puedeEnviar('   ', false), isFalse);
      expect(puedeEnviar('hola', true), isFalse);
      expect(puedeEnviar('a' * 1001, false), isFalse);
      expect(excedeElLargo('  ${'a' * 1000}  '), isFalse);
      expect(excedeElLargo('a' * 1001), isTrue);
    });

    test('ofrece cinco preguntas para empezar', () {
      expect(preguntasSugeridas, hasLength(5));
      expect(preguntasSugeridas, contains('¿Qué fue lo que más vendí este mes?'));
      expect(preguntasSugeridas, contains('¿Qué productos tengo que reponer?'));
      expect(preguntasSugeridas, contains('¿Tengo plata parada en productos que no se venden?'));
    });
  });

  group('fuentes de una respuesta', () {
    test('las nombra en una frase, sin repetir', () {
      expect(fraseFuentes([]), '');
      expect(fraseFuentes([f('Productos')]), 'Consulté: Productos.');
      expect(
        fraseFuentes([f('Proveedores'), f('Productos'), f('Productos'), f('Orden en borrador')]),
        'Consulté: Proveedores, Productos y Orden en borrador.',
      );
    });
  });

  group('texto de la respuesta', () {
    test('separa párrafos y listas', () {
      expect(
        bloquesDeTexto(
          'Tenés 2 productos para reponer:\n\n- Filtro FA-220: quedan 3\n- Aceite 5W-30: sin stock\n\nTe conviene pedirlos hoy.',
        ),
        [
          const Parrafo('Tenés 2 productos para reponer:'),
          Lista(['Filtro FA-220: quedan 3', 'Aceite 5W-30: sin stock']),
          const Parrafo('Te conviene pedirlos hoy.'),
        ],
      );
    });

    test('quita las marcas de formato y acepta listas numeradas', () {
      expect(bloquesDeTexto('## Resumen\n**FA-220** fue el mejor.\n1. Uno\n2) Dos'), [
        const Parrafo('Resumen'),
        const Parrafo('FA-220 fue el mejor.'),
        Lista(['Uno', 'Dos']),
      ]);
      expect(bloquesDeTexto('  \n '), isEmpty);
      expect(bloquesDeTexto('• Uno\r\n* Dos'), [Lista(['Uno', 'Dos'])]);
    });

    test('el código HTML queda como texto', () {
      expect(bloquesDeTexto('<img src=x onerror=alert(1)>'), [const Parrafo('<img src=x onerror=alert(1)>')]);
    });
  });

  group('fecha de una conversación', () {
    final ahora = DateTime(2026, 10, 2, 15, 0);

    test('hoy con la hora, ayer, y antes con el día', () {
      expect(fechaDeConversacion(DateTime(2026, 10, 2, 9, 5).toUtc().toIso8601String(), ahora), 'hoy 09:05');
      expect(fechaDeConversacion(DateTime(2026, 10, 1, 23, 59).toUtc().toIso8601String(), ahora), 'ayer');
      expect(fechaDeConversacion(DateTime(2026, 10, 2, 14, 32).toUtc().toIso8601String(), ahora), 'hoy 14:32');
      expect(fechaDeConversacion(DateTime(2026, 9, 12, 10, 0).toUtc().toIso8601String(), ahora), '12 sept');
    });
  });

  group('avisos al enviar', () {
    test('distingue el plan, el límite diario y la falta del servicio de un error', () {
      expect(
        avisoDeError(402, 'Esta función está disponible a partir del plan PREMIUM.'),
        const AvisoAsistente(TonoAvisoAsistente.plan, avisoPlanAsistente),
      );
      expect(
        avisoDeError(429, 'Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.'),
        const AvisoAsistente(
          TonoAvisoAsistente.warn,
          'Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.',
        ),
      );
      expect(avisoDeError(429, '').texto, 'Llegaste al límite de consultas de hoy. Se renueva mañana.');
      expect(avisoDeError(503, 'x').tono, TonoAvisoAsistente.warn);
      expect(avisoDeError(503, 'x').texto, contains('Tu consulta quedó escrita'));
      expect(
        avisoDeError(404, 'No encontramos esa conversación.'),
        const AvisoAsistente(TonoAvisoAsistente.error, 'No encontramos esa conversación.'),
      );
      expect(avisoDeError(null, 'Sin conexión.').tono, TonoAvisoAsistente.error);
    });
  });
}
