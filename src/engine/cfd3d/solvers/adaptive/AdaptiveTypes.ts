/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Adaptive Time Stepping Types and Interfaces
 */

export enum LimiterReason {
  FLOW = 'FLOW',
  ACOUSTIC = 'ACOUSTIC',
  THERMAL = 'THERMAL',
  ACCURACY = 'ACCURACY',
  USER = 'USER',
  INITIAL = 'INITIAL'
}

export interface AdaptiveTimeState {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly controllerType: string;
  readonly minDt: number;
  readonly maxDt: number;
  readonly targetCFL: number;
  readonly targetError: number;
}

export interface AdaptiveTimeRecord {
  readonly timestepIndex: number;
  readonly time: number;
  readonly dt: number;
  readonly previousDt: number;
  readonly candidateDt: number;
  readonly accepted: boolean;
  readonly rejected: boolean;
  readonly retryIndex: number;
  readonly CFL: number;
  readonly errorEstimate: number;
  readonly tolerance: number;
  readonly limitingConstraint: LimiterReason;
  readonly failureReason: string;
  readonly stateHash: string;
}
