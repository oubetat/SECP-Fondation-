import { describe, expect, it } from "vitest";
import { 
  ManufacturingFeatureRecognitionEngine, 
  ManufacturingFeatureValidator, 
  ManufacturingFeatureEngine,
  HardAcceptanceGate101,
  ManufacturingFeatureType,
  FeatureValidationStatus,
  generateReports101
} from "../features/index";

describe("PATCH-101: Manufacturing Feature Model", () => {
  it("1. Recognizes holes from cylindrical B-Rep faces", () => {
    const mockEntities = [
      { id: "F1", type: "CYLINDRICAL_FACE", radius: 10, length: 50, boundaryIds: ["E1", "E2"] }
    ];
    const features = ManufacturingFeatureRecognitionEngine.recognizeFeatures("PART-A", 1, mockEntities);
    
    expect(features.length).toBe(1);
    expect(features[0].featureType).toBe(ManufacturingFeatureType.HOLE);
    expect(features[0].parameters["diameter"].value).toBe(20);
  });

  it("2. Validates feature geometric constraints", () => {
    const mockEntities = [
      { id: "F1", type: "CYLINDRICAL_FACE", radius: 5, length: 20, boundaryIds: ["E1"] }
    ];
    const features = ManufacturingFeatureRecognitionEngine.recognizeFeatures("PART-B", 1, mockEntities);
    const validation = ManufacturingFeatureValidator.validateFeature(features[0], {});
    
    expect(validation.status).toBe(FeatureValidationStatus.VALID);
  });

  it("3. Detects circular dependencies in the feature graph", () => {
    const f1: any = { featureId: "F1", dependencies: ["F2"] };
    const f2: any = { featureId: "F2", dependencies: ["F1"] };
    
    expect(ManufacturingFeatureValidator.checkCyclicDependencies([f1, f2])).toBe(true);
  });

  it("4. Generates deterministic fingerprints", () => {
    const mockEntities = [
      { id: "F1", type: "CYLINDRICAL_FACE", radius: 5, length: 20, boundaryIds: ["E1"] }
    ];
    const features = ManufacturingFeatureRecognitionEngine.recognizeFeatures("PART-C", 1, mockEntities);
    const fp1 = ManufacturingFeatureEngine.calculateFingerprint(features[0]);
    const fp2 = ManufacturingFeatureEngine.calculateFingerprint(features[0]);
    
    expect(fp1).toBe(fp2);
    expect(fp1).toContain("feat-fingerprint-");
  });

  it("5. Hard Acceptance Gate evaluates to PASS", () => {
    const gate = HardAcceptanceGate101.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("6. generateReports101 executes successfully", () => {
    expect(() => generateReports101()).not.toThrow();
  });
});
