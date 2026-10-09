/**
 * SECP Industrial OS v2 — Unified Physics Model
 * PATCH-042: Physics Foundation
 */

import { 
  PhysicsDomain, 
  PhysicsModelStatus, 
  GeometryReference, 
  MeshReference, 
  PhysicsRegion, 
  PhysicsField, 
  MaterialReference, 
  BoundaryCondition, 
  InitialCondition, 
  PhysicsInterface, 
  PhysicsDependency, 
  PhysicsModelMetadata 
} from './PhysicsTypes';

export interface PhysicsModel {
  id: string;
  version: string;
  name: string;
  domain: PhysicsDomain;
  geometryRef?: GeometryReference;
  meshRef?: MeshReference;
  regions: PhysicsRegion[];
  fields: PhysicsField[];
  materials: MaterialReference[];
  boundaryConditions: BoundaryCondition[];
  initialConditions: InitialCondition[];
  interfaces: PhysicsInterface[];
  dependencies: PhysicsDependency[];
  metadata: PhysicsModelMetadata;
  provenance: any; // Integrates with existing ProvenanceEngine
  status: PhysicsModelStatus;
}

export class PhysicsModelFactory {
  public static createEmptyModel(id: string, domain: PhysicsDomain): PhysicsModel {
    const timestamp = new Date().toISOString();
    return {
      id,
      version: '1.0.0',
      name: `PhysicsModel_${id}`,
      domain,
      regions: [],
      fields: [],
      materials: [],
      boundaryConditions: [],
      initialConditions: [],
      interfaces: [],
      dependencies: [],
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp
      },
      provenance: {},
      status: 'DRAFT'
    };
  }
}
