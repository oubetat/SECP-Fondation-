export type StateDomain =
  | 'OBJECT'
  | 'DESIGN'
  | 'SIMULATION'
  | 'RESULT'
  | 'EVIDENCE'
  | 'MANUFACTURING'
  | 'REVISION';

export interface EngineeringState {
  readonly stateId: string;
  readonly domain: StateDomain;
  readonly stateType: string; // Specific state in the domain, e.g. "DRAFT", "READY", etc.
  readonly objectId: string;
  readonly enteredAt: string;
  readonly enteredBy: string;
  readonly transitionId: string;
  readonly version: number; // For concurrency and optimistic locking
}

export interface StateTransition {
  readonly transitionId: string;
  readonly domain: StateDomain;
  readonly fromState: string;
  readonly toState: string;
  readonly eventType: string;
  readonly actor: {
    readonly id: string;
    readonly type: string;
  };
  readonly guards: readonly string[]; // IDs of guards executed
  readonly reason?: string;
  readonly timestamp: string;
}

export type GuardVerdict = 'PASS' | 'FAIL' | 'UNPROVEN';

export interface GuardResult {
  readonly verdict: GuardVerdict;
  readonly reason?: string;
  readonly evidenceRefs?: readonly string[];
  readonly failedChecks?: readonly string[];
}

export interface TransitionContext {
  readonly actor: {
    readonly id: string;
    readonly type: string;
  };
  readonly reason?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly forceReactivate?: boolean;
  // Extra payload containing validation data / telemetry
  readonly metadata?: Record<string, any>;
}
