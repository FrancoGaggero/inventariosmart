import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../auth_falso.dart';
import '../dio_falso.dart';

void main() {
  testWidgets('CP-M.1 login con email lleva al inicio del comercio', (tester) async {
    final auth = AuthRepositoryFalso();
    await levantar(tester, servidorBase(), auth: auth);

    expect(find.text('Ingresá a tu comercio'), findsOneWidget);
    await escribir(tester, 'Email', 'ana@ejemplo.com');
    await escribir(tester, 'Contraseña', 'secreto123');
    await tocar(tester, 'Ingresar');

    expect(auth.llamadas, contains('email:ana@ejemplo.com'));
    expect(find.text('Repuestos Carlos'), findsOneWidget);
    expect(enInicio(), findsOneWidget);
  });

  testWidgets('CP-M.1c Google sin configurar muestra el mensaje y deja el email como camino', (tester) async {
    final auth = AuthRepositoryFalso(fallaGoogle: 'google-sin-configurar');
    await levantar(tester, servidorBase(), auth: auth);

    await tocar(tester, 'Continuar con Google');

    expect(find.textContaining('Google no está disponible en esta instalación'), findsOneWidget);
    expect(find.text('Ingresá a tu comercio'), findsOneWidget);
  });

  testWidgets('CP-M.1d credenciales inválidas', (tester) async {
    final auth = AuthRepositoryFalso(fallaEmail: 'invalid-credential');
    await levantar(tester, servidorBase(), auth: auth);

    await escribir(tester, 'Email', 'ana@ejemplo.com');
    await escribir(tester, 'Contraseña', 'incorrecta1');
    await tocar(tester, 'Ingresar');

    expect(find.text('El email o la contraseña no son correctos.'), findsOneWidget);
    expect(find.text('Ingresá a tu comercio'), findsOneWidget);
  });

  testWidgets('la validación local frena contraseñas cortas sin llamar a Firebase', (tester) async {
    final auth = AuthRepositoryFalso();
    await levantar(tester, servidorBase(), auth: auth);

    await escribir(tester, 'Email', 'ana@ejemplo.com');
    await escribir(tester, 'Contraseña', '123');
    await tocar(tester, 'Ingresar');

    expect(find.text('La contraseña tiene que tener al menos 8 caracteres.'), findsOneWidget);
    expect(auth.llamadas, isEmpty);
  });

  testWidgets('CP-M.1e crear cuenta lleva al onboarding del comercio', (tester) async {
    final auth = AuthRepositoryFalso();
    await levantar(tester, servidorBase(onboardingPendiente: true), auth: auth);

    await tocar(tester, 'No tengo cuenta: crear cuenta');
    expect(find.text('Creá tu cuenta'), findsOneWidget);
    await escribir(tester, 'Tu nombre', 'Ana');
    await escribir(tester, 'Email', 'ana@ejemplo.com');
    await escribir(tester, 'Contraseña', 'secreto123');
    await escribir(tester, 'Repetí la contraseña', 'secreto123');
    await tocar(tester, 'Crear cuenta');

    expect(auth.llamadas, contains('crear:ana@ejemplo.com'));
    expect(find.text('¿Cómo se llama tu comercio?'), findsOneWidget);
  });

  testWidgets('CP-M.1f con sesión guardada la app abre directo en el inicio', (tester) async {
    await levantar(tester, servidorBase(), auth: authConSesion());

    expect(find.text('Ingresá a tu comercio'), findsNothing);
    expect(enInicio(), findsOneWidget);
  });

  testWidgets('CP-M.1h cerrar sesión vuelve al login', (tester) async {
    final auth = authConSesion();
    await levantar(tester, servidorBase(), auth: auth);

    await tester.tap(find.byTooltip('Cuenta'));
    await bombear(tester);
    await tocar(tester, 'Cerrar sesión');

    expect(auth.llamadas, contains('cerrar'));
    expect(find.text('Ingresá a tu comercio'), findsOneWidget);
  });

  testWidgets('CP-M.1i acceso dado de baja: vuelve al login con el motivo', (tester) async {
    final servidor = servidorBase()..responder('GET', '/me', RespuestaFalsa.error(403, 'SIN_PERMISO', 'Usuario inactivo.'));
    await levantar(tester, servidor, auth: authConSesion());

    expect(find.text('Ingresá a tu comercio'), findsOneWidget);
    expect(find.textContaining('Tu acceso no está vigente'), findsOneWidget);
  });
}
