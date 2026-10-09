import { 
  MaterialQualificationRecord, 
  MaterialQualificationStatus, 
  MaterialQualificationVerdict,
  MaterialQualificationPolicy,
  PhysicsMaterialRequirementMatrix
} from "./types";
import { MaterialQualificationEngine } from "./MaterialQualificationEngine";
import { IndependentMaterialQualificationAuditor } from "./IndependentMaterialQualificationAuditor";
import { TrustClassification } from "../provenance/types";

export interface Gate100Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate100 {
  public static evaluateGate(): Gate100Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. Setup sample high-quality valid Material Qualification Record (Ti-6Al-4V)
    const policy: MaterialQualificationPolicy = {
      policyId: "POLICY-MIL-SPEC-01",
      revision: 1,
      effectiveAt: "2026-08-01T00:00:00Z",
      mandatoryEvidence: ["MILL_CERT", "TENSILE_TEST", "UNCERTAINTY_BUDGET"],
      requiredProperties: ["DENSITY", "ELASTIC_MODULUS", "YIELD_STRENGTH"],
      acceptableUncertainty: 20.0, // max standard uncertainty units
      validityRules: {},
      freshnessRules: { maxAgeDays: 365 },
      provenanceRequirements: "COMPLETE"
    };

    const physicsMatrix: PhysicsMaterialRequirementMatrix = {
      physicsModel: "LINEAR_STATIC_FEM",
      requiredProperties: ["DENSITY", "ELASTIC_MODULUS", "POISSON_RATIO"],
      requiredQualificationLevel: MaterialQualificationVerdict.QUALIFIED
    };

    const record: MaterialQualificationRecord = {
      qualificationId: "MQ-TI64-001",
      materialId: "TI-6AL-4V-GR5",
      materialRevision: 1,
      materialCondition: "ANNEALED",
      manufacturingState: "WROUGHT",
      propertySet: ["DENSITY", "ELASTIC_MODULUS", "POISSON_RATIO", "YIELD_STRENGTH"],
      uncertaintySet: ["U-E", "U-Y"],
      validityDomain: { minTemp: -50, maxTemp: 350 },
      requiredEvidence: ["MILL_CERT", "TENSILE_TEST", "UNCERTAINTY_BUDGET"],
      availableEvidence: ["MILL_CERT", "TENSILE_TEST", "UNCERTAINTY_BUDGET"],
      decisionRule: "STRINGENT_ACCEPTANCE",
      scope: {
        allowedConditions: ["ANNEALED"],
        allowedProperties: ["DENSITY", "ELASTIC_MODULUS", "POISSON_RATIO"],
        allowedPhysics: ["LINEAR_STATIC_FEM"],
        allowedTemperatureRange: { min: -50, max: 350 }
      },
      status: MaterialQualificationStatus.QUALIFIED,
      verdict: MaterialQualificationVerdict.QUALIFIED,
      provenance: {
        provenanceId: "PROV-1",
        materialId: "TI64",
        materialRevision: 1,
        nodes: [],
        edges: [],
        verificationStatus: TrustClassification.VERIFIED,
        provenanceFingerprint: "verified-fp-001",
        revision: 1,
      } as any,
      revision: 1,
      fingerprint: ""
    };

    record.fingerprint = MaterialQualificationEngine.calculateFingerprint(record);

    // Check 1: VALID QUALIFICATION FLOW (Room Temp)
    const evalResult = MaterialQualificationEngine.evaluateQualification(record, physicsMatrix, 20, policy);
    checks.push({
      id: "VALID_QUALIFICATION_FLOW",
      passed: evalResult.verdict === MaterialQualificationVerdict.QUALIFIED,
      details: "Ti-6Al-4V successfully passed qualification for Room Temp Linear Static FEM"
    });

    // Check 2: OUTSIDE DOMAIN REJECTION (High Temp)
    const evalOutside = MaterialQualificationEngine.evaluateQualification(record, physicsMatrix, 500, policy);
    checks.push({
      id: "OUTSIDE_DOMAIN_REJECTION",
      passed: evalOutside.verdict === MaterialQualificationVerdict.OUTSIDE_SCOPE,
      details: "Successfully rejected usage at 500°C which exceeds the 350°C qualified limit"
    });

    // Check 3: INCOMPLETE PROPERTY REJECTION
    const physicsNonlinear: PhysicsMaterialRequirementMatrix = {
      physicsModel: "NONLINEAR_PLASTICITY",
      requiredProperties: ["HARDENING_CURVE", "STRAIN_RATE_SENSITIVITY"],
      requiredQualificationLevel: MaterialQualificationVerdict.QUALIFIED
    };
    const evalIncomplete = MaterialQualificationEngine.evaluateQualification(record, physicsNonlinear, 20, policy);
    checks.push({
      id: "INCOMPLETE_PROPERTY_REJECTION",
      passed: evalIncomplete.verdict === MaterialQualificationVerdict.INCOMPLETE,
      details: "Correctly flagged INCOMPLETE when requested properties (Hardening) are missing from qualification record"
    });

    // Check 4: INDEPENDENT AUDIT PASS
    const auditReport = IndependentMaterialQualificationAuditor.audit(record, policy, physicsMatrix, 20);
    checks.push({
      id: "INDEPENDENT_AUDIT_PASS",
      passed: auditReport.verdict === "PASS",
      details: "Third-party audit confirmed evidence completeness and fingerprint integrity"
    });

    // Check 5: PROVENANCE REQUIREMENT ENFORCEMENT
    const unverifiedRecord: MaterialQualificationRecord = {
      ...record,
      provenance: { ...record.provenance, verificationStatus: TrustClassification.UNVERIFIED } as any
    };
    const evalProv = MaterialQualificationEngine.evaluateQualification(unverifiedRecord, physicsMatrix, 20, policy);
    checks.push({
      id: "PROVENANCE_REQUIREMENT_ENFORCEMENT",
      passed: evalProv.verdict === MaterialQualificationVerdict.NOT_QUALIFIED,
      details: "Policy enforcement: Rejected qualification because provenance chain is UNVERIFIED"
    });

    // Check 6: SOLVER ADMISSION GATE
    const admitted = MaterialQualificationEngine.isAdmittedForSolver(record, physicsMatrix, 20, policy);
    checks.push({
      id: "SOLVER_ADMISSION_GATE",
      passed: admitted === true,
      details: "Solver admission gate correctly admitted the qualified material for execution"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
