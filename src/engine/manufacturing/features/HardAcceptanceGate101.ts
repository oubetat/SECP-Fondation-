import { 
  ManufacturingFeature, 
  ManufacturingFeatureType, 
  FeatureValidationStatus, 
  ManufacturingIntent, 
  FeatureOrigin, 
  FeatureVisibility 
} from "./types";
import { ManufacturingFeatureRecognitionEngine } from "./ManufacturingFeatureRecognitionEngine";
import { ManufacturingFeatureValidator } from "./ManufacturingFeatureValidator";
import { ManufacturingFeatureEngine } from "./ManufacturingFeatureEngine";

export interface Gate101Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate101 {
  public static evaluateGate(): Gate101Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // Setup mock B-Rep entities for recognition
    const mockEntities = [
      { id: "FACE-001", type: "CYLINDRICAL_FACE", radius: 5, length: 20, boundaryIds: ["EDGE-1", "EDGE-2"] },
      { id: "FACE-002", type: "PLANAR_FACE", role: "POCKET_FLOOR", depth: 10, boundaryIds: ["EDGE-3"] }
    ];

    // Check 1: FEATURE RECOGNITION (Holes & Pockets)
    const recognized = ManufacturingFeatureRecognitionEngine.recognizeFeatures("PART-101", 1, mockEntities);
    const hasHole = recognized.some(f => f.featureType === ManufacturingFeatureType.HOLE);
    const hasPocket = recognized.some(f => f.featureType === ManufacturingFeatureType.POCKET);
    checks.push({
      id: "FEATURE_RECOGNITION_ACCURACY",
      passed: hasHole && hasPocket,
      details: "Successfully recognized Hole and Pocket features from mock B-Rep topology"
    });

    // Check 2: FEATURE VALIDATION (Invalid Parameters)
    const invalidFeature: ManufacturingFeature = {
      ...recognized[0],
      parameters: { 
        ...recognized[0].parameters, 
        diameter: { ...recognized[0].parameters["diameter"], value: -1 } // Negative diameter
      }
    };
    const validation = ManufacturingFeatureValidator.validateFeature(invalidFeature, {});
    checks.push({
      id: "GEOMETRIC_VALIDATION_REJECTION",
      passed: validation.status === FeatureValidationStatus.INVALID,
      details: "Correctly rejected feature with invalid negative geometric parameters"
    });

    // Check 3: CYCLIC DEPENDENCY DETECTION
    const f1: any = { featureId: "F1", dependencies: ["F2"] };
    const f2: any = { featureId: "F2", dependencies: ["F1"] };
    const hasCycle = ManufacturingFeatureValidator.checkCyclicDependencies([f1, f2]);
    checks.push({
      id: "CYCLIC_DEPENDENCY_DETECTION",
      passed: hasCycle === true,
      details: "Successfully detected and flagged a circular dependency loop in the feature graph"
    });

    // Check 4: ACCESSIBILITY ANALYSIS
    const accessibility = ManufacturingFeatureEngine.evaluateAccessibility(recognized[0]); // Hole
    checks.push({
      id: "ACCESSIBILITY_ANALYSIS_VALID",
      passed: accessibility.includes("+Z") && accessibility.includes("-Z"),
      details: "Hole accessibility correctly identified axial directions (+Z, -Z)"
    });

    // Check 5: FINGERPRINT REPRODUCIBILITY
    const fp1 = ManufacturingFeatureEngine.calculateFingerprint(recognized[0]);
    const fp2 = ManufacturingFeatureEngine.calculateFingerprint(recognized[0]);
    checks.push({
      id: "FINGERPRINT_REPRODUCIBILITY",
      passed: fp1 === fp2,
      details: "Feature fingerprints are deterministic and reproducible across multiple calculations"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
