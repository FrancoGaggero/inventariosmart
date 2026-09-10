import { prepararArgs, TENANT_MODELS } from './tenant.extension';

const C = '11111111-1111-4111-8111-111111111111';

describe('prepararArgs (extensión de tenant)', () => {
  it('Usuario está entre los modelos de negocio', () => {
    expect(TENANT_MODELS.has('Usuario')).toBe(true);
  });

  it('findMany sin where recibe comercioId', () => {
    expect(prepararArgs('Usuario', 'findMany', undefined, C)).toEqual({ where: { comercioId: C } });
  });

  it('findMany con where conserva los filtros y agrega comercioId', () => {
    expect(prepararArgs('Usuario', 'findMany', { where: { activo: true } }, C)).toEqual({
      where: { activo: true, comercioId: C },
    });
  });

  it('create inyecta comercioId en data aunque venga otro valor', () => {
    expect(
      prepararArgs('Usuario', 'create', { data: { email: 'a@b.c', comercioId: 'otro' } }, C),
    ).toEqual({ data: { email: 'a@b.c', comercioId: C } });
  });

  it('createMany inyecta comercioId en cada elemento', () => {
    expect(prepararArgs('Usuario', 'createMany', { data: [{ email: 'a' }, { email: 'b' }] }, C)).toEqual(
      { data: [{ email: 'a', comercioId: C }, { email: 'b', comercioId: C }] },
    );
  });

  it('upsert filtra por comercio y lo inyecta en create', () => {
    expect(
      prepararArgs('Usuario', 'upsert', { where: { id: 'x' }, create: { email: 'a' }, update: {} }, C),
    ).toEqual({ where: { id: 'x', comercioId: C }, create: { email: 'a', comercioId: C }, update: {} });
  });

  it('count, update y delete filtran por comercio', () => {
    for (const op of ['count', 'update', 'updateMany', 'delete', 'deleteMany']) {
      expect(prepararArgs('Usuario', op, { where: { id: 'x' } }, C)['where']).toEqual({
        id: 'x',
        comercioId: C,
      });
    }
  });

  it('Comercio sólo permite leer y actualizar la propia fila', () => {
    expect(prepararArgs('Comercio', 'findUnique', { where: { id: 'otro' } }, C)).toEqual({
      where: { id: C },
    });
    expect(prepararArgs('Comercio', 'update', { where: {}, data: { nombre: 'x' } }, C)).toEqual({
      where: { id: C },
      data: { nombre: 'x' },
    });
    for (const op of ['create', 'delete', 'deleteMany', 'upsert']) {
      expect(() => prepararArgs('Comercio', op, {}, C)).toThrow(/no permitida/);
    }
  });

  it('no altera los argumentos originales', () => {
    const original = { where: { activo: true } };
    prepararArgs('Usuario', 'findMany', original, C);
    expect(original).toEqual({ where: { activo: true } });
  });
});
