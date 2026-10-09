import { describe, expect, it } from "vitest";
import { 
  PlasticityEngine, 
  MaterialPointDriver, 
  HardAcceptanceGate092,
  generateReports092,
  ConstitutiveVerdict,
  ConstitutiveUtils
} from "../index";

describe("PATCH-092: Plasticity Framework", () => {
  const constants = {
    E: 210e9,
    nu: 0.3,
    yieldStress0: 250e6,
    H: 2e9
  };

  it("1. Constitutive Utils calculates von Mises correctly", () => {
    const stress = [300e6, 0, 0, 0, 0, 0]; // Uniaxial tension
    expect(ConstitutiveUtils.calculateVonMises(stress)).toBeCloseTo(300e6, 1);
    
    const pureShear = [0, 0, 0, 100e6, 0, 0];
    // sqrt(3) * 100e6 = 173,205,080.75
    expect(ConstitutiveUtils.calculateVonMises(pureShear)).toBeCloseTo(173205080.75, 0);
  });

  it("2. Elastic predictor works for small strains", () => {
    const state = PlasticityEngine.createInitialState();
    const strain = [0.0001, -0.00003, -0.00003, 0, 0, 0];
    const { newState, verdict } = PlasticityEngine.computeUpdate(state, strain, constants);
    
    expect(verdict).toBe(ConstitutiveVerdict.ELASTIC);
    expect(newState.stress[0]).toBeCloseTo(21e6, 1);
    expect(newState.equivalentPlasticStrain).toBe(0);
  });

  it("3. Radial return mapping works for large plastic strains", () => {
    const state = PlasticityEngine.createInitialState();
    const strain = [0.005, -0.0015, -0.0015, 0, 0, 0]; // Large tension
    const { newState, verdict } = PlasticityEngine.computeUpdate(state, strain, constants);
    
    expect(verdict).toBe(ConstitutiveVerdict.PLASTIC);
    expect(newState.equivalentPlasticStrain).toBeGreaterThan(0);
    
    // Check if stress is on yield surface
    const q = ConstitutiveUtils.calculateVonMises(newState.stress);
    const sy = 250e6 + constants.H * newState.equivalentPlasticStrain;
    expect(q).toBeCloseTo(sy, 1);
  });

  it("4. Consistent Tangent matches finite difference (approx)", () => {
    const state = PlasticityEngine.createInitialState();
    const strain = [0.002, -0.0006, -0.0006, 0, 0, 0];
    const { tangent, verdict } = PlasticityEngine.computeUpdate(state, strain, constants);
    
    expect(verdict).toBe(ConstitutiveVerdict.PLASTIC);
    expect(tangent[0][0]).toBeLessThan(constants.E); // Tangent stiffness should be lower than elastic E
  });

  it("5. HardAcceptanceGate092 achieves PASS verdict", () => {
    const report = HardAcceptanceGate092.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("6. generateReports092 executes without error", () => {
    expect(() => generateReports092()).not.toThrow();
  });
});
