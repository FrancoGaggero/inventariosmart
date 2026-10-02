import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/acumulado.dart';
import '../../core/analisis_formato.dart';
import '../../core/auth/sesion.dart';
import '../../core/formato.dart';
import '../../core/lista_paginada.dart';
import '../../core/modelos/analisis.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';
import 'alertas_provider.dart';

/// Alertas de reposición (HU-06, CP-M.9 a CP-M.9g).
class AlertasScreen extends ConsumerWidget {
  const AlertasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final lista = ref.watch(alertasProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas de reposición')),
      body: me != null && !me.tienePro
          ? ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(planAlertas)])
          : RefreshIndicator(
              onRefresh: () {
                ref.invalidate(resumenAlertasProvider);
                return ref.refresh(alertasProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  const _Cabecera(),
                  const SizedBox(height: 12),
                  switch (lista) {
                    AsyncValue(:final value?) => _Lista(acumulado: value, esDuenio: me?.esDuenio ?? false),
                    AsyncValue(hasError: true, :final error?) =>
                      ErrorConReintento(error: error, onReintentar: () => ref.invalidate(alertasProvider)),
                    _ => const Padding(padding: EdgeInsets.only(top: 24), child: Cargando()),
                  },
                ],
              ),
            ),
    );
  }
}

class _Cabecera extends ConsumerWidget {
  const _Cabecera();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final resumen = ref.watch(resumenAlertasProvider).value;
    final filtro = ref.watch(filtroAlertasProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(fraseAlertas(resumen), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: k.t1, height: 1.35)),
        if (resumen?.calculadasEn != null) ...[
          const SizedBox(height: 4),
          Text('Último cálculo: ${formatoFecha(resumen!.calculadasEn!)}', style: TextStyle(fontSize: 12, color: k.t2)),
        ],
        const SizedBox(height: 12),
        SelectorChips<String>(
          opciones: filtrosAlertas,
          actual: filtro,
          etiqueta: (f) => f == 'ACTIVA' && resumen != null
              ? '${etiquetaFiltroAlertas[f]} · ${resumen.activas}'
              : etiquetaFiltroAlertas[f]!,
          onElegir: (f) => ref.read(filtroAlertasProvider.notifier).elegir(f),
        ),
      ],
    );
  }
}

class _Lista extends ConsumerWidget {
  const _Lista({required this.acumulado, required this.esDuenio});

  final Acumulado<ListaPaginada<Alerta>> acumulado;
  final bool esDuenio;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = acumulado.datos.items;
    if (items.isEmpty) {
      final activas = ref.watch(filtroAlertasProvider) == 'ACTIVA';
      return Vacio(
        titulo: activas ? 'No hay productos por reponer.' : 'No hay alertas en este estado.',
        texto: explicacionAlertas,
      );
    }
    return Column(
      children: [
        for (final a in items) ...[_TarjetaAlerta(alerta: a, esDuenio: esDuenio), const SizedBox(height: 10)],
        CargarMas(
          hayMas: acumulado.datos.hayMas,
          cargando: acumulado.cargandoMas,
          error: acumulado.errorMas,
          onCargar: () => ref.read(alertasProvider.notifier).cargarMas(),
        ),
      ],
    );
  }
}

class _TarjetaAlerta extends ConsumerWidget {
  const _TarjetaAlerta({required this.alerta, required this.esDuenio});

  final Alerta alerta;
  final bool esDuenio;

  Future<void> _actuar(BuildContext context, WidgetRef ref, String accion) async {
    final mensajero = ScaffoldMessenger.of(context);
    final error = await ref.read(alertasProvider.notifier).actuar(alerta.id, accion);
    final nombre = alerta.producto.nombre;
    // Sin cola: cada acción reemplaza el aviso anterior.
    mensajero.hideCurrentSnackBar();
    mensajero.showSnackBar(SnackBar(
      content: Text(error?.message ??
          (accion == 'ATENDER'
              ? '$nombre: alerta atendida. No se vuelve a avisar hasta que entre mercadería.'
              : '$nombre: alerta pospuesta 7 días.')),
    ));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final a = alerta;
    final critica = a.severidad == 'CRITICA';
    final proveedor = a.proveedor == null
        ? 'Sin proveedor · lead time ${a.leadTimeDias} d por defecto'
        : '${a.proveedor!.nombre} · lead time ${a.proveedor!.leadTimeDias} d';
    final estado = switch (a.estado) {
      'POSPUESTA' when a.pospuestaHasta != null => 'Pospuesta hasta ${formatoDia(a.pospuestaHasta!)}',
      'ACTIVA' => null,
      _ => etiquetaEstadoAlerta[a.estado],
    };
    final detalle = TextStyle(color: k.t2, fontSize: 13, height: 1.4);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(a.producto.nombre, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
                      Text(a.producto.codigo, style: TextStyle(fontSize: 12, color: k.t2)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Pildora(etiquetaSeveridad[a.severidad] ?? a.severidad, color: critica ? k.crit : k.warn),
              ],
            ),
            const SizedBox(height: 8),
            Text('Stock ${formatoEntero(a.producto.stockActual)} · mín. ${formatoEntero(a.producto.stockSeguridad)}', style: detalle),
            Text('Vende ${velocidadLegible(a.velocidadDiaria)} por día · cobertura ${formatearCobertura(a.diasCobertura)}', style: detalle),
            Text(proveedor, style: detalle),
            const SizedBox(height: 4),
            Text('Pedir ${formatoEntero(a.cantidadSugerida)}', style: TextStyle(fontWeight: FontWeight.w800, color: k.t1)),
            if (estado != null) Text(estado, style: TextStyle(fontSize: 12, color: k.t2)),
            if (esDuenio && a.abierta) ...[
              const SizedBox(height: 4),
              Wrap(
                spacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  FilledButton.tonal(
                    onPressed: () => context.go('${Rutas.movimientoNuevo}?productoId=${a.producto.id}&tipo=INGRESO'),
                    child: const Text('Registrar ingreso'),
                  ),
                  TextButton(onPressed: () => _actuar(context, ref, 'ATENDER'), child: const Text('Atendida')),
                  if (a.estado == 'ACTIVA')
                    TextButton(onPressed: () => _actuar(context, ref, 'POSPONER'), child: const Text('Posponer 7 días')),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
