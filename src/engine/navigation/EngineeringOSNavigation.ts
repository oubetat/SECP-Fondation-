/**
 * SECP Industrial OS v3 — Engineering OS Navigation Registry
 */

export type EngineeringWorkbenchId =
  | 'GOVERNANCE'
  | 'DESIGN'
  | 'SIMULATION'
  | 'MANUFACTURING'
  | 'DOCUMENTATION';

export interface ToolRegistryEntry {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
}

export interface EngineeringWorkbench {
  id: EngineeringWorkbenchId;
  label: string;
  tools: ToolRegistryEntry[];
}

export const ENGINEERING_WORKBENCHES: EngineeringWorkbench[] = [
  {
    id: 'GOVERNANCE',
    label: 'Engineering OS Governance',
    tools: [
      {
        id: 'AUDIT_LEDGER',
        name: 'Immutable Cryptographic Audit Ledger',
        shortLabel: 'Audit Ledger',
        description: 'Verifies blockchain-grade consensus event ledger state'
      },
      {
        id: 'COMPLIANCE_CENTER',
        name: 'Industrial Compliance Certification Center',
        shortLabel: 'Compliance Center',
        description: 'Executes regulatory compliance verification checks'
      }
    ]
  },
  {
    id: 'DESIGN',
    label: 'Parametric CAD Design',
    tools: [
      {
        id: 'SKETCH_EDITOR',
        name: '2D Constraint Sketch Editor',
        shortLabel: 'Sketch Editor',
        description: 'Creates dimensionally constrained parametric profiles'
      },
      {
        id: 'SOLID_MODELER',
        name: 'B-Rep Solid Modeling Engine',
        shortLabel: 'Solid Modeler',
        description: 'Generates extrusion, revolve, and sweep solids'
      }
    ]
  },
  {
    id: 'SIMULATION',
    label: 'Multi-Physics Simulation',
    tools: [
      {
        id: 'STRUCTURAL_FEM',
        name: 'Nonlinear Finite Element Structural Solver',
        shortLabel: 'Structural FEM',
        description: 'Evaluates stress, strain, deformation, and factor of safety'
      },
      {
        id: 'FLUID_DYNAMICS_CFD',
        name: 'Navier-Stokes Finite Volume CFD Solver',
        shortLabel: 'Fluid Dynamics CFD',
        description: 'Simulates compressible/incompressible transient flow'
      }
    ]
  },
  {
    id: 'MANUFACTURING',
    label: '5-Axis CAM & Robotics',
    tools: [
      {
        id: 'CAM_STUDIO',
        name: '5-Axis CNC Toolpath CAM Studio',
        shortLabel: 'CAM Studio',
        description: 'Computes continuous multiaxis toolpaths and machining operations'
      },
      {
        id: 'COLLISION_INTERLOCK',
        name: 'Real-Time Kinematic Collision Interlock Guard',
        shortLabel: 'Collision Interlock',
        description: 'Monitors multi-body machine collisions and safety warnings'
      }
    ]
  },
  {
    id: 'DOCUMENTATION',
    label: 'Technical Documentation',
    tools: [
      {
        id: 'TECHNICAL_DRAWINGS',
        name: '2D Technical Orthographic Drawings',
        shortLabel: 'Technical Drawings',
        description: 'Generates dimensioned blueprints and orthographic layouts'
      },
      {
        id: 'BOM_GRAPH',
        name: 'BOM Hierarchical Dependency Graph',
        shortLabel: 'BOM Graph',
        description: 'Audits assembly components and bill of materials lineage'
      }
    ]
  }
];

export function resolveWorkbenchAndToolForPatch(patchId: string): {
  workbenchId: EngineeringWorkbenchId;
  toolId: string;
} {
  switch (patchId) {
    case 'PATCH-034':
      return { workbenchId: 'DESIGN', toolId: 'SKETCH_EDITOR' };
    case 'PATCH-015':
      return { workbenchId: 'SIMULATION', toolId: 'STRUCTURAL_FEM' };
    case 'PATCH-020':
      return { workbenchId: 'MANUFACTURING', toolId: 'CAM_STUDIO' };
    case 'PATCH-021':
      return { workbenchId: 'DOCUMENTATION', toolId: 'TECHNICAL_DRAWINGS' };
    case 'PATCH-295':
      return { workbenchId: 'GOVERNANCE', toolId: 'DIGITAL_THREAD' };
    default:
      return { workbenchId: 'DESIGN', toolId: 'SOLID_MODELER' };
  }
}
