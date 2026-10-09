import { PropertySourceType } from "../types";
import { FracturePropertiesEngine } from "./FracturePropertiesEngine";
import { FractureDataset, FracturePropertyType, FractureMode, FractureVerdict } from "./types";
import { IndependentFractureAuditor } from "./IndependentFractureAuditor";

export interface Gate095Report {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate095 {
  public static evaluateGate(): Gate095Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    const mockDataset: FractureDataset = {
      datasetId: "DS-FRACTURE-AL7075",
      materialId: "AL7075-T6",
      materialRevision: 1,
      specimenType: "Compact Tension (CT)",
      specimenGeometry: { width: 50, thickness: 25 },
      crackGeometry: { length: 25, orientation: "L-T" },
      thickness: 25,
      loadingMode: FractureMode.MODE_I,
      temperature: 293.15,
      environment: "Air",
      fractureProperty: FracturePropertyType.KIC,
      measuredValue: 28e6, // 28 MPa√m
      units: "Pa√m", // Let's use Pa√m for consistency with SI
      provenance: {
        sourceId: 'ASTM E399 Database', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash',
        timestamp: new Date().toISOString()
      }
    };

    // 1. PROPERTY_INGESTION_VERIFICATION
    const property = FracturePropertiesEngine.processProperty(mockDataset);
    checks.push({
      id: "PROPERTY_INGESTION_INTEGRITY",
      passed: property.value === 28e6 && property.type === FracturePropertyType.KIC,
      details: "Verified successful fracture property normalization and ingestion"
    });

    // 2. LEFM_ASSESSMENT_VERIFICATION
    // sigma = 100 MPa, a = 0.002 m (2mm), Y = 1.12
    // KI = 1.12 * 100e6 * sqrt(PI * 0.002) = 1.12 * 100e6 * 0.079 = 8.87e6 Pa√m
    const assessment = FracturePropertiesEngine.assessLEFM(100e6, 0.002, 1.12, property);
    checks.push({
      id: "LEFM_ASSESSMENT_ACCURACY",
      passed: assessment.KI > 8e6 && assessment.KI < 10e6 && assessment.status === FractureVerdict.SUBCRITICAL,
      details: "Verified LEFM Stress Intensity Factor calculation and criticality verdict"
    });

    // 3. CRITICALITY_DETECTION
    // Higher stress to trigger failure
    const failAssessment = FracturePropertiesEngine.assessLEFM(400e6, 0.002, 1.12, property);
    checks.push({
      id: "CRITICAL_FAILURE_DETECTION",
      passed: failAssessment.status === FractureVerdict.CRITICAL || failAssessment.status === FractureVerdict.SUPERCRITICAL,
      details: "Verified successful detection of critical fracture conditions"
    });

    // 4. INDEPENDENT_AUDIT
    const audit = IndependentFractureAuditor.audit(mockDataset, property);
    checks.push({
      id: "INDEPENDENT_FRACTURE_AUDIT",
      passed: audit.verdict === "PASS",
      details: "Passed provenance, unit consistency, and physical plausibility checks"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";
    return { verdict, checks };
  }
}
