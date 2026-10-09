import { PropertyProvenance } from "../types";

export enum TrustClassification {
  UNVERIFIED = "UNVERIFIED",
  DECLARED = "DECLARED",
  DOCUMENTED = "DOCUMENTED",
  VERIFIED = "VERIFIED",
  MEASURED = "MEASURED",
  INDEPENDENTLY_VERIFIED = "INDEPENDENTLY_VERIFIED"
}

export enum ProvenanceStatus {
  COMPLETE = "COMPLETE",
  PARTIAL = "PARTIAL",
  BROKEN = "BROKEN",
  UNKNOWN = "UNKNOWN",
  CONFLICTED = "CONFLICTED"
}

export enum ProvenanceEdgeType {
  PRODUCED_BY = "PRODUCED_BY",
  SUPPLIED_BY = "SUPPLIED_BY",
  CERTIFIED_BY = "CERTIFIED_BY",
  DERIVED_FROM = "DERIVED_FROM",
  SPLIT_FROM = "SPLIT_FROM",
  MERGED_FROM = "MERGED_FROM",
  CUT_FROM = "CUT_FROM",
  SAMPLED_FROM = "SAMPLED_FROM",
  TREATED_BY = "TREATED_BY",
  MANUFACTURED_AS = "MANUFACTURED_AS",
  TESTED_BY = "TESTED_BY",
  GENERATED_FROM = "GENERATED_FROM",
  USED_BY = "USED_BY"
}

export enum ProvenanceNodeType {
  MATERIAL = "MATERIAL",
  SOURCE = "SOURCE",
  SUPPLIER = "SUPPLIER",
  MANUFACTURER = "MANUFACTURER",
  MILL = "MILL",
  HEAT = "HEAT",
  MELT = "MELT",
  CAST = "CAST",
  LOT = "LOT",
  BATCH = "BATCH",
  STOCK = "STOCK",
  PART = "PART",
  SPECIMEN = "SPECIMEN",
  CERTIFICATE = "CERTIFICATE",
  TEST = "TEST",
  PROPERTY = "PROPERTY",
  CONDITION = "CONDITION",
  HEAT_TREATMENT = "HEAT_TREATMENT",
  MANUFACTURING_STATE = "MANUFACTURING_STATE",
  ANALYSIS = "ANALYSIS"
}

export interface ProvenanceNode {
  id: string;
  type: ProvenanceNodeType;
  label: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface ProvenanceEdge {
  sourceId: string;
  targetId: string;
  type: ProvenanceEdgeType;
  metadata?: Record<string, any>;
}

export interface PhysicalMaterialInstance {
  physicalMaterialId: string;
  materialSpecificationId: string;
  grade: string;
  designation: string;
  form: string;
  dimensions: { width?: number; thickness?: number; diameter?: number; length?: number };
  heatNumber: string;
  lotNumber: string;
  batchNumber: string;
  sourceId: string;
  receivingRecordId: string;
  conditionId: string;
  provenance: PropertyProvenance;
}

export interface MaterialCertificateReference {
  certificateId: string;
  certificateType: "MILL_TEST" | "CONFORMANCE" | "INSPECTION" | "LAB_REPORT";
  issuer: string;
  issueDate: string;
  revision: number;
  materialReference: string;
  heatLotReference: string;
  documentFingerprint: string;
  verificationStatus: "VERIFIED" | "DECLARED" | "UNVERIFIED";
}

export interface MaterialSpecimen {
  specimenId: string;
  parentMaterialId: string;
  parentPartId?: string;
  parentLotId?: string;
  parentHeatNumber?: string;
  orientation: "LONGITUDINAL" | "TRANSVERSE" | "RADIAL" | "CIRCUMFERENTIAL" | "CUSTOM";
  extractionLocation?: string;
  conditionId: string;
  treatmentHistory: string[];
  testHistory: string[];
}

export interface MaterialTestProvenance {
  testId: string;
  specimenId: string;
  method: string;
  standardReference: string;
  equipmentId: string;
  calibrationStatus: "VALID" | "EXPIRED" | "NONE";
  operator: string;
  timestamp: string;
  rawDatasetFingerprint: string;
  resultValue: number;
  uncertainty: number;
}

export interface EngineeringPropertyUsage {
  analysisId: string;
  propertyId: string;
  materialConditionId: string;
  datasetRevision: number;
  sourceId: string;
  validityDomain: {
    minTemp: number;
    maxTemp: number;
  };
  selectionRationale: string;
  timestamp: string;
}

export interface MaterialProvenanceRecord {
  provenanceId: string;
  materialId: string;
  materialRevision: number;
  physicalIdentity?: PhysicalMaterialInstance;
  heatNumber?: string;
  lotNumber?: string;
  batchNumber?: string;
  certificates: MaterialCertificateReference[];
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
  verificationStatus: TrustClassification;
  provenanceFingerprint: string;
  revision: number;
  timestamp: string;
}
