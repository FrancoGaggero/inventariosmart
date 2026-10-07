import 'package:flutter/material.dart';

import '../../app/router.dart';
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

/// Secciones de pantallas de "Más" según rol y plan, como `lib/navegacion.ts` en la web. Las
/// pantallas nuevas se suman acá. Nunca devuelve una sección vacía.
List<SeccionMas> seccionesMas(Me me) {
  final analisis = [
    // Las alertas se ven en cualquier plan: en FREE la pantalla explica que son del PRO (CP-M.9f).
    if (me.veAnalisis)
      const EntradaMas(
        etiqueta: 'Alertas de reposición',
        icono: Icons.notifications_active_outlined,
        ruta: Rutas.alertas,
        detalle: 'Qué reponer antes de quedarte sin stock',
      ),
    if (me.veAnalisis && me.tienePro) ...const [
      EntradaMas(
        etiqueta: 'Falta de stock',
        icono: Icons.trending_down,
        ruta: Rutas.quiebres,
        detalle: 'Cuánto dejaste de ganar sin stock',
      ),
      EntradaMas(
        etiqueta: 'Stock parado',
        icono: Icons.hourglass_bottom,
        ruta: Rutas.stockParado,
        detalle: 'Plata en productos que no se venden',
      ),
    ],
  ];
  return [
    if (analisis.isNotEmpty) SeccionMas(titulo: 'Análisis', entradas: analisis),
    // En cualquier plan: sin PRO la pantalla explica el plan (CP-M.13k).
    if (me.veOrdenes)
      const SeccionMas(
        titulo: 'Compras',
        entradas: [
          EntradaMas(
            etiqueta: 'Órdenes de compra',
            icono: Icons.receipt_long_outlined,
            ruta: Rutas.ordenes,
            detalle: 'Confirmalas y envialas por WhatsApp',
          ),
        ],
      ),
    // En cualquier plan: sin PREMIUM la pantalla explica el plan (CP-M.12j).
    if (me.usaAsistente)
      const SeccionMas(
        titulo: 'Asistente',
        entradas: [
          EntradaMas(
            etiqueta: 'Asistente con IA',
            icono: Icons.auto_awesome_outlined,
            ruta: Rutas.asistente,
            detalle: 'Preguntale por tu negocio',
          ),
        ],
      ),
  ];
}

/// Lo que se maneja sólo desde la web (ADR 0024, CP-M.8d).
const tareasDeLaWeb = [
  'Importar planillas de productos',
  'Proveedores y listas de precios',
  'Gastos del mes',
  'Remarcación de precios',
  'Usuarios y planes',
];

const direccionWeb = 'inventariosmart0.vercel.app';
