import { describe, expect, it } from "vitest";
import { ResultProvenanceTracker } from "../ResultProvenanceTracker";
import { EquilibriumVerifier } from "../EquilibriumVerifier";
import { StressStrainEnergyVerifier } from "../StressStrainEnergyVerifier";
import { MeshVerificationEngine } from "../MeshVerificationEngine";
import { AnalyticalVerificationSuite } from "../AnalyticalVerificationSuite";
import { IndependentStructuralAssembler } from "../IndependentStructuralAssembler";
import { StructuralVerifierEngine } from "../StructuralVerifierEngine";
import { HardAcceptanceGate087 } from "../HardAcceptanceGate087";
import { generateReports087 } from "../generateReports087";
import { AnalysisType, StructuralVerdict } from "../types";

describe("PATCH-087: Structural Verification Framework", () => {
  it("1. ResultProvenanceTracker tracks provenance and detects hash corruption cleanly", () => {
    const prov = ResultProvenanceTracker.createProvenance(
      "ANALYSIS_TEST_01",
      { nodes: [0, 1] },
      { E: 2e11 },
      { F: 500 },
      { bc: [0] },
      { solver: "DIRECT" },
      { u: [0, 0.001] },
      AnalysisType.LINEAR_STATIC
    );

    const check1 = ResultProvenanceTracker.verifyProvenance(
      prov,
      { nodes: [0, 1] },
      { E: 2e11 },
      { F: 500 },
      { bc: [0] },
      { solver: "DIRECT" },
      { u: [0, 0.001] }
    );
    expect(check1.valid).toBe(true);

    const check2 = ResultProvenanceTracker.verifyProvenance(
      prov,
      { nodes: [0, 1] },
      { E: 2.1e11 }, // Corrupted material
      { F: 500 },
      { bc: [0] },
      { solver: "DIRECT" },
      { u: [0, 0.001] }
    );
    expect(check2.valid).toBe(false);
  });

  it("2. EquilibriumVerifier validates force, moment, linear residual and constraint residual", () => {
    const tolPolicy = StructuralVerifierEngine.defaultTolerancePolicy();

    const forceCheck = EquilibriumVerifier.verifyForceBalance([[1000, 0, 0]], [[-1000, 0, 0]], tolPolicy);
    expect(forceCheck.status).toBe("PASS");

    const momentCheck = EquilibriumVerifier.verifyMomentBalance([[2, 0, 0]], [[0, -100, 0]], [[2, 0, 0]], [[0, 100, 0]], tolPolicy);
    expect(momentCheck.status).toBe("PASS");

    const linResCheck = EquilibriumVerifier.verifyLinearResidual([[100, -100], [-100, 100]], [0, 0.01], [-1, 1], tolPolicy);
    expect(linResCheck.status).toBe("PASS");

    const constResCheck = EquilibriumVerifier.verifyConstraintResidual([0], [0, 0.05], [0], tolPolicy);
    expect(constResCheck.status).toBe("PASS");
  });

  it("3. StressStrainEnergyVerifier verifies energy balance and constitutive relations", () => {
    const tolPolicy = StructuralVerifierEngine.defaultTolerancePolicy();
    const K = [[1000, -1000], [-1000, 1000]];
    const u = [0, 0.002];
    const F = [-2, 2];

    const energyCheck = StressStrainEnergyVerifier.verifyEnergyBalance(K, u, F, tolPolicy);
    expect(energyCheck.status).toBe("PASS");

    const D = [[2e11]];
    const strain = [1e-4];
    const stress = [2e7];
    const constCheck = StressStrainEnergyVerifier.verifyConstitutiveRelation(stress, strain, D, tolPolicy);
    expect(constCheck.status).toBe("PASS");
  });

  it("4. MeshVerificationEngine evaluates mesh quality and Richardson extrapolation GCI", () => {
    const elemCoords = [
      [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
    ];
    const qual = MeshVerificationEngine.verifyMeshQuality(elemCoords);
    expect(qual.status).toBe("PASS");

    const rich = MeshVerificationEngine.calculateRichardsonExtrapolation(0.0012, 0.00105, 0.00101);
    expect(rich.converged).toBe(true);
    expect(rich.observedOrder).toBeGreaterThan(0);
  });

  it("5. AnalyticalVerificationSuite passes axial bar, cantilever beam, thermal, and manufactured solution benchmarks", () => {
    const bar = AnalyticalVerificationSuite.verifyAxialBar(10000, 2.0, 0.01, 2e11, 1e-5, 1e6);
    expect(bar.status).toBe("PASS");

    const beam = AnalyticalVerificationSuite.verifyCantileverBeam(1000, 1.0, 2e11, 1e-6, 1 / 600);
    expect(beam.status).toBe("PASS");

    const thermal = AnalyticalVerificationSuite.verifyThermalExpansion(1.2e-5, 50, 2.0, 0.0012);
    expect(thermal.status).toBe("PASS");

    const nodesX = [0, 0.5, 1.0];
    const uExact = nodesX.map(x => Math.sin(Math.PI * x));
    const manufactured = AnalyticalVerificationSuite.verifyManufacturedSolution(nodesX, uExact, 1.0);
    expect(manufactured.checkResult.status).toBe("PASS");
  });

  it("6. IndependentStructuralAssembler assembles matrix, solves system, and computes reactions independently", () => {
    const nodesX = [0, 1.0, 2.0];
    const elements: [number, number][] = [[0, 1], [1, 2]];
    const A = 0.01, E = 2e11;

    const K = IndependentStructuralAssembler.assembleBarStiffnessMatrix(nodesX, elements, A, E);
    const u = IndependentStructuralAssembler.solveSystem(K, [0, 0, 10000], [0], [0]);
    const R = IndependentStructuralAssembler.computeIndependentReactions(K, u, [0, 0, 10000], [0]);

    expect(u.length).toBe(3);
    expect(R[0]).toBeCloseTo(-10000, 2);
  });

  it("7. HardAcceptanceGate087 evaluates and achieves VERIFIED verdict", () => {
    const report = HardAcceptanceGate087.evaluateGate();
    if (report.verdict !== "VERIFIED") {
      console.log("FAILED GATE CHECKS:", JSON.stringify(report.checks.filter(c => !c.passed), null, 2));
    }
    expect(report.verdict).toBe("VERIFIED");
  });

  it("8. generateReports087 produces complete evidence package in reports/fem/patch-087", () => {
    expect(() => generateReports087()).not.toThrow();
  });
});
