import { SparseMatrix } from '../sparse/SparseMatrix';
import { PartitionedSparseSystem } from './types';

export class LinearSystem {
  readonly partitionedSystem: PartitionedSparseSystem;

  constructor(partitionedSystem: PartitionedSparseSystem) {
    this.partitionedSystem = partitionedSystem;
  }

  get Kff(): SparseMatrix {
    return this.partitionedSystem.Kff;
  }

  get reducedRHS(): number[] {
    return this.partitionedSystem.reducedFf;
  }

  get freeDOFCount(): number {
    return this.partitionedSystem.freeDOFCount;
  }

  get constrainedDOFCount(): number {
    return this.partitionedSystem.constrainedDOFCount;
  }

  validateSystemIntegrity(): { isValid: boolean; reason?: string } {
    const Kff = this.Kff;

    if (Kff.rows === 0 || Kff.cols === 0) {
      return { isValid: false, reason: 'System has 0 free DOFs or empty stiffness matrix.' };
    }

    if (Kff.rows !== Kff.cols) {
      return { isValid: false, reason: `Stiffness matrix Kff is not square (${Kff.rows}x${Kff.cols}).` };
    }

    if (Kff.rows !== this.reducedRHS.length) {
      return { isValid: false, reason: 'Dimension mismatch between Kff rows and reduced RHS vector.' };
    }

    // Finite check on reduced RHS
    for (let i = 0; i < this.reducedRHS.length; i++) {
      if (!Number.isFinite(this.reducedRHS[i])) {
        return { isValid: false, reason: `Reduced RHS vector contains non-finite entry at index ${i}: ${this.reducedRHS[i]}` };
      }
    }

    // Validate Kff internal CSR integrity
    try {
      Kff.validate();
    } catch (err: any) {
      return { isValid: false, reason: `CSR validation failed on Kff: ${err.message}` };
    }

    return { isValid: true };
  }
}
