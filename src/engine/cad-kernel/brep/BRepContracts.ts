/**
 * SECP CAD Kernel — B-Rep Relationships
 */
import { Solid, Shell, Face, Wire, Loop, Edge, Vertex, TopoShape } from '../topology/TopologyContracts';

export interface BRepEntity {
  topology: TopoShape;
  metadata?: Record<string, any>;
}

export interface BRepSolid extends BRepEntity {
  topology: Solid;
}

export interface BRepDiagnostic {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  entityType: string;
  entityId: string;
  relatedEntities?: string[];
  message: string;
}

export interface BRepValidationResult {
  status: 'VALID' | 'INVALID' | 'UNPROVEN' | 'INCONCLUSIVE';
  topologyValid: boolean;
  geometryReferencesValid: boolean;
  incidenceValid: boolean;
  orientationValid: boolean;
  manifoldStatus: 'MANIFOLD' | 'NON_MANIFOLD' | 'OPEN' | 'UNPROVEN';
  diagnostics: BRepDiagnostic[];
}
