export enum BOMItemType {
  ASSEMBLY = "ASSEMBLY",
  PART = "PART",
  SUBASSEMBLY = "SUBASSEMBLY",
  COMPONENT = "COMPONENT",
  MATERIAL = "MATERIAL",
  FASTENER = "FASTENER",
  STANDARD_PART = "STANDARD_PART",
  PURCHASED_PART = "PURCHASED_PART",
  MANUFACTURED_PART = "MANUFACTURED_PART",
  VIRTUAL_ITEM = "VIRTUAL_ITEM",
  REFERENCE_ITEM = "REFERENCE_ITEM",
  PHANTOM_ITEM = "PHANTOM_ITEM",
  DOCUMENT = "DOCUMENT"
}

export enum QuantityBasis {
  OCCURRENCE_COUNT = "OCCURRENCE_COUNT",
  MEASURED_QUANTITY = "MEASURED_QUANTITY",
  CALCULATED_QUANTITY = "CALCULATED_QUANTITY",
  DECLARED_QUANTITY = "DECLARED_QUANTITY",
  FORMULA = "FORMULA"
}

export enum UnitOfMeasure {
  EA = "EA",
  KG = "KG",
  G = "G",
  MM = "MM",
  CM = "CM",
  M = "M",
  L = "L",
  ML = "ML",
  M2 = "M2",
  M3 = "M3"
}

export enum BOMEdgeType {
  REQUIRES = "REQUIRES",
  CONTAINS = "CONTAINS",
  CONSUMES = "CONSUMES",
  ASSEMBLES = "ASSEMBLES",
  INSTALLS = "INSTALLS",
  REFERENCES = "REFERENCES",
  ALTERNATE = "ALTERNATE",
  SUBSTITUTE = "SUBSTITUTE",
  OPTIONAL = "OPTIONAL",
  CONDITIONAL = "CONDITIONAL",
  PHANTOM_EXPANSION = "PHANTOM_EXPANSION"
}

export enum EffectivityType {
  DATE = "DATE",
  SERIAL = "SERIAL",
  LOT = "LOT",
  CONFIGURATION = "CONFIGURATION",
  REVISION = "REVISION",
  PROJECT = "PROJECT",
  CONTRACT = "CONTRACT"
}

export enum SourcingType {
  MAKE = "MAKE",
  BUY = "BUY",
  MIXED = "MIXED",
  REFERENCE = "REFERENCE",
  UNKNOWN = "UNKNOWN"
}

export enum BOMLifecycleState {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  RELEASED = "RELEASED",
  OBSOLETE = "OBSOLETE"
}

export interface BOMEffectivity {
  type: EffectivityType;
  start?: string;
  end?: string;
  condition?: string;
  configurationId?: string;
}

export interface BOMNode {
  bomNodeId: string;
  itemType: BOMItemType;
  partId: string;
  partRevision: string;
  assemblyId: string;
  assemblyRevision: string;
  occurrenceIds: string[];
  parentBomNodeId: string | null;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  quantityBasis: QuantityBasis;
  configurationState: string;
  effectivity: BOMEffectivity[];
  lifecycleState: BOMLifecycleState;
  sourcingType: SourcingType;
  sourceReference: {
    sourceType: string;
    sourceId: string;
    sourceRevision: string;
    sourceAssemblyRevision: string;
  };
  level?: number;
}

export interface BOMEdge {
  edgeId: string;
  parentNodeId: string;
  childNodeId: string;
  edgeType: BOMEdgeType;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  sequence: number;
  effectivity: BOMEffectivity[];
}

export interface SubstituteRecord {
  substitutionId: string;
  primaryItemId: string;
  substituteItemId: string;
  reason: string;
  approvedBy: string;
  approvalState: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface BOMGraphData {
  bomId: string;
  bomRevision: string;
  configurationId: string;
  nodes: BOMNode[];
  edges: BOMEdge[];
  substitutes: SubstituteRecord[];
}

export interface BOMForensicSnapshot {
  bomId: string;
  bomRevision: string;
  assemblyRevision: string;
  configurationId: string;
  graphHash: string;
  bomHash: string;
  dependencyHash: string;
  nodeCount: number;
  edgeCount: number;
  timestamp: string;
  validatorVersion: string;
  canonicalizerVersion: string;
}

export interface BOMChangeSet {
  changes: BOMChange[];
}

export type BOMChange = 
  | { type: 'ADDED'; node: BOMNode }
  | { type: 'REMOVED'; node: BOMNode }
  | { type: 'CHANGED_QUANTITY'; nodeId: string; oldQuantity: number; newQuantity: number; unit: UnitOfMeasure }
  | { type: 'CHANGED_REVISION'; nodeId: string; oldRevision: string; newRevision: string }
  | { type: 'CHANGED_UOM'; nodeId: string; oldUOM: UnitOfMeasure; newUOM: UnitOfMeasure };

export interface BOMAuditRecord {
  bomChangeId: string;
  actorId: string;
  timestamp: string;
  operation: string;
  beforeHash: string;
  afterHash: string;
  changeSet: BOMChangeSet;
}
