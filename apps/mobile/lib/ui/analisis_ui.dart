import 'package:flutter/material.dart';

import '../app/theme.dart';

/// Piezas comunes de las pantallas de análisis (design D7).

/// Tarjeta de indicador: título, valor grande y detalle.
class Indicador extends StatelessWidget {
  const Indicador({super.key, required this.titulo, required this.valor, required this.detalle, this.onTap});

  final String titulo;
  final String valor;
  final String detalle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: TextStyle(fontSize: 12, color: k.t2, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(valor, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: k.t1)),
              ),
              const SizedBox(height: 4),
              Text(detalle, style: TextStyle(fontSize: 11, color: k.t2, height: 1.3)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Grilla de dos columnas para indicadores, con alto natural.
class GrillaIndicadores extends StatelessWidget {
  const GrillaIndicadores({super.key, required this.hijos});

  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    final filas = <Widget>[];
    for (var i = 0; i < hijos.length; i += 2) {
      filas.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: hijos[i]),
            const SizedBox(width: 10),
            Expanded(child: i + 1 < hijos.length ? hijos[i + 1] : const SizedBox.shrink()),
          ],
        ),
      ));
      if (i + 2 < hijos.length) filas.add(const SizedBox(height: 10));
    }
    return Column(children: filas);
  }
}

/// Chips para elegir el período o el filtro.
class SelectorChips<T> extends StatelessWidget {
  const SelectorChips({super.key, required this.opciones, required this.actual, required this.etiqueta, required this.onElegir});

  final List<T> opciones;
  final T actual;
  final String Function(T) etiqueta;
  final ValueChanged<T> onElegir;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final o in opciones)
            ChoiceChip(label: Text(etiqueta(o)), selected: o == actual, onSelected: (_) => onElegir(o)),
        ],
      );
}

/// Píldora con punto de color y texto `t1` (el color del estado no llega a AA como texto chico).
class Pildora extends StatelessWidget {
  const Pildora(this.texto, {super.key, required this.color});

  final String texto;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.circle, size: 7, color: color),
            const SizedBox(width: 5),
            Text(texto, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: context.tokens.t1)),
          ],
        ),
      );
}

/// Estado vacío con título y explicación.
class Vacio extends StatelessWidget {
  const Vacio({super.key, required this.titulo, required this.texto, this.icono = Icons.check_circle_outline});

  final String titulo;
  final String texto;
  final IconData icono;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 8),
      child: Column(
        children: [
          Icon(icono, size: 40, color: k.t3),
          const SizedBox(height: 10),
          Text(titulo, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, color: k.t1)),
          const SizedBox(height: 6),
          Text(texto, textAlign: TextAlign.center, style: TextStyle(color: k.t2, height: 1.35)),
        ],
      ),
    );
  }
}

/// Nota al pie (explicación del cálculo o ideas).
class NotaAlPie extends StatelessWidget {
  const NotaAlPie(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Text(texto, style: TextStyle(fontSize: 12, color: context.tokens.t2, height: 1.4)),
      );
}

/// "Cargar más" al final de una lista, con el error de la página siguiente si lo hubo.
class CargarMas extends StatelessWidget {
  const CargarMas({super.key, required this.hayMas, required this.cargando, required this.error, required this.onCargar});

  final bool hayMas;
  final bool cargando;
  final String? error;
  final VoidCallback onCargar;

  @override
  Widget build(BuildContext context) {
    if (!hayMas) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        children: [
          if (error != null) Text(error!, style: TextStyle(color: context.tokens.crit)),
          TextButton(onPressed: cargando ? null : onCargar, child: Text(cargando ? 'Cargando…' : 'Cargar más')),
        ],
      ),
    );
  }
}
