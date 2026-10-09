import { ResolvedConfiguration } from '../configuration/types';
import { ResolvedVariant } from '../variants/types';

export type LifecycleEntityType = 
  | 'PRODUCT' 
  | 'PART' 
  | 'ASSEMBLY' 
  | 'COMPONENT' 
  | 'BOM' 
  | 'REVISION' 
  | 'VARIANT' 
  | 'CONFIGURATION' 
  | 'MATERIAL' 
  | 'PROCESS' 
  | 'TOOLPATH' 
  | 'SIMULATION' 
  | 'VALIDATION' 
  | 'ECO' 
  | 'MANUFACTURING_ORDER' 
  | 'SERVICE_RECORD';

export type LifecycleState = 
  | 'CONCEPT' 
  | 'DESIGN' 
  | 'ENGINEERING' 
  | 'VERIFICATION' 
  | 'VALIDATION' 
  | 'RELEASED' 
  | 'MANUFACTURING' 
  | 'IN_SERVICE' 
  | 'MAINTENANCE' 
  | 'SUSPENDED' 
  | 'SUPERSEDED' 
  | 'RETIRED' 
  | 'ARCHIVED';

export type LifecycleEventType = 
  | 'CREATED' 
  | 'MODIFIED' 
  | 'REVISED' 
  | 'VARIANT_CREATED' 
  | 'CONFIGURATION_CREATED' 
  | 'ECO_CREATED' 
  | 'ECO_APPROVED' 
  | 'ECO_IMPLEMENTED' 
  | 'VERIFIED' 
  | 'VALIDATED' 
  | 'RELEASED' 
  | 'MANUFACTURED' 
  | 'INSPECTED' 
  | 'INSTALLED' 
  | 'SERVICED' 
  | 'SUSPENDED' 
  | 'SUPERSEDED' 
  | 'RETIRED' 
  | 'ARCHIVED'
  | 'CORRECTION_EVENT';

export type CausalLinkType = 
  | 'CAUSED' 
  | 'TRIGGERED' 
  | 'DERIVED_FROM' 
  | 'SUPERSEDES' 
  | 'INVALIDATED' 
  | 'AFFECTED' 
  | 'RESOLVED_BY' 
  | 'VERIFIED_BY' 
  | 'VALIDATED_BY' 
  | 'MANUFACTURED_AS' 
  | 'SERVICED_AS';

export type LifecycleVerdict = 
  | 'VALID' 
  | 'INVALID' 
  | 'INCOMPLETE' 
  | 'CORRUPTED' 
  | 'NON_RECONSTRUCTABLE' 
  | 'CAUSALITY_CONFLICT' 
  | 'TEMPORAL_CONFLICT';

export interface LifecycleEntity {
  entityId: string;
  entityType: LifecycleEntityType;
  entityVersion: string;
  productId: string;
  createdAt: string;
  createdBy: string;
  currentState: LifecycleState;
  lifecycleHash: string;
}

export interface LifecycleTransition {
  transitionId: string;
  entityId: string;
  fromState: LifecycleState;
  toState: LifecycleState;
  trigger: string;
  actor: string;
  timestamp: string;
  reason: string;
  evidenceId: string;
  previousHash: string;
  transitionHash: string;
}

export interface LifecycleEvent {
  eventId: string;
  entityId: string;
  entityType: LifecycleEntityType;
  eventType: LifecycleEventType;
  timestamp: string;
  actor: string;
  source: string;
  payloadHash: string;
  sequence: number;
  previousEventHash: string;
  eventHash: string;
  payload: any;
}

export interface CausalLink {
  linkId: string;
  sourceEntity: { id: string; type: LifecycleEntityType; version: string };
  targetEntity: { id: string; type: LifecycleEntityType; version: string };
  relationshipType: CausalLinkType;
  reason: string;
  evidenceId: string;
  actor: string;
  timestamp: string;
  linkHash: string;
}

export interface ManufacturedInstance {
  instanceId: string;
  productId: string;
  variantId: string;
  configurationId: string;
  configurationHash: string;
  manufacturingOrderId: string;
  serialNumber: string;
  manufacturingDate: string;
  plant: string;
  asBuiltConfiguration?: any;
}

export interface LifecycleSnapshot {
  entityId: string;
  timestamp: string;
  state: LifecycleState;
  revisionState?: any;
  variantState?: any;
  configurationState?: any;
  bomState?: any;
  assemblyState?: any;
  snapshotHash: string;
}

export interface LifecycleEvidence {
  entityId: string;
  eventChain: LifecycleEvent[];
  transitions: LifecycleTransition[];
  causalLinks: CausalLink[];
  hashes: {
    lastEventHash: string;
    lastTransitionHash: string;
    integrityVerdict: string;
  };
}
