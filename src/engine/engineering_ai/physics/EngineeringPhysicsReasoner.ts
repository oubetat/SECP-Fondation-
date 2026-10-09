import {
  PhysicsContext,
  PhysicsProblemDefinition,
  PhysicsHypothesis,
  PhysicsPrediction,
  PhysicsReasoningEvidence,
  PhysicsReasoningVerdict,
  PhysicsResidual,
  PhysicsCausalHypothesis,
  PhysicsScenario,
  PhysicsAnomalyRecord
} from './types';
import { EngineeringPhysicsGraph } from './EngineeringPhysicsGraph';
import { GoverningEquationRegistry } from './GoverningEquationRegistry';
import { PhysicsDimensionalAnalyzer } from './PhysicsDimensionalAnalyzer';
import { PhysicsBoundsEngine } from './PhysicsBoundsEngine';
import { PhysicsConservationVerifier } from './PhysicsConservationVerifier';
import { PhysicsResidualEngine } from './PhysicsResidualEngine';
import { PhysicsHallucinationDetector } from './PhysicsHallucinationDetector';
import { PhysicsConstraintEngine } from './PhysicsConstraintEngine';
import { CanonicalPhysicsSerializer } from './CanonicalPhysicsSerializer';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';

export class EngineeringPhysicsReasoner {
  public graph: EngineeringPhysicsGraph = new EngineeringPhysicsGraph();
  public context!: PhysicsContext;
  public predictions: PhysicsPrediction[] = [];
  public hypotheses: PhysicsHypothesis[] = [];
  public residuals: PhysicsResidual[] = [];

  constructor(context: PhysicsContext) {
    this.context = context;
    if (!this.context.contextHash) {
      this.context.contextHash = CanonicalPhysicsSerializer.computeContextHash(this.context);
    }
  }

  /**
   * Proposes a physics hypothesis (State remains PROPOSED until verified).
   */
  public proposeHypothesis(statement: string, assumptions: string[] = []): PhysicsHypothesis {
    const rawHyp: Omit<PhysicsHypothesis, 'hypothesisId'> = {
      statement,
      domain: this.context.domain,
      contextHash: this.context.contextHash!,
      assumptions,
      supportingEvidence: [],
      contradictingEvidence: [],
      confidence: 0.85,
      status: 'PROPOSED'
    };

    const hypId = `HYP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const hyp: PhysicsHypothesis = {
      hypothesisId: hypId,
      ...rawHyp
    };

    this.hypotheses.push(hyp);
    return hyp;
  }

  /**
   * Evaluates AI prediction against analytical/solver/experimental references and physical constraints.
   */
  public evaluatePredictionAndConstraints(
    prediction: PhysicsPrediction,
    reference?: { type: 'ANALYTICAL' | 'NUMERICAL_SOLVER' | 'EXPERIMENTAL'; value: number; tolerance?: number; uncertainty?: number },
    options?: {
      quantityType?: any;
      equationExpr?: string;
      varQuantities?: Record<string, any>;
      conservationCheck?: { input: number; output: number; source?: number; tolerance?: number };
      solverConverged?: boolean;
    },
    twinEvidenceEngine?: TwinEvidenceGraphEngine
  ): {
    evidence: PhysicsReasoningEvidence;
    admissible: boolean;
  } {
    // 1. Constraint Check
    const constCheck = PhysicsConstraintEngine.evaluatePhysicsConstraints(
      prediction,
      this.context,
      options
    );

    let finalVerdict: PhysicsReasoningVerdict = constCheck.verdict;
    const computedResiduals: PhysicsResidual[] = [];

    // 2. Residual calculation if reference provided
    if (reference) {
      const res = PhysicsResidualEngine.calculateResidual({
        predictionId: prediction.predictionId,
        predictedValue: prediction.predictedValue,
        referenceType: reference.type,
        referenceValue: reference.value,
        tolerance: reference.tolerance || 0.01,
        measurementUncertainty: reference.uncertainty
      });
      computedResiduals.push(res);
      this.residuals.push(res);

      if (res.verdict === 'RESIDUAL_EXCEEDED' && constCheck.admissible) {
        finalVerdict = 'NOT_VERIFIED';
      }
    }

    if (!constCheck.admissible) {
      finalVerdict = constCheck.verdict;
    }

    const rawEvidence: Omit<PhysicsReasoningEvidence, 'evidenceHash'> = {
      evidenceId: `PHY-EVID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      claim: `Prediction for variable ${prediction.variable} = ${prediction.predictedValue} ${prediction.unit}`,
      physicsContextHash: this.context.contextHash!,
      modelId: 'EngineeringPhysicsReasoner-v1',
      modelVersion: prediction.modelVersion,
      inputs: { predictedValue: prediction.predictedValue, unit: prediction.unit },
      assumptions: options?.equationExpr ? ['continuum'] : [],
      equations: options?.equationExpr ? [options.equationExpr] : [],
      predictions: [prediction],
      references: reference ? { type: reference.type, value: reference.value } : {},
      residuals: computedResiduals,
      constraints: [constCheck.details],
      verdict: finalVerdict,
      timestamp: new Date().toISOString()
    };

    const evidenceHash = CanonicalPhysicsSerializer.computeEvidenceHash(rawEvidence);
    const evidence: PhysicsReasoningEvidence = {
      ...rawEvidence,
      evidenceHash
    };

    // Integrate with Twin Evidence Graph
    if (twinEvidenceEngine) {
      twinEvidenceEngine.addNode(
        `PHY-REASON-${evidence.evidenceId}`,
        'PREDICTION',
        evidence.evidenceId,
        'v1',
        'EngineeringPhysicsReasoner',
        evidence.timestamp,
        {
          claim: evidence.claim,
          verdict: evidence.verdict,
          evidenceHash: evidence.evidenceHash,
          physicsContextHash: this.context.contextHash
        }
      );
    }

    return {
      evidence,
      admissible: constCheck.admissible && finalVerdict === 'VERIFIED'
    };
  }

  /**
   * Counterfactual Scenario Reasoning (Isolated from production state)
   */
  public evaluateCounterfactualScenario(
    scenario: Omit<PhysicsScenario, 'scenarioId' | 'scenarioHash'>
  ): {
    scenario: PhysicsScenario;
    predictedOutcome: string;
  } {
    const scenarioPayload = JSON.stringify(scenario);
    const scenarioHash = CanonicalPhysicsSerializer.sha256(scenarioPayload);
    const scenarioId = `SCENARIO-${Date.now()}`;

    const fullScenario: PhysicsScenario = {
      scenarioId,
      scenarioHash,
      ...scenario
    };

    return {
      scenario: fullScenario,
      predictedOutcome: `COUNTERFACTUAL_PREDICTION: Isolated evaluation completed for scenario ${scenarioHash.slice(0, 8)}`
    };
  }
}
