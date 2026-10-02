import 'package:flutter/material.dart';

import '../app/theme.dart';

/// Marca de la app en ámbar, como `ui/Logo.tsx` de la web (ADR 0022, design D7).
class Logo extends StatelessWidget {
  const Logo({super.key, this.icono, this.conNombre = false});

  /// Ícono del cuadrado; por defecto, el de la marca.
  final IconData? icono;
  final bool conNombre;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final marca = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(color: k.brand, borderRadius: BorderRadius.circular(12)),
      child: Icon(icono ?? Icons.bar_chart_rounded, color: k.onBrand, size: 22),
    );
    if (!conNombre) return marca;
    return Row(
      children: [
        marca,
        const SizedBox(width: 10),
        Text('InventarioSmart', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: k.t1)),
      ],
    );
  }
}
