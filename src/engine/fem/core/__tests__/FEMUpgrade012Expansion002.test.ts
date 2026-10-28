/**
 * SECP Industrial OS — Engineering Truth OS
 * FEMUpgrade012Expansion002.test.ts
 *
 * SECP-PHYSICS-EXPANSION-002 Verification Suite:
 * 1. Multi-state finite-difference constitutive tangent verification & corrupted tangent rejection
 * 2. Mooney-Rivlin Hyperelastic Model & Parameter Admissibility
 * 3. 3D Large-Deformation J2 Elastoplasticity: Elastic response, Yield, Plastic Strain Evolution & Rollback
 * 4. Bidirectional Electrothermal Coupling with Iteration-by-Iteration History
 */

import { describe, it, expect } from "vitest";
import { HyperelasticNeoHookean3D } from "../HyperelasticNeoHookean3D";
import { HyperelasticMooneyRivlin3D } from "../HyperelasticMooneyRivlin3D";
import { ConstitutiveTangentVerifier } from "../ConstitutiveTangentVerifier";
import { TET4LargeDeformationPlasticFormulation } from "../TET4LargeDeformationPlasticFormulation";
import {
  BidirectionalElectrothermalSolver3D,
  ElectrothermalNode3D,
  ElectrothermalTetElement3D,
  ElectricalBoundaryCondition,
  ThermalBoundaryCondition
} from "../../../physics/electromagnetics/BidirectionalElectrothermalSolver3D";
import { FEMDOFManager } from "../FEMDOFManager";
import { FEMModel, DOFComponent, FEMNode, FEMElement, FEMMaterial } from "../FEMTypes";
import { NonlinearEquilibriumSolver } from "../NonlinearEquilibriumSolver";
import { MaterialStateManager } from "../MaterialStateManager";

describe("SECP-PHYSICS-EXPANSION-002: Advanced Mechanics & Multiphysics", () => {
  it("1. Verifies finite-difference constitutive tangent across multiple states and proves wrong-tangent rejection", () => {
    const neoModel = new HyperelasticNeoHookean3D({ E: 200.0, nu: 0.4 });

    const states = [
      {
        stateName: "Uniaxial Tension",
        F: [
          [1.15, 0, 0],
          [0, 0.93, 0],
          [0, 0, 0.93]
        ]
      },
      {
        stateName: "Equibiaxial Tension",
        F: [
          [1.10, 0, 0],
          [0, 1.10, 0],
          [0, 0, 0.826]
        ]
      },
      {
        stateName: "Pure Shear",
        F: [
          [1.0, 0.15, 0],
          [0.0, 1.0, 0],
          [0.0, 0.0, 1.0]
        ]
      },
      {
        stateName: "Combined Shear Compression",
        F: [
          [0.90, 0.10, 0.05],
          [0.02, 0.92, 0.04],
          [0.01, 0.03, 1.08]
        ]
      }
    ];

    const multiRes = ConstitutiveTangentVerifier.verifyHyperelasticTangentMultiState(neoModel, states, 1e-6, 0.01);
    expect(multiRes.allPassed).toBe(true);

    // Prove that a corrupted/wrong tangent matrix is detected and rejected
    const rejected = ConstitutiveTangentVerifier.verifyRejectionOfIncorrectTangent(neoModel, states[0].F, 1.25);
    expect(rejected).toBe(true);
  });

  it("2. Verifies Mooney-Rivlin hyperelastic model & parameter admissibility rules", () => {
    const mrModel = new HyperelasticMooneyRivlin3D({ C10: 10.0, C01: 2.0, K: 1000.0 });
    const F = [
      [1.05, 0, 0],
      [0, 0.98, 0],
      [0, 0, 0.97]
    ];
    const { S_voigt, strainEnergy, J } = mrModel.computeStressAndTangent(F);
    expect(J).toBeGreaterThan(0.9);
    expect(strainEnergy).toBeGreaterThan(0.0);
    expect(S_voigt[0]).toBeGreaterThan(0.0);

    // Invalid parameter guards
    expect(() => new HyperelasticMooneyRivlin3D({ C10: -1.0, C01: 2.0, K: 100.0 })).toThrow(/INVALID_MOONEY_RIVLIN_PARAM/);
    expect(() => new HyperelasticMooneyRivlin3D({ C10: 0.0, C01: 0.0, K: 100.0 })).toThrow(/INVALID_MOONEY_RIVLIN_PARAM/);
  });

  it("3. Verifies 3D J2 Elastoplasticity: Elastic response, Yield, Plastic strain evolution & Trial state rollback", async () => {
    const plasticForm = new TET4LargeDeformationPlasticFormulation();

    // Test A: Low load (elastic branch)
    const elasticLoad = 100.0; // N
    const S_trial_elastic = [5.0, 0, 0, 0, 0, 0]; // 5 MPa < 10 MPa yield
    const resElastic = plasticForm.performRadialReturn(S_trial_elastic, 70000, 0.33, 10.0, 500.0);
    expect(resElastic.yieldFlag).toBe(false);
    expect(resElastic.equivalentPlasticStrain).toBe(0.0);

    // Test B: High load (plastic yield branch)
    const S_trial_plastic = [30.0, 0, 0, 0, 0, 0]; // 30 MPa > 10 MPa yield
    const resPlastic = plasticForm.performRadialReturn(S_trial_plastic, 70000, 0.33, 10.0, 500.0);
    expect(resPlastic.yieldFlag).toBe(true);
    expect(resPlastic.equivalentPlasticStrain).toBeGreaterThan(0.0);

    // Test C: Rollback verification in MaterialStateManager
    const stateMgr = new MaterialStateManager();
    stateMgr.initializeElement("E1", 1, {
      stress: [0, 0, 0, 0, 0, 0],
      plasticStrain: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0,
      yieldStress: 10.0,
      yieldFlag: false
    });

    // Simulate failed trial iteration state update
    stateMgr.updateIntegrationPoint("E1", 0, {
      stress: resPlastic.S_ret,
      plasticStrain: [0.01, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: resPlastic.equivalentPlasticStrain,
      yieldStress: 10.0 + 500.0 * resPlastic.equivalentPlasticStrain,
      yieldFlag: true
    });

    // Rollback trial state
    stateMgr.rollback();
    const rolledBackState = stateMgr.getElementStates("E1", true)[0];
    expect(rolledBackState.equivalentPlasticStrain).toBe(0.0); // Reset to last committed
    expect(rolledBackState.yieldFlag).toBe(false);
  });

  it("4. Verifies 3D Bidirectional Electrothermal Picard Feedback Iteration & Detailed History", () => {
    const L = 0.1, W = 0.02, H = 0.02;

    const nodes: ElectrothermalNode3D[] = [
      { id: "N0", x: 0, y: 0, z: 0 },
      { id: "N1", x: L, y: 0, z: 0 },
      { id: "N2", x: L, y: W, z: 0 },
      { id: "N3", x: 0, y: W, z: 0 },
      { id: "N4", x: 0, y: 0, z: H },
      { id: "N5", x: L, y: 0, z: H },
      { id: "N6", x: L, y: W, z: H },
      { id: "N7", x: 0, y: W, z: H }
    ];

    const elements: ElectrothermalTetElement3D[] = [
      { id: "T1", nodeIds: ["N0", "N1", "N3", "N4"], nominalConductivity: 1e4, tempCoefficient: 0.004, thermalConductivity: 200 },
      { id: "T2", nodeIds: ["N1", "N2", "N3", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.004, thermalConductivity: 200 },
      { id: "T3", nodeIds: ["N1", "N4", "N5", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.004, thermalConductivity: 200 },
      { id: "T4", nodeIds: ["N3", "N4", "N6", "N7"], nominalConductivity: 1e4, tempCoefficient: 0.004, thermalConductivity: 200 },
      { id: "T5", nodeIds: ["N1", "N3", "N4", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.004, thermalConductivity: 200 }
    ];

    const electricalBCs: ElectricalBoundaryCondition[] = [
      { nodeId: "N0", potential: 12.0 },
      { nodeId: "N3", potential: 12.0 },
      { nodeId: "N4", potential: 12.0 },
      { nodeId: "N7", potential: 12.0 },
      { nodeId: "N1", potential: 0.0 },
      { nodeId: "N2", potential: 0.0 },
      { nodeId: "N5", potential: 0.0 },
      { nodeId: "N6", potential: 0.0 }
    ];

    const thermalBCs: ThermalBoundaryCondition[] = [
      { nodeId: "N0", type: "PRESCRIBED", temperatureC: 25.0 },
      { nodeId: "N3", type: "PRESCRIBED", temperatureC: 25.0 },
      { nodeId: "N4", type: "PRESCRIBED", temperatureC: 25.0 },
      { nodeId: "N7", type: "PRESCRIBED", temperatureC: 25.0 }
    ];

    const solver = new BidirectionalElectrothermalSolver3D();
    const result = solver.solve(nodes, elements, electricalBCs, thermalBCs, {
      maxIterations: 20,
      toleranceK: 1e-3
    });

    expect(result.status).toBe("CONVERGED");
    expect(result.success).toBe(true);
    expect(result.iterationHistory.length).toBeGreaterThan(1);
    expect(result.totalElectricalPowerWatts).toBeCloseTo(result.totalThermalHeatWatts, 6);
  });
});
