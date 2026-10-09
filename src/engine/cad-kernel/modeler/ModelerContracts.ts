/**
 * SECP CAD Kernel — Modeler Operations
 */
import { Solid } from '../topology/TopologyContracts';
import { CapabilityStatus } from '../registry/CapabilityRegistry';

export interface KernelDiagnostic {
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  entityId?: string;
}

export interface KernelOperationResult<T> {
  success: boolean;
  value?: T;
  operationId: string;
  kernelVersion: string;
  backend?: string;
  capabilityStatus: CapabilityStatus;
  diagnostics: KernelDiagnostic[];
  provenance?: {
    identityId: string;
  };
}

export interface BooleanOperationArgs {
  target: Solid;
  tool: Solid;
}

export interface IModelerCore {
  booleanUnion(args: BooleanOperationArgs): KernelOperationResult<Solid>;
  booleanCut(args: BooleanOperationArgs): KernelOperationResult<Solid>;
  booleanIntersect(args: BooleanOperationArgs): KernelOperationResult<Solid>;
}
