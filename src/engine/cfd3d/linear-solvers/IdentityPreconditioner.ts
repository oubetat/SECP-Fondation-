/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Identity Preconditioner
 */

import { Preconditioner } from './Preconditioner';
import { SparseVector } from './SparseVector';
import { SparseMatrix } from './SparseMatrix';

export class IdentityPreconditioner implements Preconditioner {
  public readonly id = 'identity-preconditioner';

  public setup(matrix: SparseMatrix): void {
    // Identity preconditioner does not require setup
  }

  public apply(r: SparseVector): SparseVector {
    return r.copy();
  }
}
