import { PropertyProvenance } from "../types";
import { MaterialProvenanceRecord } from "../provenance/types";
import { MaterialUncertaintyRecord } from "../uncertainty/types";

export enum MaterialQualificationStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  QUALIFIED = "QUALIFIED",
  CONDITIONALLY_QUALIFIED = "CONDITIONALLY_QUALIFIED",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
  REJECTED = "REJECTED",
  INVALID = "INVALID",
  INCOMPLETE = "INCOMPLETE",
  OUTSIDE_SCOPE = "OUTSIDE_SCOPE"
}

export enum MaterialQualificationVerdict {
  QUALIFIED = "QUALIFIED",
  CONDITIONALLY_QUALIFIED = "CONDITIONALLY_QUALIFIED",
  NOT_QUALIFIED = "NOT_QUALIFIED",
  INVALID = "INVALID",
  INCOMPLETE = "INCOMPLETE",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
  OUTSIDE_SCOPE = "OUTSIDE_SCOPE"
}

export enum PropertyQualificationStatus {
  VERIFIED = "VERIFIED",
  VALIDATED = "VALIDATED",
  QUALIFIED = "QUALIFIED",
  CONDITIONAL = "CONDITIONAL",
  UNQUALIFIED = "UNQUALIFIED",
  MISSING = "MISSING",
  EXPIRED = "EXPIRED",
  OUT_OF_SCOPE = "OUT_OF_SCOPE"
}

export interface MaterialSpecification {
  specificationId: string;
  standard: string;
  revision: string;
  grade: string;
  requirements: Record<string, any>;
  validity: { minTemp: number; maxTemp: number };
}

export interface MaterialQualificationTestRequirement {
  requirementId: string;
  property: string;
  testMethod: string;
  standard: string;
  acceptanceRange: { min?: number; max?: number };
  temperature: number;
  condition: string;
  sampleCount: number;
  uncertaintyRequirement: number;
  evidenceRequirement: string;
}

export interface MaterialQualificationPolicy {
  policyId: string;
  revision: number;
  effectiveAt: string;
  mandatoryEvidence: string[];
  requiredProperties: string[];
  acceptableUncertainty: number;
  validityRules: Record<string, any>;
  freshnessRules: { maxAgeDays: number };
  provenanceRequirements: "COMPLETE" | "PARTIAL" | "MINIMAL";
}

export interface MaterialQualificationRecord {
  qualificationId: string;
  materialId: string;
  materialRevision: number;
  physicalMaterialId?: string;
  materialCondition: string;
  manufacturingState: string;
  heatTreatment?: string;
  propertySet: string[];
  uncertaintySet: string[];
  validityDomain: { minTemp: number; maxTemp: number };
  requiredEvidence: string[];
  availableEvidence: string[];
  auditResult?: string;
  gateResult?: string;
  decisionRule: string;
  scope: {
    allowedConditions: string[];
    allowedProperties: string[];
    allowedPhysics: string[];
    allowedTemperatureRange: { min: number; max: number };
  };
  status: MaterialQualificationStatus;
  verdict: MaterialQualificationVerdict;
  qualifiedAt?: string;
  expiresAt?: string;
  reviewedBy?: string[];
  revision: number;
  fingerprint: string;
  provenance?: MaterialProvenanceRecord;
  uncertaintyRecords?: MaterialUncertaintyRecord[];
}

export interface PhysicsMaterialRequirementMatrix {
  physicsModel: string;
  requiredProperties: string[];
  requiredQualificationLevel: MaterialQualificationVerdict;
}
