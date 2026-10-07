import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/abrir_enlace.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/formato.dart';
import '../../core/modelos/ordenes.dart';
import '../../core/ordenes_formato.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/aviso.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';
import 'ordenes_provider.dart';
import 'ordenes_screen.dart' show colorEstado;

const _maxCantidad = 1000000;

/// Detalle de una orden de compra (CP-M.13b a CP-M.13j). El DUENIO edita el borrador
/// (cantidades y líneas), lo confirma, abre WhatsApp y la marca enviada; nada sale sin su
/// confirmación (RN-06).
class OrdenScreen extends ConsumerWidget {
  const OrdenScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final orden = ref.watch(ordenProvider(id));
    final titulo = orden.value?.numero ?? 'Orden de compra';
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: me != null && !me.tienePro
          ? ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(planOrdenes)])
          : switch (orden) {
              AsyncValue(:final value?) => _Detalle(
                  // Una orden nueva (guardada, confirmada, recargada) reinicia la edición local.
                  key: ValueKey('${value.estado}-${value.items.map((l) => '${l.id}:${l.cantidad}').join(',')}'),
                  orden: value,
                  opera: me?.operaOrdenes ?? false,
                ),
              AsyncValue(hasError: true, :final error?) =>
                ErrorConReintento(error: error, onReintentar: () => ref.invalidate(ordenProvider(id))),
              _ => const Cargando(),
            },
    );
  }
}

class _Detalle extends ConsumerStatefulWidget {
  const _Detalle({super.key, required this.orden, required this.opera});

  final OrdenCompra orden;
  final bool opera;

  @override
  ConsumerState<_Detalle> createState() => _DetalleState();
}

class _DetalleState extends ConsumerState<_Detalle> {
  /// Líneas que quedan en el borrador, en el orden de la API, con su campo de cantidad.
  late final List<LineaOrden> _lineas = [...widget.orden.items];
  late final Map<String, TextEditingController> _cantidades = {
    for (final l in widget.orden.items) l.id: TextEditingController(text: '${l.cantidad}'),
  };
  String? _canalElegido;
  bool _ocupado = false;

  OrdenCompra get o => widget.orden;
  bool get _editable => o.esBorrador && widget.opera;

  @override
  void dispose() {
    for (final c in _cantidades.values) {
      c.dispose();
    }
    super.dispose();
  }

  int? _cantidadDe(LineaOrden l) {
    final n = int.tryParse(_cantidades[l.id]!.text.trim());
    return n == null || n < 1 || n > _maxCantidad ? null : n;
  }

  bool get _validas => _lineas.every((l) => _cantidadDe(l) != null);

  bool get _hayCambios =>
      _lineas.length != o.items.length || _lineas.any((l) => _cantidadDe(l) != l.cantidad);

  String? get _canal => _canalElegido ?? o.proveedor.canal;

  void _avisar(String texto) {
    final m = ScaffoldMessenger.of(context);
    m.hideCurrentSnackBar();
    m.showSnackBar(SnackBar(content: Text(texto)));
  }

  Future<void> _accion(Future<String?> Function() hacer) async {
    if (_ocupado) return;
    setState(() => _ocupado = true);
    try {
      final aviso = await hacer();
      if (aviso != null) _avisar(aviso);
    } on ApiException catch (e) {
      _avisar(e.detalleDe('canal') ?? e.message);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<OrdenCompra> _guardarSiHace() async {
    final acciones = ref.read(accionesOrdenProvider);
    if (!_hayCambios) return o;
    return acciones.guardar(o.id, [
      for (final l in _lineas) (productoId: l.producto.id, cantidad: _cantidadDe(l)!, alertaId: l.alertaId),
    ]);
  }

  Future<void> _guardar() => _accion(() async {
        await _guardarSiHace();
        return 'Borrador guardado.';
      });

  Future<void> _confirmar() => _accion(() async {
        await _guardarSiHace();
        final nueva = await ref.read(accionesOrdenProvider).confirmar(o.id, canal: _canalElegido);
        return avisoConfirmada(nueva);
      });

  Future<void> _marcarEnviada() => _accion(() async {
        await ref.read(accionesOrdenProvider).marcarEnviada(o.id);
        return 'Orden ${o.numero} marcada como enviada.';
      });

  Future<void> _cancelar() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        content: Text('¿Cancelar la orden ${o.numero}? Se conserva como cancelada.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Volver')),
          TextButton(
            onPressed: () => Navigator.of(c).pop(true),
            style: TextButton.styleFrom(foregroundColor: c.tokens.crit),
            child: const Text('Cancelar orden'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _accion(() async {
      await ref.read(accionesOrdenProvider).cancelar(o.id);
      if (mounted) context.go(Rutas.ordenes);
      return 'Orden ${o.numero} cancelada.';
    });
  }

  Future<void> _abrirWhatsApp() async {
    final url = o.whatsappUrl;
    if (url == null) return;
    // La URL es la del servidor, tal cual (ADR 0015): no se arma acá.
    final abrio = await ref.read(abrirEnlaceProvider)(Uri.parse(url));
    if (!abrio) _avisar('No se pudo abrir WhatsApp. Copiá el texto y envialo a mano.');
  }

  Future<void> _copiar() async {
    await Clipboard.setData(ClipboardData(text: textoParaCopiar(o)));
    _avisar('Texto copiado. Pegalo en WhatsApp o en tu correo.');
  }

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final p = o.proveedor;
    final canales = canalesDe(email: p.email, whatsapp: p.whatsapp);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(children: [Pildora(etiquetaEstadoOrden[o.estado] ?? o.estado, color: colorEstado(k, o.estado))]),
        const SizedBox(height: 8),
        Text(fraseEstado(o), style: TextStyle(color: k.t1, height: 1.35)),
        const SizedBox(height: 14),
        _Proveedor(p: p),
        const SizedBox(height: 12),
        _Lineas(
          lineas: _lineas,
          original: o,
          editable: _editable,
          cantidades: _cantidades,
          error: (l) => _cantidadDe(l) == null ? 'Entre 1 y 1.000.000' : null,
          onCambio: () => setState(() {}),
          onQuitar: _lineas.length > 1 ? (l) => setState(() => _lineas.remove(l)) : null,
        ),
        if (_editable) ...[
          const SizedBox(height: 8),
          Text(
            _lineas.length == 1
                ? 'Una orden necesita al menos un producto: si ya no la querés, cancelá el borrador. $avisoEdicionEnLaWeb'
                : avisoEdicionEnLaWeb,
            style: TextStyle(fontSize: 12, color: k.t2, height: 1.35),
          ),
          if (canales.length == 2) ...[
            const SizedBox(height: 14),
            Text('Enviar por', style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
            const SizedBox(height: 6),
            SelectorChips<String>(
              opciones: canales,
              actual: _canal ?? canales.first,
              etiqueta: (c) => etiquetaCanal[c]!,
              onElegir: (c) => setState(() => _canalElegido = c),
            ),
          ],
          const SizedBox(height: 12),
          Aviso(avisoDeEnvio(_canal, email: p.email, whatsapp: p.whatsapp)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _ocupado || !_validas ? null : _confirmar,
            child: Text(textoConfirmar(_canal)),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _ocupado || !_hayCambios || !_validas ? null : _guardar,
            child: const Text('Guardar'),
          ),
          TextButton(
            onPressed: _ocupado ? null : _cancelar,
            style: TextButton.styleFrom(foregroundColor: k.crit),
            child: const Text('Cancelar borrador'),
          ),
        ],
        if (o.esConfirmada) ...[
          const SizedBox(height: 12),
          if (o.canal == 'WHATSAPP')
            Aviso(
              o.whatsappUrl != null
                  ? 'Falta enviarla: abrí WhatsApp, mandale el mensaje a ${p.nombre} y después tocá "Ya la envié".'
                  : 'El teléfono de ${p.nombre} ya no sirve para WhatsApp. Corregilo en el proveedor o copiá el texto y '
                      'enviala por otro medio.',
              tono: o.whatsappUrl != null ? TonoAviso.info : TonoAviso.warn,
            )
          else if (etiquetaMotivoNoEnvio[o.motivoNoEnvio] != null)
            Aviso(etiquetaMotivoNoEnvio[o.motivoNoEnvio]!, tono: TonoAviso.warn),
          if (widget.opera && o.whatsappUrl != null) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _abrirWhatsApp,
              style: FilledButton.styleFrom(backgroundColor: k.whatsapp, foregroundColor: k.onWhatsapp),
              icon: const Icon(Icons.chat),
              label: const Text('Abrir WhatsApp'),
            ),
          ],
          if (widget.opera) ...[
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _ocupado ? null : _marcarEnviada, child: const Text('Ya la envié')),
          ],
        ],
        const SizedBox(height: 16),
        _Mensaje(o: o, onCopiar: o.esBorrador ? null : _copiar),
      ],
    );
  }
}

class _Proveedor extends StatelessWidget {
  const _Proveedor({required this.p});

  final ProveedorOrden p;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final detalle = TextStyle(fontSize: 13, color: k.t2, height: 1.4);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Proveedor', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: k.t2)),
            const SizedBox(height: 4),
            Text(p.nombre, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
            if (p.email != null) Text(p.email!, style: detalle),
            if (p.whatsapp != null) Text('WhatsApp ${formatearWhatsApp(p.whatsapp!)}', style: detalle),
            if (p.email == null && p.whatsapp == null) Text('Sin correo ni WhatsApp cargados', style: detalle),
          ],
        ),
      ),
    );
  }
}

class _Lineas extends StatelessWidget {
  const _Lineas({
    required this.lineas,
    required this.original,
    required this.editable,
    required this.cantidades,
    required this.error,
    required this.onCambio,
    required this.onQuitar,
  });

  final List<LineaOrden> lineas;
  final OrdenCompra original;
  final bool editable;
  final Map<String, TextEditingController> cantidades;
  final String? Function(LineaOrden) error;
  final VoidCallback onCambio;
  final void Function(LineaOrden)? onQuitar;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final l in lineas) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.producto.nombre, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
                        Text(
                          '${l.producto.codigo} · costo ${l.costoUnitarioNeto == null ? 'a confirmar' : formatoPesos(l.costoUnitarioNeto)}',
                          style: TextStyle(fontSize: 12, color: k.t2),
                        ),
                        if (!editable)
                          Text(
                            '${formatoEntero(l.cantidad)} u. · ${l.subtotal == null ? 'a confirmar' : formatoPesos(l.subtotal)}',
                            style: TextStyle(fontSize: 13, color: k.t1),
                          ),
                      ],
                    ),
                  ),
                  if (editable) ...[
                    SizedBox(
                      width: 96,
                      child: TextField(
                        controller: cantidades[l.id],
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        textAlign: TextAlign.end,
                        onChanged: (_) => onCambio(),
                        decoration: InputDecoration(
                          labelText: 'Cantidad',
                          isDense: true,
                          errorText: error(l),
                          errorMaxLines: 2,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Quitar',
                      onPressed: onQuitar == null ? null : () => onQuitar!(l),
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
            ],
            Divider(color: k.line2),
            Row(
              children: [
                Expanded(child: Text('Total neto estimado (sin IVA)', style: TextStyle(color: k.t2))),
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Text(formatoPesos(original.totalNeto), style: TextStyle(fontWeight: FontWeight.w800, color: k.t1)),
                ),
              ],
            ),
            if (editable)
              Text('El total se recalcula al guardar.', style: TextStyle(fontSize: 11, color: k.t2)),
          ],
        ),
      ),
    );
  }
}

class _Mensaje extends StatelessWidget {
  const _Mensaje({required this.o, required this.onCopiar});

  final OrdenCompra o;
  final VoidCallback? onCopiar;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mensaje', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: k.t2)),
            const SizedBox(height: 6),
            Text(o.asunto, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
            const SizedBox(height: 6),
            Text(o.texto, style: TextStyle(color: k.t1, height: 1.4)),
            if (onCopiar != null) ...[
              const SizedBox(height: 8),
              TextButton.icon(onPressed: onCopiar, icon: const Icon(Icons.copy), label: const Text('Copiar texto')),
            ],
          ],
        ),
      ),
    );
  }
}
