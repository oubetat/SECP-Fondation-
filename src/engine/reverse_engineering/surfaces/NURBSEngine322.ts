
import { NURBSSurface322, NURBSSurfaceData322 } from './NURBSTypes322';
import { AnalyticalSurface321A } from './AnalyticalSurfaceTypes321A';
import { NURBSReconstructor322 } from './NURBSReconstructor322';
import { NURBSUtils322 } from './NURBSUtils322';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';
import { MathUtils321A } from './MathUtils321A';

export class NURBSEngine322 {
  private static instance: NURBSEngine322;
  private evidenceBus: EvidenceBus314;

  private constructor() {
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public static getInstance(): NURBSEngine322 {
    if (!NURBSEngine322.instance) {
      NURBSEngine322.instance = new NURBSEngine322();
    }
    return NURBSEngine322.instance;
  }

  public reconstructNURBS(analyticalSurface: AnalyticalSurface321A): NURBSSurface322 | null {
    console.log('Reconstructing NURBS for:', JSON.stringify(analyticalSurface.parameters));
    this.evidenceBus.registerEvidence(
      'NURBSEngine322',
      `nurbs-${analyticalSurface.surfaceId}`,
      'REVISION-322',
      'NURBS_RECONSTRUCTION_STARTED',
      { sourceSurfaceId: analyticalSurface.surfaceId, type: analyticalSurface.surfaceType },
      'UNVERIFIED'
    );

    const data = NURBSReconstructor322.reconstruct(analyticalSurface);
    if (!data) {
      this.evidenceBus.registerEvidence(
        'NURBSEngine322',
        `nurbs-${analyticalSurface.surfaceId}`,
        'REVISION-322',
        'NURBS_RECONSTRUCTION_FAILED',
        { reason: 'UNSUPPORTED_TYPE' },
        'INVALID'
      );
      return null;
    }

    // Independent Validation
    const { maxDeviation, rmsDeviation } = this.validateNURBS(data, analyticalSurface);

    const nurbsSurface: NURBSSurface322 = {
      surfaceId: `nurbs-${analyticalSurface.surfaceId}-${Date.now()}`,
      sourceSurfaceId: analyticalSurface.surfaceId,
      data,
      reconstructionMethod: 'EXACT_ANALYTICAL_CONVERSION',
      maxDeviationMm: maxDeviation,
      rmsDeviationMm: rmsDeviation,
      confidence: 1.0 - (rmsDeviation / 0.1), // assume 0.1mm is the tolerance
      validationStatus: rmsDeviation < 0.05 ? 'VALID' : 'SUSPECT',
      provenance: {
        parentMeshId: analyticalSurface.provenance.parentMeshId,
        parentRegionId: analyticalSurface.provenance.parentRegionId,
        sourceSurfaceType: analyticalSurface.surfaceType,
        timestamp: new Date().toISOString()
      }
    };

    this.evidenceBus.registerEvidence(
      'NURBSEngine322',
      nurbsSurface.surfaceId,
      'REVISION-322',
      'NURBS_RECONSTRUCTION_COMPLETED',
      {
        surfaceType: analyticalSurface.surfaceType,
        maxDeviation: nurbsSurface.maxDeviationMm,
        rmsDeviation: nurbsSurface.rmsDeviationMm
      },
      nurbsSurface.validationStatus === 'VALID' ? 'VALIDATED' : 'SUSPECT'
    );

    return nurbsSurface;
  }

  private validateNURBS(data: NURBSSurfaceData322, analytical: AnalyticalSurface321A): { maxDeviation: number, rmsDeviation: number } {
    let maxDev = 0;
    let sumSqDev = 0;
    const samples = 10; // 10x10 grid

    for (let i = 0; i <= samples; i++) {
      for (let j = 0; j <= samples; j++) {
        const u = i / samples;
        const v = j / samples;
        const result = NURBSUtils322.evaluateSurface(data, u, v);
        
        // Calculate distance from NURBS point to analytical surface
        const dist = this.distanceToAnalytical(result.point, analytical);
        
        if (dist > 1e-3) {
          console.log(`Failing sample at u=${u}, v=${v}: [${result.point}], dist=${dist}`);
        }

        maxDev = Math.max(maxDev, dist);
        sumSqDev += dist * dist;
      }
    }

    return {
      maxDeviation: maxDev,
      rmsDeviation: Math.sqrt(sumSqDev / ((samples + 1) * (samples + 1)))
    };
  }

  private distanceToAnalytical(point: [number, number, number], surface: AnalyticalSurface321A): number {
    const p = surface.parameters;
    switch (surface.surfaceType) {
      case 'PLANE': {
        const normal = p.normal || [0, 0, 1];
        const planeD = p.d !== undefined 
          ? p.d 
          : (p.centroid ? -MathUtils321A.dotProduct(normal, p.centroid) : 0);
        const dist = Math.abs(MathUtils321A.dotProduct(normal, point) + planeD);
        return dist;
      }
      case 'SPHERE': {
        const center = p.center || [0, 0, 0];
        const radius = p.radius !== undefined ? p.radius : 1;
        const dx = point[0] - center[0];
        const dy = point[1] - center[1];
        const dz = point[2] - center[2];
        const dist = Math.abs(Math.sqrt(dx*dx + dy*dy + dz*dz) - radius);
        return dist;
      }
      case 'CYLINDER': {
        const axisOrigin = p.axisOrigin || [0, 0, 0];
        const axisDirection = p.axisDirection || [0, 0, 1];
        const radius = p.radius !== undefined ? p.radius : 1;
        const distToAxis = MathUtils321A.distancePointToLine(point, axisOrigin, axisDirection);
        return Math.abs(distToAxis - radius);
      }
      case 'CONE': {
        const apex = p.apex || [0, 0, 0];
        const axis = p.axisDirection || [0, 0, 1];
        const halfAngleRad = (p.halfAngleDeg !== undefined ? p.halfAngleDeg : 45) * Math.PI / 180;
        
        const v = [point[0] - apex[0], point[1] - apex[1], point[2] - apex[2]];
        const distToApex = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if (distToApex < 1e-9) return 0;
        const distToAxis = MathUtils321A.distancePointToLine(point, apex, axis);
        
        const expectedDistToAxis = distToApex * Math.sin(halfAngleRad);
        return Math.abs(distToAxis - expectedDistToAxis);
      }
      default:
        return Infinity;
    }
  }
}
