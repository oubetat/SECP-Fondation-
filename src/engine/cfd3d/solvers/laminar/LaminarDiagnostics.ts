/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Diagnostics
 */

import { LaminarSolverFailureCode } from './LaminarFailure';

export interface LaminarDiagnosticEvent {
  readonly level: 'INFO' | 'WARNING' | 'ERROR';
  readonly code?: LaminarSolverFailureCode;
  readonly message: string;
  readonly timestamp: string;
}

export class LaminarDiagnostics {
  private readonly events: LaminarDiagnosticEvent[] = [];

  public log(level: 'INFO' | 'WARNING' | 'ERROR', message: string, code?: LaminarSolverFailureCode): void {
    this.events.push({
      level,
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  public getEvents(): readonly LaminarDiagnosticEvent[] {
    return Object.freeze([...this.events]);
  }
}
