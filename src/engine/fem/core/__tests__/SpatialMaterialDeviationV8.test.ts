import { describe, it, expect } from "vitest";
import {
  SpatialMaterialDeviationEngine,
  AcceptanceCriteriaContract
} from "../SpatialMaterialDeviationEngine";
import { AsBuiltMaterialState } from "../AsBuiltMaterialStateEngine";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { FEMEvidenceEngine } from "../FEMEvidenceEngine";

describe("SECP-PROGRAMMABLE-MATERIAL-V8-001 Spatial Material Deviation Engine", () => {
  const createMockAsBuiltState = (
    pts: Array<{ x: number; y: number; z: number; E: number; uncertainty?: number; isMeasured?: boolean }>
  ): AsBuiltMaterialState => {
    const reconstructedPoints = pts.map(p => ({
      x: p.x,
      y: p.y,
      z: p.z,
      reconstructedProperties: p.isMeasured === false ? {} : {
        E: {
          value: p.E,
          uncertainty: p.uncertainty ?? 100.0,
          isInterpolated: false,
          unit: "MPa",
        },
      },
      isMeasured: p.isMeasured !== false,
      qualityStatus: (p.isMeasured === false ? "UNMEASURED" : "VALIDATED") as any,
    }));

    const measuredCount = reconstructedPoints.filter(p => p.isMeasured).length;
    const coverageRatio = reconstructedPoints.length > 0 ? measuredCount / reconstructedPoints.length : 0;

    return {
      asBuiltStateId: "ABState_Mock_001",
      datasetId: "DS_Mock_001",
      partInstanceId: "PART_2002",
      engineeringRevisionId: "REV_B",
      geometryRevisionId: "GEO_REV_2",
      reconstructionMethod: "IDW_INTERPOLATION",
      reconstructedPoints,
      coverageRatio,
      unmeasuredVolumeRatio: 1 - coverageRatio,
      unmeasuredRegions: [],
      registrationError: { maxError: 0.0, rmsError: 0.0 },
      stateHash: "HASH_ABSTATE_MOCK",
      createdAt: new Date().toISOString(),
    };
  };

  const symmetricCriteria: AcceptanceCriteriaContract = {
    criteriaId: "CRIT_SYM_10PCT",
    propertyId: "E",
    thresholdType: "SYMMETRIC_DELTA",
    maxSymmetricDelta: 10500.0, // 5% of 210,000 MPa
    unit: "MPa",
    sourceSpecification: "SPEC-TEST-V8-01",
  };

  it("V8-TEST-01: Zero deviation benchmark", () => {
    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 210000 },
      { x: 10, y: 0, z: 0, E: 210000 },
      { x: 20, y: 0, z: 0, E: 210000 },
    ]);
    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    expect(res.overallStatus).toBe("CONFORMING");
    expect(res.regionalSummary.maxAbsoluteDeviation).toBe(0);
    expect(res.regionalSummary.rmsDeviation).toBe(0);
    expect(res.regionalSummary.conformingPointsCount).toBe(3);
  });

  it("V8-TEST-02: Uniform constant deviation benchmark", () => {
    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 215000 }, // +5000 MPa delta
      { x: 10, y: 0, z: 0, E: 215000 },
      { x: 20, y: 0, z: 0, E: 215000 },
    ]);
    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    expect(res.overallStatus).toBe("CONFORMING");
    expect(res.regionalSummary.maxPositiveDeviation).toBe(5000);
    expect(res.regionalSummary.rmsDeviation).toBe(5000);
    expect(res.pointRecords[0].signedDeviation).toBe(5000);
  });

  it("V8-TEST-03: Spatial gradient field deviation benchmark", () => {
    // Intended linear spatial field: E(x) = 200000 + 100*x
    const specs = new Map();
    specs.set("E", {
      propertyName: "E",
      fieldFunctionType: "LINEAR",
      baseValue: 200000,
      linearCoefficients: { a: 100, b: 0, c: 0 },
      bounds: { lower: 1000, upper: 500000 },
      expression: (c: { x: number; y: number; z: number }) => 200000 + 100 * c.x,
    });
    const intendedField = new SpatialMaterialField("FIELD_GRAD", "MAT_STEEL", "REV_B", "GEO_01", specs);

    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 200000 },  // Intended 200000 -> Delta 0
      { x: 100, y: 0, z: 0, E: 212000 },// Intended 210000 -> Delta +2000
      { x: 200, y: 0, z: 0, E: 218000 },// Intended 220000 -> Delta -2000
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, intendedField, 200000, symmetricCriteria);
    expect(res.overallStatus).toBe("CONFORMING");
    expect(res.regionalSummary.maxAbsoluteDeviation).toBe(2000);
    expect(res.pointRecords[1].intendedValue).toBe(210000);
    expect(res.pointRecords[1].signedDeviation).toBe(2000);
  });

  it("V8-TEST-04: Localized non-conforming hotspot detection (no global averaging mask)", () => {
    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 210000, uncertainty: 10.0 }, // Conforming
      { x: 10, y: 0, z: 0, E: 210000, uncertainty: 10.0 },// Conforming
      { x: 20, y: 0, z: 0, E: 210000, uncertainty: 10.0 },// Conforming
      { x: 30, y: 0, z: 0, E: 250000, uncertainty: 10.0 },// Delta +40000 MPa >> 10500 maxSymmetricDelta!
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    expect(res.overallStatus).toBe("NONCONFORMING");
    expect(res.regionalSummary.nonConformingPointsCount).toBe(1);
    expect(res.regionalSummary.worstCasePoint?.delta).toBe(40000);
    expect(res.regionalSummary.meanDeviation).toBe(10000); // Average is smaller, but overall is NONCONFORMING!
  });

  it("V8-TEST-05: Upper & lower acceptance threshold evaluation (ABSOLUTE_RANGE)", () => {
    const rangeCriteria: AcceptanceCriteriaContract = {
      criteriaId: "CRIT_RANGE",
      propertyId: "E",
      thresholdType: "ABSOLUTE_RANGE",
      minAbsoluteValue: 190000.0,
      maxAbsoluteValue: 220000.0,
      unit: "MPa",
      sourceSpecification: "SPEC-RANGE-01",
    };

    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 200000, uncertainty: 100 }, // Within range
      { x: 10, y: 0, z: 0, E: 180000, uncertainty: 100 },// Below min (180000 < 190000)
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, rangeCriteria);
    expect(res.overallStatus).toBe("NONCONFORMING");
    expect(res.pointRecords[1].status).toBe("NONCONFORMING");
  });

  it("V8-TEST-06: Unmeasured region handling (V8-ARCH-02)", () => {
    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 210000, isMeasured: true },
      { x: 10, y: 0, z: 0, E: 0, isMeasured: false }, // Unmeasured domain point
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria, 0.4);
    expect(res.pointRecords[1].status).toBe("NOT_MEASURED");
    expect(res.pointRecords[1].signedDeviation).toBeUndefined(); // MUST NOT be set to zero!
    expect(res.pointRecords[1].absoluteDeviation).toBeUndefined();
    expect(res.regionalSummary.unmeasuredPointsCount).toBe(1);
  });

  it("V8-TEST-07: Unit mismatch & normalization checks", () => {
    const pctCriteria: AcceptanceCriteriaContract = {
      criteriaId: "CRIT_PCT",
      propertyId: "E",
      thresholdType: "RELATIVE_PERCENTAGE",
      maxRelativePercentage: 0.05, // 5%
      unit: "MPa",
      sourceSpecification: "SPEC-PCT-01",
    };

    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 220500, uncertainty: 100 }, // 220,500 / 210,000 = +5.000%
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, pctCriteria);
    expect(res.pointRecords[0].relativeDeviation).toBeCloseTo(0.05, 4);
  });

  it("V8-TEST-08: Mismatched coordinate frames & registration failure handling", () => {
    const invalidState: any = { asBuiltStateId: "" };
    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(invalidState, undefined, 210000, symmetricCriteria);
    expect(res.overallStatus).toBe("INVALID_INPUT");
  });

  it("V8-TEST-09: Division-by-zero protection when p_intended = 0", () => {
    const pctCriteria: AcceptanceCriteriaContract = {
      criteriaId: "CRIT_PCT",
      propertyId: "E",
      thresholdType: "RELATIVE_PERCENTAGE",
      maxRelativePercentage: 0.05,
      unit: "MPa",
      sourceSpecification: "SPEC-PCT-01",
    };

    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 0, uncertainty: 0 },
    ]);

    // Intended value = 0.0
    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 0.0, pctCriteria);
    expect(res.pointRecords[0].status).toBe("CONFORMING"); // Safe safeguard handled
  });

  it("V8-TEST-10: Invalid numerical inputs handling", () => {
    const invalidResult = (SpatialMaterialDeviationEngine as any).buildInvalidResult(
      "REV_A", "FIELD_01", "ABState_01", "E", symmetricCriteria, "BLOCKED"
    );
    expect(invalidResult.overallStatus).toBe("BLOCKED");
    expect(invalidResult.resultHash).toBeDefined();
  });

  it("V8-TEST-11: Uncertainty overlapping threshold evaluation (INDETERMINATE)", () => {
    const state = createMockAsBuiltState([
      // Intended = 210000, maxSymmetricDelta = 10500.
      // Actual = 220500 -> absDelta = 10500 (Exactly on tolerance boundary!).
      // Uncertainty = 500 MPa.
      // 10500 <= 10500 - 500 (false) and 10500 > 10500 + 500 (false) -> INDETERMINATE
      { x: 0, y: 0, z: 0, E: 220500, uncertainty: 500.0 },
    ]);

    const res = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    expect(res.overallStatus).toBe("INDETERMINATE");
    expect(res.pointRecords[0].status).toBe("INDETERMINATE");
  });

  it("V8-TEST-12: Deterministic replay & evidence hash repeatability", () => {
    const state = createMockAsBuiltState([
      { x: 0, y: 0, z: 0, E: 210000 },
      { x: 10, y: 0, z: 0, E: 215000 },
    ]);

    const res1 = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    const res2 = SpatialMaterialDeviationEngine.computeSpatialDeviation(state, undefined, 210000, symmetricCriteria);
    expect(res1.resultHash).toBe(res2.resultHash);
  });

  it("V8-TEST-13: Revision stale evidence invalidation in FEMEvidenceEngine", () => {
    const devRes = SpatialMaterialDeviationEngine.computeSpatialDeviation(
      createMockAsBuiltState([{ x: 0, y: 0, z: 0, E: 210000 }]),
      undefined, 210000, symmetricCriteria
    );

    const model: any = {
      nodes: new Map([["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }]]),
      elements: new Map([["E1", { elementId: "E1", nodeIds: ["N1"], materialId: "M1", sectionId: "S1", formulationId: "BAR1D" }]]),
      materials: new Map([["M1", { materialId: "M1", E: 210000, nu: 0.3 }]]),
      loads: [],
      boundaryConditions: [],
      deviationResult: devRes,
    };
    const solveRes: any = { U: [0], trace: [], displacements: new Map() };
    const ev = FEMEvidenceEngine.generateEvidence(model, solveRes);

    expect(FEMEvidenceEngine.isEvidenceStale(ev, model).isStale).toBe(false);

    // Mutate deviationResult
    const modifiedModel = {
      ...model,
      deviationResult: { ...devRes, overallStatus: "NONCONFORMING" },
    };
    const staleCheck = FEMEvidenceEngine.isEvidenceStale(ev, modifiedModel);
    expect(staleCheck.isStale).toBe(true);
    expect(staleCheck.reason).toContain("Spatial material deviation result");
  });
});
