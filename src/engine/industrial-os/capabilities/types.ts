export type CapabilityStatus =
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'UNAVAILABLE';

export type CapabilityExecutionMode =
  | 'LOCAL'
  | 'WORKER'
  | 'NATIVE'
  | 'GPU'
  | 'WASM'
  | 'REMOTE'
  | 'HYBRID'
  | 'SIMULATED';

export interface EngineeringCapability {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly domain: string;
  readonly description: string;
  readonly status: CapabilityStatus;
  readonly executionMode: CapabilityExecutionMode;
  readonly providerIds: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly supportedObjectTypes: readonly string[];
  readonly requiredPolicies: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly enabled: boolean;
  readonly deterministic: boolean;
  readonly reproducible: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CapabilityProvider {
  readonly id: string;
  readonly name: string;
  readonly type: 'GPU' | 'CPU' | 'REMOTE' | 'SIMULATION';
  canProvide(capabilityId: string): boolean;
  execute<TInput, TResult>(
    capabilityId: string,
    input: TInput
  ): Promise<TResult>;
  verify(capabilityId: string): Promise<boolean>;
}

export interface ResolvedCapability {
  readonly capabilityId: string;
  readonly status: CapabilityStatus;
  readonly executable: boolean;
  readonly providerId: string | null;
  readonly executionMode: CapabilityExecutionMode;
  readonly missingRequirements: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly qualificationPath: readonly string[];
}

export interface CapabilityExecutionRequest<T> {
  readonly capabilityId: string;
  readonly objectId: string;
  readonly input: T;
  readonly requestedBy?: string;
  readonly correlationId: string;
  readonly revisionId?: string;
}

export interface CapabilityExecutionResult<T> {
  readonly capabilityId: string;
  readonly objectId: string;
  readonly status: 'COMPLETED' | 'FAILED' | 'REJECTED' | 'UNPROVEN';
  readonly result?: T;
  readonly providerId?: string;
  readonly evidenceIds: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly executionHash: string;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface EvidenceRecord {
  readonly id: string;
  readonly capabilityId: string;
  readonly timestamp: string;
  readonly verifier: string;
  readonly hash: string;
  readonly metricSnapshots: Record<string, unknown>;
  readonly valid: boolean;
}
