import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // En Android la configuración sale de android/app/google-services.json.
  await Firebase.initializeApp();
  runApp(const ProviderScope(child: InventarioSmartApp()));
}

class InventarioSmartApp extends StatelessWidget {
  const InventarioSmartApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'InventarioSmart',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: appRouter,
    );
  }
}
