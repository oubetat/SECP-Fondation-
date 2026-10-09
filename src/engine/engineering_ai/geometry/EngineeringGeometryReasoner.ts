import {
  GeometryContext,
  GeometryEntityDescriptor,
  GeometryFeatureEvidence,
  GeometryReasoningEvidence,
  GeometryReasoningVerdict,
  GeometryToleranceProfile,
  GeometryQueryPlan
} from './types';
import { EngineeringGeometryGraph } from './EngineeringGeometryGraph';
import { SpatialReasoningEngine } from './SpatialReasoningEngine';
import { AIGeometryFeatureRecognizer, KernelFeatureVerifier } from './AIGeometryFeatureRecognizer';
import { GeometryHallucinationDetector, AIClaim, HallucinationCheckResult } from './GeometryHallucinationDetector';
import { GeometryReasoningQueryEngine } from './GeometryReasoningQueryEngine';
import { GeometryRevisionDiffEngine } from './GeometryRevisionDiffEngine';
import { GeometryDependencyReasoner } from './GeometryDependencyReasoner';
import { GeometryAnomalyDetector } from './GeometryAnomalyDetector';
import { GeometrySimilarityEngine } from './GeometrySimilarityEngine';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';

export class EngineeringGeometryReasoner {
  public graph: EngineeringGeometryGraph = new EngineeringGeometryGraph();
  public dependencyReasoner: GeometryDependencyReasoner = new GeometryDependencyReasoner();
  public context!: GeometryContext;
  public verifiedFeatures: GeometryFeatureEvidence[] = [];

  constructor(
    context: GeometryContext,
    entities: GeometryEntityDescriptor[] = []
  ) {
    this.context = context;
    for (const ent of entities) {
      this.graph.addEntity(ent);
    }
  }

  public setEntities(entities: GeometryEntityDescriptor[]): void {
    this.graph.clear();
    for (const ent of entities) {
      this.graph.addEntity(ent);
    }
  }

  /**
   * Recognizes candidate features and verifies each against CAD Kernel.
   */
  public recognizeAndVerifyFeatures(kernelVerifier?: KernelFeatureVerifier): GeometryFeatureEvidence[] {
    const entities = Array.from(this.graph.entities.values());
    const hypotheses = AIGeometryFeatureRecognizer.proposeHypotheses(entities);

    this.verifiedFeatures = [];
    for (const hyp of hypotheses) {
      const evidence = AIGeometryFeatureRecognizer.verifyFeatureHypothesis(
        hyp,
        this.context,
        entities,
        kernelVerifier
      );
      this.verifiedFeatures.push(evidence);
    }

    return this.verifiedFeatures;
  }

  /**
   * Queries geometry using structured plans compiled from natural language.
   */
  public queryGeometry(rawQuery: string) {
    const plan = GeometryReasoningQueryEngine.compileNaturalQuery(rawQuery);
    if (!plan.isValid) {
      return {
        plan,
        matchedEntities: [],
        matchedFeatures: [],
        unitConverted: false,
        details: plan.validationError || 'Invalid Query'
      };
    }

    return GeometryReasoningQueryEngine.executeQuery(
      plan,
      this.graph,
      this.verifiedFeatures,
      this.context
    );
  }

  /**
   * Evaluates AI claim grounding and returns evidence record.
   */
  public evaluateClaimAndGrounding(
    claim: AIClaim,
    evidenceEngine?: TwinEvidenceGraphEngine
  ): {
    hallucinationCheck: HallucinationCheckResult;
    evidence: GeometryReasoningEvidence;
  } {
    const entities = Array.from(this.graph.entities.values());
    const hallucinationCheck = GeometryHallucinationDetector.verifyClaimGrounding(
      claim,
      entities,
      this.verifiedFeatures,
      this.context
    );

    let verdict: GeometryReasoningVerdict = 'INVALID';
    if (hallucinationCheck.verdict === 'GROUNDED') {
      verdict = 'VERIFIED';
    } else if (hallucinationCheck.verdict === 'CONTRADICTED_BY_KERNEL') {
      verdict = 'KERNEL_REJECTED';
    } else if (hallucinationCheck.verdict === 'UNGROUNDED') {
      verdict = 'INSUFFICIENT_EVIDENCE';
    }

    const rawEvidence: Omit<GeometryReasoningEvidence, 'evidenceHash'> = {
      evidenceId: `GEO-EVID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      claim: claim.claimText,
      geometryContext: this.context,
      entityReferences: claim.mentionedEntityIds || [],
      reasoningModel: 'EngineeringGeometryReasoner-v1',
      modelVersion: 'v1.0',
      kernelQuery: `CHECK_GROUNDING(${claim.mentionedEntityIds?.join(',') || 'ALL'})`,
      kernelResult: hallucinationCheck.details,
      confidence: verdict === 'VERIFIED' ? 0.99 : 0.1,
      verdict,
      timestamp: new Date().toISOString()
    };

    const evidenceHash = CanonicalGeometrySerializer.computeReasoningEvidenceHash(rawEvidence);
    const evidence: GeometryReasoningEvidence = { ...rawEvidence, evidenceHash };

    // Integrate into Twin Evidence Graph (PATCH-130)
    if (evidenceEngine) {
      const nodeId = `GEO-REASON-${evidence.evidenceId}`;
      evidenceEngine.addNode(
        nodeId,
        'PREDICTION',
        evidence.evidenceId,
        'v1',
        'EngineeringGeometryReasoner',
        evidence.timestamp,
        {
          claim: evidence.claim,
          verdict: evidence.verdict,
          evidenceHash: evidence.evidenceHash,
          geometryHash: this.context.geometryHash
        }
      );
    }

    return { hallucinationCheck, evidence };
  }
}
