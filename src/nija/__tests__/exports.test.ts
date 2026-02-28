import { describe, it, expect } from "vitest";
import * as nija from "@/nija";

describe("NIJA barrel exports", () => {
  it("exports a non-empty module", () => {
    expect(nija).toBeTruthy();
    expect(Object.keys(nija).length).toBeGreaterThan(0);
  });

  it("exports at least one callable function", () => {
    const hasFn = Object.values(nija).some((v) => typeof v === "function");
    expect(hasFn).toBe(true);
  });
});
