import 'package:intl/intl.dart';

import 'modelos/asistente.dart';

/// Textos y reglas de pantalla del asistente (HU-08, design D1). Son copia de
/// `apps/web/src/lib/asistente-formato.ts`: si cambia una frase en la web, se cambia acá.

const asistenteMaxCaracteres = 1000;

/// Preguntas para empezar una conversación vacía (CP-08.6).
const preguntasSugeridas = [
  '¿Qué productos tengo que reponer?',
  '¿Qué fue lo que más vendí este mes?',
  '¿Cuál fue mi producto más rentable del mes?',
  '¿Cómo vienen mis precios frente a la inflación?',
  '¿Tengo plata parada en productos que no se venden?',
];

const avisoIa =
    'Las respuestas las genera un modelo de inteligencia artificial con los datos de tu comercio. '
    'Verificá los números importantes en su pantalla.';

const avisoPlanAsistente =
    'Disponible en el plan PREMIUM: preguntale al asistente por tus ventas, tu stock, tus márgenes y tus '
    'proveedores, y pedile que te prepare un pedido.';

/// Texto de la tarjeta de una orden en borrador. En la app todavía no hay pantalla de órdenes:
/// se confirma desde la web (RN-06).
const borradorSinEnviar = 'Borrador. Todavía no se envió: revisala y confirmala desde Órdenes en la web.';

final _entero = NumberFormat.decimalPattern('es_AR');

/// "120 / 1.000"
String contadorDeCaracteres(String texto) =>
    '${_entero.format(texto.length)} / ${_entero.format(asistenteMaxCaracteres)}';

bool excedeElLargo(String texto) => texto.trim().length > asistenteMaxCaracteres;

bool puedeEnviar(String texto, bool ocupado) => !ocupado && texto.trim().isNotEmpty && !excedeElLargo(texto);

/// "Consulté: Productos más rentables y Alertas de reposición."
String fraseFuentes(List<FuenteAsistente> fuentes) {
  final nombres = <String>[];
  for (final f in fuentes) {
    if (!nombres.contains(f.nombre)) nombres.add(f.nombre);
  }
  if (nombres.isEmpty) return '';
  final ultima = nombres.removeLast();
  return 'Consulté: ${nombres.isNotEmpty ? '${nombres.join(', ')} y $ultima' : ultima}.';
}

sealed class BloqueTexto {
  const BloqueTexto();
}

class Parrafo extends BloqueTexto {
  const Parrafo(this.texto);

  final String texto;

  @override
  bool operator ==(Object other) => other is Parrafo && other.texto == texto;

  @override
  int get hashCode => texto.hashCode;

  @override
  String toString() => 'Parrafo($texto)';
}

class Lista extends BloqueTexto {
  Lista(this.items);

  final List<String> items;

  @override
  bool operator ==(Object other) =>
      other is Lista && other.items.length == items.length && Iterable.generate(items.length).every((i) => other.items[i] == items[i]);

  @override
  int get hashCode => Object.hashAll(items);

  @override
  String toString() => 'Lista($items)';
}

final _negrita = RegExp(r'\*\*(.+?)\*\*');
final _titulo = RegExp(r'^#{1,6}\s+');
final _item = RegExp(r'^(?:[-•*]|\d+[.)])\s+(.*)$');

String _limpiar(String linea) => linea.replaceAllMapped(_negrita, (m) => m[1]!).replaceFirst(_titulo, '').trim();

/// Separa la respuesta en párrafos y listas. Todo se muestra como texto: sólo se quitan las
/// marcas de formato que el modelo pueda haber dejado.
List<BloqueTexto> bloquesDeTexto(String contenido) {
  final bloques = <BloqueTexto>[];
  for (final cruda in contenido.split(RegExp(r'\r?\n'))) {
    final linea = cruda.trim();
    if (linea.isEmpty) continue;
    final item = _item.firstMatch(linea);
    final ultimo = bloques.isEmpty ? null : bloques.last;
    if (item != null) {
      final texto = _limpiar(item[1] ?? '');
      if (ultimo is Lista) {
        ultimo.items.add(texto);
      } else {
        bloques.add(Lista([texto]));
      }
    } else {
      bloques.add(Parrafo(_limpiar(linea)));
    }
  }
  return bloques;
}

const _meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/// "hoy 14:32", "ayer" o "12 sept", según cuándo fue el último mensaje (hora local).
String fechaDeConversacion(String iso, [DateTime? ahora]) {
  final fecha = DateTime.tryParse(iso)?.toLocal();
  if (fecha == null) return iso;
  final hoy = (ahora ?? DateTime.now()).toLocal();
  DateTime medianoche(DateTime d) => DateTime(d.year, d.month, d.day);
  final dias = medianoche(hoy).difference(medianoche(fecha)).inHours / 24;
  String dos(int v) => v.toString().padLeft(2, '0');
  if (dias.round() <= 0) return 'hoy ${dos(fecha.hour)}:${dos(fecha.minute)}';
  if (dias.round() == 1) return 'ayer';
  return '${fecha.day} ${_meses[fecha.month - 1]}';
}

enum TonoAvisoAsistente { error, warn, plan }

class AvisoAsistente {
  const AvisoAsistente(this.tono, this.texto);

  final TonoAvisoAsistente tono;
  final String texto;

  @override
  bool operator ==(Object other) => other is AvisoAsistente && other.tono == tono && other.texto == texto;

  @override
  int get hashCode => Object.hash(tono, texto);

  @override
  String toString() => 'AvisoAsistente($tono, $texto)';
}

/// Aviso para un error al enviar: el límite y la falta del servicio no son fallas del usuario.
AvisoAsistente avisoDeError(int? status, String mensaje) {
  if (status == 402) return const AvisoAsistente(TonoAvisoAsistente.plan, avisoPlanAsistente);
  if (status == 429) {
    return AvisoAsistente(
      TonoAvisoAsistente.warn,
      mensaje.isNotEmpty ? mensaje : 'Llegaste al límite de consultas de hoy. Se renueva mañana.',
    );
  }
  if (status == 503) {
    return const AvisoAsistente(
      TonoAvisoAsistente.warn,
      'El asistente no está disponible en este momento. Tu consulta quedó escrita: probá de nuevo en unos minutos.',
    );
  }
  return AvisoAsistente(TonoAvisoAsistente.error, mensaje);
}
