import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/api_client.dart';
import '../../core/config.dart';

/// Respuesta de GET /api/v1/health.
class Health {
  const Health({required this.status, required this.db, required this.version, required this.timestamp});

  final String status;
  final String db;
  final String version;
  final String timestamp;

  factory Health.fromJson(Map<String, dynamic> json) => Health(
        status: json['status'] as String,
        db: json['db'] as String,
        version: json['version'] as String,
        timestamp: json['timestamp'] as String,
      );
}

final healthProvider = FutureProvider.autoDispose<Health>((ref) async {
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/health');
    return Health.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});

/// Sprint 0: prueba de humo. Muestra el estado de la API y de la base.
class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final health = ref.watch(healthProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      gradient: const LinearGradient(colors: [AppColors.brand, Color(0xFF8B5CF6)]),
                    ),
                    child: const Icon(Icons.bar_chart_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 10),
                  const Text('InventarioSmart', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 28),
              const Text('Estado del servicio', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('GET ${AppConfig.apiUrl}${AppConfig.apiPrefix}/health',
                  style: const TextStyle(color: AppColors.t2, fontSize: 12, fontFamily: 'monospace')),
              const SizedBox(height: 20),
              Expanded(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: health.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: CircularProgressIndicator(),
                    ),
                    error: (err, _) => _ErrorCard(
                      message: err is ApiException ? err.message : 'Error inesperado: $err',
                      onRetry: () => ref.invalidate(healthProvider),
                    ),
                    data: (h) => _HealthCard(health: h, onRefresh: () => ref.invalidate(healthProvider)),
                  ),
                ),
              ),
              const Text('Sprint 0 · login, dashboard, inventario y movimientos llegan en mobile-mvp.',
                  style: TextStyle(color: AppColors.t3, fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }
}

class _HealthCard extends StatelessWidget {
  const _HealthCard({required this.health, required this.onRefresh});

  final Health health;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _Row('API', health.status, ok: health.status == 'ok'),
            _Row('Base de datos', health.db, ok: health.db == 'ok'),
            _Row('Versión', health.version),
            _Row('Hora del servidor', health.timestamp),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Volver a consultar'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline, color: AppColors.crit),
                SizedBox(width: 8),
                Text('No se pudo consultar la API', style: TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            Text(message, style: const TextStyle(color: AppColors.t2)),
            const SizedBox(height: 14),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.ok});

  final String label;
  final String value;
  final bool? ok;

  @override
  Widget build(BuildContext context) {
    final color = ok == null ? AppColors.t1 : (ok! ? AppColors.ok : AppColors.crit);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.t2)),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.end,
                style: TextStyle(color: color, fontWeight: FontWeight.w700, fontFamily: ok == null ? 'monospace' : null)),
          ),
        ],
      ),
    );
  }
}
