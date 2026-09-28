import { describe, expect, it } from 'vitest';
import { ConfirmarOrdenSchema } from './ordenes';
import { ProveedorCreateSchema, ProveedorPatchSchema } from './proveedores';
import {
  canalDeProveedor,
  enlaceWhatsApp,
  formatearWhatsApp,
  mensajeWhatsApp,
  MENSAJE_WHATSAPP_MAX,
  normalizarWhatsApp,
  NOTA_MENSAJE_RECORTADO,
  validarCanalPreferido,
} from './whatsapp';

describe('normalizarWhatsApp (CP-16.1)', () => {
  it('lleva los teléfonos argentinos a 549 + área + número', () => {
    expect(normalizarWhatsApp('011 15-2345-6789')).toBe('5491123456789');
    expect(normalizarWhatsApp('+54 9 351 234-5678')).toBe('5493512345678');
    expect(normalizarWhatsApp('0351 15 234 5678')).toBe('5493512345678');
    expect(normalizarWhatsApp('+54 11 2345-6789')).toBe('5491123456789');
  });

  it('acepta otras formas habituales de escribirlo', () => {
    expect(normalizarWhatsApp('11 2345 6789')).toBe('5491123456789');
    expect(normalizarWhatsApp('(0351) 15-2345678')).toBe('5493512345678');
    expect(normalizarWhatsApp('02944 15 456789')).toBe('5492944456789');
    expect(normalizarWhatsApp('0054 9 11 2345 6789')).toBe('5491123456789');
    expect(normalizarWhatsApp('54 9 11 2345 6789')).toBe('5491123456789');
    expect(normalizarWhatsApp('+54 011 15 2345 6789')).toBe('5491123456789');
    expect(normalizarWhatsApp('5491123456789')).toBe('5491123456789');
  });

  it('un teléfono sin código de área no sirve', () => {
    expect(normalizarWhatsApp('4567-8901')).toBeNull();
    expect(normalizarWhatsApp('15 2345 6789')).toBeNull();
  });

  it('descarta lo que no es un teléfono', () => {
    expect(normalizarWhatsApp(null)).toBeNull();
    expect(normalizarWhatsApp('')).toBeNull();
    expect(normalizarWhatsApp('   ')).toBeNull();
    expect(normalizarWhatsApp('no tiene')).toBeNull();
    expect(normalizarWhatsApp('011 2345 6789 int. 12')).toBeNull();
    expect(normalizarWhatsApp('+54')).toBeNull();
  });

  it('conserva los números de otro país', () => {
    expect(normalizarWhatsApp('+598 99 123 456')).toBe('59899123456');
    expect(normalizarWhatsApp('+1 (415) 555-0132')).toBe('14155550132');
    expect(normalizarWhatsApp('+1 23')).toBeNull();
  });

  it('muestra el número como se lee', () => {
    expect(formatearWhatsApp('5491123456789')).toBe('+54 9 11 2345-6789');
    expect(formatearWhatsApp('5493512345678')).toBe('+54 9 351 234-5678');
    expect(formatearWhatsApp('59899123456')).toBe('+59899123456');
  });
});

describe('canal del proveedor (CP-16.1b)', () => {
  const ambos = { email: 'compras@norte.com', telefono: '011 15-2345-6789' };

  it('sin preferencia usa el correo y, si no hay, WhatsApp', () => {
    expect(canalDeProveedor({ ...ambos, canalPreferido: null })).toBe('EMAIL');
    expect(canalDeProveedor({ email: null, telefono: ambos.telefono, canalPreferido: null })).toBe(
      'WHATSAPP',
    );
    expect(canalDeProveedor({ email: null, telefono: null, canalPreferido: null })).toBeNull();
    expect(
      canalDeProveedor({ email: null, telefono: '4567-8901', canalPreferido: null }),
    ).toBeNull();
  });

  it('el canal preferido manda cuando tiene los datos', () => {
    expect(canalDeProveedor({ ...ambos, canalPreferido: 'WHATSAPP' })).toBe('WHATSAPP');
    expect(canalDeProveedor({ ...ambos, canalPreferido: 'EMAIL' })).toBe('EMAIL');
    expect(canalDeProveedor({ ...ambos, telefono: '4567-8901', canalPreferido: 'WHATSAPP' })).toBe(
      'EMAIL',
    );
  });

  it('CP-16.1c valida el canal preferido contra los datos', () => {
    expect(validarCanalPreferido({ ...ambos, canalPreferido: 'WHATSAPP' })).toBeNull();
    expect(validarCanalPreferido({ ...ambos, canalPreferido: null })).toBeNull();
    expect(
      validarCanalPreferido({ ...ambos, telefono: '4567-8901', canalPreferido: 'WHATSAPP' }),
    ).toMatch(/código de área/);
    expect(validarCanalPreferido({ ...ambos, email: null, canalPreferido: 'EMAIL' })).toMatch(
      /email/,
    );
  });
});

describe('mensaje de WhatsApp (CP-16.4)', () => {
  const asunto = 'Orden de compra OC-0002 · Lubricentro carfax';

  it('lleva el asunto arriba y el texto debajo', () => {
    const texto = 'Hola Marta, necesito 70 filtros FA-220 para el lunes.';
    expect(mensajeWhatsApp(asunto, texto)).toBe(`${asunto}\n\n${texto}`);
  });

  it('CP-16.4b recorta en un salto de línea y avisa', () => {
    const lineas = Array.from(
      { length: 150 },
      (_, i) => `- PROD-${String(i).padStart(3, '0')} Producto de prueba número ${i}: 12 unidades`,
    );
    const texto = `Hola:\n\n${lineas.join('\n')}\n\nSaludos.`;
    expect(texto.length).toBeGreaterThan(MENSAJE_WHATSAPP_MAX);
    const mensaje = mensajeWhatsApp(asunto, texto);
    expect(mensaje.length).toBeLessThanOrEqual(MENSAJE_WHATSAPP_MAX);
    expect(mensaje.endsWith(NOTA_MENSAJE_RECORTADO)).toBe(true);
    const cuerpo = mensaje.slice(0, -NOTA_MENSAJE_RECORTADO.length).split('\n');
    expect(lineas).toContain(cuerpo[cuerpo.length - 1]);
    expect(cuerpo[0]).toBe(asunto);
  });

  it('un mensaje justo en el límite no se recorta', () => {
    const texto = 'x'.repeat(MENSAJE_WHATSAPP_MAX - asunto.length - 2);
    expect(mensajeWhatsApp(asunto, texto)).toHaveLength(MENSAJE_WHATSAPP_MAX);
    expect(mensajeWhatsApp(asunto, `${texto}x`).endsWith(NOTA_MENSAJE_RECORTADO)).toBe(true);
  });

  it('el enlace codifica acentos, espacios y saltos de línea', () => {
    const enlace = enlaceWhatsApp('5491123456789', 'Orden Nº 2\nFiltro & bujía: 50 %');
    expect(enlace).toBe(
      'https://wa.me/5491123456789?text=Orden%20N%C2%BA%202%0AFiltro%20%26%20buj%C3%ADa%3A%2050%20%25',
    );
    expect(decodeURIComponent(enlace.split('?text=')[1]!)).toBe('Orden Nº 2\nFiltro & bujía: 50 %');
  });
});

describe('esquemas', () => {
  it('el canal preferido es opcional y puede quitarse', () => {
    expect(ProveedorCreateSchema.parse({ nombre: 'Norte' }).canalPreferido).toBeUndefined();
    expect(
      ProveedorCreateSchema.parse({ nombre: 'Norte', canalPreferido: 'WHATSAPP' }).canalPreferido,
    ).toBe('WHATSAPP');
    expect(ProveedorPatchSchema.parse({ canalPreferido: null }).canalPreferido).toBeNull();
    expect(ProveedorPatchSchema.safeParse({ canalPreferido: 'OTRO' }).success).toBe(false);
  });

  it('la confirmación acepta el cuerpo vacío o un canal', () => {
    expect(ConfirmarOrdenSchema.parse(undefined)).toEqual({});
    expect(ConfirmarOrdenSchema.parse({})).toEqual({});
    expect(ConfirmarOrdenSchema.parse({ canal: 'WHATSAPP' })).toEqual({ canal: 'WHATSAPP' });
    const r = ConfirmarOrdenSchema.safeParse({ canal: 'OTRO' });
    expect(r.error?.issues[0]?.path).toEqual(['canal']);
  });
});
