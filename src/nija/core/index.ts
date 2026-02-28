// src/nija/core/index.ts - Barrel exports for core module
export * from "./engine";
export * from "./pipeline";
export * from "./analyzer";
export * from "./mapper";
export * from "./poloDetect";
export * from "./fullAnalysis";
// Note: poloFilter exports NijaPolo which is also exported by poloDetect
// Re-export poloFilter selectively to avoid naming collision
export {
  isDefectCompatibleWithPolo,
  filterStrategiesByPolo,
  getStrategiesForPolo,
  buildPoloAwareResumoTatico,
  adjustSeverityForPolo,
} from "./poloFilter";
