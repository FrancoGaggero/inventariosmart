import { Controller, Get } from '@nestjs/common';

/** Controlador sólo para tests: recurso con campos sensibles (CP-11.4b). */
@Controller('_test/sensible')
export class SensibleTestController {
  @Get()
  obtener() {
    return {
      nombre: 'Filtro Aire FA-220',
      precioVenta: '3900.00',
      costo: '2340.00',
      margenBruto: '38.4',
      margenNeto: '28.9',
      proveedor: { nombre: 'AutoParts', costoUltimaLista: '2340.00' },
      historial: [{ fecha: '2026-09-01', costo: '2200.00' }],
    };
  }
}
