import 'package:intl/intl.dart';

import 'formato.dart';
import 'modelos/analisis.dart';

/// Textos de alertas, falta de stock y stock parado (design D1). Son copia de
/// `apps/web/src/lib/alertas.ts`, `quiebres-formato.ts` y `stock-parado-formato.ts`: si cambia
/// una frase en la web, se cambia acá. La única diferencia es el espacio común después de "$",
/// como en el resto de la app, salvo dentro de las frases, donde no se corta (como en la web).

final _entero = NumberFormat.decimalPattern('es_AR');
final _unDecimal = NumberFormat('#,##0.0', 'es_AR');
final _hastaUnDecimal = NumberFormat('#,##0.#', 'es_AR');

/// Monto sin centavos con un espacio que no se corta: el "$" no queda solo al final de una línea.
String _montoEnFrase(String monto) => formatoPesosEntero(monto).replaceFirst('\$ ', '\$\u00a0');

String _productos(int n) => n == 1 ? '1 producto' : '${_entero.format(n)} productos';

// ── Alertas de reposición (HU-06) ──────────────────────────────────────────────────────────

const etiquetaFiltroAlertas = {'ACTIVA': 'Activas', 'POSPUESTA': 'Pospuestas', 'TODAS': 'Todas'};

const etiquetaSeveridad = {'CRITICA': 'Crítica', 'PROXIMA': 'Próxima al quiebre'};

const etiquetaEstadoAlerta = {
  'ACTIVA': 'Activa',
  'POSPUESTA': 'Pospuesta',
  'ATENDIDA': 'Atendida',
  'RESUELTA': 'Resuelta',
};

const explicacionAlertas =
    'El cálculo usa las ventas de los últimos 30 días y el lead time del proveedor principal (RN-04). '
    'Podés ajustar la anticipación por producto desde la web.';

const planAlertas =
    'Las alertas predictivas avisan antes del quiebre según tu velocidad de venta y el lead time de cada proveedor. '
    'Disponibles en el plan PRO.';

/// Resumen de la cabecera; null mientras carga.
String fraseAlertas(ResumenAlertas? r) {
  if (r == null) return 'Calculando con las ventas de los últimos 30 días…';
  if (r.activas == 0) {
    return r.pospuestas > 0
        ? 'Sin alertas activas; ${r.pospuestas} pospuesta${r.pospuestas == 1 ? '' : 's'}.'
        : 'Ningún producto se va a quedar sin stock antes de que llegue la reposición.';
  }
  final productos = r.activas == 1 ? '1 producto va' : '${r.activas} productos van';
  final criticas = r.criticas > 0
      ? ' ${r.criticas == 1 ? 'Uno ya está' : '${r.criticas} ya están'} por debajo del punto de reposición.'
      : '';
  return '$productos a quedarse sin stock antes de que llegue la reposición.$criticas';
}

/// Días de cobertura: "sin ventas", "se agota hoy", "1 día", "N días".
String formatearCobertura(int? dias) {
  if (dias == null) return 'sin ventas';
  if (dias == 0) return 'se agota hoy';
  return dias == 1 ? '1 día' : '$dias días';
}

/// "2.000" → "2"; "1.500" → "1,5".
String velocidadLegible(String velocidad) => _hastaUnDecimal.format(num.tryParse(velocidad) ?? 0);

/// Total del bloque "Reposición" del inicio: "3 productos por reponer en total, 1 crítico."
String totalReposicion(int total, int criticas) {
  final base = total == 1 ? '1 producto por reponer' : '$total productos por reponer en total';
  if (criticas == 0) return '$base.';
  return '$base, $criticas ${criticas == 1 ? 'crítico' : 'críticos'}.';
}

// ── Falta de stock (HU-18) ─────────────────────────────────────────────────────────────────

const explicacionQuiebres =
    'Estimamos lo que habrías vendido con lo que vendía cada producto en los días en que tuvo stock, '
    'en los últimos 90 días. Si un producto ya no se vende, dalo de baja para que no cuente.';

const planQuiebres =
    'Disponible en el plan PRO: mirá cuánto dejaste de ganar cada vez que un producto se quedó sin stock.';

const sinStockAhora = 'Sin stock ahora';
const sinHistorial = 'Sin historial suficiente';

/// 5 → "5,0 días"; 1 → "1,0 día"; menos de un décimo → "menos de un día".
String diasLegibles(double dias) {
  if (dias < 0.05) return 'menos de un día';
  return '${_unDecimal.format(dias)} ${dias == 1 ? 'día' : 'días'}';
}

/// "10.0" → "10,0 unidades"; null → "—".
String unidadesLegibles(String? unidades) {
  if (unidades == null) return '—';
  final n = num.tryParse(unidades) ?? 0;
  return '${_unDecimal.format(n)} ${n == 1 ? 'unidad' : 'unidades'}';
}

/// "2.0" → "2,0"; null → "—".
String decimalLegible(String? valor) => valor == null ? '—' : _unDecimal.format(num.tryParse(valor) ?? 0);

/// Ganancia perdida del producto, o por qué no se estima.
String textoGanancia(ProductoConQuiebres p) =>
    p.motivo == 'SIN_HISTORIAL' ? sinHistorial : formatoPesosEntero(p.gananciaPerdida);

String fraseQuiebres(TotalesQuiebres t, int dias) {
  if (t.productosAfectados == 0) return 'En los últimos $dias días ningún producto se quedó sin stock.';
  final base = 'En los últimos $dias días ${_productos(t.productosAfectados)} se '
      '${t.productosAfectados == 1 ? 'quedó' : 'quedaron'} sin stock';
  final ahora = t.enCurso > 0 ? ' (${t.enCurso == 1 ? '1 sigue' : '${t.enCurso} siguen'} así)' : '';
  if ((num.tryParse(t.gananciaPerdida) ?? 0) <= 0) return '$base$ahora.';
  return '$base$ahora: dejaste de ganar unos ${_montoEnFrase(t.gananciaPerdida)}.';
}

/// Detalle de la tarjeta del inicio.
String detallePanelQuiebres(int productosAfectados) =>
    'de ganancia en los últimos 30 días · ${_productos(productosAfectados)} sin stock';

// ── Stock parado (HU-19) ───────────────────────────────────────────────────────────────────

const ideasStockParado =
    'Para liberar esa plata: armá una promoción o un combo con un producto que sí sale, preguntale al '
    'proveedor si te lo toma de vuelta, y si ya no lo vas a vender, dalo de baja.';

const planStockParado =
    'Disponible en el plan PRO: mirá cuánta plata tenés parada en productos que no se venden hace meses.';

const nuncaSeVendio = 'Nunca se vendió';

/// 120 → "120 días"; 1 → "1 día".
String diasSinVenderLegible(int dias) => dias == 1 ? '1 día' : '${_entero.format(dias)} días';

/// "Última venta: 04/06/2026 · hace 120 días" o "Nunca se vendió · 30 días desde el alta".
String textoUltimaVenta(ProductoParado p) => p.ultimaVenta == null
    ? '$nuncaSeVendio · ${diasSinVenderLegible(p.diasSinVender)} desde el alta'
    : 'Última venta: ${formatoDia(p.ultimaVenta!)} · hace ${diasSinVenderLegible(p.diasSinVender)}';

String fraseStockParado(TotalesStockParado t, int dias) {
  if (t.productos == 0) return 'Ningún producto con stock lleva más de $dias días sin venderse.';
  final parte = t.porcentajeDelStock == null
      ? ''
      : ' (el ${_hastaUnDecimal.format(num.tryParse(t.porcentajeDelStock!) ?? 0)} % de tu stock)';
  return 'Tenés ${_montoEnFrase(t.capitalParado)}$parte en ${_productos(t.productos)} que no se '
      '${t.productos == 1 ? 'vendió' : 'vendieron'} en los últimos $dias días.';
}

/// Detalle de la tarjeta del inicio.
String detallePanelStockParado(int n) => 'en ${_productos(n)} sin ventas en 90 días';

/// "Avisos" de plan (D6): los planes se cambian desde la web.
const cambiarPlanEnLaWeb = 'Podés cambiar de plan desde la web: inventariosmart0.vercel.app';
