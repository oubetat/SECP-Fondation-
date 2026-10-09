import { AnalyticalSurface321A, SurfaceType321A, AnalyticalReconstructionSettings321A } from './AnalyticalSurfaceTypes321A';
import { SurfaceFitter321A, FittingResult } from './SurfaceFitter321A';
import { ScanMeshDataset } from '../mesh/ScanMeshTypes318';
import { EvidenceBus314 } from '../../engineering_ai/copilot/EvidenceBus314';

export interface MeshSessionContext321A {
  parentMesh: {
    meshId: string;
    globalCoordinateFrame?: string;
  };
}

export interface SegmentVertex321A {
  position: [number, number, number] | number[];
  normal: [number, number, number] | number[];
  id?: string | number;
  sourceType?: string;
  confidence?: number;
}

export interface Segment321A {
  segmentId?: string;
  vertices: Array<SegmentVertex321A>;
  faceIndices?: number[];
}

export class AnalyticalReconstructionEngine321A {
  private static instance: AnalyticalReconstructionEngine321A;
  private evidenceBus: EvidenceBus314;

  private constructor() {
    this.evidenceBus = EvidenceBus314.getInstance();
  }

  public static getInstance(): AnalyticalReconstructionEngine321A {
    if (!AnalyticalReconstructionEngine321A.instance) {
      AnalyticalReconstructionEngine321A.instance = new AnalyticalReconstructionEngine321A();
    }
    return AnalyticalReconstructionEngine321A.instance;
  }

  public reconstructSurface(
    session: MeshSessionContext321A | { parentMesh: ScanMeshDataset },
    segment: Segment321A,
    settings: AnalyticalReconstructionSettings321A
  ): AnalyticalSurface321A | null {
    const segId = segment.segmentId || 'default-segment';
    
    this.evidenceBus.registerEvidence(
      'AnalyticalReconstructionEngine321A',
      `surf-${segId}`,
      'REVISION-321A',
      'FITTING_STARTED',
      { segmentId: segId, vertexCount: segment.vertices.length },
      'UNVERIFIED'
    );

    if (segment.vertices.length < settings.minPointsRequired) {
      this.evidenceBus.registerEvidence(
        'AnalyticalReconstructionEngine321A',
        `surf-${segId}`,
        'REVISION-321A',
        'FITTING_FAILED',
        { reason: 'INSUFFICIENT_GEOMETRY' },
        'INVALID'
      );
      return null;
    }

    const points: [number, number, number][] = segment.vertices.map((v) => [v.position[0], v.position[1], v.position[2]]);
    const normals: [number, number, number][] = segment.vertices.map((v) => [v.normal[0], v.normal[1], v.normal[2]]);

    // Bounding box size to detect degenerate large radii
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
    }
    const bboxSize = Math.sqrt((maxX-minX)**2 + (maxY-minY)**2 + (maxZ-minZ)**2);
    const MAX_RADIUS = bboxSize * 100;

    const fits = new Map<SurfaceType321A, FittingResult>();

    fits.set('PLANE', SurfaceFitter321A.fitPlane(points));
    fits.set('SPHERE', SurfaceFitter321A.fitSphere(points));
    fits.set('CYLINDER', SurfaceFitter321A.fitCylinder(points, normals));
    fits.set('CONE', SurfaceFitter321A.fitCone(points, normals));

    // Filter invalid and geometrically unstable fits
    let bestType: SurfaceType321A | null = null;
    let bestFit: FittingResult | null = null;
    let bestScore = Infinity;

    for (const [type, fit] of fits.entries()) {
      if (!fit.valid) continue;
      
      // Reject fits that exceed hard tolerances
      if (fit.rmsResidual > settings.maxRmsToleranceMm || fit.maxResidual > settings.maxErrorToleranceMm) {
        continue;
      }

      // Reject degenerate large radii which are just planes in disguise
      if (type === 'SPHERE' || type === 'CYLINDER') {
        if (fit.parameters.radius > MAX_RADIUS) continue;
        if (fit.parameters.radius < 1e-4) continue;
      }
      if (type === 'CONE') {
        if (fit.parameters.halfAngleDeg < 1 || fit.parameters.halfAngleDeg > 89) continue;
      }

      // Model Selection Score: RMS heavily weighted, but slight penalty for complexity.
      // NOTE: This is an Engineering Heuristic (not a formal AIC/BIC model selection).
      // Complexity penalties are assigned to prevent over-fitting simple regions to complex models.
      let complexityPenalty = 1.0;
      if (type === 'CYLINDER' || type === 'SPHERE') complexityPenalty = 1.1;
      if (type === 'CONE') complexityPenalty = 1.2;

      const score = fit.rmsResidual * complexityPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        bestFit = fit;
      }
    }

    if (!bestType || !bestFit) {
      this.evidenceBus.registerEvidence(
        'AnalyticalReconstructionEngine321A',
        `surf-${segment.segmentId}`,
        'REVISION-321A',
        'FITTING_FAILED',
        { reason: 'NO_VALID_MODEL' },
        'INVALID'
      );
      return null;
    }

    const surfaceId = `surf-${segment.segmentId}-${Date.now()}`;

    const analyticalSurface: AnalyticalSurface321A = {
      surfaceId,
      sourceRegionId: segment.segmentId,
      surfaceType: bestType,
      coordinateFrame: session.parentMesh.globalCoordinateFrame,
      units: 'mm',
      parameters: bestFit.parameters,
      fittingMethod: 'LEAST_SQUARES_PCA',
      sampleCount: points.length,
      rmsResidual: parseFloat(bestFit.rmsResidual.toFixed(6)),
      maxResidual: parseFloat(bestFit.maxResidual.toFixed(6)),
      residualStatistics: {
        mean: parseFloat(bestFit.rmsResidual.toFixed(6)), // approx
        stdDev: 0,
        percentile90: parseFloat(bestFit.maxResidual.toFixed(6))
      },
      confidence: 1.0 - (bestFit.rmsResidual / settings.maxRmsToleranceMm),
      validationStatus: 'VALID',
      provenance: {
        parentMeshId: session.parentMesh.meshId,
        parentRegionId: segment.segmentId,
        fittingAlgorithm: 'AnalyticalReconstructionEngine321A_LeastSquares',
        timestamp: new Date().toISOString(),
        vertexIndices: segment.vertices.map((v, idx) => {
          if (typeof v.id === 'number' && Number.isFinite(v.id)) {
            return v.id;
          }
          if (typeof v.id === 'string') {
            const parsed = Number(v.id);
            if (Number.isFinite(parsed)) {
              return parsed;
            }
          }
          throw new Error(`Invalid vertex ID at index ${idx}: ${v.id}. Vertex ID must be a valid numeric index.`);
        })
      }
    };

    this.evidenceBus.registerEvidence(
      'AnalyticalReconstructionEngine321A',
      surfaceId,
      'REVISION-321A',
      'FITTING_COMPLETED',
      {
        type: bestType,
        rmsResidual: analyticalSurface.rmsResidual,
        sampleCount: analyticalSurface.sampleCount
      },
      'VALIDATED'
    );

    return analyticalSurface;
  }
}
