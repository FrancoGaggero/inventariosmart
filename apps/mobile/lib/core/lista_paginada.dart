/// Respuesta de los listados de la API: `{ items, siguienteCursor }`.
class ListaPaginada<T> {
  const ListaPaginada({required this.items, required this.siguienteCursor});

  final List<T> items;

  /// null en la última página.
  final String? siguienteCursor;

  bool get hayMas => siguienteCursor != null;

  factory ListaPaginada.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) item,
  ) {
    final items = (json['items'] as List<dynamic>)
        .map((e) => item(e as Map<String, dynamic>))
        .toList(growable: false);
    return ListaPaginada(items: items, siguienteCursor: json['siguienteCursor'] as String?);
  }
}
