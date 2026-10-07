import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/auth/sesion.dart';
import '../../core/formato.dart';
import '../../core/modelos/ordenes.dart';
import '../../core/ordenes_formato.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';
import 'ordenes_provider.dart';

/// Órdenes de compra (HU-07, HU-16; CP-M.13, CP-M.13k, CP-M.13l).
class OrdenesScreen extends ConsumerWidget {
  const OrdenesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final lista = ref.watch(ordenesProvider);
    final filtro = ref.watch(filtroOrdenesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Órdenes de compra')),
      body: me != null && !me.tienePro
          ? ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(planOrdenes)])
          : RefreshIndicator(
              onRefresh: () => ref.refresh(ordenesProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  SelectorChips<String>(
                    opciones: filtrosOrdenes,
                    actual: filtro,
                    etiqueta: (f) => etiquetaFiltroOrden[f]!,
                    onElegir: (f) => ref.read(filtroOrdenesProvider.notifier).elegir(f),
                  ),
                  const SizedBox(height: 14),
                  switch (lista) {
                    AsyncValue(:final value?) => Column(
                        children: [
                          if (value.datos.items.isEmpty)
                            Vacio(
                              titulo: filtro == 'TODAS' ? 'Todavía no hay órdenes.' : 'No hay órdenes en este estado.',
                              texto: 'Las órdenes se arman desde las alertas en la web o pidiéndoselas al asistente.',
                              ilustracion: 'carrito',
                            ),
                          for (final o in value.datos.items) ...[_FilaOrden(o: o), const SizedBox(height: 10)],
                          CargarMas(
                            hayMas: value.datos.hayMas,
                            cargando: value.cargandoMas,
                            error: value.errorMas,
                            onCargar: () => ref.read(ordenesProvider.notifier).cargarMas(),
                          ),
                        ],
                      ),
                    AsyncValue(hasError: true, :final error?) =>
                      ErrorConReintento(error: error, onReintentar: () => ref.invalidate(ordenesProvider)),
                    _ => const Padding(padding: EdgeInsets.only(top: 24), child: Cargando()),
                  },
                ],
              ),
            ),
    );
  }
}

/// Color de la píldora de estado.
Color colorEstado(Tokens k, String estado) => switch (estado) {
      'BORRADOR' => k.t3,
      'CONFIRMADA' => k.warn,
      'ENVIADA' => k.ok,
      _ => k.crit,
    };

class _FilaOrden extends StatelessWidget {
  const _FilaOrden({required this.o});

  final OrdenResumen o;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final canal = etiquetaCanal[o.canal];
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('${Rutas.ordenes}/${o.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(o.numero, style: TextStyle(fontWeight: FontWeight.w800, color: k.t1)),
                    Text(o.proveedor.nombre, style: TextStyle(color: k.t1)),
                    const SizedBox(height: 4),
                    Text('${cantidadDeItems(o.cantidadItems)} · ${formatoFecha(o.fecha)}', style: TextStyle(fontSize: 12, color: k.t2)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        Pildora(etiquetaEstadoOrden[o.estado] ?? o.estado, color: colorEstado(k, o.estado)),
                        if (canal != null) Pildora(canal, color: k.brand),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(formatoPesos(o.totalNeto), style: TextStyle(fontWeight: FontWeight.w800, color: k.t1)),
                  Text('neto', style: TextStyle(fontSize: 11, color: k.t2)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
