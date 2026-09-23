import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'core/auth/auth_repository.dart';
import 'core/auth/firebase_auth_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // En Android la configuración sale de android/app/google-services.json.
  await Firebase.initializeApp();
  runApp(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(FirebaseAuthRepository())],
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
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
