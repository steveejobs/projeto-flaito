import { describe, it, expect } from "vitest";
import * as nija from "@/nija";

describe("NIJA core smoke", () => {
  it("engine-related symbols exist (best-effort)", () => {
    const keys = Object.keys(nija).join(" ").toLowerCase();
    expect(keys).toMatch(/nija|engine|analy|extract|eproc|cnj|pdf|timeline/);
  });
});
