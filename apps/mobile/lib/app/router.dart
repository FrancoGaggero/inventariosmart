import 'package:go_router/go_router.dart';

import '../features/health/health_screen.dart';

/// Sprint 0: una sola pantalla. Login, dashboard, inventario y movimientos llegan en mobile-mvp.
final appRouter = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HealthScreen()),
  ],
);
