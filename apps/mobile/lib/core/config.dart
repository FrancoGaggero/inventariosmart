/// Configuración inyectada en tiempo de compilación:
///   flutter run --dart-define=API_URL=http://10.0.2.2:3000
/// 10.0.2.2 es la máquina anfitriona vista desde el emulador de Android.
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000');
  static const apiPrefix = '/api/v1';
}
