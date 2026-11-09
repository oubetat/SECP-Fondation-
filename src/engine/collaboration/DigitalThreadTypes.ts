export type DigitalThreadNodeType =
  | 'REQUIREMENT'
  | 'PART'
  | 'ASSEMBLY'
  | 'SIMULATION'
  | 'BOM'
  | 'PROCESS'
  | 'DIGITAL_TWIN'
  | 'ECO'
  | 'FEATURE'
  | 'SIMULATION_RESULT'
  | 'VALIDATION_RECORD'
  | 'QUALITY_RECORD'
  | 'SKETCH'
  | 'BODY'
  | 'DRAWING'
  | 'APPROVAL'
  | 'REVISION'
  | 'SUPPLIER_PACKAGE'
  | 'PRODUCTION_RUN'
  | 'EVIDENCE'
  | 'GATE_RESULT'
  | 'SIMULATION_RUN'
  | 'CAM_OPERATION'
  | 'CAM_FEATURE'
  | 'MATERIAL'
  | 'TOOLPATH'
  | 'GCODE'
  | 'POST_PROCESSOR'
  | 'MACHINE'
  | 'SUPPLIER_QUOTE'
  | 'SUPPLIER_DFM'
  | 'SUPPLIER_CHANGE_REQUEST'
  | 'MESH'
  | 'BOUNDARY_CONDITION'
  | 'SIMULATION_CONFIG'
  | 'SAFETY_FACTOR'
  | 'VERIFICATION_RECORD'
  | '*';

export type DigitalThreadRelationshipType =
  | 'SATISFIES'
  | 'DERIVED_FROM'
  | 'VALIDATES'
  | 'PRODUCES'
  | 'MONITORS'
  | 'AFFECTS'
  | 'CONSTRAINS'
  | 'CHILD_OF'
  | 'PARENT_OF'
  | 'VERSION_OF'
  | 'APPROVED_BY'
  | 'EVIDENCED_BY'
  | 'BASED_ON'
  | 'DEPENDS_ON'
  | 'GENERATED_FROM'
  | 'MANUFACTURES'
  | 'CONTAINS'
  | 'SUPPLIED_BY'
  | 'TRIGGERS'
  | 'MODIFIES'
  | 'VERIFIES'
  | 'INSTANCE_OF'
  | 'SUPERSEDES'
  | 'ANALYZES';

export type ThreadProjectionView = 'ENGINEERING' | 'MANUFACTURING' | 'SUPPLIER' | 'EXECUTIVE';

export interface DigitalThreadNode {
  id: string;
  name: string;
  type: DigitalThreadNodeType;
  revision: string;
  status: string;
  owner: string;
  timestamp: string;
  stale?: boolean;
  tenantId?: string;
  [key: string]: any;
}

export interface DigitalThreadEdge {
  id: string;
  source: string;
  target: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  tenantId?: string;
  relationship: DigitalThreadRelationshipType;
  [key: string]: any;
}

export interface ThreadConsistencyIssue {
  issueId: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  affectedNodeIds: string[];
}

export interface ThreadConsistencyReport {
  isValid: boolean;
  valid?: boolean;
  integrityScore?: number;
  brokenEdges?: any[];
  issues: ThreadConsistencyIssue[];
  checkedAt: string;
  evaluatedNodeCount: number;
  evaluatedEdgeCount: number;
}




