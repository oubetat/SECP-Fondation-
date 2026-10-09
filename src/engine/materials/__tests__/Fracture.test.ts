import { PropertySourceType } from "../types";
import { describe, expect, it } from "vitest";
import { 
  FracturePropertiesEngine, 
  FractureUtils, 
  HardAcceptanceGate095, 
  generateReports095,
  FractureVerdict,
  FractureMode,
  FracturePropertyType
} from "../index";

describe("PATCH-095: Fracture Properties Framework", () => {
  it("1. Fracture Utils calculates KI correctly", () => {
    const sigma = 100e6;
    const a = 0.01; // 10mm
    const Y = 1.0;
    // K = 1 * 100e6 * sqrt(PI * 0.01) = 100e6 * 0.1772 = 17.72 MPa√m
    expect(FractureUtils.calculateKI(sigma, a, Y)).toBeCloseTo(17724538.5, 1);
  });

  it("2. Fracture Properties Engine processes datasets correctly", () => {
    const dataset = {
      datasetId: "DS-001",
      materialId: "MAT-001",
      materialRevision: 1,
      specimenType: "CT",
      specimenGeometry: {},
      crackGeometry: { length: 0.01, orientation: "L-T" },
      thickness: 0.02,
      loadingMode: FractureMode.MODE_I,
      temperature: 293.15,
      environment: "Air",
      fractureProperty: FracturePropertyType.KIC,
      measuredValue: 30e6,
      units: "Pa√m",
      provenance: { sourceId: 'Lab', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash', timestamp: "now" }
    };

    const property = FracturePropertiesEngine.processProperty(dataset);
    expect(property.value).toBe(30e6);
    expect(property.type).toBe(FracturePropertyType.KIC);
  });

  it("3. HardAcceptanceGate095 achieves PASS verdict", () => {
    const report = HardAcceptanceGate095.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("4. generateReports095 executes without error", () => {
    expect(() => generateReports095()).not.toThrow();
  });
});
