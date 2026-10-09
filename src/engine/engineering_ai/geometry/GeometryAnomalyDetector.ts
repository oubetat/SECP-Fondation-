import {
  GeometryEntityDescriptor,
  GeometryAnomalyRecord,
  GeometryContext
} from './types';

export class GeometryAnomalyDetector {
  public static detectAnomalies(
    entities: GeometryEntityDescriptor[],
    context: GeometryContext
  ): GeometryAnomalyRecord[] {
    const anomalies: GeometryAnomalyRecord[] = [];

    for (const entity of entities) {
      // 1. Check for tiny/sliver faces
      const bbox = entity.boundingBox;
      const dx = Math.abs(bbox.max[0] - bbox.min[0]);
      const dy = Math.abs(bbox.max[1] - bbox.min[1]);
      const dz = Math.abs(bbox.max[2] - bbox.min[2]);

      const minDim = Math.min(dx, dy, dz);
      const tol = context.toleranceProfile.linearTolerance;

      if (minDim > 0 && minDim < tol * 10) {
        anomalies.push({
          anomalyId: `ANO-SLIVER-${entity.entityId}`,
          entityId: entity.entityId,
          anomalyType: 'SLIVER_FACE',
          severity: 'MEDIUM',
          verdict: 'SUSPECTED',
          details: `Feature dimension ${minDim.toFixed(6)} ${context.units} is dangerously close to manufacturing linear tolerance ${tol} ${context.units}`
        });
      }

      // 2. Check for invalid topology flag
      if (entity.parameters.isOpenShell || entity.parameters.isNonManifold) {
        anomalies.push({
          anomalyId: `ANO-TOPOLOGY-${entity.entityId}`,
          entityId: entity.entityId,
          anomalyType: entity.parameters.isOpenShell ? 'OPEN_SHELL' : 'NON_MANIFOLD',
          severity: 'HIGH',
          verdict: 'KERNEL_REJECTED',
          details: 'B-Rep Kernel reported invalid solid topology (open shell or non-manifold edges).'
        });
      }
    }

    return anomalies;
  }
}
