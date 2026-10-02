import 'package:flutter/material.dart';

import '../app/theme.dart';
import '../core/analisis_formato.dart';

/// Lo que ofrece una función de un plan superior y que el plan se cambia en la web.
/// No hay botón "Ver planes": los planes se manejan desde la web (ADR 0024).
class AvisoPlan extends StatelessWidget {
  const AvisoPlan(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: k.brand.withValues(alpha: 0.10),
        border: Border.all(color: k.brand.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.workspace_premium_outlined, color: k.brand3, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(texto, style: TextStyle(color: k.t1, height: 1.35)),
                const SizedBox(height: 6),
                Text(cambiarPlanEnLaWeb, style: TextStyle(color: k.t2, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
