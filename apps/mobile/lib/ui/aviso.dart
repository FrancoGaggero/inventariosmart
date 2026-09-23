import 'package:flutter/material.dart';

import '../app/theme.dart';

enum TonoAviso { ok, warn, error, info }

/// Franja de aviso con el mismo tono que la web (`ui/Aviso.tsx`).
class Aviso extends StatelessWidget {
  const Aviso(this.texto, {super.key, this.tono = TonoAviso.info, this.accion});

  final String texto;
  final TonoAviso tono;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final color = switch (tono) {
      TonoAviso.ok => AppColors.ok,
      TonoAviso.warn => AppColors.warn,
      TonoAviso.error => AppColors.crit,
      TonoAviso.info => AppColors.brand3,
    };
    final icono = switch (tono) {
      TonoAviso.ok => Icons.check_circle_outline,
      TonoAviso.warn => Icons.warning_amber_rounded,
      TonoAviso.error => Icons.error_outline,
      TonoAviso.info => Icons.info_outline,
    };
    return Semantics(
      liveRegion: tono == TonoAviso.error,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          border: Border.all(color: color.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icono, color: color, size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(texto, style: const TextStyle(fontSize: 14, height: 1.35))),
            if (accion != null) ...[const SizedBox(width: 8), accion!],
          ],
        ),
      ),
    );
  }
}
