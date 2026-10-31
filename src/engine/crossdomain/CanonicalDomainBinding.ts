/**
 * SECP Engineering OS — Canonical Domain Binding Contracts
 * 
 * Defines the strict interface contracts between the SECP Canonical Core 
 * and specific engineering domain solvers.
 */

export type EngineeringDomain = 
  | 'PCB' 
  | 'ELECTRICAL' 
  | 'WIRING_HARNESS' 
  | 'FEM' 
  | 'CFD' 
  | 'MULTIDOMAIN';

export interface SimulationAuthorityInternal {
  isAuthoritative: boolean;
  executionSealToken: string;
  timestamp: string;
  originatingCoreRevision: string | number;
}

export interface CanonicalDomainBinding<T = any> {
  domain: EngineeringDomain;
  designId: string;
  revisionId: string | number;
  payload: T;
  
  // Provenance & Integrity
  geometryHash: string;
  topologyHash: string;
  materialHash: string;
  environmentHash: string;
  physicsHash: string;
  
  // Authority Gate
  executionAuthority: SimulationAuthorityInternal;
  
  // Status Tracking
  status: 'CURRENT' | 'STALE' | 'INVALID';
  invalidationReason?: string;
}

export interface PcbToCoreBinding extends CanonicalDomainBinding {
  domain: 'PCB';
  payload: any; // PCB Design Model
}

export interface ElectricalToCoreBinding extends CanonicalDomainBinding {
  domain: 'ELECTRICAL';
  payload: any; // Circuit Model
}

export interface HarnessToCoreBinding extends CanonicalDomainBinding {
  domain: 'WIRING_HARNESS';
  payload: any; // Harness Model
}

export interface FemToCoreBinding extends CanonicalDomainBinding {
  domain: 'FEM';
  payload: any; // FEM Model (mesh, BCs, materials)
}

export interface CfdToCoreBinding extends CanonicalDomainBinding {
  domain: 'CFD';
  payload: {
    mesh: any;
    fluid: any;
  };
}
