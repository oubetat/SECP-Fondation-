import {
  ForensicSimulationRecord,
  SimulationLifecycleState,
  SimulationManifest,
  SolverHealthRecord,
  ConservationRecord,
  MeshDiagnostic,
  RootCauseCandidate,
  SimulationDiagnosticEvidence
} from './types';
import { InputAuditor, SolverMonitor, PhysicsAuditor, MeshAuditor } from './Auditors';
import * as crypto from 'crypto';

export class SimulationDiagnosticEngine {
  public static diagnose(
    manifest: SimulationManifest,
    healthHistory: SolverHealthRecord[],
    conservation: ConservationRecord[],
    meshDiag: MeshDiagnostic,
    variables: Record<string, number>
  ): {
    state: SimulationLifecycleState;
    record: ForensicSimulationRecord;
    rootCauses: RootCauseCandidate[];
  } {
    const logs: string[] = [];
    const timeline: { timestamp: string; event: string; details?: any }[] = [];
    const diagnostics: SimulationDiagnosticEvidence[] = [];

    // 1. Input Audit
    const inputRes = InputAuditor.audit(manifest);
    timeline.push({ timestamp: new Date().toISOString(), event: 'INPUT_AUDIT', details: inputRes });
    
    if (inputRes.verdict !== 'VALID') {
      return this.finalizeFailure(manifest, 'INVALID', 'Input audit failed: ' + inputRes.details, timeline);
    }

    // 2. Mesh Audit
    const meshRes = MeshAuditor.audit(meshDiag);
    timeline.push({ timestamp: new Date().toISOString(), event: 'MESH_AUDIT', details: meshRes });
    if (meshRes === 'MESH_INVALID') {
      return this.finalizeFailure(manifest, 'FAILED', 'Mesh is invalid (Negative Jacobian or volume detected).', timeline);
    }

    // 3. Solver & Convergence
    const convergence = SolverMonitor.evaluateConvergence(healthHistory, conservation);
    timeline.push({ timestamp: new Date().toISOString(), event: 'CONVERGENCE_CHECK', details: { verdict: convergence } });

    // 4. Physics Audit
    const physicsRes = PhysicsAuditor.verifyBounds(variables);
    timeline.push({ timestamp: new Date().toISOString(), event: 'PHYSICS_BOUNDS_CHECK', details: { verdict: physicsRes } });

    let state: SimulationLifecycleState = 'RUNNING';
    const rootCauses: RootCauseCandidate[] = [];

    if (convergence === 'CONVERGED' && physicsRes === 'PHYSICS_VALID') {
      state = 'CONVERGED';
    } else if (convergence === 'NOT_CONVERGED') {
      state = 'FAILED';
      rootCauses.push({
        candidateId: 'RC-NUM',
        description: 'Numerical instability or divergence detected.',
        probability: 0.9,
        supportingEvidence: ['Solver errors or diverging residuals'],
        contradictingEvidence: [],
        verified: false
      });
    } else if (convergence === 'FALSE_CONVERGENCE') {
      state = 'FAILED';
      rootCauses.push({
        candidateId: 'RC-001',
        description: 'False convergence: Small residuals but high conservation error.',
        probability: 0.9,
        supportingEvidence: ['Conservation imbalance > tolerance'],
        contradictingEvidence: [],
        verified: false
      });
    }

    const record: ForensicSimulationRecord = {
      simulationId: manifest.simulationId,
      simulationHash: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
      manifest,
      environment: { os: 'IndustrialOS v2', arch: 'x64' },
      logs,
      logHash: crypto.createHash('sha256').update(logs.join('\n')).digest('hex'),
      healthHistory,
      diagnostics,
      timeline
    };

    return { state, record, rootCauses };
  }

  private static finalizeFailure(
    manifest: SimulationManifest,
    state: SimulationLifecycleState,
    reason: string,
    existingTimeline: { timestamp: string; event: string; details?: any }[]
  ) {
    const timeline = [...existingTimeline, { timestamp: new Date().toISOString(), event: 'FAILURE', details: { reason } }];
    return {
      state,
      record: {
        simulationId: manifest.simulationId,
        simulationHash: '',
        manifest,
        environment: {},
        logs: [reason],
        logHash: '',
        healthHistory: [],
        diagnostics: [],
        timeline
      },
      rootCauses: [{
        candidateId: 'RC-FAIL',
        description: reason,
        probability: 1.0,
        supportingEvidence: [],
        contradictingEvidence: [],
        verified: true
      }]
    };
  }
}
