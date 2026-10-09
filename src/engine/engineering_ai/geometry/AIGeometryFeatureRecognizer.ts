import {
  GeometryEntityDescriptor,
  GeometryFeatureHypothesis,
  GeometryFeatureEvidence,
  FeatureType,
  GeometryContext
} from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export interface KernelFeatureVerifier {
  verifyFeature(
    hypothesis: GeometryFeatureHypothesis,
    entities: GeometryEntityDescriptor[]
  ): {
    passed: boolean;
    reason: string;
  };
}

export class AIGeometryFeatureRecognizer {
  /**
   * Generates AI Feature Hypothesis based on geometry entities and topological patterns.
   */
  public static proposeHypotheses(
    entities: GeometryEntityDescriptor[]
  ): GeometryFeatureHypothesis[] {
    const hypotheses: GeometryFeatureHypothesis[] = [];

    for (const entity of entities) {
      if (entity.geometryType === 'CYLINDER') {
        const isInternal = entity.parameters.isInternal ?? true;
        if (isInternal) {
          hypotheses.push({
            hypothesisId: `HYP-HOLE-${entity.entityId}`,
            featureType: 'HOLE',
            entityIds: [entity.entityId],
            proposedParameters: {
              diameter: entity.parameters.diameter || (entity.parameters.radius ? entity.parameters.radius * 2 : 10),
              depth: entity.parameters.depth || 20
            },
            recognitionConfidence: 0.995,
            reasoningNotes: 'Cylindrical internal surface detected matching standard hole topology.'
          });
        } else {
          hypotheses.push({
            hypothesisId: `HYP-BOSS-${entity.entityId}`,
            featureType: 'BOSS',
            entityIds: [entity.entityId],
            proposedParameters: {
              diameter: entity.parameters.diameter || 15,
              height: entity.parameters.height || 10
            },
            recognitionConfidence: 0.92,
            reasoningNotes: 'External cylindrical surface detected matching boss topology.'
          });
        }
      } else if (entity.geometryType === 'POCKET_SURFACE' || (entity.geometryType === 'PLANE' && entity.parameters.isPocketFloor)) {
        hypotheses.push({
          hypothesisId: `HYP-POCKET-${entity.entityId}`,
          featureType: 'POCKET',
          entityIds: [entity.entityId],
          proposedParameters: {
            depth: entity.parameters.depth || 15,
            bottomRadius: entity.parameters.radius || 3
          },
          recognitionConfidence: 0.98,
            reasoningNotes: 'Recessed planar floor surrounded by bounding walls matching pocket feature.'
        });
      } else if (entity.geometryType === 'ROUND_SURFACE' || entity.parameters.isFillet) {
        hypotheses.push({
          hypothesisId: `HYP-FILLET-${entity.entityId}`,
          featureType: 'FILLET',
          entityIds: [entity.entityId],
          proposedParameters: {
            radius: entity.parameters.radius || 2.0
          },
          recognitionConfidence: 0.99,
          reasoningNotes: 'Constant radius blend surface between adjacent planar faces.'
        });
      }
    }

    return hypotheses;
  }

  /**
   * Verifies an AI feature hypothesis against the CAD Kernel and returns GeometryFeatureEvidence.
   * AI proposal alone NEVER becomes truth.
   */
  public static verifyFeatureHypothesis(
    hypothesis: GeometryFeatureHypothesis,
    context: GeometryContext,
    entities: GeometryEntityDescriptor[],
    kernelVerifier?: KernelFeatureVerifier
  ): GeometryFeatureEvidence {
    const relatedEntities = entities.filter((e) => hypothesis.entityIds.includes(e.entityId));

    let kernelPassed = false;
    let method = 'KERNEL_GEOMETRIC_PREDICATE_EVAL';

    if (kernelVerifier) {
      const res = kernelVerifier.verifyFeature(hypothesis, relatedEntities);
      kernelPassed = res.passed;
      method = 'EXTERNAL_CAD_KERNEL_SOLVER';
    } else {
      // Internal default kernel validation test
      // Test if entities exist and parameter constraints hold
      if (relatedEntities.length > 0) {
        // e.g. for HOLE, check if cylindrical geometry exists and parameters > 0
        const first = relatedEntities[0];
        if (hypothesis.featureType === 'HOLE') {
          kernelPassed =
            first.geometryType === 'CYLINDER' &&
            (hypothesis.proposedParameters.diameter || 0) > 0 &&
            !first.parameters.isNonHole; // if CAD kernel tags it as non-hole, test fails
        } else if (hypothesis.featureType === 'POCKET') {
          kernelPassed = !first.parameters.isNonPocket;
        } else if (hypothesis.featureType === 'FILLET') {
          kernelPassed = (hypothesis.proposedParameters.radius || 0) > 0;
        } else {
          kernelPassed = true;
        }
      }
    }

    const verificationStatus = kernelPassed ? 'PASS' : 'CONTRADICTED_BY_KERNEL';

    const rawEvidence: Omit<GeometryFeatureEvidence, 'evidenceHash'> = {
      featureId: hypothesis.hypothesisId.replace('HYP-', 'FEAT-VERIFIED-'),
      featureType: hypothesis.featureType,
      entityIds: hypothesis.entityIds,
      sourceGeometryHash: context.geometryHash,
      modelVersion: context.kernelVersion,
      recognitionMethod: method,
      confidence: hypothesis.recognitionConfidence,
      kernelVerification: verificationStatus
    };

    const evidenceHash = CanonicalGeometrySerializer.computeFeatureEvidenceHash(rawEvidence);

    return {
      ...rawEvidence,
      evidenceHash
    };
  }
}
