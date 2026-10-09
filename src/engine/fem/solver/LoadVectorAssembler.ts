import { DOFManager } from './DOFManager';
import { NodalLoadInput } from './types';

export interface LoadValidationResult {
  isValid: boolean;
  errors: string[];
  totalAppliedForce: { fx: number; fy: number; fz: number };
  appliedLoadCount: number;
}

export class LoadVectorAssembler {
  static assembleGlobalLoadVector(
    dofManager: DOFManager,
    loads: NodalLoadInput[]
  ): { F: number[]; validation: LoadValidationResult } {
    const totalDOFs = dofManager.totalDOFs;
    const F = new Array<number>(totalDOFs).fill(0);
    const errors: string[] = [];

    let fx = 0, fy = 0, fz = 0;
    let validCount = 0;

    for (const load of loads) {
      if (!Number.isFinite(load.magnitude)) {
        errors.push(`Load on node ${load.nodeId} DOF ${load.dof} is non-finite: ${load.magnitude}`);
        continue;
      }

      try {
        const globalDOFIdx = dofManager.getGlobalDOFIndex(load.nodeId, load.dof);
        F[globalDOFIdx] += load.magnitude;
        validCount++;

        if (load.dof === 'UX') fx += load.magnitude;
        if (load.dof === 'UY') fy += load.magnitude;
        if (load.dof === 'UZ') fz += load.magnitude;
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    return {
      F,
      validation: {
        isValid: errors.length === 0,
        errors,
        totalAppliedForce: { fx, fy, fz },
        appliedLoadCount: validCount
      }
    };
  }
}
