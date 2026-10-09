export enum ManufacturingFeatureType {
  HOLE = 'HOLE',
  SIMPLE_HOLE = 'SIMPLE_HOLE',
  COUNTERBORE_HOLE = 'COUNTERBORE_HOLE',
  COUNTERSINK_HOLE = 'COUNTERSINK_HOLE',
  THROUGH_HOLE = 'THROUGH_HOLE',
  BLIND_HOLE = 'BLIND_HOLE',
  POCKET = 'POCKET',
  OPEN_POCKET = 'OPEN_POCKET',
  CLOSED_POCKET = 'CLOSED_POCKET',
  SLOT = 'SLOT',
  THROUGH_SLOT = 'THROUGH_SLOT',
  BLIND_SLOT = 'BLIND_SLOT',
  STEP = 'STEP',
  INTERNAL_STEP = 'INTERNAL_STEP',
  EXTERNAL_STEP = 'EXTERNAL_STEP',
  CHAMFER = 'CHAMFER',
  FILLET = 'FILLET',
  FACE = 'FACE',
  BOSS = 'BOSS',
  CYLINDRICAL_BOSS = 'CYLINDRICAL_BOSS',
  PRISMATIC_BOSS = 'PRISMATIC_BOSS',
  COMPOUND = 'COMPOUND'
}

export type MachiningFeatureType = 
  | 'HOLE' 
  | 'POCKET' 
  | 'SLOT' 
  | 'STEP' 
  | 'CHAMFER' 
  | 'FILLET' 
  | 'FACE' 
  | 'BOSS';

export enum ManufacturingIntent {
  ROUGHING = 'ROUGHING',
  FINISHING = 'FINISHING',
  SEMI_FINISHING = 'SEMI_FINISHING',
  DRILLING = 'DRILLING',
  BORING = 'BORING',
  TAPPING = 'TAPPING',
  REAMING = 'REAMING',
  CHAMFERING = 'CHAMFERING',
  POCKET_MILLING = 'POCKET_MILLING',
  FACE_MILLING = 'FACE_MILLING',
  SLOT_MILLING = 'SLOT_MILLING'
}

export enum RecognitionState {
  PROVEN = 'PROVEN',
  AMBIGUOUS = 'AMBIGUOUS',
  RECOGNIZED = 'RECOGNIZED',
  UNRECOGNIZED = 'UNRECOGNIZED',
  PARTIAL = 'PARTIAL',
  INVALID = 'INVALID'
}

export enum ToolAccessDirection {
  POS_Z = 'POS_Z',
  NEG_Z = 'NEG_Z',
  POS_X = 'POS_X',
  NEG_X = 'NEG_X',
  POS_Y = 'POS_Y',
  NEG_Y = 'NEG_Y',
  MULTI_AXIS = 'MULTI_AXIS'
}

export interface ManufacturingFeature {
  id: string;
  type: ManufacturingFeatureType;
  name?: string;
  parameters: Record<string, any>;
  faceIds: string[];
  edgeIds?: string[];
  vertexIds?: string[];
  intents?: ManufacturingIntent[];
  state?: RecognitionState;
  accessDirection?: ToolAccessDirection;
  accessibility?: any;
  confidence: ManufacturingFeatureConfidence;
  isManuallyOverridden?: boolean;
  manualOverrideReason?: string;
}

export interface HoleFeatureParams {
  diameterMm: number;
  depthMm: number;
  axis: { x: number; y: number; z: number };
  centerTop: { x: number; y: number; z: number };
  centerBottom: { x: number; y: number; z: number };
  isThrough: boolean;
  isBlind: boolean;
  counterboreDiameterMm?: number;
  counterboreDepthMm?: number;
  countersinkAngleDeg?: number;
  countersinkDiameterMm?: number;
  bottomCondition: string;
}

export interface PocketFeatureParams {
  widthMm: number;
  lengthMm: number;
  depthMm: number;
  areaMm2: number;
  perimeterMm: number;
  cornerRadii: number[];
  isClosed: boolean;
  floorFaceId: string;
  wallFaceIds: string[];
}

export interface ManufacturingFeatureEvidence {
  evidenceId: string;
  timestamp: string;
  cadModelHash: string;
  bRepHash: string;
  bodyCount: number;
  totalFeaturesRecognized: number;
  provenFeaturesCount: number;
  ambiguousFeaturesCount: number;
  features: any[];
  algorithmVersion: string;
  deterministicFingerprint: string;
  validationStatus: string;
  diagnostics: string[];
}

export interface ManufacturingFeatureConfidence {
  score: number;
  state: RecognitionState;
  detectionEvidence: string[];
  supportingTopology?: any;
}

export interface HolePatternCandidate {
  id: string;
  holeIds: string[];
  patternType: 'LINEAR' | 'CIRCULAR' | 'GRID';
  parameters: any;
}


export interface MachiningFeature {
  id: string;
  type: MachiningFeatureType | ManufacturingFeatureType;
  parameters: Record<string, number>;
  faces: string[];
}

export interface MachiningSetup {
  id: string;
  name: string;
  direction: ToolAccessDirection;
  features: ManufacturingFeature[];
}
