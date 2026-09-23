/// Respuesta de GET /api/v1/me (HU-11).
library;

const roles = ['DUENIO', 'EMPLEADO', 'CONTADOR'];

const nombreRol = <String, String>{
  'DUENIO': 'Dueño',
  'EMPLEADO': 'Empleado',
  'CONTADOR': 'Contador',
};

class Comercio {
  const Comercio({
    required this.id,
    required this.nombre,
    required this.cuit,
    required this.plan,
    required this.ivaDefault,
    required this.moneda,
    required this.onboardingPendiente,
  });

  final String id;
  final String nombre;
  final String? cuit;
  final String plan;
  final String ivaDefault;
  final String moneda;
  final bool onboardingPendiente;

  factory Comercio.fromJson(Map<String, dynamic> json) => Comercio(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        cuit: json['cuit'] as String?,
        plan: json['plan'] as String,
        ivaDefault: json['ivaDefault'] as String,
        moneda: json['moneda'] as String,
        onboardingPendiente: json['onboardingPendiente'] as bool,
      );
}

class Usuario {
  const Usuario({
    required this.id,
    required this.email,
    required this.nombre,
    required this.rol,
    required this.activo,
    required this.estado,
  });

  final String id;
  final String email;
  final String? nombre;
  final String rol;
  final bool activo;
  final String estado;

  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
        id: json['id'] as String,
        email: json['email'] as String,
        nombre: json['nombre'] as String?,
        rol: json['rol'] as String,
        activo: json['activo'] as bool,
        estado: json['estado'] as String,
      );
}

class Me {
  const Me({
    required this.usuario,
    required this.comercio,
    required this.rol,
    required this.plan,
    required this.onboardingPendiente,
  });

  final Usuario usuario;
  final Comercio comercio;
  final String rol;
  final String plan;
  final bool onboardingPendiente;

  bool get esDuenio => rol == 'DUENIO';
  bool get esEmpleado => rol == 'EMPLEADO';
  bool get esContador => rol == 'CONTADOR';

  /// Pestañas visibles según el rol (D4).
  bool get vePanel => esDuenio || esContador;
  bool get veInventario => esDuenio || esEmpleado;
  bool get registraMovimientos => esDuenio || esEmpleado;

  factory Me.fromJson(Map<String, dynamic> json) => Me(
        usuario: Usuario.fromJson(json['usuario'] as Map<String, dynamic>),
        comercio: Comercio.fromJson(json['comercio'] as Map<String, dynamic>),
        rol: json['rol'] as String,
        plan: json['plan'] as String,
        onboardingPendiente: json['onboardingPendiente'] as bool,
      );
}
