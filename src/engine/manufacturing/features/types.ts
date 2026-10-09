import { BRepEntity } from "../../cad-kernel/brep/BRepContracts";
import { PropertyProvenance } from "../../materials/types";

export enum ManufacturingFeatureType {
  HOLE = "HOLE",
  POCKET = "POCKET",
  SLOT = "SLOT",
  STEP = "STEP",
  FACE = "FACE",
  BOSS = "BOSS",
  PAD = "PAD",
  CHAMFER = "CHAMFER",
  FILLET = "FILLET",
  THREAD = "THREAD",
  COUNTERBORE = "COUNTERBORE",
  COUNTERSINK = "COUNTERSINK",
  DRILLED_HOLE = "DRILLED_HOLE",
  TAPPED_HOLE = "TAPPED_HOLE",
  MILLING_FEATURE = "MILLING_FEATURE",
  TURNING_FEATURE = "TURNING_FEATURE",
  GROOVE = "GROOVE",
  PROFILE = "PROFILE",
  SURFACE = "SURFACE",
  PATTERN = "PATTERN",
  UNKNOWN = "UNKNOWN",
  AMBIGUOUS = "AMBIGUOUS",
  UNRESOLVED = "UNRESOLVED"
}

export enum FeatureValidationStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  AMBIGUOUS = "AMBIGUOUS",
  INCOMPLETE = "INCOMPLETE",
  STALE = "STALE",
  UNRESOLVED = "UNRESOLVED"
}

export enum ManufacturingIntent {
  REMOVE_MATERIAL = "REMOVE_MATERIAL",
  ADD_MATERIAL = "ADD_MATERIAL",
  DRILL = "DRILL",
  MILL = "MILL",
  TURN = "TURN",
  FINISH = "FINISH",
  THREAD = "THREAD",
  DEBURR = "DEBURR",
  INSPECT = "INSPECT"
}

export enum FeatureOrigin {
  NATIVE = "NATIVE",
  IMPORTED = "IMPORTED",
  RECOGNIZED = "RECOGNIZED",
  INFERRED = "INFERRED",
  USER_DEFINED = "USER_DEFINED",
  AI_ASSISTED = "AI_ASSISTED"
}

export enum FeatureVisibility {
  VISIBLE = "VISIBLE",
  PARTIALLY_OBSTRUCTED = "PARTIALLY_OBSTRUCTED",
  OBSTRUCTED = "OBSTRUCTED",
  INTERNAL = "INTERNAL",
  UNKNOWN = "UNKNOWN"
}

export interface FeatureParameter {
  name: string;
  value: number | string | boolean;
  unit?: string;
  confidence: number;
  provenance: PropertyProvenance;
}

export interface ManufacturingFeature {
  featureId: string;
  featureType: ManufacturingFeatureType;
  partId: string;
  partRevision: number;
  geometryReferences: string[]; // IDs of B-Rep entities
  topologyReferences: string[];
  parameters: Record<string, FeatureParameter>;
  intent: ManufacturingIntent;
  origin: FeatureOrigin;
  parentFeature?: string;
  childFeatures: string[];
  dependencies: string[];
  status: FeatureValidationStatus;
  visibility: FeatureVisibility;
  accessibility: string[]; // Directions (+X, -Z, etc.)
  revision: number;
  timestamp: string;
  fingerprint: string;
}

export interface FeatureDependencyGraph {
  nodes: ManufacturingFeature[];
  edges: { sourceId: string; targetId: string; type: "PARENT" | "DEPENDENCY" | "REFERENCE" }[];
}

export interface FeaturePattern {
  patternId: string;
  type: "LINEAR" | "CIRCULAR" | "MIRROR" | "GRID" | "CUSTOM";
  seedFeatureId: string;
  instances: string[]; // Child feature IDs
  parameters: Record<string, number>;
}
