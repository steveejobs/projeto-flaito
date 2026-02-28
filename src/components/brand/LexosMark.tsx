import React from "react";

type Props = {
  className?: string;
  title?: string;
  style?: React.CSSProperties;
};

export default function LexosMark({ className, title = "LEXOS", style }: Props) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="14" fill="#0F172A" />
      <path
        d="M22 14V50H42"
        stroke="#E5E7EB"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 22V42"
        stroke="#E5E7EB"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
