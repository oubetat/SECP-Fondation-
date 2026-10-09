/**
 * SECP CAD Kernel — Canonical Surface Evaluator
 */

import { FeatureNode } from '../history/FeatureNode';
import { EngineeringDocument } from '../document/CADDocument';
import { SurfaceEngine } from '../../cad/surface/SurfaceEngine';
import { FeatureType } from '../history/FeatureDefinition';
import { EvidenceRecord } from '../document/CADDocument';

export class SurfaceEvaluator {
  /**
   * Evaluates a Surface Feature Node and produces B-Rep geometry.
   */
  public static evaluate(
    node: FeatureNode,
    doc: EngineeringDocument
  ): any {
    const type = node.type;
    const params = node.parameters;

    let result: any;

    try {
      switch (type) {
        case 'PLANAR_SURFACE':
          result = SurfaceEngine.evaluatePlanar(this.resolveCurves(params.boundaryReferences, doc));
          break;
        case 'REVOLVED_SURFACE':
          result = SurfaceEngine.evaluateRevolve(
            this.resolveCurve(params.profileReference, doc),
            params.axisOrigin || { x: 0, y: 0, z: 0 },
            params.axisDir || { x: 0, y: 0, z: 1 },
            params.angleDeg
          );
          break;
        case 'SWEPT_SURFACE':
          result = SurfaceEngine.evaluateSweep(
            this.resolveCurve(params.profileReference, doc),
            this.resolveCurve(params.pathReference, doc),
            params
          );
          break;
        case 'LOFT_SURFACE':
          result = SurfaceEngine.evaluateLoft(this.resolveCurves(params.sectionReferences, doc), params);
          break;
        case 'BOUNDARY_SURFACE':
          result = SurfaceEngine.evaluatePlanar(this.resolveCurves(params.boundaryReferences, doc)); // Fallback or dedicated
          break;
        case 'FILL_SURFACE':
          result = SurfaceEngine.evaluateFill(this.resolveCurves(params.boundaryReferences, doc), params);
          break;
        case 'OFFSET_SURFACE':
          result = SurfaceEngine.evaluateOffset(this.resolveSurface(params.faceReferences[0], doc), params.distance);
          break;
        case 'TRIM_SURFACE':
          result = SurfaceEngine.evaluateTrim(
            this.resolveSurface(params.targetFaceReferences[0], doc),
            this.resolveCurve(params.trimToolReference, doc),
            params.keepSide
          );
          break;
        case 'KNIT_SURFACE':
          result = SurfaceEngine.knitSurfaces(this.resolveSurfaces(params.surfaceReferences, doc), params.tolerance || 1e-4);
          break;
        case 'SEW_SURFACE':
          result = SurfaceEngine.sewSurfaces(this.resolveSurfaces(params.surfaceReferences, doc), params.tolerance || 1e-4);
          break;
        default:
          throw new Error(`Unsupported surface feature type: ${type}`);
      }

      this.recordEvidence(node, doc, 'PASS');
      return result;
    } catch (error: any) {
      this.recordEvidence(node, doc, 'FAIL', error.message);
      throw error;
    }
  }

  private static resolveCurve(ref: any, doc: EngineeringDocument): any {
    // Logic to find curve from sketch or other feature output
    return {}; // Placeholder
  }

  private static resolveCurves(refs: any[], doc: EngineeringDocument): any[] {
    return refs.map(ref => this.resolveCurve(ref, doc));
  }

  private static resolveSurface(ref: any, doc: EngineeringDocument): any {
    return {}; // Placeholder
  }

  private static resolveSurfaces(refs: any[], doc: EngineeringDocument): any[] {
    return refs.map(ref => this.resolveSurface(ref, doc));
  }

  private static recordEvidence(node: FeatureNode, doc: EngineeringDocument, verdict: 'PASS' | 'FAIL', message?: string) {
    const record: EvidenceRecord = {
      evidenceId: `EVID_SURF_${Date.now()}_${node.id}`,
      stage: 'GEOMETRY',
      sourceSystem: 'SECP_SURFACE_EVALUATOR',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: node.definitionHash,
      timestamp: new Date().toISOString(),
      payload: { featureId: node.id, featureType: node.type, message },
      verdict
    };
    doc.evidence.push(record);
  }
}
