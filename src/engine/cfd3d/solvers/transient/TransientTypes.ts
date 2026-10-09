/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Flow Types and Checkpoint Representations
 */

export interface CheckpointData {
  readonly time: number;
  readonly timestepIndex: number;
  readonly stateHash: string;
  readonly previousStateHash: string;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly physicsHash: string;
  readonly temporalSchemeHash: string;
}

export interface TransientStateRecord {
  readonly time: number;
  readonly timestepIndex: number;
  readonly deltaT: number;
  readonly flowStateHash: string;
  readonly thermalStateHash: string;
  readonly residualHash: string;
  readonly conservationHash: string;
}

export enum TimeFunctionType {
  CONSTANT = 'CONSTANT',
  LINEAR = 'LINEAR',
  SINUSOIDAL = 'SINUSOIDAL',
  PIECEWISE = 'PIECEWISE'
}

export interface TimeFunction {
  readonly type: TimeFunctionType;
  readonly parameters: readonly number[];
  evaluate(t: number): number;
}

export class SinusoidalTimeFunction implements TimeFunction {
  public readonly type = TimeFunctionType.SINUSOIDAL;
  public readonly parameters: readonly number[]; // [amplitude, frequency, phase]

  constructor(amplitude: number, frequency: number, phase: number = 0.0) {
    this.parameters = [amplitude, frequency, phase];
  }

  public evaluate(t: number): number {
    const [amplitude, frequency, phase] = this.parameters;
    return amplitude * Math.sin(2.0 * Math.PI * frequency * t + phase);
  }
}
