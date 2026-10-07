import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/asistente_formato.dart';
import '../../core/auth/sesion.dart';
import '../../core/modelos/asistente.dart';
import '../../ui/aviso.dart';
import '../../ui/aviso_plan.dart';
import '../../ui/estado_carga.dart';
import 'asistente_provider.dart';

/// Chat con el asistente (HU-08, CP-M.12 a CP-M.12k).
class AsistenteScreen extends ConsumerStatefulWidget {
  const AsistenteScreen({super.key});

  @override
  ConsumerState<AsistenteScreen> createState() => _AsistenteScreenState();
}

class _AsistenteScreenState extends ConsumerState<AsistenteScreen> {
  final _campo = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _campo.text = ref.read(chatProvider).borrador;
  }

  @override
  void dispose() {
    _campo.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _alFinal() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _enviar(String texto) => ref.read(chatProvider.notifier).enviar(texto);

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    final chat = ref.watch(chatProvider);
    ref.listen(chatProvider, (antes, ahora) {
      // El borrador vuelve al campo si el envío falló, y se vacía si salió.
      if (_campo.text != ahora.borrador) _campo.text = ahora.borrador;
      if ((antes?.mensajes.length ?? 0) != ahora.mensajes.length || ahora.pendiente != antes?.pendiente) _alFinal();
    });

    if (me != null && !me.tienePremium) {
      return Scaffold(
        appBar: AppBar(title: const Text('Asistente')),
        body: ListView(padding: const EdgeInsets.all(16), children: const [AvisoPlan(avisoPlanAsistente)]),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente'),
        actions: [
          IconButton(
            tooltip: 'Conversaciones',
            icon: const Icon(Icons.history),
            onPressed: () => context.push(Rutas.conversaciones),
          ),
          IconButton(
            tooltip: 'Nueva conversación',
            icon: const Icon(Icons.edit_square),
            onPressed: chat.vacio || chat.enviando ? null : () => ref.read(chatProvider.notifier).nueva(),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _Mensajes(chat: chat, scroll: _scroll, onSugerencia: _enviar)),
          _Pie(campo: _campo, chat: chat, onEnviar: () => _enviar(_campo.text)),
        ],
      ),
    );
  }
}

class _Mensajes extends ConsumerWidget {
  const _Mensajes({required this.chat, required this.scroll, required this.onSugerencia});

  final EstadoChat chat;
  final ScrollController scroll;
  final ValueChanged<String> onSugerencia;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    if (chat.abriendo) return const Cargando();
    if (chat.errorAlAbrir != null) {
      return ErrorConReintento(
        error: chat.errorAlAbrir!,
        onReintentar: () => ref.read(chatProvider.notifier).abrir(chat.conversacionId!),
      );
    }
    if (chat.vacio) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 8),
          Icon(Icons.auto_awesome_outlined, size: 36, color: k.brand3),
          const SizedBox(height: 10),
          Text(
            '¿Qué querés saber?',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: k.t1),
          ),
          const SizedBox(height: 4),
          Text(
            'Preguntale por tu negocio como se lo preguntarías a una persona.',
            textAlign: TextAlign.center,
            style: TextStyle(color: k.t2),
          ),
          const SizedBox(height: 18),
          // Botones de ancho completo: en 360 dp la pregunta más larga no entra en un chip.
          for (final p in preguntasSugeridas)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  side: BorderSide(color: k.line2),
                  backgroundColor: k.card,
                ),
                onPressed: chat.enviando ? null : () => onSugerencia(p),
                child: Row(
                  children: [
                    Icon(Icons.chat_bubble_outline, size: 18, color: k.brand3),
                    const SizedBox(width: 10),
                    Expanded(child: Text(p, style: TextStyle(color: k.t1, fontWeight: FontWeight.w500))),
                  ],
                ),
              ),
            ),
        ],
      );
    }
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      children: [
        for (final m in chat.mensajes) _Burbuja(mensaje: m),
        if (chat.pendiente != null) ...[
          _Burbuja(mensaje: MensajeAsistente(id: 'pendiente', rol: 'USUARIO', contenido: chat.pendiente!, creadoEn: '')),
          const _Esperando(),
        ],
      ],
    );
  }
}

class _Burbuja extends StatelessWidget {
  const _Burbuja({required this.mensaje});

  final MensajeAsistente mensaje;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final propio = mensaje.esDelUsuario;
    final fuentes = fraseFuentes(mensaje.fuentes);
    final estilo = TextStyle(color: k.t1, height: 1.4);
    final contenido = propio
        ? Text(mensaje.contenido, style: estilo)
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final b in bloquesDeTexto(mensaje.contenido))
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: switch (b) {
                    Parrafo(:final texto) => Text(texto, style: estilo),
                    Lista(:final items) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final i in items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 3),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8, right: 8, left: 2),
                                    child: Icon(Icons.circle, size: 5, color: k.t2),
                                  ),
                                  Expanded(child: Text(i, style: estilo)),
                                ],
                              ),
                            ),
                        ],
                      ),
                  },
                ),
            ],
          );
    return Semantics(
      label: propio ? 'Vos:' : 'Asistente:',
      child: Align(
        alignment: propio ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * (propio ? 0.82 : 0.92)),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: propio ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: propio ? k.brand.withValues(alpha: 0.18) : k.card,
                    border: propio ? null : Border.all(color: k.line),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(propio ? 16 : 4),
                      bottomRight: Radius.circular(propio ? 4 : 16),
                    ),
                  ),
                  child: contenido,
                ),
                for (final a in mensaje.acciones) _TarjetaOrden(accion: a),
                if (fuentes.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 4),
                    child: Text(fuentes, style: TextStyle(fontSize: 12, color: k.t2)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Orden que el asistente dejó en BORRADOR (CP-M.12e): lleva al detalle para revisarla y confirmarla.
class _TarjetaOrden extends StatelessWidget {
  const _TarjetaOrden({required this.accion});

  final AccionAsistente accion;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      decoration: BoxDecoration(
        color: k.card2,
        border: Border.all(color: k.brand.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push('${Rutas.ordenes}/${accion.ordenId}'),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.receipt_long_outlined, color: k.brand3, size: 22),
                const SizedBox(width: 10),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Orden ${accion.numero} para ${accion.proveedor}',
                        style: TextStyle(fontWeight: FontWeight.w700, color: k.t1),
                      ),
                      const SizedBox(height: 2),
                      Text(borradorSinEnviar, style: TextStyle(fontSize: 12, color: k.t2, height: 1.35)),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Icon(Icons.chevron_right, color: k.t3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Esperando extends StatelessWidget {
  const _Esperando();

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Align(
      alignment: Alignment.centerLeft,
      child: Semantics(
        liveRegion: true,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: k.card,
            border: Border.all(color: k.line),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: k.brand3)),
              const SizedBox(width: 10),
              Text('Consultando tus datos…', style: TextStyle(color: k.t2)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pie extends ConsumerWidget {
  const _Pie({required this.campo, required this.chat, required this.onEnviar});

  final TextEditingController campo;
  final EstadoChat chat;
  final VoidCallback onEnviar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final aviso = chat.aviso;
    return Material(
      color: k.bg2,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (aviso != null) ...[
                switch (aviso.tono) {
                  TonoAvisoAsistente.plan => AvisoPlan(aviso.texto),
                  TonoAvisoAsistente.warn => Aviso(aviso.texto, tono: TonoAviso.warn),
                  TonoAvisoAsistente.error => Aviso(aviso.texto, tono: TonoAviso.error),
                },
                const SizedBox(height: 8),
              ],
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: campo,
                builder: (context, valor, _) {
                  final texto = valor.text;
                  final excede = excedeElLargo(texto);
                  final habilitado = puedeEnviar(texto, chat.enviando || chat.abriendo);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: campo,
                              minLines: 1,
                              maxLines: 5,
                              keyboardType: TextInputType.multiline,
                              textInputAction: TextInputAction.newline,
                              textCapitalization: TextCapitalization.sentences,
                              onChanged: (t) => ref.read(chatProvider.notifier).escribir(t),
                              decoration: const InputDecoration(
                                hintText: 'Escribí tu consulta…',
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            tooltip: 'Enviar',
                            onPressed: habilitado ? onEnviar : null,
                            icon: const Icon(Icons.send),
                            style: IconButton.styleFrom(
                              backgroundColor: k.brand,
                              foregroundColor: k.onBrand,
                              minimumSize: const Size(48, 48),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(avisoIa, style: TextStyle(fontSize: 11, color: k.t2, height: 1.3)),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            contadorDeCaracteres(texto),
                            style: TextStyle(
                              fontSize: 11,
                              color: excede ? k.crit : k.t2,
                              fontWeight: excede ? FontWeight.w700 : FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
