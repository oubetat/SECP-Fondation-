/**
 * SECP Industrial OS v2 — Conservation Framework Unit Tests
 * PATCH-050: Conservation Framework
 */

import { describe, it, expect } from "vitest";
import { 
  ConservationContract, 
  ConservationEvaluator, 
  ConservationReportGenerator,
  ConservationEvidence,
  ConservationFrameworkGate
} from "../index";

describe("PATCH-050: Conservation Framework", () => {

  const baseContract: ConservationContract = {
    caseId: "CASE-01",
    solverId: "SOLVER-CFD-01",
    solverVersion: "1.0.0",
    meshId: "MESH-3D-01",
    meshVersion: "1.0",
    physicsModel: "NAVIER_STOKES",
    systemType: "CONTROL_VOLUME",
    analysisType: "STEADY",
    toleranceConfig: {
      absoluteTolerance: 1e-4,
      relativeTolerance: 1e-3,
      normalizationMethod: "INLET_FLUX"
    },
    massData: {
      inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg/s" }],
      outletMassFlows: [{ boundaryId: "outlet", value: 10.0, unit: "kg/s" }]
    },
    momentumData: {
      convectiveFluxesIn: [{ boundaryId: "inlet", x: 100, y: 0, z: 0, unit: "N" }],
      convectiveFluxesOut: [{ boundaryId: "outlet", x: 80, y: 0, z: 0, unit: "N" }],
      surfaceForces: [{ boundaryId: "wall", x: -20, y: 0, z: 0, unit: "N" }] // 100 - 20 = 80 -> balanced!
    },
    energyData: {
      convectiveEnergyIn: [{ boundaryId: "inlet", value: 1e6, unit: "W" }],
      convectiveEnergyOut: [{ boundaryId: "outlet", value: 1e6, unit: "W" }],
      declaredZeroTerms: ["conductiveHeatFlux", "workOrPressurePower", "volumetricSources"]
    }
  };

  it("A. evaluates exact balanced mass case -> PASS", () => {
    const res = ConservationEvaluator.evaluateContract(baseContract);
    expect(res.massResult.verdict).toBe("MASS_CONVERGED");
    expect(res.massResult.balanceTerms?.absoluteImbalance).toBe(0.0);
  });

  it("B. evaluates known mass imbalance -> FAIL / MASS_CONSERVATION_FAILURE", () => {
    const imbalancedContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg/s" }],
        outletMassFlows: [{ boundaryId: "outlet", value: 8.0, unit: "kg/s" }] // 2 kg/s imbalance!
      }
    };

    const res = ConservationEvaluator.evaluateContract(imbalancedContract);
    expect(res.massResult.verdict).toBe("MASS_CONSERVATION_FAILURE");
    expect(res.overallVerdict).toBe("FAIL");
    expect(res.massResult.balanceTerms?.absoluteImbalance).toBe(2.0);
  });

  it("C. evaluates missing mass boundary data -> UNPROVEN", () => {
    const missingContract: ConservationContract = {
      ...baseContract,
      massData: undefined
    };

    const res = ConservationEvaluator.evaluateContract(missingContract);
    expect(res.massResult.verdict).toBe("MASS_UNPROVEN");
    expect(res.overallVerdict).toBe("UNPROVEN");
  });

  it("D. evaluates momentum component failure independently", () => {
    const momFailContract: ConservationContract = {
      ...baseContract,
      momentumData: {
        convectiveFluxesIn: [{ boundaryId: "inlet", x: 100, y: 50, z: 0, unit: "N" }],
        convectiveFluxesOut: [{ boundaryId: "outlet", x: 100, y: 0, z: 0, unit: "N" }], // Y-momentum has 50 N imbalance!
        surfaceForces: []
      }
    };

    const res = ConservationEvaluator.evaluateContract(momFailContract);
    expect(res.momentumResult.verdict).toBe("MOMENTUM_CONSERVATION_FAILURE");
    expect(res.overallVerdict).toBe("FAIL");
    expect(res.momentumResult.componentTerms?.y.absoluteImbalance).toBe(50.0);
    expect(res.momentumResult.componentTerms?.x.absoluteImbalance).toBe(0.0);
  });

  it("E. evaluates balanced energy case -> PASS", () => {
    const res = ConservationEvaluator.evaluateContract(baseContract);
    expect(res.energyResult.verdict).toBe("ENERGY_CONVERGED");
    expect(res.overallVerdict).toBe("PASS");
  });

  it("F. evaluates missing energy term without explicit zero declaration -> UNPROVEN", () => {
    const missingEnergyContract: ConservationContract = {
      ...baseContract,
      energyData: {
        convectiveEnergyIn: [{ boundaryId: "inlet", value: 1e6, unit: "W" }],
        convectiveEnergyOut: [{ boundaryId: "outlet", value: 1e6, unit: "W" }]
        // Missing conductiveHeatFlux and workOrPressurePower without declaredZeroTerms!
      }
    };

    const res = ConservationEvaluator.evaluateContract(missingEnergyContract);
    expect(res.energyResult.verdict).toBe("ENERGY_UNPROVEN");
    expect(res.overallVerdict).toBe("UNPROVEN");
  });

  it("G. evaluates unit incompatibility -> INVALID", () => {
    const badUnitContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "meters" }], // Incompatible unit!
        outletMassFlows: [{ boundaryId: "outlet", value: 10.0, unit: "kg/s" }]
      }
    };

    const res = ConservationEvaluator.evaluateContract(badUnitContract);
    expect(res.massResult.verdict).toBe("MASS_INVALID");
    expect(res.overallVerdict).toBe("INVALID");
  });

  it("H. evaluates transient/steady mismatch (transient analysis without storage rate) -> UNPROVEN", () => {
    const transientMismatchContract: ConservationContract = {
      ...baseContract,
      analysisType: "TRANSIENT"
      // Storage rate is omitted!
    };

    const res = ConservationEvaluator.evaluateContract(transientMismatchContract);
    expect(res.massResult.verdict).toBe("MASS_UNPROVEN");
    expect(res.overallVerdict).toBe("UNPROVEN");
  });

  it("I. verifies deterministic replay produces identical result and hashes", () => {
    const res1 = ConservationEvaluator.evaluateContract(baseContract);
    const res2 = ConservationEvaluator.evaluateContract(baseContract);

    expect(res1.inputHash).toBe(res2.inputHash);
    expect(res1.overallVerdict).toBe(res2.overallVerdict);
    expect(res1.massResult.balanceTerms?.absoluteImbalance).toBe(res2.massResult.balanceTerms?.absoluteImbalance);
  });

  it("J. verifies adversarial modification detection via evidence verification", () => {
    const res = ConservationEvaluator.evaluateContract(baseContract);
    const evid = ConservationEvidence.createEvidence(res);

    expect(ConservationEvidence.verifyEvidenceIntegrity(res, evid)).toBe(true);

    // Tamper with result overallVerdict
    const tamperedResult = { ...res, overallVerdict: "FAIL" as const };
    expect(ConservationEvidence.verifyEvidenceIntegrity(tamperedResult, evid)).toBe(false);
  });

  it("K. generates machine-readable report and evaluates gate PASS for valid results", () => {
    const res = ConservationEvaluator.evaluateContract(baseContract);
    const report = ConservationReportGenerator.generateReport(res);

    expect(report.caseId).toBe("CASE-01");
    expect(report.overallVerdict).toBe("PASS");

    const gateRes = ConservationFrameworkGate.evaluateGate([res]);
    expect(gateRes.status).toBe("PASS");
  });

});
