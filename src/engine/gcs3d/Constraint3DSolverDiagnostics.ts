/**
 * SECP CAD Kernel — GCS 3D Solver Diagnostics
 * Phase 2 (PATCH-026)
 */

export interface Constraint3DDiagnostic {
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly code:
    | 'DUPLICATE_CONSTRAINT_ID'
    | 'MISSING_ENTITY_REFERENCE'
    | 'CROSS_MODEL_REFERENCE'
    | 'NON_FINITE_PARAMETER'
    | 'ZERO_LENGTH_LINE'
    | 'ZERO_DIRECTION_VECTOR'
    | 'ZERO_NORMAL_VECTOR'
    | 'NEGATIVE_RADIUS'
    | 'CONTRADICTORY_CONSTRAINTS'
    | 'DUPLICATE_CONSTRAINTS'
    | 'SINGULAR_SYSTEM'
    | 'UNSUPPORTED_CONSTRAINT_CONFIGURATION'
    | 'NUMERICAL_FAILURE'
    | 'NOT_CONVERGED';
  readonly constraintId?: string;
  readonly message: string;
}
