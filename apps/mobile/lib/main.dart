import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/router.dart';
import 'app/tema_provider.dart';
import 'app/theme.dart';
import 'core/auth/auth_repository.dart';
import 'core/auth/firebase_auth_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // En Android la configuración sale de android/app/google-services.json.
  await Firebase.initializeApp();
  final preferencias = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(FirebaseAuthRepository()),
        preferenciasProvider.overrideWithValue(preferencias),
      ],
      // Sin reintentos automáticos: cada pantalla ofrece "Reintentar" (CP-M.5).
      retry: (_, _) => null,
      child: const InventarioSmartApp(),
    ),
  );
}

class InventarioSmartApp extends ConsumerWidget {
  const InventarioSmartApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'InventarioSmart',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ref.watch(temaProvider).modo,
      routerConfig: ref.watch(routerProvider),
      // Barras del sistema acordes al tema aplicado, también si el sistema cambia con la app abierta (D3).
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: estiloBarras(context.tokens),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
