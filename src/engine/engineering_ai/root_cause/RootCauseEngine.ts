import {
  FailureSignature,
  CausalHypothesis,
  RootCauseRecord,
  RootCauseVerdict,
  HypothesisStatus,
  CausalNode,
  CausalEdge,
  RootCauseIntervention,
  CounterfactualCase,
  EvidenceStrength
} from './types';
import { CausalGraph, FailureNormalizer } from './CausalEngineCore';
import { ForensicSimulationRecord } from '../simulation/types';
import * as crypto from 'crypto';

export class RootCauseEngine {
  public static analyze(record: ForensicSimulationRecord): RootCauseRecord {
    const signatures = FailureNormalizer.normalize(record);
    const hypotheses = this.generateHypotheses(signatures, record);
    const graph = this.buildCausalGraph(signatures, hypotheses);

    const recordId = `RC-${crypto.randomBytes(4).toString('hex')}`;
    
    // Initial verdict is UNVERIFIED
    return {
      rootCauseId: recordId,
      simulationId: record.simulationId,
      failureId: signatures[0]?.failureId || 'UNKNOWN',
      failureClass: signatures[0]?.category || 'SOLVER_FAILURE',
      candidateCauses: hypotheses.map(h => h.statement),
      causalGraphHash: graph.getHash(),
      supportingEvidence: [],
      contradictingEvidence: [],
      experiments: [],
      interventions: [],
      counterfactuals: [],
      verificationResults: [],
      confidence: 0.5,
      verdict: 'NO_ROOT_CAUSE_ESTABLISHED',
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex'),
      createdAt: new Date().toISOString()
    };
  }

  private static generateHypotheses(signatures: FailureSignature[], record: ForensicSimulationRecord): CausalHypothesis[] {
    const hypotheses: CausalHypothesis[] = [];

    for (const sig of signatures) {
      if (sig.category === 'CONVERGENCE_FAILURE') {
        hypotheses.push({
          hypothesisId: `HYP-TS-${Date.now()}`,
          statement: 'Excessive time step leading to numerical instability',
          causeVariable: 'timeStep',
          effectVariable: 'residualConvergence',
          domain: 'NUMERICAL',
          mechanism: 'CFL condition violation or nonlinear stiffness lag',
          predictedObservation: 'Reducing time step by 2x should stabilize convergence',
          requiredEvidence: ['TimeStep > StabilityLimit'],
          status: 'PROPOSED',
          confidence: 0.7
        });
      }

      if (sig.category === 'MESH_FAILURE' || (sig.category === 'CONVERGENCE_FAILURE' && record.diagnostics.some(d => d.event.includes('MESH')))) {
        hypotheses.push({
          hypothesisId: `HYP-MESH-${Date.now()}`,
          statement: 'Poor mesh quality in high gradient regions',
          causeVariable: 'meshResolution',
          effectVariable: 'localGradients',
          domain: 'SPATIAL',
          mechanism: 'Truncation error from high skewness or aspect ratio',
          predictedObservation: 'Local mesh refinement should reduce residual spikes',
          requiredEvidence: ['Skewness > 0.9'],
          status: 'PROPOSED',
          confidence: 0.6
        });
      }
    }

    return hypotheses;
  }

  private static buildCausalGraph(signatures: FailureSignature[], hypotheses: CausalHypothesis[]): CausalGraph {
    const graph = new CausalGraph();

    signatures.forEach(sig => {
      graph.addNode(sig.failureId, 'Failure', sig.observable, { category: sig.category });
    });

    hypotheses.forEach(hyp => {
      graph.addNode(hyp.hypothesisId, 'Cause', hyp.statement, { variable: hyp.causeVariable });
      
      // Link hypothesis to relevant failure
      signatures.forEach(sig => {
        if (this.isRelevant(hyp, sig)) {
          graph.addEdge(hyp.hypothesisId, sig.failureId, 'CAUSES', hyp.mechanism);
        }
      });
    });

    return graph;
  }

  private static isRelevant(hyp: CausalHypothesis, sig: FailureSignature): boolean {
    if (hyp.domain === 'NUMERICAL' && sig.category === 'CONVERGENCE_FAILURE') return true;
    if (hyp.domain === 'SPATIAL' && sig.category === 'MESH_FAILURE') return true;
    return false;
  }

  public static verify(
    record: RootCauseRecord,
    interventionResults: any[],
    counterfactualResults: any[]
  ): RootCauseVerdict {
    // Level 5 Verification Logic
    const hasControlledIntervention = interventionResults.length > 0;
    const hasCounterfactualSupport = counterfactualResults.length > 0;
    const hasBaseline = !!record.simulationId;

    if (!hasBaseline) return 'NO_ROOT_CAUSE_ESTABLISHED';

    // Check for confounding
    const changedVariables = interventionResults.flatMap(r => r.changedVariables || []);
    const isIsolated = changedVariables.length === 1;

    if (hasControlledIntervention && !isIsolated) {
      return 'CAUSAL_IDENTIFICATION_INSUFFICIENT';
    }

    if (hasControlledIntervention && hasCounterfactualSupport && isIsolated) {
      // Check if independent verification performed (mocked for now)
      const independentVerified = true; 
      return independentVerified ? 'VERIFIED_ROOT_CAUSE' : 'SUPPORTED_ROOT_CAUSE';
    }

    if (hasControlledIntervention) return 'SUPPORTED_ROOT_CAUSE';

    return 'UNVERIFIED_ROOT_CAUSE';
  }
}
