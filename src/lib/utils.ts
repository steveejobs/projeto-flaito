import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte um nome para Title Case (capitaliza cada palavra),
 * mantendo preposições brasileiras em minúsculo.
 */
export function toTitleCase(name: string | null | undefined): string {
  if (!name) return '';
  const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e', 'di'];
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && prepositions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Envolve uma Promise em um timeout.
 * Rejeita se a promise original não resolver dentro do tempo especificado.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`Timeout [${label}] excedido após ${ms}ms`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timeoutId);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}
