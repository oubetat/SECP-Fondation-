/**
 * SECP Engineering Types Package
 * Standard interfaces for 3D Geometry, FEA Structural Nodes, CAD Mesh, and Provenance Audit Logs.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Point3D;
  max: Point3D;
}

export interface MaterialProperties {
  id: string;
  name: string;
  elasticModulusGPa: number; // Young's Modulus E (GPa)
  poissonsRatio: number;      // Poisson's Ratio ν
  densityKgM3: number;        // Mass Density ρ (kg/m³)
  yieldStrengthMPa: number;   // Yield Strength σy (MPa)
}

export interface StructuralNode {
  id: string;
  position: Point3D;
  restraints: {
    fx: boolean;
    fy: boolean;
    fz: boolean;
    mx: boolean;
    my: boolean;
    mz: boolean;
  };
}

export interface BeamElement {
  id: string;
  startNodeId: string;
  endNodeId: string;
  materialId: string;
  sectionProfile: 'I-BEAM' | 'RECTANGULAR_TUBE' | 'CIRCULAR_HOLLOW' | 'C-CHANNEL';
  crossAreaCm2: number;
}

export interface ProvenanceRecord {
  id: string;
  timestamp: string;
  action: string;
  author: string;
  hash: string;
  status: 'VERIFIED' | 'PENDING' | 'REVOKED';
  metadata: Record<string, unknown>;
}

export interface SecpProject {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  elementCount: number;
  cadStatus: 'READY' | 'SYNCHRONIZING' | 'COMPILING_WASM';
}
