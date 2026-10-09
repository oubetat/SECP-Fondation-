/**
 * SECP PATCH-035: Design Workbench Capability Matrix
 * 
 * SCOPE: This matrix tracks the maturity of the Design Workbench subsystem.
 * It is NOT a measure of the entire SECP Industrial OS v2 platform, but a 
 * dedicated audit of CAD/Design capabilities to prevent "Design Escape".
 * 
 * ARCHITECTURE CONTEXT:
 *                          SECP INDUSTRIAL OS v2
 *                                   │
 *         ┌─────────────────────────┼─────────────────────────┐
 *         │                         │                         │
 *  Engineering Kernel        Engineering Truth        Production Proof
 *         │                         │                         │
 *  CAD / B-Rep / NURBS       Mathematical Proof       Real-world Evidence
 *  GCS / Topology             Numerical Verification  Physical Validation
 *  Geometry Operations        Evidence Graph          Production Trials
 *         │                         │                         │
 *         └───────────────┬─────────┴─────────┬───────────────┘
 *                         │                   │
 *                  INDUSTRIAL DOMAINS
 *                         │
 *      ┌──────────┬────────┼─────────┬──────────┬───────────┐
 *      │          │        │         │          │           │
 *    Design     Assembly  CFD/FEA    CAM      Reverse     PLM/
 *    Workbench           Physics   Manufacturing Engineering Enterprise
 *      │
 *  PATCH-034 / PATCH-035 (This Matrix)
 * 
 * TARGET: 100% Design Coverage (Zero Design Escape).
 */

import { EngineeringDomain, ImplementationStatus, Priority, EscapeType } from './DesignWorkbenchTypes';

export interface CapabilityEntry {
  id: string;
  name: string;
  domain: EngineeringDomain;
  priority: Priority;
  status: ImplementationStatus;
  
  // Gate Flags (Evidence-Based)
  gateA: boolean; // Command Completeness (E1/E2 Check)
  gateB: boolean; // Workflow Fidelity (E3 Check)
  gateC: boolean; // Production Proof (Real World)
  gateD: boolean; // Design Escape-Proof (E4 & Zero Escape Check)
  
  // Master Design Inventory Audit
  audit: {
    kernelDependency: 'GCS' | 'B-REP' | 'NURBS' | 'TOPOLOGY' | 'PARAMETRIC' | 'NONE';
    uiAvailability: boolean;
    parametricSupport: boolean;
    regenerationSupport: boolean;
    interoperability: boolean;
    productionEvidence: boolean;
    testCoveragePercent: number;
    unresolvedEscapes: EscapeType[];
  };
  
  escapeRisk: 'NONE' | 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
}

export class DesignCapabilityMatrix {
  private static _registry: CapabilityEntry[] | null = null;

  private static get registry(): CapabilityEntry[] {
    if (!this._registry) {
      this._registry = [
        // 1. SKETCHING (P0)
        { 
          id: 'SK-001', name: 'Lines / Arcs / Circles / Construction', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
          gateA: true, gateB: true, gateC: true, gateD: true,
          audit: { kernelDependency: 'GCS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
          escapeRisk: 'NONE'
        },
    { 
      id: 'SK-002', name: 'Rectangles / Polygons / Slots', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'GCS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SK-003', name: 'Splines / Style Splines (G2/G3)', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'NURBS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 95, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SK-004', name: 'Conics / Parabola / Hyperbola', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'GCS', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 10, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'SK-005', name: 'Helix / Spiral / Equation Curves', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 80, unresolvedEscapes: [EscapeType.E3_INTEGRATION] },
      escapeRisk: 'MED'
    },
    { 
      id: 'SK-006', name: '3D Sketching & Reference Curves', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 5, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'CRITICAL'
    },
    { 
      id: 'SK-007', name: 'Projection / Intersection Geometry', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: false, testCoveragePercent: 75, unresolvedEscapes: [EscapeType.E4_PARAMETRIC] },
      escapeRisk: 'MED'
    },
    { 
      id: 'SK-008', name: 'Offset / Mirror / Patterns', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'GCS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SK-009', name: 'Parametric Constraints & Solver Truth', domain: EngineeringDomain.SKETCH, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'GCS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },

    // 2. SOLID MODELING (P0)
    { 
      id: 'SL-001', name: 'Extrude / Revolve / Thin', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SL-002', name: 'Sweep (Multi-profile) / Loft (Guides)', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SL-003', name: 'Boundary Boss / Base', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.IMPLEMENTED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 60, unresolvedEscapes: [EscapeType.E2_BROKEN, EscapeType.E4_PARAMETRIC] },
      escapeRisk: 'MED'
    },
    { 
      id: 'SL-004', name: 'Hole Wizard / Advanced Hole', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 85, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SL-005', name: 'Fillet / Chamfer (Variable Radius)', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 80, unresolvedEscapes: [EscapeType.E2_BROKEN] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SL-006', name: 'Shell / Draft / Rib / Wrap / Dome', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.IMPLEMENTED, 
      gateA: true, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 50, unresolvedEscapes: [EscapeType.E2_BROKEN] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'SL-007', name: 'Boolean / Intersect / Split / Combine', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 95, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SL-008', name: 'Multibody Operations & Feature History', domain: EngineeringDomain.SOLID, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },

    // 3. SURFACE MODELING (P0)
    { 
      id: 'SR-001', name: 'Boundary / Fill / Knit / Trim', domain: EngineeringDomain.SURFACE, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'NURBS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SR-002', name: 'G0-G3 Continuity & Deviation Analysis', domain: EngineeringDomain.SURFACE, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'NURBS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 70, unresolvedEscapes: [EscapeType.E2_BROKEN] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'SR-003', name: 'Offset Surface / Rule Surface', domain: EngineeringDomain.SURFACE, priority: Priority.P0, status: ImplementationStatus.IMPLEMENTED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'NURBS', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 55, unresolvedEscapes: [EscapeType.E2_BROKEN] },
      escapeRisk: 'MED'
    },

    // 4. ASSEMBLY (P0)
    { 
      id: 'AS-001', name: 'Standard Mates (Coincident/Distance)', domain: EngineeringDomain.ASSEMBLY, priority: Priority.P0, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'AS-002', name: 'Mechanical Mates (Gear/Cam/Screw)', domain: EngineeringDomain.ASSEMBLY, priority: Priority.P0, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 75, unresolvedEscapes: [EscapeType.E3_INTEGRATION] },
      escapeRisk: 'MED'
    },
    { 
      id: 'AS-003', name: 'Advanced Mates (Width/Path/Limit)', domain: EngineeringDomain.ASSEMBLY, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 15, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'AS-004', name: 'Interference / Collision / Motion', domain: EngineeringDomain.ASSEMBLY, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'AS-005', name: 'Flexible Subassemblies & In-Context', domain: EngineeringDomain.ASSEMBLY, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 10, unresolvedEscapes: [EscapeType.E1_MISSING, EscapeType.E4_PARAMETRIC] },
      escapeRisk: 'CRITICAL'
    },

    // 5. FABRICATION (P0)
    { 
      id: 'FB-001', name: 'Sheet Metal: Flanges / Bends / Pattern', domain: EngineeringDomain.SHEET_METAL, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'FB-002', name: 'Weldments: Structural Members / Cut List', domain: EngineeringDomain.WELDMENTS, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 85, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'FB-003', name: 'Bend Tables & Corner Treatment', domain: EngineeringDomain.SHEET_METAL, priority: Priority.P0, status: ImplementationStatus.IMPLEMENTED, 
      gateA: true, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: false, productionEvidence: false, testCoveragePercent: 40, unresolvedEscapes: [EscapeType.E2_BROKEN] },
      escapeRisk: 'MED'
    },

    // 6. MOLD & TOOLING (P0)
    { 
      id: 'MT-001', name: 'Draft Analysis & Parting Line/Surface', domain: EngineeringDomain.MOLD_TOOLING, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'NURBS', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 20, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'MT-002', name: 'Core / Cavity Split & Mold Base', domain: EngineeringDomain.MOLD_TOOLING, priority: Priority.P0, status: ImplementationStatus.MISSING, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'B-REP', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 0, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'CRITICAL'
    },

    // 7. DOCUMENTATION (P0)
    { 
      id: 'ED-001', name: 'Orthographic Views / Sections / Details', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P0, status: ImplementationStatus.IMPLEMENTED, 
      gateA: true, gateB: true, gateC: false, gateD: false,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: false, testCoveragePercent: 65, unresolvedEscapes: [EscapeType.E3_INTEGRATION] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'ED-002', name: 'BOM / Balloons / Revision Management', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P0, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'NONE', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 10, unresolvedEscapes: [EscapeType.E1_MISSING, EscapeType.E2_BROKEN] },
      escapeRisk: 'CRITICAL'
    },
    { 
      id: 'ED-003', name: 'GD&T / PMI / Surface Finish Symbols', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P0, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },

    // 8. DATA & CONFIGURATIONS (P1)
    { 
      id: 'DC-001', name: 'Configurations & Design Tables', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P1, status: ImplementationStatus.SCAFFOLD, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 10, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'HIGH'
    },
    { 
      id: 'DC-002', name: 'Design Library & Standard Parts', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P1, status: ImplementationStatus.MISSING, 
      gateA: false, gateB: false, gateC: false, gateD: false,
      audit: { kernelDependency: 'NONE', uiAvailability: false, parametricSupport: false, regenerationSupport: false, interoperability: false, productionEvidence: false, testCoveragePercent: 0, unresolvedEscapes: [EscapeType.E1_MISSING] },
      escapeRisk: 'CRITICAL'
    },

    // 9. INTEROPERABILITY & AI (P2)
    { 
      id: 'IO-001', name: 'STEP AP242 / IGES / DXF Import/Export', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P2, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'TOPOLOGY', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 95, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'IO-002', name: 'Dumb Solid Feature Recognition', domain: EngineeringDomain.INTEROPERABILITY, priority: Priority.P2, status: ImplementationStatus.VERIFIED, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 75, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'AI-001', name: 'Universal Design Command (NL -> Tree)', domain: EngineeringDomain.AI_DESIGN, priority: Priority.P2, status: ImplementationStatus.PRODUCTION_PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'PARAMETRIC', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 100, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    },
    { 
      id: 'AI-002', name: 'Reverse Engineering (Cloud -> B-Rep)', domain: EngineeringDomain.REVERSE_ENGINEERING, priority: Priority.P2, status: ImplementationStatus.PROVEN, 
      gateA: true, gateB: true, gateC: true, gateD: true,
      audit: { kernelDependency: 'B-REP', uiAvailability: true, parametricSupport: true, regenerationSupport: true, interoperability: true, productionEvidence: true, testCoveragePercent: 90, unresolvedEscapes: [] },
      escapeRisk: 'NONE'
    }
      ];
    }
    return this._registry;
  }

  public static getMatrix(): CapabilityEntry[] {
    return this.registry;
  }

  public static getSummary() {
    const total = this.registry.length;
    const gateA = this.registry.filter(r => r.gateA).length;
    const gateB = this.registry.filter(r => r.gateB).length;
    const gateC = this.registry.filter(r => r.gateC).length;
    const gateD = this.registry.filter(r => r.gateD).length;

    const p0Total = this.registry.filter(r => r.priority === Priority.P0).length;
    const p0Closed = this.registry.filter(r => r.priority === Priority.P0 && r.gateD).length;

    const totalUnresolvedEscapes = this.registry.reduce((acc, r) => acc + (r.audit.unresolvedEscapes?.length || 0), 0);
    const zeroEscapeCount = this.registry.filter(r => (r.audit.unresolvedEscapes?.length || 0) === 0).length;

    // Strict Closure Calculation
    const e1Count = this.registry.filter(r => r.audit.unresolvedEscapes?.includes(EscapeType.E1_MISSING)).length;
    const e2Count = this.registry.filter(r => r.audit.unresolvedEscapes?.includes(EscapeType.E2_BROKEN)).length;
    const e3Count = this.registry.filter(r => r.audit.unresolvedEscapes?.includes(EscapeType.E3_INTEGRATION)).length;
    const e4Count = this.registry.filter(r => r.audit.unresolvedEscapes?.includes(EscapeType.E4_PARAMETRIC)).length;
    
    const p0Open = this.registry.filter(r => r.priority === Priority.P0 && !r.gateD).length;
    
    const isClosed = p0Open === 0 && e1Count === 0 && e2Count === 0 && e3Count === 0 && e4Count === 0;

    return {
      total,
      gateA,
      gateB,
      gateC,
      gateD,
      p0Total,
      p0Closed,
      p0Open,
      totalUnresolvedEscapes,
      zeroEscapeCount,
      e1Count,
      e2Count,
      e3Count,
      e4Count,
      isClosed,
      status: isClosed ? 'CLOSED' : 'OPEN',
      percentGateA: Math.round((gateA / total) * 100),
      percentGateB: Math.round((gateB / total) * 100),
      percentGateC: Math.round((gateC / total) * 100),
      percentGateD: Math.round((gateD / total) * 100),
      percentP0Closed: Math.round((p0Closed / p0Total) * 100)
    };
  }

  /**
   * PATCH-035: Evidence-Based Escape Computation
   * This method simulates the transition from static registry to computed truth.
   * In a real environment, this would parse test results and evidence logs.
   */
  public static computeEscapesFromEvidence(): void {
    this.registry.forEach(entry => {
      const escapes: EscapeType[] = [];
      
      // E1: Missing Capability (Based on Gate A)
      if (!entry.gateA || entry.status === ImplementationStatus.MISSING) {
        escapes.push(EscapeType.E1_MISSING);
      }
      
      // E2: Broken Capability (Based on Test Coverage and Status)
      if (entry.audit.testCoveragePercent < 50 || entry.status === ImplementationStatus.SCAFFOLD) {
        if (!escapes.includes(EscapeType.E1_MISSING)) {
          escapes.push(EscapeType.E2_BROKEN);
        }
      }
      
      // E3: Integration Escape (Based on Gate B and Interoperability)
      if (!entry.gateB || (!entry.audit.interoperability && entry.priority === Priority.P0)) {
        escapes.push(EscapeType.E3_INTEGRATION);
      }
      
      // E4: Parametric Escape (Based on Regeneration and Parametric Support)
      if (!entry.audit.regenerationSupport || !entry.audit.parametricSupport || !entry.gateD) {
        if (entry.status !== ImplementationStatus.MISSING) {
           escapes.push(EscapeType.E4_PARAMETRIC);
        }
      }

      // Deduplicate and update entry
      entry.audit.unresolvedEscapes = [...new Set(escapes)];
      
      // Update Gate D based on absence of escapes
      entry.gateD = entry.audit.unresolvedEscapes.length === 0;
      
      // Update Risk
      if (entry.audit.unresolvedEscapes.length > 2) entry.escapeRisk = 'CRITICAL';
      else if (entry.audit.unresolvedEscapes.length > 1) entry.escapeRisk = 'HIGH';
      else if (entry.audit.unresolvedEscapes.length === 1) entry.escapeRisk = 'MED';
      else entry.escapeRisk = 'NONE';
    });
  }
}
