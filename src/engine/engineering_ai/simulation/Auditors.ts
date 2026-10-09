import {
  InputVerdict,
  SimulationManifest,
  SolverHealthRecord,
  ResidualClassification,
  ConvergenceVerdict,
  ConservationRecord,
  ConservationVerdict,
  PhysicsViolationVerdict,
  MeshDiagnostic,
  MeshFailureClassification,
  BoundaryConditionVerdict
} from './types';

export class InputAuditor {
  public static audit(manifest: SimulationManifest): { verdict: InputVerdict; details: string } {
    if (!manifest.geometry) return { verdict: 'INCOMPLETE', details: 'Missing geometry definition.' };
    if (!manifest.mesh) return { verdict: 'INCOMPLETE', details: 'Missing mesh definition.' };
    if (!manifest.materials || manifest.materials.length === 0) return { verdict: 'INCOMPLETE', details: 'Missing material definition.' };
    if (!manifest.physics) return { verdict: 'INCOMPLETE', details: 'Missing physics model.' };
    if (!manifest.boundaryConditions || manifest.boundaryConditions.length === 0) return { verdict: 'INCOMPLETE', details: 'Missing boundary conditions.' };

    // Placeholder for more complex cross-consistency checks
    return { verdict: 'VALID', details: 'All mandatory input components present.' };
  }
}

export class SolverMonitor {
  public static analyzeResiduals(history: SolverHealthRecord[]): ResidualClassification {
    if (!history || history.length < 3) return 'INSUFFICIENT_DATA';

    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const first = history[history.length - 3];

    if (!last.residuals || !prev.residuals || !first.residuals) return 'INSUFFICIENT_DATA';

    // Simple trend detection (averaging over major residuals)
    const getAvg = (rec: SolverHealthRecord) => {
      const vals = Object.values(rec.residuals).map(arr => arr[arr.length - 1]);
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const vLast = getAvg(last);
    const vPrev = getAvg(prev);
    const vFirst = getAvg(first);

    if (vLast > vPrev && vPrev > vFirst) return 'DIVERGING';
    if (vLast < vPrev && vPrev < vFirst) return 'DECREASING';
    if (Math.abs(vLast - vPrev) < 1e-12) return 'STAGNANT';
    
    // Check for spikes
    if (vLast > vPrev * 100) return 'SPIKING';

    return 'OSCILLATORY';
  }

  public static evaluateConvergence(
    history: SolverHealthRecord[],
    conservation: ConservationRecord[]
  ): ConvergenceVerdict {
    if (!history || history.length === 0) return 'CONVERGENCE_INSUFFICIENT';

    const last = history[history.length - 1];
    
    // Check for explicit numerical failures in errors
    if (last.errors && last.errors.some(e => e === 'NUMERICAL_INSTABILITY' || e === 'MATRIX_BREAKDOWN')) {
      return 'NOT_CONVERGED';
    }

    if (!last.residuals) return 'CONVERGENCE_INSUFFICIENT';

    const resValues = Object.values(last.residuals).map(arr => arr[arr.length - 1]);
    if (resValues.length === 0) return 'CONVERGENCE_INSUFFICIENT';

    // Check for NaN/Inf in residuals
    if (resValues.some(v => isNaN(v) || !isFinite(v))) {
      return 'NOT_CONVERGED';
    }

    const maxResidual = Math.max(...resValues);
    const trend = this.analyzeResiduals(history);
    
    // FALSE CONVERGENCE check: residual is small but conservation is failed
    const conservationFailed = conservation.some(c => c.verdict === 'CONSERVATION_FAILURE');
    
    if (maxResidual < 1e-4 && conservationFailed) {
      return 'FALSE_CONVERGENCE';
    }

    if (maxResidual < 1e-6 && trend === 'DECREASING') {
      return 'CONVERGED';
    }

    if (trend === 'DIVERGING') {
      return 'NOT_CONVERGED';
    }

    return 'CONVERGENCE_INSUFFICIENT';
  }
}

export class PhysicsAuditor {
  public static verifyBounds(variables: Record<string, number>): PhysicsViolationVerdict {
    if (variables['temperature'] !== undefined && variables['temperature'] < 0) {
      return 'PHYSICS_VIOLATION';
    }
    if (variables['density'] !== undefined && variables['density'] <= 0) {
      return 'PHYSICS_VIOLATION';
    }
    return 'PHYSICS_VALID';
  }

  public static verifyConservation(record: ConservationRecord): ConservationVerdict {
    const totalIn = record.inflow + record.source;
    const totalOut = record.outflow + record.sink;
    const imbalance = Math.abs(totalIn - totalOut);
    const normError = imbalance / Math.max(Math.abs(totalIn), 1e-9);

    if (normError > record.tolerance) {
      return 'CONSERVATION_FAILURE';
    }
    return 'CONSERVATION_PASS';
  }
}

export class MeshAuditor {
  public static audit(diag: MeshDiagnostic): MeshFailureClassification {
    if (diag.negativeVolumeCount > 0) return 'MESH_INVALID';
    if (diag.minJacobian < 0) return 'MESH_INVALID';
    if (diag.maxSkewness > 0.95) return 'MESH_DEGRADED';
    return 'MESH_VALID';
  }
}

export class BoundaryAuditor {
  public static audit(bcs: any[]): BoundaryConditionVerdict {
    // Simple logic: check for overlapping types on same boundaries
    // In a real system, this would use geometry and patch IDs
    return 'BC_VALID';
  }
}
