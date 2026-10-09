/**
 * SECP Engineering Clock Abstraction
 * 
 * Explicitly separates physical wall-clock time from simulation/engineering time
 * and deterministic test/replay time.
 * 
 * DETERMINISM CONTRACT:
 * - WallClock: NON-DETERMINISTIC (reflects physical host system time)
 * - DeterministicClock: DETERMINISTIC (fixed point in time, advances only via explicit step)
 * - SimulationClock: DETERMINISTIC with explicit state progression (advances only via discrete delta or explicit set)
 */

export interface EngineeringClock {
  /** Returns an immutable Date snapshot representing current clock time */
  now(): Date;
  /** Returns epoch milliseconds representing current clock time */
  nowMs(): number;
  /** Optional helper for ISO 8601 string representation */
  iso?(): string;
  /** Optional helper for timestamp in epoch ms */
  timestamp?(): number;
}

/**
 * WallClock
 * 
 * Purpose: Real-world physical system time.
 * Contract: NON-DETERMINISTIC
 * 
 * Appropriate for: Operational logging, host file creation, UI telemetry, Wall-clock timeouts.
 */
export class WallClock implements EngineeringClock {
  public now(): Date {
    return new Date();
  }

  public nowMs(): number {
    return Date.now();
  }

  public iso(): string {
    return new Date().toISOString();
  }

  public timestamp(): number {
    return Date.now();
  }
}

/**
 * Backward compatibility alias for legacy call sites.
 */
export const SystemClock = WallClock;

/**
 * DeterministicClock
 * 
 * Purpose: Deterministic execution, testing, reproducible calculations, and replay.
 * Contract: DETERMINISTIC
 * 
 * Behavior:
 * - Returns exactly the configured deterministic time.
 * - Does NOT access host system clock (Date.now() or performance.now()).
 * - Advances time ONLY via explicit call to advanceMs().
 * - Internal state is protected from external mutation through Date snapshot copies.
 */
export class DeterministicClock implements EngineeringClock {
  private currentMs: number;

  constructor(initialTime: Date | number | string = "2026-08-17T03:30:00.000Z") {
    if (initialTime instanceof Date) {
      this.currentMs = initialTime.getTime();
    } else if (typeof initialTime === 'number') {
      if (!Number.isFinite(initialTime)) {
        throw new Error(`[DeterministicClock] Invalid initialTime: ${initialTime}`);
      }
      this.currentMs = initialTime;
    } else if (typeof initialTime === 'string') {
      const parsed = new Date(initialTime).getTime();
      if (!Number.isFinite(parsed)) {
        throw new Error(`[DeterministicClock] Invalid initialTime string: "${initialTime}"`);
      }
      this.currentMs = parsed;
    } else {
      throw new Error(`[DeterministicClock] Unsupported initialTime format`);
    }
  }

  public now(): Date {
    return new Date(this.currentMs);
  }

  public nowMs(): number {
    return this.currentMs;
  }

  public iso(): string {
    return new Date(this.currentMs).toISOString();
  }

  public timestamp(): number {
    return this.currentMs;
  }

  /**
   * Explicitly advances deterministic time by deltaMs.
   * @param deltaMs Finite number of milliseconds to advance (must be >= 0).
   */
  public advanceMs(deltaMs: number): void {
    if (typeof deltaMs !== 'number' || !Number.isFinite(deltaMs)) {
      throw new Error(`[DeterministicClock] advanceMs requires a finite number, received: ${deltaMs}`);
    }
    if (deltaMs < 0) {
      throw new Error(`[DeterministicClock] Negative time advancement is rejected: ${deltaMs}`);
    }
    this.currentMs += deltaMs;
  }
}

/**
 * SimulationClock
 * 
 * Purpose: Discrete engineering simulation time progression (e.g. ODE/PDE solvers, CFD steps, kinematics).
 * Contract: DETERMINISTIC with explicit state progression
 * 
 * Behavior:
 * - Represents discrete simulation time distinct from real-world wall clock.
 * - Does NOT read Date.now() or host system clock internally.
 * - Advances exclusively via advanceMs() or setTimeMs().
 */
export class SimulationClock implements EngineeringClock {
  private simulationMs: number;

  constructor(initialSimulationTime: Date | number | string = 0) {
    if (initialSimulationTime instanceof Date) {
      this.simulationMs = initialSimulationTime.getTime();
    } else if (typeof initialSimulationTime === 'number') {
      if (!Number.isFinite(initialSimulationTime)) {
        throw new Error(`[SimulationClock] Invalid initialSimulationTime: ${initialSimulationTime}`);
      }
      this.simulationMs = initialSimulationTime;
    } else if (typeof initialSimulationTime === 'string') {
      const parsed = new Date(initialSimulationTime).getTime();
      if (!Number.isFinite(parsed)) {
        throw new Error(`[SimulationClock] Invalid initialSimulationTime string: "${initialSimulationTime}"`);
      }
      this.simulationMs = parsed;
    } else {
      throw new Error(`[SimulationClock] Unsupported initialSimulationTime format`);
    }
  }

  public now(): Date {
    return new Date(this.simulationMs);
  }

  public nowMs(): number {
    return this.simulationMs;
  }

  public iso(): string {
    return new Date(this.simulationMs).toISOString();
  }

  public timestamp(): number {
    return this.simulationMs;
  }

  /**
   * Advances simulation time by deltaMs.
   * @param deltaMs Finite delta in milliseconds (must be >= 0).
   */
  public advanceMs(deltaMs: number): void {
    if (typeof deltaMs !== 'number' || !Number.isFinite(deltaMs)) {
      throw new Error(`[SimulationClock] advanceMs requires a finite number, received: ${deltaMs}`);
    }
    if (deltaMs < 0) {
      throw new Error(`[SimulationClock] Negative time advancement is rejected: ${deltaMs}`);
    }
    this.simulationMs += deltaMs;
  }

  /**
   * Sets explicit simulation epoch time in milliseconds.
   * @param timeMs Finite epoch in milliseconds.
   */
  public setTimeMs(timeMs: number): void {
    if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
      throw new Error(`[SimulationClock] setTimeMs requires a finite number, received: ${timeMs}`);
    }
    this.simulationMs = timeMs;
  }
}

/**
 * Utility functions for EngineeringClock
 */
export function toISOString(clock: EngineeringClock): string {
  if (typeof clock.iso === 'function') {
    return clock.iso();
  }
  return clock.now().toISOString();
}
