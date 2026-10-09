/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Mixed / Robin Boundary Condition
 */

import { BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface RobinValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class MixedBoundaryCondition {
  public readonly boundaryConditionId: string;
  public readonly patchId: string;
  public readonly a: number;
  public readonly b: number;
  public readonly c: number;

  constructor(boundaryConditionId: string, patchId: string, a: number, b: number, c: number) {
    this.boundaryConditionId = boundaryConditionId;
    this.patchId = patchId;
    this.a = a;
    this.b = b;
    this.c = c;
  }

  public validate(): RobinValidationResult {
    const diagnostics: string[] = [];

    if (!Number.isFinite(this.a) || !Number.isFinite(this.b) || !Number.isFinite(this.c)) {
      diagnostics.push(`Mixed Robin BC coefficients (a=${this.a}, b=${this.b}, c=${this.c}) contain non-finite numbers.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    if (this.a === 0 && this.b === 0) {
      diagnostics.push(`Mixed Robin BC coefficients 'a' and 'b' cannot both be zero.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
