/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Report
 */

import { BoundaryConditionVerdict, BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface BoundaryConditionReportData {
  readonly patchCount: number;
  readonly conditionCount: number;
  readonly coverageComplete: boolean;
  readonly systemConstrained: boolean;
  readonly verdict: BoundaryConditionVerdict;
  readonly diagnostics: readonly string[];
  readonly diagnosticCodes: readonly BoundaryDiagnosticCode[];
  readonly meshHash: string;
  readonly timestamp: string;
}

export class BoundaryConditionReport {
  public readonly data: BoundaryConditionReportData;

  constructor(data: BoundaryConditionReportData) {
    this.data = Object.freeze({ ...data });
  }

  public toJSON(): BoundaryConditionReportData {
    return this.data;
  }
}
