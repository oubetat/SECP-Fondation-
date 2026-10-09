/**
 * SECP Industrial OS v2 — Conservation Adversarial Tests
 * PATCH-050: Conservation Framework
 */

import { describe, it, expect } from "vitest";
import { 
  ConservationContract, 
  ConservationEvaluator, 
  ConservationEvidence,
  ConservationFrameworkGate
} from "../index";

describe("PATCH-050: Conservation Adversarial Tests", () => {

  const baseContract: ConservationContract = {
    caseId: "CASE-ADV-01",
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
      convectiveFluxesOut: [{ boundaryId: "outlet", x: 100, y: 0, z: 0, unit: "N" }]
    },
    energyData: {
      convectiveEnergyIn: [{ boundaryId: "inlet", value: 1e6, unit: "W" }],
      convectiveEnergyOut: [{ boundaryId: "outlet", value: 1e6, unit: "W" }],
      declaredZeroTerms: ["conductiveHeatFlux", "workOrPressurePower", "volumetricSources"]
    }
  };

  it("1. rejects false PASS when outlet boundary is omitted", () => {
    const omittedBoundaryContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg/s" }],
        outletMassFlows: [] // Omitted!
      }
    };

    const res = ConservationEvaluator.evaluateContract(omittedBoundaryContract);
    expect(res.massResult.verdict).toBe("MASS_CONSERVATION_FAILURE");
    expect(res.overallVerdict).toBe("FAIL");
  });

  it("2. rejects false PASS when mass source term is omitted", () => {
    const omittedSourceContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg/s" }],
        outletMassFlows: [{ boundaryId: "outlet", value: 12.0, unit: "kg/s" }] // Needs +2 kg/s source
        // massSources omitted!
      }
    };

    const res = ConservationEvaluator.evaluateContract(omittedSourceContract);
    expect(res.massResult.verdict).toBe("MASS_CONSERVATION_FAILURE");
    expect(res.overallVerdict).toBe("FAIL");
  });

  it("3. rejects false PASS when missing energy terms are omitted without explicit zero declaration", () => {
    const undeclaredEnergyContract: ConservationContract = {
      ...baseContract,
      energyData: {
        convectiveEnergyIn: [{ boundaryId: "inlet", value: 1e6, unit: "W" }],
        convectiveEnergyOut: [{ boundaryId: "outlet", value: 1e6, unit: "W" }]
        // declaredZeroTerms NOT provided!
      }
    };

    const res = ConservationEvaluator.evaluateContract(undeclaredEnergyContract);
    expect(res.energyResult.verdict).toBe("ENERGY_UNPROVEN");
    expect(res.overallVerdict).toBe("UNPROVEN");
  });

  it("4. rejects false PASS when mass flow unit is incompatible (e.g. kg instead of kg/s)", () => {
    const badUnitContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg" }], // kg is mass, not mass flow rate!
        outletMassFlows: [{ boundaryId: "outlet", value: 10.0, unit: "kg/s" }]
      }
    };

    const res = ConservationEvaluator.evaluateContract(badUnitContract);
    expect(res.massResult.verdict).toBe("MASS_INVALID");
    expect(res.overallVerdict).toBe("INVALID");
  });

  it("5. preserves configured tolerance in report without hardcoding PASS", () => {
    const tightTolContract: ConservationContract = {
      ...baseContract,
      toleranceConfig: {
        absoluteTolerance: 1e-12, // Extremely tight
        relativeTolerance: 1e-12,
        normalizationMethod: "INLET_FLUX"
      },
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: 10.0, unit: "kg/s" }],
        outletMassFlows: [{ boundaryId: "outlet", value: 10.000001, unit: "kg/s" }] // 1e-6 imbalance
      }
    };

    const res = ConservationEvaluator.evaluateContract(tightTolContract);
    expect(res.massResult.verdict).toBe("MASS_CONSERVATION_FAILURE");
    expect(res.overallVerdict).toBe("FAIL");
  });

  it("6. rejects NaN or Infinity in mass flux data", () => {
    const nanContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: NaN, unit: "kg/s" }],
        outletMassFlows: [{ boundaryId: "outlet", value: 10.0, unit: "kg/s" }]
      }
    };

    const res = ConservationEvaluator.evaluateContract(nanContract);
    expect(res.massResult.verdict).toBe("MASS_INVALID");
    expect(res.overallVerdict).toBe("INVALID");
  });

  it("7. rejects negative mass flux scalar magnitudes", () => {
    const negContract: ConservationContract = {
      ...baseContract,
      massData: {
        inletMassFlows: [{ boundaryId: "inlet", value: -10.0, unit: "kg/s" }], // Negative scalar magnitude
        outletMassFlows: [{ boundaryId: "outlet", value: 10.0, unit: "kg/s" }]
      }
    };

    const res = ConservationEvaluator.evaluateContract(negContract);
    expect(res.massResult.verdict).toBe("MASS_INVALID");
    expect(res.overallVerdict).toBe("INVALID");
  });

  it("8. rejects missing mesh or solver metadata in Gate evaluation", () => {
    const badMetadataContract: Partial<ConservationContract> = {
      caseId: "CASE-BAD",
      solverId: "", // Missing
      meshId: "MESH-1"
    };

    const res = ConservationEvaluator.evaluateContract(badMetadataContract as ConservationContract);
    expect(res.overallVerdict).toBe("INVALID");

    const gateRes = ConservationFrameworkGate.evaluateGate([res]);
    expect(gateRes.status).toBe("UNPROVEN");
  });

  it("9. rejects modified result after evidence hashing", () => {
    const res = ConservationEvaluator.evaluateContract(baseContract);
    const evid = ConservationEvidence.createEvidence(res);

    // Tamper with input hash
    const tamperedRes = { ...res, inputHash: "TAMPERED_HASH" };
    expect(ConservationEvidence.verifyEvidenceIntegrity(tamperedRes, evid)).toBe(false);
  });

  it("10. rejects transient analysis without storage term -> UNPROVEN", () => {
    const transientNoStorageContract: ConservationContract = {
      ...baseContract,
      analysisType: "TRANSIENT"
      // storage term missing
    };

    const res = ConservationEvaluator.evaluateContract(transientNoStorageContract);
    expect(res.overallVerdict).toBe("UNPROVEN");
  });

});
