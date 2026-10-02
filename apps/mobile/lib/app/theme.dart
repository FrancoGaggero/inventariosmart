import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Paleta ámbar cálida de la web (ADR 0022, ADR 0024). Los valores son copia de
/// `apps/web/src/index.css`: `test/app/tokens_web_test.dart` los compara y
/// `test/app/contraste_test.dart` exige WCAG AA en los dos temas.
@immutable
class Tokens extends ThemeExtension<Tokens> {
  const Tokens({
    required this.brightness,
    required this.bg,
    required this.bg2,
    required this.card,
    required this.card2,
    required this.field,
    required this.t1,
    required this.t2,
    required this.t3,
    required this.line,
    required this.line2,
    required this.fill,
    required this.brand,
    required this.brand2,
    required this.brand3,
    required this.onBrand,
    required this.ok,
    required this.warn,
    required this.crit,
    required this.violet,
    required this.whatsapp,
    required this.onWhatsapp,
    required this.inverso,
    required this.onInverso,
    required this.acentoInverso,
  });

  final Brightness brightness;
  final Color bg;
  final Color bg2;
  final Color card;
  final Color card2;
  final Color field;
  final Color t1;
  final Color t2;
  final Color t3;
  final Color line;
  final Color line2;
  final Color fill;

  /// Ámbar de marca. Encima siempre va texto oscuro ([onBrand]): el blanco no llega a AA.
  final Color brand;
  final Color brand2;

  /// Ámbar para texto e íconos sobre las superficies.
  final Color brand3;
  final Color onBrand;
  final Color ok;

  /// Terracota, para no confundirse con el ámbar de marca.
  final Color warn;
  final Color crit;
  final Color violet;
  final Color whatsapp;
  final Color onWhatsapp;
  final Color inverso;
  final Color onInverso;
  final Color acentoInverso;

  static const oscuro = Tokens(
    brightness: Brightness.dark,
    bg: Color(0xFF14110D),
    bg2: Color(0xFF1A1612),
    card: Color(0xFF1E1A15),
    card2: Color(0xFF231E18),
    field: Color(0xFF110E0B),
    t1: Color(0xFFF3ECE1),
    t2: Color(0xFFB8AC99),
    t3: Color(0xFF857A69),
    line: Color.fromRGBO(243, 236, 225, 0.08),
    line2: Color.fromRGBO(243, 236, 225, 0.14),
    fill: Color.fromRGBO(243, 236, 225, 0.05),
    brand: Color(0xFFE0A54A),
    brand2: Color(0xFFEBB866),
    brand3: Color(0xFFF0C07A),
    onBrand: Color(0xFF1F1A14),
    ok: Color(0xFF5BB585),
    warn: Color(0xFFE5824A),
    crit: Color(0xFFE5574F),
    violet: Color(0xFFB39BD6),
    whatsapp: Color(0xFF25D366),
    onWhatsapp: Color(0xFF062B14),
    inverso: Color(0xFFF3ECE1),
    onInverso: Color(0xFF1F1A14),
    acentoInverso: Color(0xFF8A5A12),
  );

  static const claro = Tokens(
    brightness: Brightness.light,
    bg: Color(0xFFF4EFE6),
    bg2: Color(0xFFFBF8F2),
    card: Color(0xFFFFFCF7),
    card2: Color(0xFFFAF6EF),
    field: Color(0xFFFFFFFF),
    t1: Color(0xFF1F1A14),
    t2: Color(0xFF5C5244),
    t3: Color(0xFF8A7F6F),
    line: Color.fromRGBO(31, 26, 20, 0.09),
    line2: Color.fromRGBO(31, 26, 20, 0.16),
    fill: Color.fromRGBO(31, 26, 20, 0.045),
    brand: Color(0xFFB87A22),
    brand2: Color(0xFFA66C1A),
    brand3: Color(0xFF8A5A12),
    onBrand: Color(0xFF1F1A14),
    ok: Color(0xFF2F7D55),
    warn: Color(0xFFB4561F),
    crit: Color(0xFFBF3A30),
    violet: Color(0xFF7A5C9E),
    whatsapp: Color(0xFF25D366),
    onWhatsapp: Color(0xFF062B14),
    inverso: Color(0xFF1F1A14),
    onInverso: Color(0xFFF3ECE1),
    acentoInverso: Color(0xFFE0A54A),
  );

  static Tokens de(Brightness b) => b == Brightness.light ? claro : oscuro;

  /// Color del estado de stock (OK / BAJO / SIN_STOCK).
  Color estadoStock(String estado) => switch (estado) {
        'OK' => ok,
        'BAJO' => warn,
        _ => crit,
      };

  @override
  Tokens copyWith() => this;

  // Sin animación entre temas: el cambio es instantáneo, como en la web.
  @override
  Tokens lerp(ThemeExtension<Tokens>? other, double t) => t < 0.5 || other is! Tokens ? this : other;
}

extension TokensDelContexto on BuildContext {
  Tokens get tokens => Theme.of(this).extension<Tokens>() ?? Tokens.oscuro;
}

/// Tema de Material 3 armado a mano desde los tokens (ADR 0024): `fromSeed` generaría tonos
/// que no coinciden con la web.
ThemeData buildTheme(Brightness brillo) {
  final k = Tokens.de(brillo);
  final claro = brillo == Brightness.light;
  final base = ThemeData(brightness: brillo, useMaterial3: true);
  final esquema = ColorScheme(
    brightness: brillo,
    primary: k.brand,
    onPrimary: k.onBrand,
    primaryContainer: Color.alphaBlend(k.brand.withValues(alpha: 0.18), k.card),
    onPrimaryContainer: k.brand3,
    secondary: k.brand3,
    onSecondary: k.onBrand,
    surface: k.card,
    onSurface: k.t1,
    onSurfaceVariant: k.t2,
    surfaceContainerLowest: k.bg,
    surfaceContainerLow: k.bg2,
    surfaceContainer: k.card,
    surfaceContainerHigh: k.card2,
    surfaceContainerHighest: k.card2,
    error: k.crit,
    onError: claro ? k.bg2 : k.onBrand,
    outline: k.t3,
    outlineVariant: k.line2,
    inverseSurface: k.inverso,
    onInverseSurface: k.onInverso,
    inversePrimary: k.acentoInverso,
    shadow: Colors.black,
  );
  final radio12 = BorderRadius.circular(12);
  // Los estilos parten del tema base para conservar la familia y el tamaño de Material.
  final etiqueta = base.textTheme.labelLarge ?? const TextStyle();
  final borde = OutlineInputBorder(borderRadius: radio12, borderSide: BorderSide(color: k.t3));

  return base.copyWith(
    colorScheme: esquema,
    scaffoldBackgroundColor: k.bg,
    canvasColor: k.bg,
    dividerColor: k.line2,
    extensions: [k],
    textTheme: base.textTheme.apply(bodyColor: k.t1, displayColor: k.t1),
    appBarTheme: AppBarTheme(
      backgroundColor: k.bg,
      foregroundColor: k.t1,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: estiloBarras(k),
    ),
    // En claro, la tarjeta crema sobre el fondo crema necesita elevación y borde (design, riesgos).
    cardTheme: CardThemeData(
      color: k.card,
      surfaceTintColor: Colors.transparent,
      elevation: claro ? 1 : 0,
      shadowColor: claro ? const Color.fromRGBO(60, 40, 15, 0.25) : Colors.black,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: claro ? BorderSide(color: k.line) : BorderSide.none,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: k.brand,
        foregroundColor: k.onBrand,
        minimumSize: const Size(64, 48),
        shape: RoundedRectangleBorder(borderRadius: radio12),
        textStyle: etiqueta.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: k.t1,
        minimumSize: const Size(64, 48),
        side: BorderSide(color: k.t3),
        shape: RoundedRectangleBorder(borderRadius: radio12),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: k.brand3)),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: k.brand.withValues(alpha: 0.18),
        selectedForegroundColor: k.t1,
        foregroundColor: k.t2,
        side: BorderSide(color: k.t3),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: k.bg2,
      surfaceTintColor: Colors.transparent,
      indicatorColor: k.brand.withValues(alpha: 0.18),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? k.brand3 : k.t2),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => etiqueta.copyWith(
          fontSize: 12,
          fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: s.contains(WidgetState.selected) ? k.t1 : k.t2,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: k.field,
      labelStyle: TextStyle(color: k.t2),
      hintStyle: TextStyle(color: k.t3),
      border: borde,
      enabledBorder: borde,
      focusedBorder: borde.copyWith(borderSide: BorderSide(color: k.brand, width: 2)),
      errorBorder: borde.copyWith(borderSide: BorderSide(color: k.crit)),
      focusedErrorBorder: borde.copyWith(borderSide: BorderSide(color: k.crit, width: 2)),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: k.fill,
      selectedColor: k.brand.withValues(alpha: 0.18),
      side: BorderSide(color: k.line2),
      labelStyle: etiqueta.copyWith(color: k.t1),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: k.brand,
      foregroundColor: k.onBrand,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: k.brand),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: k.inverso,
      contentTextStyle: TextStyle(color: k.onInverso),
      actionTextColor: k.acentoInverso,
    ),
    popupMenuTheme: PopupMenuThemeData(color: k.card2, surfaceTintColor: Colors.transparent),
    dialogTheme: DialogThemeData(backgroundColor: k.card, surfaceTintColor: Colors.transparent),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: k.card, surfaceTintColor: Colors.transparent),
  );
}

/// Barras del sistema de Android acordes al tema (design D3).
SystemUiOverlayStyle estiloBarras(Tokens k) {
  final claro = k.brightness == Brightness.light;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: claro ? Brightness.dark : Brightness.light,
    statusBarBrightness: k.brightness,
    systemNavigationBarColor: k.bg2,
    systemNavigationBarIconBrightness: claro ? Brightness.dark : Brightness.light,
  );
}
