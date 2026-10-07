/// Órdenes de compra (HU-07, HU-16): respuestas de `/purchase-orders` (design D2 de mobile-orders).
library;

import 'dashboard.dart';

/// Filtros de la lista, como en la web: Todas, Borradores, Confirmadas, Enviadas y Canceladas.
const filtrosOrdenes = ['TODAS', 'BORRADOR', 'CONFIRMADA', 'ENVIADA', 'CANCELADA'];

class ProveedorRefOrden {
  const ProveedorRefOrden({required this.id, required this.nombre});

  final String id;
  final String nombre;

  factory ProveedorRefOrden.fromJson(Map<String, dynamic> j) =>
      ProveedorRefOrden(id: j['id'] as String, nombre: j['nombre'] as String);
}

class OrdenResumen {
  const OrdenResumen({
    required this.id,
    required this.numero,
    required this.estado,
    required this.proveedor,
    required this.cantidadItems,
    required this.totalNeto,
    required this.motivoNoEnvio,
    required this.canal,
    required this.confirmadaEn,
    required this.enviadaEn,
    required this.creadoEn,
  });

  final String id;
  final String numero;

  /// BORRADOR, CONFIRMADA, ENVIADA o CANCELADA.
  final String estado;
  final ProveedorRefOrden proveedor;
  final int cantidadItems;
  final String totalNeto;
  final String? motivoNoEnvio;

  /// EMAIL, WHATSAPP, OTRO o null.
  final String? canal;
  final String? confirmadaEn;
  final String? enviadaEn;
  final String creadoEn;

  /// Fecha que muestra la lista: la del último paso.
  String get fecha => enviadaEn ?? confirmadaEn ?? creadoEn;

  factory OrdenResumen.fromJson(Map<String, dynamic> j) => OrdenResumen(
        id: j['id'] as String,
        numero: j['numero'] as String,
        estado: j['estado'] as String,
        proveedor: ProveedorRefOrden.fromJson(j['proveedor'] as Map<String, dynamic>),
        cantidadItems: j['cantidadItems'] as int,
        totalNeto: j['totalNeto'] as String,
        motivoNoEnvio: j['motivoNoEnvio'] as String?,
        canal: j['canal'] as String?,
        confirmadaEn: j['confirmadaEn'] as String?,
        enviadaEn: j['enviadaEn'] as String?,
        creadoEn: j['creadoEn'] as String,
      );
}

class ProveedorOrden {
  const ProveedorOrden({
    required this.id,
    required this.nombre,
    required this.email,
    required this.telefono,
    required this.whatsapp,
    required this.canal,
  });

  final String id;
  final String nombre;
  final String? email;
  final String? telefono;

  /// Número normalizado para WhatsApp (p. ej. "5491123456789") o null.
  final String? whatsapp;

  /// Canal preferido del proveedor: EMAIL, WHATSAPP o null.
  final String? canal;

  factory ProveedorOrden.fromJson(Map<String, dynamic> j) => ProveedorOrden(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        email: j['email'] as String?,
        telefono: j['telefono'] as String?,
        whatsapp: j['whatsapp'] as String?,
        canal: j['canal'] as String?,
      );
}

class LineaOrden {
  const LineaOrden({
    required this.id,
    required this.producto,
    required this.alertaId,
    required this.cantidad,
    required this.costoUnitarioNeto,
    required this.subtotal,
  });

  final String id;
  final ProductoRef producto;
  final String? alertaId;
  final int cantidad;

  /// null si el proveedor todavía no informó el costo ("a confirmar").
  final String? costoUnitarioNeto;
  final String? subtotal;

  factory LineaOrden.fromJson(Map<String, dynamic> j) => LineaOrden(
        id: j['id'] as String,
        producto: ProductoRef.fromJson(j['producto'] as Map<String, dynamic>),
        alertaId: j['alertaId'] as String?,
        cantidad: j['cantidad'] as int,
        costoUnitarioNeto: j['costoUnitarioNeto'] as String?,
        subtotal: j['subtotal'] as String?,
      );
}

class OrdenCompra {
  const OrdenCompra({
    required this.id,
    required this.numero,
    required this.estado,
    required this.proveedor,
    required this.items,
    required this.totalNeto,
    required this.asunto,
    required this.texto,
    required this.motivoNoEnvio,
    required this.canal,
    required this.whatsappUrl,
    required this.confirmadaPor,
    required this.confirmadaEn,
    required this.enviadaEn,
    required this.enviadaA,
    required this.canceladaEn,
    required this.creadoEn,
  });

  final String id;
  final String numero;
  final String estado;
  final ProveedorOrden proveedor;
  final List<LineaOrden> items;
  final String totalNeto;
  final String asunto;
  final String texto;
  final String? motivoNoEnvio;
  final String? canal;

  /// Enlace `https://wa.me/...` armado por el servidor (ADR 0015); sólo en una CONFIRMADA por WhatsApp.
  final String? whatsappUrl;
  final String? confirmadaPor;
  final String? confirmadaEn;
  final String? enviadaEn;
  final String? enviadaA;
  final String? canceladaEn;
  final String creadoEn;

  bool get esBorrador => estado == 'BORRADOR';
  bool get esConfirmada => estado == 'CONFIRMADA';

  factory OrdenCompra.fromJson(Map<String, dynamic> j) => OrdenCompra(
        id: j['id'] as String,
        numero: j['numero'] as String,
        estado: j['estado'] as String,
        proveedor: ProveedorOrden.fromJson(j['proveedor'] as Map<String, dynamic>),
        items: (j['items'] as List<dynamic>)
            .map((e) => LineaOrden.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        totalNeto: j['totalNeto'] as String,
        asunto: j['asunto'] as String,
        texto: j['texto'] as String,
        motivoNoEnvio: j['motivoNoEnvio'] as String?,
        canal: j['canal'] as String?,
        whatsappUrl: j['whatsappUrl'] as String?,
        confirmadaPor: (j['confirmadaPor'] as Map<String, dynamic>?)?['nombre'] as String?,
        confirmadaEn: j['confirmadaEn'] as String?,
        enviadaEn: j['enviadaEn'] as String?,
        enviadaA: j['enviadaA'] as String?,
        canceladaEn: j['canceladaEn'] as String?,
        creadoEn: j['creadoEn'] as String,
      );
}
