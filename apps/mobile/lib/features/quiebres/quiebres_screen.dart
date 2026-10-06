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
import 'quiebres_provider.dart';

/// Cuánto se dejó de ganar por quedarse sin stock (HU-18, CP-M.10 a CP-M.10h).
class QuiebresScreen extends ConsumerWidget {
  const QuiebresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final datos = ref.watch(quiebresProvider);
    final dias = ref.watch(periodoQuiebresProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Falta de stock')),
      body: me != null && !me.tienePro
          ? ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(planQuiebres)])
          : RefreshIndicator(
              onRefresh: () => ref.refresh(quiebresProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  SelectorChips<int>(
                    opciones: diasQuiebres,
                    actual: dias,
                    etiqueta: (d) => '$d días',
                    onElegir: (d) => ref.read(periodoQuiebresProvider.notifier).elegir(d),
                  ),
                  const SizedBox(height: 14),
                  switch (datos) {
                    AsyncValue(:final value?) => _Contenido(acumulado: value),
                    AsyncValue(hasError: true, :final error?) =>
                      ErrorConReintento(error: error, onReintentar: () => ref.invalidate(quiebresProvider)),
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

  final Acumulado<ResultadoQuiebres> acumulado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final r = acumulado.datos;
    final t = r.totales;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(fraseQuiebres(t, r.dias), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: k.t1, height: 1.35)),
        const SizedBox(height: 14),
        GrillaIndicadores(hijos: [
          Indicador(titulo: 'Ganancia perdida', valor: formatoPesosEntero(t.gananciaPerdida), detalle: 'Margen bruto, sin IVA'),
          Indicador(
            titulo: 'Ventas perdidas',
            valor: formatoPesosEntero(t.ventaPerdida),
            detalle: '${unidadesLegibles(t.unidadesPerdidas)}, sin IVA',
          ),
          Indicador(
            titulo: 'Productos afectados',
            valor: formatoEntero(t.productosAfectados),
            detalle: t.enCurso == 0 ? 'Ninguno sigue sin stock' : '${t.enCurso} ${t.enCurso == 1 ? 'sigue' : 'siguen'} sin stock',
          ),
        ]),
        const SizedBox(height: 16),
        if (r.items.isEmpty)
          const Vacio(
            titulo: 'No te quedaste sin stock en este período.',
            texto: 'Las alertas de reposición te avisan antes de que un producto se agote.',
            ilustracion: 'cajas',
          )
        else ...[
          for (final p in r.items) ...[_Fila(p: p), const SizedBox(height: 10)],
          CargarMas(
            hayMas: r.hayMas,
            cargando: acumulado.cargandoMas,
            error: acumulado.errorMas,
            onCargar: () => ref.read(quiebresProvider.notifier).cargarMas(),
          ),
        ],
        const NotaAlPie(explicacionQuiebres),
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.p});

  final ProductoConQuiebres p;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final detalle = TextStyle(color: k.t2, fontSize: 13, height: 1.4);
    final sinHistorialSuficiente = p.motivo == 'SIN_HISTORIAL';
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
                  Text(
                    p.quiebres > 1 ? '${p.producto.codigo} · ${p.quiebres} veces' : p.producto.codigo,
                    style: TextStyle(fontSize: 12, color: k.t2),
                  ),
                  const SizedBox(height: 6),
                  Text('Sin stock: ${diasLegibles(p.diasSinStock)}', style: detalle),
                  if (!sinHistorialSuficiente)
                    Text('Vendía ${decimalLegible(p.demandaDiaria)} por día · ${unidadesLegibles(p.unidadesPerdidas)}', style: detalle),
                  if (p.enCurso) ...[const SizedBox(height: 6), Pildora(sinStockAhora, color: k.crit)],
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  textoGanancia(p),
                  textAlign: TextAlign.end,
                  style: sinHistorialSuficiente
                      ? TextStyle(fontSize: 12, color: k.t2)
                      : TextStyle(fontWeight: FontWeight.w800, color: k.t1),
                ),
                if (!sinHistorialSuficiente) Text('ganancia perdida', style: TextStyle(fontSize: 11, color: k.t2)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
