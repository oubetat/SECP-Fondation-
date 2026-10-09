/**
 * SECP CAD Kernel — GCS 3D Solver Result
 * Phase 2 (PATCH-026)
 */

import { Model3D } from './Constraint3DTypes';
import { DOF3DReport } from './DegreeOfFreedom3DAnalyzer';
import { Constraint3DDiagnostic } from './Constraint3DSolverDiagnostics';

export interface Constraint3DSolverResult {
  readonly success: boolean;
  readonly converged: boolean;
  readonly model: Model3D;
  readonly iterations: number;
  readonly residualNorm: number;
  readonly dofReport: DOF3DReport;
  readonly diagnostics: readonly Constraint3DDiagnostic[];
  readonly evidenceHash: string; // Engineering Evidence Chain compliance
  readonly solvedAt: string;
}
