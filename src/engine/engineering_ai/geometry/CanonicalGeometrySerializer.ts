import * as crypto from 'crypto';
import {
  GeometryEntityDescriptor,
  GeometryContext,
  GeometryFeatureEvidence,
  GeometryChangeEvidence,
  GeometryReasoningEvidence
} from './types';

export class CanonicalGeometrySerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static computeEntityHash(entity: Omit<GeometryEntityDescriptor, 'hash'>): string {
    const payload = [
      entity.entityId,
      entity.entityType,
      entity.geometryType,
      entity.dimension,
      JSON.stringify(entity.boundingBox),
      JSON.stringify(entity.parameters),
      entity.kernelReference
    ].join('|');

    return this.sha256(payload);
  }

  public static computeGeometryHash(
    modelId: string,
    revision: string,
    entities: GeometryEntityDescriptor[],
    topologyVersion: string,
    units: string
  ): string {
    const sortedEntitiesStr = [...entities]
      .sort((a, b) => a.entityId.localeCompare(b.entityId))
      .map((e) => `${e.entityId}:${e.hash}`)
      .join(';');

    const payload = [
      modelId,
      revision,
      topologyVersion,
      units,
      sortedEntitiesStr
    ].join('||');

    return this.sha256(payload);
  }

  public static computeFeatureEvidenceHash(ev: Omit<GeometryFeatureEvidence, 'evidenceHash'>): string {
    const payload = [
      ev.featureId,
      ev.featureType,
      [...ev.entityIds].sort().join(','),
      ev.sourceGeometryHash,
      ev.modelVersion,
      ev.recognitionMethod,
      ev.confidence,
      ev.kernelVerification
    ].join('|');

    return this.sha256(payload);
  }

  public static computeChangeEvidenceHash(ev: Omit<GeometryChangeEvidence, 'evidenceHash'>): string {
    const payload = [
      ev.changeEvidenceId,
      ev.oldGeometryHash,
      ev.newGeometryHash,
      ev.changeType,
      ev.kernelComparison,
      JSON.stringify(ev.changedEntities)
    ].join('|');

    return this.sha256(payload);
  }

  public static computeReasoningEvidenceHash(ev: Omit<GeometryReasoningEvidence, 'evidenceHash'>): string {
    const payload = [
      ev.evidenceId,
      ev.claim,
      ev.geometryContext.geometryHash,
      [...ev.entityReferences].sort().join(','),
      ev.reasoningModel,
      ev.modelVersion,
      ev.kernelQuery,
      ev.kernelResult,
      ev.verdict,
      ev.timestamp
    ].join('|');

    return this.sha256(payload);
  }
}
