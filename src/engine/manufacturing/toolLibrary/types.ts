import { PropertyProvenance } from "../../materials/types";

export enum ManufacturingToolType {
  MILLING_TOOL = "MILLING_TOOL",
  DRILL = "DRILL",
  REAMER = "REAMER",
  TAP = "TAP",
  BORING_TOOL = "BORING_TOOL",
  TURNING_TOOL = "TURNING_TOOL",
  GROOVING_TOOL = "GROOVING_TOOL",
  THREADING_TOOL = "THREADING_TOOL",
  FACE_MILL = "FACE_MILL",
  END_MILL = "END_MILL",
  BALL_NOSE_MILL = "BALL_NOSE_MILL",
  CHAMFER_MILL = "CHAMFER_MILL",
  COUNTERSINK_TOOL = "COUNTERSINK_TOOL",
  COUNTERBORE_TOOL = "COUNTERBORE_TOOL",
  UNKNOWN = "UNKNOWN",
  CUSTOM = "CUSTOM",
  SPECIAL_PURPOSE = "SPECIAL_PURPOSE"
}

export enum ToolMaterialType {
  HSS = "HSS",
  CARBIDE = "CARBIDE",
  CERAMIC = "CERAMIC",
  CBN = "CBN",
  PCD = "PCD",
  DIAMOND = "DIAMOND",
  CUSTOM = "CUSTOM"
}

export enum ToolCoatingType {
  UNCOATED = "UNCOATED",
  TiN = "TiN",
  TiAlN = "TiAlN",
  AlTiN = "AlTiN",
  TiCN = "TiCN",
  DLC = "DLC",
  CUSTOM = "CUSTOM"
}

export enum ToolTipType {
  FLAT = "FLAT",
  BALL = "BALL",
  BULL = "BULL",
  POINT = "POINT",
  CONICAL = "CONICAL",
  CUSTOM = "CUSTOM"
}

export enum DrillType {
  TWIST_DRILL = "TWIST_DRILL",
  CENTER_DRILL = "CENTER_DRILL",
  STEP_DRILL = "STEP_DRILL",
  DEEP_HOLE_DRILL = "DEEP_HOLE_DRILL",
  SPECIAL_DRILL = "SPECIAL_DRILL"
}

export enum ToolHolderInterface {
  HSK = "HSK",
  CAT = "CAT",
  BT = "BT",
  CAPTO = "CAPTO",
  PSC = "PSC",
  COLLET = "COLLET",
  CUSTOM = "CUSTOM"
}

export enum ToolCondition {
  NEW = "NEW",
  USED = "USED",
  WORN = "WORN",
  DAMAGED = "DAMAGED",
  INSPECTION_REQUIRED = "INSPECTION_REQUIRED",
  RETIRED = "RETIRED",
  UNKNOWN = "UNKNOWN"
}

export enum CuttingDataStatus {
  VERIFIED = "VERIFIED",
  VALIDATED = "VALIDATED",
  QUALIFIED = "QUALIFIED",
  CONDITIONAL = "CONDITIONAL",
  UNVERIFIED = "UNVERIFIED",
  EXPIRED = "EXPIRED",
  OUT_OF_SCOPE = "OUT_OF_SCOPE"
}

export enum CoolantType {
  DRY = "DRY",
  FLOOD = "FLOOD",
  MQL = "MQL",
  THROUGH_TOOL = "THROUGH_TOOL",
  AIR = "AIR",
  SPECIAL = "SPECIAL"
}

export enum CoolantRequirement {
  REQUIRED = "REQUIRED",
  RECOMMENDED = "RECOMMENDED",
  OPTIONAL = "OPTIONAL",
  NOT_SUPPORTED = "NOT_SUPPORTED",
  UNKNOWN = "UNKNOWN"
}

export enum ToolOperationCompatibilityType {
  COMPATIBLE = "COMPATIBLE",
  CONDITIONAL = "CONDITIONAL",
  INCOMPATIBLE = "INCOMPATIBLE",
  UNKNOWN = "UNKNOWN"
}

export enum ToolLibraryStatus {
  DRAFT = "DRAFT",
  VALIDATED = "VALIDATED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  OBSOLETE = "OBSOLETE",
  INVALID = "INVALID"
}

export enum ToolSelectionVerdict {
  ELIGIBLE = "ELIGIBLE",
  CONDITIONALLY_ELIGIBLE = "CONDITIONALLY_ELIGIBLE",
  INELIGIBLE = "INELIGIBLE",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA",
  INVALID = "INVALID",
  NO_ELIGIBLE_TOOL = "NO_ELIGIBLE_TOOL"
}

export enum ToolQualificationVerdict {
  QUALIFIED = "QUALIFIED",
  CONDITIONALLY_QUALIFIED = "CONDITIONALLY_QUALIFIED",
  NOT_QUALIFIED = "NOT_QUALIFIED",
  INVALID = "INVALID",
  INCOMPLETE = "INCOMPLETE",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
  OUTSIDE_SCOPE = "OUTSIDE_SCOPE"
}

export interface ToolGeometry {
  cuttingDiameter: number;
  cuttingLength: number;
  overallLength: number;
  shankDiameter: number;
  shankLength: number;
  neckDiameter?: number;
  neckLength?: number;
  tipRadius?: number;
  tipAngle?: number;
  helixAngle?: number;
  cornerRadius?: number;
  ballRadius?: number;
  effectiveDiameter?: number;
  marginDiameter?: number;
  webThickness?: number;
  leadAngle?: number;
}

export interface ToolSolidModel {
  solidId: string;
  collisionModelPath?: string;
  hasBRepRepresentation: boolean;
  clearanceDistance: number;
}

export interface FluteDefinition {
  fluteCount: number;
  helixAngle: number;
  fluteLength: number;
  fluteDirection: "RIGHT_HAND" | "LEFT_HAND";
  variablePitch: boolean;
  pitchProfile?: number[];
  variableHelix: boolean;
  helixProfile?: number[];
}

export interface CuttingInsert {
  insertId: string;
  shape: string;
  size: number;
  thickness: number;
  noseRadius: number;
  grade: {
    gradeId: string;
    material: string;
    applicationRange: string[];
    manufacturer: string;
    revision: number;
  };
  coating: string;
  hand: "RIGHT" | "LEFT" | "NEUTRAL";
  chipBreaker?: string;
}

export interface CuttingEdge {
  edgeId: string;
  edgeType: string;
  edgeCount: number;
  geometry?: any;
  radius: number;
  condition: string;
}

export interface ToolHolder {
  holderId: string;
  holderType: string;
  interfaceType: ToolHolderInterface;
  gaugeLength: number;
  overallLength: number;
  diameter: number;
  runout: number;
  maxRPM: number;
  manufacturer: string;
  revision: number;
}

export interface ToolExtension {
  extensionId: string;
  extensionLength: number;
  diameter: number;
  material: string;
  stiffnessMetadata?: {
    elasticModulus: number;
    stiffnessValue: number;
  };
  interfaceType: ToolHolderInterface;
}

export interface ToolEnvelope {
  radialEnvelope: number;
  axialEnvelope: number;
  holderEnvelope: number;
  cuttingEnvelope: number;
  assemblyEnvelope: number;
}

export interface ToolRunout {
  radialRunout: number;
  axialRunout: number;
  measurementMethod: string;
  measurementCondition: string;
}

export interface ToolWearState {
  wearMetric: string;
  wearValue: number;
  wearLimit: number;
  measurementMethod: string;
  timestamp: string;
}

export interface ToolLifeModel {
  nominalLife: number; // in minutes or parts
  expectedLife: number;
  remainingLife: number;
  lifeMetric: "MINUTES" | "PARTS" | "VOL_REMOVED";
  lifeModel: "TAYLOR" | "EXTENDED_TAYLOR" | "EMPIRICAL";
  confidence: number;
}

export interface ToolCuttingParameters {
  cuttingSpeed: number; // m/min
  spindleSpeed: number; // RPM
  feedRate: number; // mm/min
  feedPerTooth: number; // mm/tooth
  feedPerRevolution: number; // mm/rev
  depthOfCut: number; // mm (ap)
  widthOfCut: number; // mm (ae)
}

export interface ToolMaterialCuttingRule {
  materialId: string;
  condition: string;
  cuttingSpeedRange: { min: number; max: number };
  feedRange: { min: number; max: number };
  docRange: { min: number; max: number };
  wocRange: { min: number; max: number };
  coolantRequirement: CoolantRequirement;
}

export interface ToolDefinition {
  toolId: string;
  toolRevision: number;
  toolType: ManufacturingToolType;
  manufacturer: string;
  manufacturerPartNumber: string;
  catalogNumber: string;
  toolName: string;
  description: string;
  standard: string;
  status: ToolLibraryStatus;
  geometry: ToolGeometry;
  flute?: FluteDefinition;
  material: ToolMaterialType;
  coating: ToolCoatingType;
  cuttingEdges: CuttingEdge[];
  tipType?: ToolTipType;
  drillType?: DrillType;
  insert?: CuttingInsert;
  maximumRPM: number;
  recommendedRPMRange?: { min: number; max: number };
  maximumFeed?: number;
  recommendedFeedRange?: { min: number; max: number };
  coolantCompatibility: CoolantType[];
  operationCompatibility: Record<string, ToolOperationCompatibilityType>;
  materialsCuttingRules: ToolMaterialCuttingRule[];
  solidModel?: ToolSolidModel;
  provenance: {
    source: string;
    sourceType: string;
    document?: string;
    manufacturer: string;
    catalogRevision: number;
    importTimestamp: string;
  };
  fingerprint: string;
}

export interface ToolInstance {
  instanceId: string;
  toolId: string;
  serialNumber: string;
  batchNumber: string;
  location: string;
  status: ToolCondition;
  usageCount: number;
  cuttingTime: number; // in minutes
  lastInspection: string;
  remainingLife: number; // remaining life in minutes
  wearState?: ToolWearState;
  lifeModel?: ToolLifeModel;
}

export interface ToolAssembly {
  assemblyId: string;
  toolId: string; // Ref to ToolDefinition
  toolInstanceId?: string; // Ref to ToolInstance (optional for definition assemblies)
  holder?: ToolHolder;
  extension?: ToolExtension;
  stickoutLength: number; // mm
  runout?: ToolRunout;
  gaugeLength: number; // calculated overall gauge length
  effectiveReach: number;
  maximumReach: number;
  recommendedReach: number;
  envelope: ToolEnvelope;
  fingerprint: string;
}

export interface ToolQualificationEvidence {
  toolRevision: number;
  catalogSource: string;
  testEvidence: string[];
  cuttingData: ToolCuttingParameters;
  machineId: string;
  materialId: string;
  operationType: string;
  conditions: string[];
  limits: { maxRPM: number; maxFeed: number };
  validationTimestamp: string;
  fingerprint: string;
}

export interface ToolQualification {
  qualificationId: string;
  toolId: string;
  materialId: string;
  operationType: string;
  machineId: string;
  verdict: ToolQualificationVerdict;
  scope: {
    allowedConditions: string[];
    allowedSpeedRange: { min: number; max: number };
  };
  evidence: ToolQualificationEvidence;
  timestamp: string;
  fingerprint: string;
}

export interface ToolSelectionExplanation {
  whySelected: string;
  constraintsSatisfied: string[];
  constraintsFailed: string[];
  tradeoffs: string[];
}

export interface ToolSelectionResult {
  toolId: string;
  assemblyId?: string;
  verdict: ToolSelectionVerdict;
  rankingScore: number;
  explanation: ToolSelectionExplanation;
}
