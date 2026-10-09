import { SimulationDiagnosticEngine } from './SimulationDiagnosticEngine';
import {
  SimulationManifest,
  SolverHealthRecord,
  ConservationRecord,
  MeshDiagnostic,
  SimulationLifecycleState
} from './types';

export interface Gate134Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate134 {
  public static runAllTests(): Gate134Result[] {
    const results: Gate134Result[] = [];

    // 1. Mandatory Test: False Convergence
    results.push(this.testFalseConvergence());

    // 2. Mandatory Test: Numerical Failure (NaN/Inf)
    results.push(this.testNumericalFailure());

    // 3. Mandatory Test: Mesh Failure (Negative Jacobian)
    results.push(this.testMeshFailure());

    // 4. Mandatory Test: Input Integrity Failure
    results.push(this.testInputIntegrityFailure());

    // 5. Mandatory Test: Physical Bounds Violation
    results.push(this.testPhysicsViolation());

    return results;
  }

  private static testFalseConvergence(): Gate134Result {
    const manifest = this.getBasicManifest();
    const history: SolverHealthRecord[] = [
      { residuals: { p: [1e-3], u: [1e-3] }, iterations: 1, timeStep: 1, warnings: [], errors: [] },
      { residuals: { p: [1e-4], u: [1e-4] }, iterations: 2, timeStep: 1, warnings: [], errors: [] },
      { residuals: { p: [1e-7], u: [1e-7] }, iterations: 3, timeStep: 1, warnings: [], errors: [] }
    ];
    const conservation: ConservationRecord[] = [{
      quantity: 'Mass', inflow: 10, outflow: 5, source: 0, sink: 0, imbalance: 5,
      normalizedError: 0.5, tolerance: 0.001, verdict: 'CONSERVATION_FAILURE'
    }];
    const mesh: MeshDiagnostic = { elementCount: 100, minJacobian: 0.8, maxAspectRatio: 1.2, maxSkewness: 0.1, minAngle: 45, negativeVolumeCount: 0, verdict: 'MESH_VALID' };

    const diag = SimulationDiagnosticEngine.diagnose(manifest, history, conservation, mesh, {});
    
    const passed = diag.state === 'FAILED' && diag.rootCauses.some(rc => rc.description.includes('False convergence'));
    
    return {
      gateId: 'GATE-134-FALSE-CONV',
      description: 'Detect small residuals but high conservation error as FALSE_CONVERGENCE',
      passed,
      verdict: diag.state,
      details: passed ? 'Successfully detected false convergence.' : 'Failed to detect false convergence.'
    };
  }

  private static testNumericalFailure(): Gate134Result {
    const manifest = this.getBasicManifest();
    const history: SolverHealthRecord[] = [
      { residuals: { p: [1e-3], u: [1e-3] }, iterations: 1, timeStep: 1, warnings: [], errors: [] },
      { residuals: { p: [Infinity], u: [NaN] }, iterations: 2, timeStep: 1, warnings: [], errors: ['NUMERICAL_INSTABILITY'] }
    ];
    const conservation: ConservationRecord[] = [];
    const mesh: MeshDiagnostic = { elementCount: 100, minJacobian: 0.8, maxAspectRatio: 1.2, maxSkewness: 0.1, minAngle: 45, negativeVolumeCount: 0, verdict: 'MESH_VALID' };

    const diag = SimulationDiagnosticEngine.diagnose(manifest, history, conservation, mesh, {});
    
    const passed = diag.state === 'FAILED' && diag.rootCauses.some(rc => rc.candidateId === 'RC-NUM');
    
    return {
      gateId: 'GATE-134-NUMERICAL-FAIL',
      description: 'Detect NaN/Inf as Numerical Failure',
      passed,
      verdict: diag.state,
      details: passed ? 'Successfully detected numerical instability.' : 'Failed to detect numerical instability.'
    };
  }

  private static testMeshFailure(): Gate134Result {
    const manifest = this.getBasicManifest();
    const mesh: MeshDiagnostic = { elementCount: 100, minJacobian: -0.1, maxAspectRatio: 1.2, maxSkewness: 0.1, minAngle: 45, negativeVolumeCount: 1, verdict: 'MESH_INVALID' };

    const diag = SimulationDiagnosticEngine.diagnose(manifest, [], [], mesh, {});
    
    const passed = diag.state === 'FAILED' && diag.record.timeline.some(t => t.event === 'MESH_AUDIT' && t.details === 'MESH_INVALID');
    
    return {
      gateId: 'GATE-134-MESH-FAIL',
      description: 'Reject mesh with negative Jacobian/volume as MESH_INVALID',
      passed,
      verdict: diag.state,
      details: passed ? 'Successfully rejected invalid mesh.' : 'Failed to reject invalid mesh.'
    };
  }

  private static testInputIntegrityFailure(): Gate134Result {
    const manifest: SimulationManifest = {
      simulationId: 'SIM-FAIL',
      geometry: null, // Missing geometry
      mesh: {},
      materials: [],
      physics: {},
      boundaryConditions: [],
      initialConditions: {},
      solver: 'SolverX',
      solverVersion: '1.0',
      numericalSettings: {}
    };

    const diag = SimulationDiagnosticEngine.diagnose(manifest, [], [], { elementCount: 0, minJacobian: 0, maxAspectRatio: 0, maxSkewness: 0, minAngle: 0, negativeVolumeCount: 0, verdict: 'MESH_VALID' }, {});
    
    const passed = diag.state === 'INVALID';
    
    return {
      gateId: 'GATE-134-INPUT-FAIL',
      description: 'Reject manifest with missing geometry/components',
      passed,
      verdict: diag.state,
      details: passed ? 'Successfully rejected incomplete input.' : 'Failed to reject incomplete input.'
    };
  }

  private static testPhysicsViolation(): Gate134Result {
    const manifest = this.getBasicManifest();
    const mesh: MeshDiagnostic = { elementCount: 100, minJacobian: 0.8, maxAspectRatio: 1.2, maxSkewness: 0.1, minAngle: 45, negativeVolumeCount: 0, verdict: 'MESH_VALID' };
    const vars = { 'temperature': -5 }; // Violates T >= 0 K

    const diag = SimulationDiagnosticEngine.diagnose(manifest, [], [], mesh, vars);
    
    const passed = diag.record.timeline.some(t => t.event === 'PHYSICS_BOUNDS_CHECK' && t.details.verdict === 'PHYSICS_VIOLATION');
    
    return {
      gateId: 'GATE-134-PHYSICS-FAIL',
      description: 'Detect physical bounds violations (e.g., T < 0 K)',
      passed,
      verdict: diag.state,
      details: passed ? 'Successfully detected physics violation.' : 'Failed to detect physics violation.'
    };
  }

  private static getBasicManifest(): SimulationManifest {
    return {
      simulationId: 'SIM-001',
      geometry: { id: 'G1' },
      mesh: { id: 'M1' },
      materials: [{ id: 'MAT1' }],
      physics: { model: 'RANS' },
      boundaryConditions: [{ id: 'BC1' }],
      initialConditions: {},
      solver: 'SolverX',
      solverVersion: '1.0',
      numericalSettings: {}
    };
  }
}
