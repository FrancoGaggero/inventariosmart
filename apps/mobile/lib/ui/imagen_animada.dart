import 'package:flutter/material.dart';

import '../app/theme.dart';

/// Ruta de una animación de `assets/animaciones/` (ADR 0025). `quieta` elige el PNG fijo.
String rutaAnimacion(String nombre, Brightness brillo, {bool quieta = false}) =>
    'assets/animaciones/$nombre-${brillo == Brightness.light ? 'claro' : 'oscuro'}.${quieta ? 'png' : 'webp'}';

/// Animación generada en `herramientas/visuales` (WebP con transparencia) del tema actual, como
/// `ui/ImagenAnimada.tsx` de la web. Con "quitar animaciones" del sistema muestra el PNG fijo; si
/// el archivo no carga, el respaldo. Es decorativa: el texto de la pantalla dice lo que importa.
class ImagenAnimada extends StatelessWidget {
  const ImagenAnimada({super.key, required this.nombre, required this.ancho, required this.alto, required this.respaldo});

  final String nombre;
  final double ancho;
  final double alto;
  final Widget respaldo;

  @override
  Widget build(BuildContext context) {
    final quieta = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return Image.asset(
      rutaAnimacion(nombre, context.tokens.brightness, quieta: quieta),
      width: ancho,
      height: alto,
      excludeFromSemantics: true,
      gaplessPlayback: true,
      errorBuilder: (_, _, _) => respaldo,
    );
  }
}
