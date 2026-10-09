import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export type EngineeringObjectStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'VALIDATED'
  | 'RELEASED'
  | 'SUPERSEDED'
  | 'ARCHIVED'
  | 'INVALIDATED';

export interface EngineeringObject {
  readonly id: string;               // Local ID / Database ID
  readonly identity: EngineeringIdentity;
  readonly status: EngineeringObjectStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly dependencies: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly provenance: Readonly<{
    author: string;
    action: string;
    timestamp: string;
    hash: string;
    parentRevisionId?: string;
  }>;
  readonly evidenceRefs: readonly string[];
  readonly dependencyVersionSnapshot: Readonly<Record<string, string>>;
}

export interface EngineeringAuditEvent {
  readonly id: string;
  readonly eventType: string;
  readonly objectId: string;
  readonly timestamp: string;
  readonly author: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature: string;
}
