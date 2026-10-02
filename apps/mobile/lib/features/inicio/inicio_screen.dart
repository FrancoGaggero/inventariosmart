import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/analisis_formato.dart';
import '../../core/formato.dart';
import '../../core/modelos/dashboard.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/aviso.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';

/// Mes elegido en el panel (YYYY-MM).
class PeriodoPanel extends Notifier<String> {
  @override
  String build() => mesActual();

  void mover(int delta) => state = sumarMeses(state, delta);
}

final periodoPanelProvider = NotifierProvider<PeriodoPanel, String>(PeriodoPanel.new);

/// GET /dashboard?periodo= (HU-04). Se invalida al registrar movimientos o productos (CP-M.2d).
final dashboardProvider = FutureProvider.autoDispose.family<Dashboard, String>((ref, periodo) async {
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/dashboard', queryParameters: {'periodo': periodo});
    return Dashboard.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});

/// Panel resumido del mes para DUENIO y CONTADOR (CP-M.2).
class InicioScreen extends ConsumerWidget {
  const InicioScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final periodo = ref.watch(periodoPanelProvider);
    final panel = ref.watch(dashboardProvider(periodo));
    final me = ref.watch(meProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(me?.comercio.nombre ?? 'Inicio'),
      ),
      body: Column(
        children: [
          _SelectorMes(periodo: periodo, onMover: (d) => ref.read(periodoPanelProvider.notifier).mover(d)),
          Expanded(
            child: panel.when(
              loading: () => const Cargando(),
              error: (e, _) => ErrorConReintento(error: e, onReintentar: () => ref.invalidate(dashboardProvider(periodo))),
              data: (d) => RefreshIndicator(
                onRefresh: () => ref.refresh(dashboardProvider(periodo).future),
                child: _Panel(d: d, esMesActual: periodo == mesActual()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectorMes extends StatelessWidget {
  const _SelectorMes({required this.periodo, required this.onMover});

  final String periodo;
  final void Function(int delta) onMover;

  @override
  Widget build(BuildContext context) {
    final esActual = periodo == mesActual();
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            tooltip: 'Mes anterior',
            onPressed: () => onMover(-1),
            icon: const Icon(Icons.chevron_left),
          ),
          Text(etiquetaMes(periodo), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          IconButton(
            tooltip: 'Mes siguiente',
            onPressed: esActual ? null : () => onMover(1),
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.d, required this.esMesActual});

  final Dashboard d;
  final bool esMesActual;

  String get _frase {
    final v = d.ventas;
    final cuando = esMesActual ? 'Este mes' : 'En ${etiquetaMes(d.periodo).toLowerCase()}';
    if (v.unidadesVendidas == 0) {
      return esMesActual
          ? 'Todavía no hay ventas registradas este mes.'
          : 'No hubo ventas en ${etiquetaMes(d.periodo).toLowerCase()}.';
    }
    return '$cuando vendiste ${formatoEntero(v.unidadesVendidas)} unidades por ${formatoPesos(v.ventasNetas)} netos.';
  }

  /// Tarjetas de falta de stock y stock parado, sólo con monto mayor a cero (CP-M.11, CP-M.11b).
  List<Widget> _analisis(BuildContext context, Tokens k) {
    final q = d.quiebres;
    final sp = d.stockParado;
    final tarjetas = [
      if (q != null && (num.tryParse(q.gananciaPerdida) ?? 0) > 0)
        Indicador(
          titulo: 'Perdiste por falta de stock',
          valor: formatoPesosEntero(q.gananciaPerdida),
          detalle: detallePanelQuiebres(q.productosAfectados),
          onTap: () => context.go(Rutas.quiebres),
        ),
      if (sp != null && (num.tryParse(sp.capitalParado) ?? 0) > 0)
        Indicador(
          titulo: 'Plata parada en stock',
          valor: formatoPesosEntero(sp.capitalParado),
          detalle: detallePanelStockParado(sp.productos),
          onTap: () => context.go(Rutas.stockParado),
        ),
    ];
    if (tarjetas.isEmpty) return const [];
    return [const SizedBox(height: 10), GrillaIndicadores(hijos: tarjetas)];
  }

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final v = d.ventas;
    final motivoNeto = v.motivo == null ? null : (etiquetaMotivoResumen[v.motivo] ?? v.motivo!);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(_frase, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.3)),
        const SizedBox(height: 14),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.15,
          children: [
            _Tarjeta(
              titulo: 'Stock',
              valor: '${formatoEntero(d.stock.unidades)} u.',
              detalle: 'valorizado en ${formatoPesos(d.stock.valorizacion)}\n'
                  '${formatoEntero(d.stock.productosActivos)} productos activos',
            ),
            _Tarjeta(
              titulo: 'Ventas netas',
              valor: formatoPesos(v.ventasNetas),
              detalle: '${formatoEntero(v.unidadesVendidas)} unidades\n'
                  '${formatoVariacion(d.mesAnterior.variacionVentasPct)} vs. ${etiquetaMes(d.mesAnterior.periodo)}',
            ),
            _Tarjeta(
              titulo: 'Margen bruto',
              valor: formatoPesos(v.margenBruto),
              detalle: '${formatoPorcentaje(v.margenBrutoPct)} sobre ventas netas',
            ),
            v.margenNetoCalculable
                ? _Tarjeta(
                    titulo: 'Margen neto',
                    valor: formatoPesos(v.margenNeto),
                    detalle: '${formatoPorcentaje(v.margenNetoPct)} · gastos ${formatoPesos(v.gastos)}',
                  )
                : _Tarjeta(
                    titulo: 'Margen neto',
                    valor: 'No calculable',
                    valorChico: true,
                    detalle: v.motivo == 'SIN_GASTOS' ? 'Cargá tus gastos del mes desde la web' : (motivoNeto ?? ''),
                    tono: k.warn,
                  ),
          ],
        ),
        ..._analisis(context, k),
        const SizedBox(height: 20),
        const _Titulo('Reposición'),
        _Reposicion(reposicion: d.alertas.reposicion),
        const SizedBox(height: 20),
        const _Titulo('Más rentables del mes'),
        if (d.topRentables.isEmpty)
          Text('Sin ventas en el mes: todavía no hay ranking.', style: TextStyle(color: k.t2))
        else
          for (final t in d.topRentables.take(3))
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: CircleAvatar(
                radius: 14,
                backgroundColor: k.brand.withValues(alpha: 0.18),
                child: Text('${d.topRentables.indexOf(t) + 1}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: k.brand3)),
              ),
              title: Text(t.producto.nombre, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('${t.producto.codigo} · ${formatoEntero(t.unidadesVendidas)} u. · ${formatoPorcentaje(t.margenBrutoPct)}'),
              trailing: Text(formatoPesos(t.margenBrutoMes), style: TextStyle(fontWeight: FontWeight.w700, color: k.ok)),
            ),
        const SizedBox(height: 20),
        const _Titulo('Alertas'),
        if (d.alertas.faltanGastos) ...[
          const Aviso(
            'Faltan los gastos del mes: cargalos desde la web para ver el margen neto.',
            tono: TonoAviso.warn,
          ),
          const SizedBox(height: 8),
        ],
        _AlertaStock(
          titulo: 'Sin stock',
          grupo: d.alertas.sinStock,
          color: k.crit,
          onVer: () => context.go('${Rutas.inventario}?estado=SIN_STOCK'),
        ),
        const SizedBox(height: 8),
        _AlertaStock(
          titulo: 'Stock bajo',
          grupo: d.alertas.stockBajo,
          color: k.warn,
          onVer: () => context.go('${Rutas.inventario}?estado=BAJO'),
        ),
        if (!d.alertas.faltanGastos && d.alertas.sinStock.total == 0 && d.alertas.stockBajo.total == 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('Sin alertas activas.', style: TextStyle(color: k.t2)),
          ),
      ],
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(texto, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: context.tokens.t2)),
      );
}

class _Tarjeta extends StatelessWidget {
  const _Tarjeta({required this.titulo, required this.valor, required this.detalle, this.tono, this.valorChico = false});

  final String titulo;
  final String valor;
  final String detalle;
  final Color? tono;
  final bool valorChico;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: TextStyle(fontSize: 12, color: k.t2, fontWeight: FontWeight.w700)),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                valor,
                style: TextStyle(fontSize: valorChico ? 17 : 20, fontWeight: FontWeight.w800, color: tono ?? k.t1),
              ),
            ),
            const SizedBox(height: 4),
            Text(detalle, style: TextStyle(fontSize: 11, color: k.t2, height: 1.3), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _AlertaStock extends StatelessWidget {
  const _AlertaStock({required this.titulo, required this.grupo, required this.color, required this.onVer});

  final String titulo;
  final GrupoAlertas grupo;
  final Color color;
  final VoidCallback onVer;

  @override
  Widget build(BuildContext context) {
    if (grupo.total == 0) return const SizedBox.shrink();
    final nombres = grupo.items.take(3).map((a) => a.nombre).join(', ');
    final resto = grupo.total - grupo.items.take(3).length;
    return Card(
      child: ListTile(
        leading: Icon(Icons.circle, color: color, size: 12),
        title: Text('$titulo: ${grupo.total}', style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(resto > 0 ? '$nombres y $resto más' : nombres, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: TextButton(onPressed: onVer, child: const Text('Ver')),
      ),
    );
  }
}

/// Bloque "Reposición" con las primeras alertas del panel (CP-M.11c, CP-M.11d).
class _Reposicion extends StatelessWidget {
  const _Reposicion({required this.reposicion});

  final ReposicionPanel? reposicion;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final r = reposicion;
    if (r == null) {
      return const AvisoPlan(
        'Alertas predictivas de reposición: disponibles en el plan PRO. Calculan cuándo reponer según tus ventas y el lead time de cada proveedor.',
      );
    }
    if (r.total == 0) {
      return Text(
        'Ningún producto se va a quedar sin stock antes de que llegue la reposición.',
        style: TextStyle(color: k.t2),
      );
    }
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final a in r.items)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: Icon(Icons.circle, size: 10, color: a.severidad == 'CRITICA' ? k.crit : k.warn),
                title: Text(a.producto.nombre, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  '${formatearCobertura(a.diasCobertura)} de stock · pedir ${formatoEntero(a.cantidadSugerida)}',
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(right: 8, top: 4),
              child: Text(totalReposicion(r.total, r.criticas), style: TextStyle(fontSize: 12, color: k.t2)),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                onPressed: () => context.go(Rutas.alertas),
                child: const Text('Ver alertas'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
