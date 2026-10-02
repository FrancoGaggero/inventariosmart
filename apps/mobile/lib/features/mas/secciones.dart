import 'package:flutter/material.dart';

import '../../core/modelos/me.dart';

/// Una pantalla a la que se llega desde "Más".
class EntradaMas {
  const EntradaMas({required this.etiqueta, required this.icono, required this.ruta, this.detalle});

  final String etiqueta;
  final IconData icono;
  final String ruta;
  final String? detalle;
}

class SeccionMas {
  const SeccionMas({required this.titulo, required this.entradas});

  final String titulo;
  final List<EntradaMas> entradas;
}

/// Secciones de pantallas de "Más" según rol y plan (design D4), como `lib/navegacion.ts` en la web.
/// Hoy no hay ninguna: las suman `mobile-stock-insights`, `mobile-assistant` y `mobile-orders`.
/// Nunca devuelve una sección vacía.
List<SeccionMas> seccionesMas(Me me) => const <SeccionMas>[];

/// Lo que se maneja sólo desde la web (ADR 0024, CP-M.8d).
const tareasDeLaWeb = [
  'Importar planillas de productos',
  'Proveedores y listas de precios',
  'Gastos del mes',
  'Remarcación de precios',
  'Usuarios y planes',
];

const direccionWeb = 'inventariosmart0.vercel.app';
