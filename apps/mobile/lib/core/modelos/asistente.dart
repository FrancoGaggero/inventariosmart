/// Respuestas de `/assistant/messages` y `/assistant/conversations` (HU-08, design D2).
library;

class FuenteAsistente {
  const FuenteAsistente({required this.herramienta, required this.nombre});

  final String herramienta;
  final String nombre;

  factory FuenteAsistente.fromJson(Map<String, dynamic> j) =>
      FuenteAsistente(herramienta: j['herramienta'] as String, nombre: j['nombre'] as String);
}

/// Una orden de compra que el asistente dejó en BORRADOR (preparar_orden).
class AccionAsistente {
  const AccionAsistente({required this.tipo, required this.ordenId, required this.numero, required this.proveedor});

  final String tipo;
  final String ordenId;
  final String numero;
  final String proveedor;

  /// null para un tipo que esta versión de la app no conoce.
  static AccionAsistente? fromJson(Map<String, dynamic> j) {
    if (j['tipo'] != 'ORDEN_BORRADOR') return null;
    return AccionAsistente(
      tipo: j['tipo'] as String,
      ordenId: j['ordenId'] as String,
      numero: j['numero'] as String,
      proveedor: j['proveedor'] as String,
    );
  }
}

class MensajeAsistente {
  const MensajeAsistente({
    required this.id,
    required this.rol,
    required this.contenido,
    this.fuentes = const [],
    this.acciones = const [],
    required this.creadoEn,
  });

  final String id;

  /// USUARIO o ASISTENTE.
  final String rol;
  final String contenido;
  final List<FuenteAsistente> fuentes;
  final List<AccionAsistente> acciones;
  final String creadoEn;

  bool get esDelUsuario => rol == 'USUARIO';

  factory MensajeAsistente.fromJson(Map<String, dynamic> j) => MensajeAsistente(
        id: j['id'] as String,
        rol: j['rol'] as String,
        contenido: j['contenido'] as String,
        fuentes: ((j['fuentes'] as List<dynamic>?) ?? const [])
            .map((e) => FuenteAsistente.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        acciones: ((j['acciones'] as List<dynamic>?) ?? const [])
            .map((e) => AccionAsistente.fromJson(e as Map<String, dynamic>))
            .whereType<AccionAsistente>()
            .toList(growable: false),
        creadoEn: j['creadoEn'] as String,
      );
}

class RespuestaAsistente {
  const RespuestaAsistente({required this.conversacionId, required this.mensaje});

  final String conversacionId;
  final MensajeAsistente mensaje;

  factory RespuestaAsistente.fromJson(Map<String, dynamic> j) => RespuestaAsistente(
        conversacionId: j['conversacionId'] as String,
        mensaje: MensajeAsistente.fromJson(j['mensaje'] as Map<String, dynamic>),
      );
}

class ConversacionResumen {
  const ConversacionResumen({required this.id, required this.titulo, required this.actualizadoEn});

  final String id;
  final String titulo;
  final String actualizadoEn;

  factory ConversacionResumen.fromJson(Map<String, dynamic> j) => ConversacionResumen(
        id: j['id'] as String,
        titulo: j['titulo'] as String,
        actualizadoEn: j['actualizadoEn'] as String,
      );
}

class ConversacionDetalle {
  const ConversacionDetalle({required this.id, required this.titulo, required this.mensajes});

  final String id;
  final String titulo;
  final List<MensajeAsistente> mensajes;

  factory ConversacionDetalle.fromJson(Map<String, dynamic> j) => ConversacionDetalle(
        id: j['id'] as String,
        titulo: j['titulo'] as String,
        mensajes: (j['mensajes'] as List<dynamic>)
            .map((e) => MensajeAsistente.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );
}
