/**
 * SECP PATCH-035: Design Workbench Shared Types
 */

export enum EngineeringDomain {
  SKETCH = 'SKETCH',
  SOLID = 'SOLID',
  SURFACE = 'SURFACE',
  DIRECT_MODELING = 'DIRECT_MODELING',
  ASSEMBLY = 'ASSEMBLY',
  SHEET_METAL = 'SHEET_METAL',
  WELDMENTS = 'WELDMENTS',
  MOLD_TOOLING = 'MOLD_TOOLING',
  MECHANICAL_DESIGN = 'MECHANICAL_DESIGN',
  INDUSTRIAL_DESIGN = 'INDUSTRIAL_DESIGN',
  REVERSE_ENGINEERING = 'REVERSE_ENGINEERING',
  INTEROPERABILITY = 'INTEROPERABILITY',
  AI_DESIGN = 'AI_DESIGN'
}

export enum ImplementationStatus {
  MISSING = 'MISSING',
  SCAFFOLD = 'SCAFFOLD',
  IMPLEMENTED = 'IMPLEMENTED',
  VERIFIED = 'VERIFIED',
  PROVEN = 'PROVEN',
  PRODUCTION_PROVEN = 'PRODUCTION_PROVEN'
}

export enum Priority {
  P0 = 'P0', // Critical CAD blockers
  P1 = 'P1', // Professional productivity
  P2 = 'P2'  // SECP differentiation
}

export enum EscapeType {
  E1_MISSING = 'E1_MISSING',       // Tool does not exist
  E2_BROKEN = 'E2_BROKEN',         // Tool exists but fails operation
  E3_INTEGRATION = 'E3_INTEGRATION', // Fails in Workflow (Sketch->Part->Assy)
  E4_PARAMETRIC = 'E4_PARAMETRIC',   // Fails on Regeneration/Upstream Edit
  NONE = 'NONE'
}

export interface DesignOperation {
  domain: EngineeringDomain;
  command: string;
  parameters: Record<string, any>;
  timestamp: string;
  source: 'UI' | 'AI_AGENT' | 'API';
}
