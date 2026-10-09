import { describe, expect, it } from "vitest";
import { 
  MaterialQualificationEngine, 
  IndependentMaterialQualificationAuditor, 
  HardAcceptanceGate100, 
  generateReports100,
  MaterialQualificationStatus,
  MaterialQualificationVerdict,
  MaterialQualificationRecord,
  MaterialQualificationPolicy,
  PhysicsMaterialRequirementMatrix
} from "../qualification/index";
import { TrustClassification } from "../../materials/provenance/types";

describe("PATCH-100: Material Qualification Gate", () => {
  const policy: MaterialQualificationPolicy = {
    policyId: "P1",
    revision: 1,
    effectiveAt: "2026-08-20T00:00:00Z",
    mandatoryEvidence: ["E1"],
    requiredProperties: ["P1"],
    acceptableUncertainty: 0,
    validityRules: {},
    freshnessRules: { maxAgeDays: 100 },
    provenanceRequirements: "COMPLETE"
  };

  const physicsMatrix: PhysicsMaterialRequirementMatrix = {
    physicsModel: "M1",
    requiredProperties: ["P1"],
    requiredQualificationLevel: MaterialQualificationVerdict.QUALIFIED
  };

  const record: MaterialQualificationRecord = {
    qualificationId: "Q1",
    materialId: "M1",
    materialRevision: 1,
    materialCondition: "C1",
    manufacturingState: "S1",
    propertySet: ["P1"],
    uncertaintySet: [],
    validityDomain: { minTemp: 0, maxTemp: 100 },
    requiredEvidence: ["E1"],
    availableEvidence: ["E1"],
    decisionRule: "R1",
    scope: {
      allowedConditions: ["C1"],
      allowedProperties: ["P1"],
      allowedPhysics: ["M1"],
      allowedTemperatureRange: { min: 0, max: 100 }
    },
    status: MaterialQualificationStatus.QUALIFIED,
    verdict: MaterialQualificationVerdict.QUALIFIED,
    revision: 1,
    fingerprint: "",
    provenance: {
        verificationStatus: TrustClassification.VERIFIED,
        provenanceFingerprint: "fp"
    } as any
  };

  record.fingerprint = MaterialQualificationEngine.calculateFingerprint(record);

  it("1. MaterialQualificationEngine validates validity domain", () => {
    const res = MaterialQualificationEngine.evaluateQualification(record, physicsMatrix, 50, policy);
    expect(res.verdict).toBe(MaterialQualificationVerdict.QUALIFIED);

    const resOutside = MaterialQualificationEngine.evaluateQualification(record, physicsMatrix, 150, policy);
    expect(resOutside.verdict).toBe(MaterialQualificationVerdict.OUTSIDE_SCOPE);
  });

  it("2. MaterialQualificationEngine detects missing properties", () => {
    const missingMatrix = { ...physicsMatrix, requiredProperties: ["P2"] };
    const res = MaterialQualificationEngine.evaluateQualification(record, missingMatrix, 50, policy);
    expect(res.verdict).toBe(MaterialQualificationVerdict.INCOMPLETE);
    expect(res.details[0]).toContain("Missing required properties");
  });

  it("3. Independent auditor detects fingerprint mismatch", () => {
    const corruptRecord = { ...record, fingerprint: "wrong-fp" };
    const audit = IndependentMaterialQualificationAuditor.audit(corruptRecord, policy, physicsMatrix, 50);
    expect(audit.verdict).toBe("FAIL");
    expect(audit.checks.find(c => c.id === "FINGERPRINT_INTEGRITY")?.passed).toBe(false);
  });

  it("4. Hard Acceptance Gate evaluates to PASS", () => {
    const gate = HardAcceptanceGate100.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("5. generateReports100 executes without error", () => {
    expect(() => generateReports100()).not.toThrow();
  });
});
