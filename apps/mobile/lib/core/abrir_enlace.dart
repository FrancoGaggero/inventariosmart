import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// Abre un enlace fuera de la app (WhatsApp, design D5 de mobile-orders). Devuelve false si el
/// sistema no pudo abrirlo. Los tests lo reemplazan para registrar la URI sin salir de la app.
final abrirEnlaceProvider = Provider<Future<bool> Function(Uri)>(
  (_) => (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);
