import { describe, expect, it } from 'vitest';
import { avisoDeEnvio, ayudaTelefono, canalesDe, fraseEnviada, textoConfirmar } from './canales';

describe('teléfono del proveedor (CP-16.5b)', () => {
  it('muestra cómo queda el número para WhatsApp', () => {
    expect(ayudaTelefono('011 15-2345-6789')).toEqual({
      texto: 'WhatsApp: +54 9 11 2345-6789',
      sirve: true,
    });
  });

  it('avisa cuando falta el código de área', () => {
    expect(ayudaTelefono('4567-8901')).toEqual({
      texto: 'Para WhatsApp falta el código de área (por ejemplo, 011 o 0351)',
      sirve: false,
    });
  });

  it('sin teléfono explica para qué sirve', () => {
    expect(ayudaTelefono('  ').sirve).toBeNull();
  });
});

describe('confirmación según el canal (CP-16.5)', () => {
  const ambos = { email: 'compras@sur.com', whatsapp: '5491123456789' };

  it('el botón dice por dónde sale', () => {
    expect(textoConfirmar('EMAIL')).toBe('Confirmar y enviar por correo');
    expect(textoConfirmar('WHATSAPP')).toBe('Confirmar y enviar por WhatsApp');
    expect(textoConfirmar(null)).toBe('Confirmar');
  });

  it('los canales disponibles salen de los datos cargados', () => {
    expect(canalesDe(ambos)).toEqual(['EMAIL', 'WHATSAPP']);
    expect(canalesDe({ email: null, whatsapp: ambos.whatsapp })).toEqual(['WHATSAPP']);
    expect(canalesDe({ email: null, whatsapp: null })).toEqual([]);
  });

  it('explica qué pasa al confirmar', () => {
    expect(avisoDeEnvio('EMAIL', ambos)).toContain('compras@sur.com');
    expect(avisoDeEnvio('WHATSAPP', ambos)).toContain('+54 9 11 2345-6789');
    expect(avisoDeEnvio('WHATSAPP', ambos)).toContain('Lo enviás vos');
    expect(avisoDeEnvio(null, { email: null, whatsapp: null })).toContain('otro medio');
  });

  it('cuenta cómo salió una orden enviada', () => {
    const fecha = '28 sept, 10:30';
    expect(fraseEnviada({ canal: 'WHATSAPP', enviadaA: '011 15-2345-6789', fecha })).toBe(
      'Enviada por WhatsApp a 011 15-2345-6789 el 28 sept, 10:30.',
    );
    expect(fraseEnviada({ canal: 'EMAIL', enviadaA: 'compras@sur.com', fecha })).toBe(
      'Enviada por correo a compras@sur.com el 28 sept, 10:30.',
    );
    expect(fraseEnviada({ canal: 'OTRO', enviadaA: null, fecha })).toBe(
      'Marcada como enviada el 28 sept, 10:30.',
    );
  });
});
