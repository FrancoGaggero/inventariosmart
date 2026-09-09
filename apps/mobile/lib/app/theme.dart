import 'package:flutter/material.dart';

/// Paleta de los wireframes v3: fondo midnight, azul de marca, textos slate.
class AppColors {
  static const bg = Color(0xFF080E1A);
  static const navy = Color(0xFF0F1C30);
  static const navy2 = Color(0xFF152236);
  static const brand = Color(0xFF2563EB);
  static const brand3 = Color(0xFF60A5FA);
  static const ok = Color(0xFF10B981);
  static const crit = Color(0xFFEF4444);
  static const t1 = Color(0xFFF1F5F9);
  static const t2 = Color(0xFF94A3B8);
  static const t3 = Color(0xFF475569);
}

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.brand,
      secondary: AppColors.brand3,
      surface: AppColors.navy,
      error: AppColors.crit,
    ),
    cardTheme: const CardThemeData(color: AppColors.navy2, elevation: 0),
    textTheme: base.textTheme.apply(bodyColor: AppColors.t1, displayColor: AppColors.t1),
  );
}
