import type { CSSProperties, ReactNode } from 'react';

/**
 * Entrada escalonada (design D3): aplica la animación `.entra` con un retraso según el índice.
 * Con `prefers-reduced-motion` el CSS la desactiva.
 */
export function Entrada({
  indice = 0,
  as: Tag = 'div',
  className = '',
  children,
}: {
  indice?: number;
  as?: 'div' | 'li' | 'section' | 'article' | 'tr';
  className?: string;
  children: ReactNode;
}) {
  const estilo = { '--i': indice } as CSSProperties;
  return (
    <Tag className={`entra ${className}`} style={estilo}>
      {children}
    </Tag>
  );
}
