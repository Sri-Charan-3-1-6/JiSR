import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  as?: 'div' | 'section' | 'li';
}) {
  return (
    <Tag
      className={`card card-enter ${hover ? 'card-hover' : ''} ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}