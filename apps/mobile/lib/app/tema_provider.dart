import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tema elegido en "Más" (CP-M.7, CP-M.7b). Por defecto sigue al del sistema.
enum PreferenciaTema {
  sistema('Sistema', ThemeMode.system),
  claro('Claro', ThemeMode.light),
  oscuro('Oscuro', ThemeMode.dark);

  const PreferenciaTema(this.etiqueta, this.modo);

  final String etiqueta;
  final ThemeMode modo;

  static PreferenciaTema desde(String? valor) =>
      PreferenciaTema.values.firstWhere((p) => p.name == valor, orElse: () => PreferenciaTema.sistema);
}

/// Preferencias del dispositivo. `main.dart` las carga antes de `runApp` para que el primer cuadro
/// ya salga con el tema guardado (design D2). Sin override, la elección vive sólo en memoria.
final preferenciasProvider = Provider<SharedPreferences?>((_) => null);

const claveTema = 'tema';

class TemaNotifier extends Notifier<PreferenciaTema> {
  @override
  PreferenciaTema build() => PreferenciaTema.desde(ref.watch(preferenciasProvider)?.getString(claveTema));

  Future<void> elegir(PreferenciaTema p) async {
    state = p;
    await ref.read(preferenciasProvider)?.setString(claveTema, p.name);
  }
}

final temaProvider = NotifierProvider<TemaNotifier, PreferenciaTema>(TemaNotifier.new);
