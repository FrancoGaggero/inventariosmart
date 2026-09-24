/** Bloque de carga con brillo (design D4). Decorativo: oculto a lectores de pantalla. */
export function Skeleton({
  variante = 'linea',
  className = '',
}: {
  variante?: 'linea' | 'numero' | 'fila' | 'bloque';
  className?: string;
}) {
  const base = {
    linea: 'h-3 w-2/3',
    numero: 'h-7 w-1/2',
    fila: 'h-10 w-full',
    bloque: 'h-24 w-full',
  }[variante];
  return <span aria-hidden className={`skeleton block ${base} ${className}`} />;
}

/** Varias filas de skeleton para listados. */
export function SkeletonFilas({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} variante="fila" />
      ))}
    </div>
  );
}
