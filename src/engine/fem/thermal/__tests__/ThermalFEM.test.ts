import { describe, expect, it } from "vitest";
import { ThermalMaterial } from "../ThermalMaterial";
import { ThermalElementIntegrator } from "../ThermalElementIntegrator";
import { ThermalSolver } from "../ThermalSolver";
import { HardAcceptanceGate083 } from "../HardAcceptanceGate083";
import { generateReports083 } from "../generateReports083";

describe("PATCH-083: Thermal FEM Foundation", () => {
  it("1. ThermalMaterial calculates diffusivity correctly", () => {
    const mat = ThermalMaterial.fromK(10, 1000, 500);
    expect(mat.getDiffusivity()).toBe(10 / (1000 * 500));
  });

  it("2. ThermalElementIntegrator computes valid Ke and Ce", () => {
    const dNdX = [[-1], [1]];
    const Ke = ThermalElementIntegrator.computeConductivityMatrix(dNdX, 1.0, 10.0);
    expect(Ke.get(0, 0)).toBe(10);
    expect(Ke.get(0, 1)).toBe(-10);

    const Ce = ThermalElementIntegrator.computeCapacityMatrix(2, 1.0, 1000, 500);
    expect(Ce.get(0, 0)).toBe(250000);
  });

  it("3. HardAcceptanceGate083 passes all core thermal checks", () => {
    const report = HardAcceptanceGate083.evaluateGate();
    expect(report.verdict).toBe("VERIFIED");
  });

  it("4. generateReports083 produces forensic evidence", () => {
    expect(() => generateReports083()).not.toThrow();
  });
});
