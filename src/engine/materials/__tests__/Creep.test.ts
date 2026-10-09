import { describe, expect, it } from "vitest";
import { 
  CreepEngine, 
  TimeUnit, 
  TimeConverter,
  NortonCreepLaw,
  CreepMaterialPointDriver,
  HardAcceptanceGate093,
  generateReports093,
  CreepVerdict
} from "../index";

describe("PATCH-093: Creep Framework", () => {
  const constants = {
    A0: 1e-15,
    n: 5,
    Q: 150000,
    R: 8.314,
    E: 200e9,
    nu: 0.3
  };

  it("1. Time Converter handles units correctly", () => {
    expect(TimeConverter.toSeconds(1, TimeUnit.HOUR)).toBe(3600);
    expect(TimeConverter.fromSeconds(86400, TimeUnit.DAY)).toBe(1);
  });

  it("2. Norton Creep Law calculates rates correctly", () => {
    const rate = NortonCreepLaw.calculateRate(100e6, 600, constants);
    expect(rate).toBeGreaterThan(0);
    
    const rateHigherT = NortonCreepLaw.calculateRate(100e6, 700, constants);
    expect(rateHigherT).toBeGreaterThan(rate);
  });

  it("3. Creep Engine accumulates strain over time", () => {
    const state = CreepEngine.createInitialState(600);
    const { newState, verdict } = CreepEngine.computeUpdate(state, [100e6, 0, 0, 0, 0, 0], 600, 3600, constants);
    
    expect(verdict).toBe(CreepVerdict.CONVERGED);
    expect(newState.equivalentCreepStrain).toBeGreaterThan(0);
    expect(newState.accumulatedTime).toBe(3600);
  });

  it("4. HardAcceptanceGate093 achieves PASS verdict", () => {
    const report = HardAcceptanceGate093.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("5. generateReports093 executes without error", () => {
    expect(() => generateReports093()).not.toThrow();
  });
});
