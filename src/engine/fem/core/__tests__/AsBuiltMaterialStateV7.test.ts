import { describe, it, expect } from "vitest";
import {
  AsBuiltMaterialStateEngine,
  AsBuiltMaterialDataset,
  RawMeasurementPoint
} from "../AsBuiltMaterialStateEngine";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { CoordinateFrameContract } from "../GeometryMaterialAssignment";
import { FEMEvidenceEngine } from "../FEMEvidenceEngine";

describe("SECP-PROGRAMMABLE-MATERIAL-V7-001 As-Built Material State Engine", () => {
  const sampleFrame: CoordinateFrameContract = {
    frameType: "LOCAL_PART_FRAME",
    frameId: "PartFrame01",
    transform: {
      position: { x: 10, y: 20, z: 30 },
    },
  };

  const createValidDataset = (dataOrigin: any = "SYNTHETIC_TEST_DATA"): AsBuiltMaterialDataset => ({
    datasetId: "DS_001",
    partInstanceId: "PART_1001",
    engineeringRevisionId: "REV_A",
    geometryRevisionId: "GEO_REV_1",
    measurementMethodId: "ULTRASONIC_TEST_01",
    dataOrigin,
    sensorMetadata: {
      deviceName: "Olympus_UT_3000",
      resolution: 0.1,
      accuracy: 500.0, // 500 MPa accuracy
    },
    rawPoints: [
      { pointId: "P1", x: 0, y: 0, z: 0, propertyId: "E", value: 210000, unit: "MPa", uncertainty: 500, qualityStatus: "VALIDATED" },
      { pointId: "P2", x: 10, y: 0, z: 0, propertyId: "E", value: 215000, unit: "MPa", uncertainty: 500, qualityStatus: "VALIDATED" },
      { pointId: "P3", x: 20, y: 0, z: 0, propertyId: "E", value: 208000, unit: "MPa", uncertainty: 500, qualityStatus: "VALIDATED" },
      { pointId: "P4", x: 30, y: 0, z: 0, propertyId: "E", value: 212000, unit: "MPa", uncertainty: 500, qualityStatus: "VALIDATED" },
    ],
    createdAt: new Date().toISOString(),
  });

  it("V7-TEST-01: Known exact physical measurements reconstruction", () => {
    const ds = createValidDataset();
    const evalPts = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const reconstructed = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, evalPts, 5.0);
    expect(reconstructed.coverageRatio).toBe(1.0);
    expect(reconstructed.reconstructedPoints[0].reconstructedProperties["E"].value).toBe(210000);
    expect(reconstructed.reconstructedPoints[1].reconstructedProperties["E"].value).toBe(215000);
  });

  it("V7-TEST-02: Known spatial transformation registration accuracy", () => {
    const ds = createValidDataset();
    const landmarks = [
      { local: [0, 0, 0] as [number, number, number], global: [10, 20, 30] as [number, number, number] },
      { local: [10, 0, 0] as [number, number, number], global: [20, 20, 30] as [number, number, number] },
    ];
    const res = AsBuiltMaterialStateEngine.registerDatasetToGeometry(ds, sampleFrame, landmarks);
    expect(res.registrationError.maxError).toBeLessThan(1e-5);
    expect(res.registeredPoints[0].x).toBe(10);
    expect(res.registeredPoints[0].y).toBe(20);
    expect(res.registeredPoints[0].z).toBe(30);
  });

  it("V7-TEST-03: Out-of-bounds data rejection", () => {
    const ds = createValidDataset();
    ds.rawPoints.push({
      pointId: "P_OOB",
      x: 100, y: 100, z: 100,
      propertyId: "E",
      value: 200000,
      unit: "MPa",
    });
    const bounds = { minX: -5, maxX: 35, minY: -5, maxY: 5, minZ: -5, maxZ: 5 };
    const report = AsBuiltMaterialStateEngine.validateMeasurementDataset(ds, bounds);
    expect(report.outOfBoundsCount).toBe(1);
    const oobPt = ds.rawPoints.find(p => p.pointId === "P_OOB");
    expect(oobPt?.qualityStatus).toBe("OUT_OF_BOUNDS");
  });

  it("V7-TEST-04: Missing data coverage reduction & unmeasured region identification", () => {
    const ds = createValidDataset();
    const evalPts = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 500, y: 500, z: 500 }, // Way out of sampling radius
    ];
    const reconstructed = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, evalPts, 15.0);
    expect(reconstructed.coverageRatio).toBeCloseTo(2 / 3, 2);
    expect(reconstructed.unmeasuredVolumeRatio).toBeCloseTo(1 / 3, 2);
    expect(reconstructed.unmeasuredRegions.length).toBeGreaterThan(0);
  });

  it("V7-TEST-05: Conflicting measurements policy resolution", () => {
    const ds = createValidDataset();
    ds.rawPoints.push({
      pointId: "P1_CONFLICT",
      x: 0, y: 0, z: 0,
      propertyId: "E",
      value: 150000, // Direct conflict with 210000 at (0,0,0)
      unit: "MPa",
    });
    const report = AsBuiltMaterialStateEngine.validateMeasurementDataset(ds);
    expect(report.conflictingPointCount).toBeGreaterThan(0);
    expect(report.isValid).toBe(false);
  });

  it("V7-TEST-06: Unit conversion mismatch rejection & normalization", () => {
    const normPa = AsBuiltMaterialStateEngine.normalizePropertyValue(210e9, "Pa");
    expect(normPa.normalizedValue).toBe(210000);
    expect(normPa.normalizedUnit).toBe("MPa");

    const normGPa = AsBuiltMaterialStateEngine.normalizePropertyValue(210, "GPa");
    expect(normGPa.normalizedValue).toBe(210000);
    expect(normGPa.normalizedUnit).toBe("MPa");

    const normGcm3 = AsBuiltMaterialStateEngine.normalizePropertyValue(7.85, "g/cm3");
    expect(normGcm3.normalizedValue).toBe(7850);
    expect(normGcm3.normalizedUnit).toBe("kg/m3");
  });

  it("V7-TEST-07: Synthetic data origin tag enforcement", () => {
    const ds = createValidDataset("SYNTHETIC_TEST_DATA");
    const report = AsBuiltMaterialStateEngine.validateMeasurementDataset(ds);
    expect(report.warnings.some(w => w.includes("SYNTHETIC_TEST_DATA"))).toBe(true);
  });

  it("V7-TEST-08: Uncertainty tracking & indeterminate boundary evaluation", () => {
    const ds = createValidDataset();
    // Point with actual 210000 MPa, intended 200000 MPa (5% diff = 10000 MPa)
    // Allowed tolerance = 5% of 200000 = 10000 MPa.
    // Absolute delta = 10000.
    // Large uncertainty = 2000 MPa.
    // 10000 <= 10000 - 2000 (false) and 10000 > 10000 + 2000 (false) -> INDETERMINATE
    ds.rawPoints = [
      { pointId: "P1", x: 0, y: 0, z: 0, propertyId: "E", value: 210000, unit: "MPa", uncertainty: 2000, qualityStatus: "VALIDATED" },
    ];
    const reconstructed = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, [{ x: 0, y: 0, z: 0 }], 5.0);
    const comp = AsBuiltMaterialStateEngine.compareIntendedVsAsBuilt(reconstructed, undefined, 200000, 0.05);
    expect(comp.overallStatus).toBe("INDETERMINATE");
  });

  it("V7-TEST-09: Revision change evidence invalidation", () => {
    const model: any = {
      nodes: new Map([["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }]]),
      elements: new Map([["E1", { elementId: "E1", nodeIds: ["N1"], materialId: "M1", sectionId: "S1", formulationId: "BAR1D" }]]),
      materials: new Map([["M1", { materialId: "M1", E: 210000, nu: 0.3 }]]),
      loads: [],
      boundaryConditions: [],
      asBuiltState: { stateHash: "HASH_A1", engineeringRevisionId: "REV_A" },
    };
    const solveRes: any = { U: [0], trace: [], displacements: new Map() };
    const ev = FEMEvidenceEngine.generateEvidence(model, solveRes);

    // Same model
    expect(FEMEvidenceEngine.isEvidenceStale(ev, model).isStale).toBe(false);

    // Modify asBuiltState revision
    const modifiedModel = {
      ...model,
      asBuiltState: { stateHash: "HASH_B2", engineeringRevisionId: "REV_B" },
    };
    const staleCheck = FEMEvidenceEngine.isEvidenceStale(ev, modifiedModel);
    expect(staleCheck.isStale).toBe(true);
    expect(staleCheck.reason).toContain("As-Built actual material state");
  });

  it("V7-TEST-10: Independent negative test (out-of-tolerance deviation detection)", () => {
    const ds = createValidDataset();
    ds.rawPoints = [
      { pointId: "P1", x: 0, y: 0, z: 0, propertyId: "E", value: 150000, unit: "MPa", uncertainty: 100, qualityStatus: "VALIDATED" },
    ];
    const reconstructed = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, [{ x: 0, y: 0, z: 0 }], 5.0);
    const comp = AsBuiltMaterialStateEngine.compareIntendedVsAsBuilt(reconstructed, undefined, 210000, 0.05); // Intended 210 GPa vs Actual 150 GPa
    expect(comp.overallStatus).toBe("FAIL");
    expect(comp.failCount).toBe(1);
  });

  it("V7-TEST-11: Invalid numerical values rejection (NaN, Infinity, negative E)", () => {
    const ds = createValidDataset();
    ds.rawPoints = [
      { pointId: "P_NAN", x: NaN, y: 0, z: 0, propertyId: "E", value: 210000, unit: "MPa" },
      { pointId: "P_NEG", x: 0, y: 0, z: 0, propertyId: "E", value: -5000, unit: "MPa" },
      { pointId: "P_INF", x: 0, y: 0, z: 0, propertyId: "E", value: Infinity, unit: "MPa" },
    ];
    const report = AsBuiltMaterialStateEngine.validateMeasurementDataset(ds);
    expect(report.isValid).toBe(false);
    expect(report.rejectedPointCount).toBe(3);
  });

  it("V7-TEST-12: Deterministic replay & hashing repeatability", () => {
    const ds = createValidDataset();
    const evalPts = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }];
    const rec1 = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, evalPts, 5.0);
    const rec2 = AsBuiltMaterialStateEngine.reconstructAsBuiltState(ds, evalPts, 5.0);
    expect(rec1.stateHash).toBe(rec2.stateHash);
  });
});
