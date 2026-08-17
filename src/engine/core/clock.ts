/**
 * SECP Engineering Clock Abstraction
 * 
 * Separates physical wall-clock time from simulation, replay, and cryptographic time.
 */

export interface EngineeringClock {
  now(): Date;
  timestamp(): number;
  iso(): string;
}

/**
 * Default implementation using system time.
 */
export class SystemClock implements EngineeringClock {
  now(): Date {
    return new Date();
  }
  timestamp(): number {
    return Date.now();
  }
  iso(): string {
    return new Date().toISOString();
  }
}

/**
 * Deterministic clock for Replay, Simulation, and Cryptographic Canonicalization.
 */
export class DeterministicClock implements EngineeringClock {
  private fixedDate: Date;

  constructor(isoString: string = "2026-08-17T03:30:00Z") {
    this.fixedDate = new Date(isoString);
  }

  now(): Date {
    return new Date(this.fixedDate);
  }
  timestamp(): number {
    return this.fixedDate.getTime();
  }
  iso(): string {
    return this.fixedDate.toISOString();
  }
}
