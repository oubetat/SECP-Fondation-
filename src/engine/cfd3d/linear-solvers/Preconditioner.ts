/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Preconditioner Interface
 */

import { SparseVector } from './SparseVector';
import { SparseMatrix } from './SparseMatrix';

export interface Preconditioner {
  readonly id: string;
  setup(matrix: SparseMatrix): void;
  apply(r: SparseVector): SparseVector;
}
