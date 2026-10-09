/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Diagnostics
 */

import { BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface DiagnosticRecord {
  readonly code: BoundaryDiagnosticCode;
  readonly message: string;
  readonly timestamp: string;
}

export class BoundaryConditionDiagnostics {
  private readonly records: DiagnosticRecord[] = [];

  public log(code: BoundaryDiagnosticCode, message: string): void {
    this.records.push({
      code,
      message,
      timestamp: new Date().toISOString()
    });
  }

  public getRecords(): readonly DiagnosticRecord[] {
    return Object.freeze([...this.records]);
  }

  public hasCode(code: BoundaryDiagnosticCode): boolean {
    return this.records.some(r => r.code === code);
  }

  public clear(): void {
    this.records.length = 0;
  }
}
