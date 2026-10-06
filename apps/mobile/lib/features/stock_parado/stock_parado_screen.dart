import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/acumulado.dart';
import '../../core/analisis_formato.dart';
import '../../core/auth/sesion.dart';
import '../../core/formato.dart';
import '../../core/modelos/analisis.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';
import 'stock_parado_provider.dart';

/// Plata parada en productos que no se venden (HU-19, CP-M.10b, CP-M.10d a CP-M.10h).
class StockParadoScreen extends ConsumerWidget {
  const StockParadoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final datos = ref.watch(stockParadoProvider);
    final dias = ref.watch(periodoStockParadoProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Stock parado')),
      body: me != null && !me.tienePro
          ? ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(planStockParado)])
          : RefreshIndicator(
              onRefresh: () => ref.refresh(stockParadoProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  SelectorChips<int>(
                    opciones: diasStockParado,
                    actual: dias,
                    etiqueta: (d) => '$d días',
                    onElegir: (d) => ref.read(periodoStockParadoProvider.notifier).elegir(d),
                  ),
                  const SizedBox(height: 14),
                  switch (datos) {
                    AsyncValue(:final value?) => _Contenido(acumulado: value),
                    AsyncValue(hasError: true, :final error?) =>
                      ErrorConReintento(error: error, onReintentar: () => ref.invalidate(stockParadoProvider)),
                    _ => const Padding(padding: EdgeInsets.only(top: 24), child: Cargando()),
                  },
                ],
              ),
            ),
    );
  }
}

class _Contenido extends ConsumerWidget {
  const _Contenido({required this.acumulado});

  final Acumulado<ResultadoStockParado> acumulado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final r = acumulado.datos;
    final t = r.totales;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(fraseStockParado(t, r.dias), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: k.t1, height: 1.35)),
        const SizedBox(height: 14),
        GrillaIndicadores(hijos: [
          Indicador(titulo: 'Plata parada', valor: formatoPesosEntero(t.capitalParado), detalle: 'Al costo de reposición, sin IVA'),
          Indicador(
            titulo: 'De tu stock',
            valor: t.porcentajeDelStock == null ? '—' : formatoPorcentaje(t.porcentajeDelStock),
            detalle: 'Del valor de todo tu stock',
          ),
          Indicador(
            titulo: 'Productos',
            valor: formatoEntero(t.productos),
            detalle: '${formatoEntero(t.unidades)} ${t.unidades == 1 ? 'unidad' : 'unidades'} sin vender',
          ),
        ]),
        const SizedBox(height: 16),
        if (r.items.isEmpty)
          const Vacio(
            titulo: 'No tenés stock parado en este período.',
            texto: 'Los productos dados de alta hace menos tiempo que el período elegido todavía no cuentan.',
            ilustracion: 'recibo',
          )
        else ...[
          for (final p in r.items) ...[_Fila(p: p), const SizedBox(height: 10)],
          CargarMas(
            hayMas: r.hayMas,
            cargando: acumulado.cargandoMas,
            error: acumulado.errorMas,
            onCargar: () => ref.read(stockParadoProvider.notifier).cargarMas(),
          ),
        ],
        const NotaAlPie(ideasStockParado),
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.p});

  final ProductoParado p;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final detalle = TextStyle(color: k.t2, fontSize: 13, height: 1.4);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.producto.nombre, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
                  Text(p.producto.codigo, style: TextStyle(fontSize: 12, color: k.t2)),
                  const SizedBox(height: 6),
                  Text('Stock ${formatoEntero(p.stock)} · costo ${formatoPesos(p.costoReposicion)}', style: detalle),
                  Text(textoUltimaVenta(p), style: detalle),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(formatoPesosEntero(p.capitalParado), style: TextStyle(fontWeight: FontWeight.w800, color: k.t1)),
                Text('parados', style: TextStyle(fontSize: 11, color: k.t2)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
