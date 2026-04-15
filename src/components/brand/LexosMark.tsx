import React from "react";

type Props = {
  className?: string;
  title?: string;
  style?: React.CSSProperties;
  /** 'dark' = logo preta (padrão), 'light' = logo branca (invertida via CSS) */
  variant?: 'dark' | 'light';
};

export default function LexosMark({ className, title = "Projeto Flaito", style, variant = 'dark' }: Props) {
  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(variant === 'light' ? { filter: 'brightness(0) invert(1)' } : {}),
  };

  return (
    <img
      className={className}
      style={mergedStyle}
      src="/logo.png"
      alt={title}
    />
  );
}
