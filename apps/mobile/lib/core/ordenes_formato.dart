import 'formato.dart';
import 'modelos/ordenes.dart';

/// Textos de las órdenes de compra (HU-07, HU-16; design D1 de mobile-orders). Son copia de
/// `apps/web/src/lib/canales.ts` y de las etiquetas de `packages/shared/src/ordenes.ts` y
/// `whatsapp.ts`: si cambia una frase en la web, se cambia acá.

const etiquetaEstadoOrden = {
  'BORRADOR': 'Borrador',
  'CONFIRMADA': 'Confirmada',
  'ENVIADA': 'Enviada',
  'CANCELADA': 'Cancelada',
};

const etiquetaFiltroOrden = {
  'TODAS': 'Todas',
  'BORRADOR': 'Borradores',
  'CONFIRMADA': 'Confirmadas',
  'ENVIADA': 'Enviadas',
  'CANCELADA': 'Canceladas',
};

const etiquetaCanal = {'EMAIL': 'Correo', 'WHATSAPP': 'WhatsApp', 'OTRO': 'Otro medio'};

const etiquetaMotivoNoEnvio = {
  'SIN_EMAIL': 'El proveedor no tiene email ni WhatsApp cargados: enviala por otro medio.',
  'ENVIO_FALLIDO': 'El correo no pudo enviarse: copiá el texto y envialo por otro medio.',
};

const planOrdenes = 'Disponible en el plan PRO, junto con las alertas de reposición que la alimentan.';

const avisoEdicionEnLaWeb =
    'Para agregar productos, cambiar el proveedor o reescribir el texto, usá la web. Los costos se actualizan con la '
    'lista vigente del proveedor al guardar.';

/// "5491123456789" → "+54 9 11 2345-6789" (como `formatearWhatsApp` de shared).
String formatearWhatsApp(String numero) {
  if (!numero.startsWith('549') || numero.length != 13) return '+$numero';
  final nacional = numero.substring(3);
  final area = nacional.startsWith('11') ? 2 : 3;
  final resto = nacional.substring(area);
  return '+54 9 ${nacional.substring(0, area)} ${resto.substring(0, resto.length - 4)}-${resto.substring(resto.length - 4)}';
}

/// Canales que el proveedor puede usar con los datos que tiene cargados.
List<String> canalesDe({required String? email, required String? whatsapp}) => [
      if (email != null) 'EMAIL',
      if (whatsapp != null) 'WHATSAPP',
    ];

/// Texto del botón de confirmar según por dónde sale la orden.
String textoConfirmar(String? canal) => switch (canal) {
      'EMAIL' => 'Confirmar y enviar por correo',
      'WHATSAPP' => 'Confirmar y enviar por WhatsApp',
      _ => 'Confirmar',
    };

/// Qué va a pasar al confirmar, en lenguaje claro.
String avisoDeEnvio(String? canal, {required String? email, required String? whatsapp}) {
  if (canal == 'EMAIL' && email != null) {
    return 'Al confirmar se envía por correo a $email, con tu correo como respuesta.';
  }
  if (canal == 'WHATSAPP' && whatsapp != null) {
    return 'Al confirmar vas a poder abrir WhatsApp con el mensaje ya escrito para ${formatearWhatsApp(whatsapp)}. '
        'Lo enviás vos desde tu teléfono.';
  }
  return 'Este proveedor no tiene email ni WhatsApp: al confirmar, la orden queda lista para que copies el texto y '
      'la envíes por otro medio.';
}

/// Cómo salió una orden enviada.
String fraseEnviada({required String? canal, required String? enviadaA, required String fecha}) {
  if (canal == 'WHATSAPP') return 'Enviada por WhatsApp a ${enviadaA ?? 'el proveedor'} el $fecha.';
  if (canal == 'OTRO') return 'Marcada como enviada el $fecha.';
  return 'Enviada por correo a ${enviadaA ?? 'el proveedor'} el $fecha.';
}

/// Frase de la cabecera del detalle según el estado.
String fraseEstado(OrdenCompra o) => switch (o.estado) {
      'ENVIADA' => fraseEnviada(canal: o.canal, enviadaA: o.enviadaA, fecha: formatoFecha(o.enviadaEn ?? o.creadoEn)),
      'CONFIRMADA' => 'Confirmada el ${formatoFecha(o.confirmadaEn ?? o.creadoEn)} por ${o.confirmadaPor ?? 'el dueño'}.',
      'CANCELADA' => 'Cancelada el ${formatoFecha(o.canceladaEn ?? o.creadoEn)}.',
      _ => 'Borrador creado el ${formatoFecha(o.creadoEn)}. Nada se envía hasta que confirmes.',
    };

/// Lo que se copia al portapapeles: asunto y texto, como en la web.
String textoParaCopiar(OrdenCompra o) => '${o.asunto}\n\n${o.texto}';

/// Aviso después de confirmar, según cómo quedó la orden.
String avisoConfirmada(OrdenCompra o) {
  if (o.estado == 'ENVIADA') return 'Orden ${o.numero} enviada a ${o.enviadaA ?? o.proveedor.nombre}.';
  if (o.canal == 'WHATSAPP') {
    return 'Orden ${o.numero} confirmada. Abrí WhatsApp para enviarle el mensaje a ${o.proveedor.nombre}.';
  }
  final motivo = etiquetaMotivoNoEnvio[o.motivoNoEnvio];
  return motivo == null ? 'Orden ${o.numero} confirmada.' : 'Orden ${o.numero} confirmada. $motivo';
}

/// "1 ítem" / "3 ítems".
String cantidadDeItems(int n) => n == 1 ? '1 ítem' : '$n ítems';
