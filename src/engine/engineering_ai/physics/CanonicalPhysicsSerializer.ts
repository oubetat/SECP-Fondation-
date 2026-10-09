import * as crypto from 'crypto';
import {
  PhysicsContext,
  PhysicsHypothesis,
  PhysicsPrediction,
  PhysicsReasoningEvidence,
  PhysicsAnomalyRecord
} from './types';

export class CanonicalPhysicsSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static computeContextHash(ctx: Omit<PhysicsContext, 'contextHash'>): string {
    const payload = [
      ctx.contextId,
      ctx.domain,
      ctx.geometryHash,
      ctx.meshHash,
      ctx.materialStateHash,
      ctx.boundaryConditionHash,
      ctx.initialConditionHash,
      ctx.solverConfigurationHash,
      ctx.coordinateSystem,
      ctx.units,
      ctx.referenceFrame,
      ctx.physicsModel
    ].join('|');

    return this.sha256(payload);
  }

  public static computeHypothesisHash(hyp: Omit<PhysicsHypothesis, 'hypothesisId'>): string {
    const payload = [
      hyp.statement,
      hyp.domain,
      hyp.contextHash,
      [...hyp.assumptions].sort().join(','),
      hyp.confidence,
      hyp.status
    ].join('|');

    return this.sha256(payload);
  }

  public static computePredictionHash(pred: Omit<PhysicsPrediction, 'predictionId'>): string {
    const payload = [
      pred.variable,
      pred.predictedValue.toFixed(6),
      pred.unit,
      pred.uncertainty,
      pred.confidence,
      pred.contextHash,
      pred.modelVersion
    ].join('|');

    return this.sha256(payload);
  }

  public static computeEvidenceHash(ev: Omit<PhysicsReasoningEvidence, 'evidenceHash'>): string {
    const payload = [
      ev.evidenceId,
      ev.claim,
      ev.physicsContextHash,
      ev.modelId,
      ev.modelVersion,
      JSON.stringify(ev.inputs),
      [...ev.assumptions].sort().join(','),
      [...ev.equations].sort().join(','),
      ev.verdict,
      ev.timestamp
    ].join('||');

    return this.sha256(payload);
  }

  public static computeAnomalyHash(ano: Omit<PhysicsAnomalyRecord, 'evidenceHash'>): string {
    const payload = [
      ano.anomalyId,
      ano.contextHash,
      ano.fieldHash,
      ano.detectorVersion,
      ano.metric,
      ano.threshold,
      ano.observedValue,
      ano.verdict,
      ano.details
    ].join('|');

    return this.sha256(payload);
  }
}
