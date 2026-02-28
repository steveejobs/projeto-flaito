/**
 * Performance utilities - dev-only instrumentation
 */

const isDev = import.meta.env.DEV;

export function mark(name: string): void {
  if (isDev) {
    performance.mark(name);
  }
}

export function measure(label: string, startMark: string, endMark?: string): void {
  if (isDev) {
    try {
      if (endMark) {
        performance.measure(label, startMark, endMark);
      } else {
        performance.measure(label, startMark);
      }
      const entries = performance.getEntriesByName(label, "measure");
      if (entries.length > 0) {
        const duration = entries[entries.length - 1].duration;
        console.debug(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
      }
    } catch (e) {
      // Mark may not exist, ignore
    }
  }
}

export function clearMarks(): void {
  if (isDev) {
    performance.clearMarks();
    performance.clearMeasures();
  }
}
