import 'package:intl/intl.dart';

/// Formato rioplatense de montos, porcentajes, fechas y meses (D6).

final _pesos = NumberFormat('#,##0.00', 'es_AR');
final _entero = NumberFormat.decimalPattern('es_AR');
final _decimal1 = NumberFormat('#,##0.0', 'es_AR');

/// "1230000.00" → "$ 1.230.000,00" (símbolo adelante, como en la web). Acepta string
/// decimal o número; "—" si no es un número.
String formatoPesos(Object? monto) {
  final n = _aNumero(monto);
  if (n == null) return '—';
  final texto = _pesos.format(n.abs());
  return n < 0 ? '-\$ $texto' : '\$ $texto';
}

/// 1234 → "1.234".
String formatoEntero(num n) => _entero.format(n);

/// "-12.5" → "-12,5 %"; null → "—".
String formatoPorcentaje(Object? valor) {
  final n = _aNumero(valor);
  if (n == null) return '—';
  return '${_decimal1.format(n)} %';
}

/// Variación con signo: "+200,0 %" / "-12,5 %"; null → "sin datos".
String formatoVariacion(Object? valor) {
  final n = _aNumero(valor);
  if (n == null) return 'sin datos';
  final texto = formatoPorcentaje(n);
  return n > 0 ? '+$texto' : texto;
}

/// ISO 8601 → "23/09/2026 14:05" en hora local del dispositivo.
String formatoFecha(String iso) {
  final f = DateTime.tryParse(iso);
  if (f == null) return iso;
  final l = f.toLocal();
  String dos(int v) => v.toString().padLeft(2, '0');
  return '${dos(l.day)}/${dos(l.month)}/${l.year} ${dos(l.hour)}:${dos(l.minute)}';
}

const _meses = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/// "2026-09" → "Septiembre 2026".
String etiquetaMes(String periodo) {
  final partes = periodo.split('-');
  if (partes.length != 2) return periodo;
  final mes = int.tryParse(partes[1]);
  if (mes == null || mes < 1 || mes > 12) return periodo;
  return '${_meses[mes - 1]} ${partes[0]}';
}

/// Mes actual en Buenos Aires (UTC−3 fijo, sin horario de verano), formato YYYY-MM.
String mesActual([DateTime? ahora]) {
  final utc = (ahora ?? DateTime.now()).toUtc();
  final ba = utc.subtract(const Duration(hours: 3));
  return '${ba.year}-${ba.month.toString().padLeft(2, '0')}';
}

/// "2026-01" + (−1) → "2025-12".
String sumarMeses(String periodo, int delta) {
  final partes = periodo.split('-');
  final anio = int.parse(partes[0]);
  final mes = int.parse(partes[1]);
  final total = anio * 12 + (mes - 1) + delta;
  final nuevoAnio = total ~/ 12;
  final nuevoMes = total % 12 + 1;
  return '$nuevoAnio-${nuevoMes.toString().padLeft(2, '0')}';
}

num? _aNumero(Object? v) {
  if (v == null) return null;
  if (v is num) return v;
  if (v is String) return num.tryParse(v.replaceAll(',', '.'));
  return null;
}
