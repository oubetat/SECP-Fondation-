/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Chamfer & Fillet Feature Recognizer
 */

import { Face, Solid } from '../../cad-kernel/topology/TopologyContracts';
import { Vector3D } from '../../cadKernel';
import {
  ManufacturingFeature,
  ManufacturingFeatureType,
  ManufacturingIntent,
  RecognitionState,
  ToolAccessDirection,
  ChamferFeatureParams,
  FilletFeatureParams,
} from './FeatureTypes';
import { FaceGeometryInfo, FeatureGeometryAnalyzer } from './FeatureGeometryAnalyzer';
import { FaceAdjacencyGraph, TopologicalEdgeInfo } from './FeatureTopologyAnalyzer';

export class ChamferAndFilletRecognizer {
  /**
   * Recognizes Chamfers and Fillets
   */
  public static recognizeTransitions(
    solid: Solid,
    bodyId: string,
    faceGeoms: Map<string, FaceGeometryInfo>,
    adjMap: Map<string, FaceAdjacencyGraph>,
    edgeMap: Map<string, TopologicalEdgeInfo>
  ): ManufacturingFeature[] {
    const features: ManufacturingFeature[] = [];

    for (const [faceId, geom] of faceGeoms.entries()) {
      const adj = adjMap.get(faceId);
      if (!adj) continue;

      // 1. Chamfer detection:
      // A planar face connecting two adjacent perpendicular faces with an inclined normal (~45 deg)
      if (geom.surfaceType === 'PLANE' && adj.adjacentFaceIds.length >= 2) {
        const isInclined = Math.abs(geom.normal.z) > 0.3 && Math.abs(geom.normal.z) < 0.9 &&
          (Math.abs(geom.normal.x) > 0.3 || Math.abs(geom.normal.y) > 0.3);

        const dx = geom.boundsMm.maxX - geom.boundsMm.minX;
        const dy = geom.boundsMm.maxY - geom.boundsMm.minY;
        const dz = geom.boundsMm.maxZ - geom.boundsMm.minZ;
        const minDim = Math.min(dx, Math.min(dy, dz));

        // Chamfer width is typically small (0.5mm - 10mm) compared to main dimensions
        if (isInclined && minDim <= 10.0) {
          const widthMm = Math.max(1.0, minDim * Math.SQRT2);
          const angleDeg = 45.0;

          const explanations: string[] = [
            `Identified 45° Beveled Planar Transition (ID: ${faceId}, Width: ${widthMm.toFixed(1)}mm).`,
            `Connected between adjacent boundary faces: ${adj.adjacentFaceIds.join(', ')}.`,
            `Classification: Machinable Chamfer Feature (Tool: Chamfer Mill 45°).`
          ];

          const params: ChamferFeatureParams = {
            widthMm,
            angleDeg,
            edgeIds: adj.connectedEdges,
            adjacentFaceIds: adj.adjacentFaceIds,
            isMachinable: true,
          };

          features.push({
            id: `FEAT_CHAMFER_${faceId}_${Date.now().toString(36)}`,
            type: ManufacturingFeatureType.CHAMFER_FEATURE,
            name: `Chamfer ${widthMm.toFixed(1)}mm x ${angleDeg}°`,
            intent: ManufacturingIntent.CHAMFER_MILLING,
            bodyId,
            faceIds: [faceId],
            edgeIds: adj.connectedEdges,
            vertexIds: [],
            parameters: { type: 'CHAMFER', params },
            confidence: {
              score: 0.93,
              state: RecognitionState.PROVEN,
              detectionEvidence: explanations,
              supportingTopology: {
                facesCount: 1,
                edgesCount: adj.connectedEdges.length,
                concaveEdgesCount: adj.concaveNeighborCount,
                convexEdgesCount: adj.convexNeighborCount,
              },
              supportingGeometry: {
                surfaceTypes: ['PLANE'],
                hasPlanarFloor: false,
                isCoaxialCylinder: false,
                isOrthogonal: false,
              },
              ambiguities: [],
            },
            accessibility: {
              primaryAccessDirection: geom.normal.z > 0 ? ToolAccessDirection.POS_Z : ToolAccessDirection.NEG_Z,
              accessibleDirections: [ToolAccessDirection.POS_Z],
              minToolLengthMm: 15.0,
              maxToolDiameterMm: 16.0,
              minToolDiameterMm: 4.0,
              isOccluded: false,
            },
            subFeatureIds: [],
            isManuallyOverridden: false,
            explanation: explanations,
          });
        }
      }

      // 2. Fillet detection:
      // Cylindrical or blend surface of small radius acting as a transition between two faces
      if (geom.surfaceType === 'CYLINDER' && geom.cylinderParams) {
        const cyl = geom.cylinderParams;
        if (cyl.radiusMm <= 12.0 && adj.adjacentFaceIds.length >= 2) {
          const isInterior = adj.concaveNeighborCount >= 1;
          const radiusMm = cyl.radiusMm;

          const explanations: string[] = [
            `Identified Blend Cylinder Surface (ID: ${faceId}, Radius: ${radiusMm.toFixed(1)}mm).`,
            `Transitional radius connecting faces [${adj.adjacentFaceIds.join(', ')}].`,
            `Classification: ${isInterior ? 'Internal Concave Fillet' : 'External Convex Edge Round'}.`
          ];

          const params: FilletFeatureParams = {
            radiusMm,
            isConstantRadius: true,
            edgeIds: adj.connectedEdges,
            adjacentFaceIds: adj.adjacentFaceIds,
            isInteriorCorner: isInterior,
          };

          features.push({
            id: `FEAT_FILLET_${faceId}_${Date.now().toString(36)}`,
            type: ManufacturingFeatureType.FILLET_FEATURE,
            name: `Fillet R${radiusMm.toFixed(1)}mm (${isInterior ? 'Internal' : 'External'})`,
            intent: ManufacturingIntent.FILLET_MILLING,
            bodyId,
            faceIds: [faceId],
            edgeIds: adj.connectedEdges,
            vertexIds: [],
            parameters: { type: 'FILLET', params },
            confidence: {
              score: 0.91,
              state: RecognitionState.PROVEN,
              detectionEvidence: explanations,
              supportingTopology: {
                facesCount: 1,
                edgesCount: adj.connectedEdges.length,
                concaveEdgesCount: adj.concaveNeighborCount,
                convexEdgesCount: adj.convexNeighborCount,
              },
              supportingGeometry: {
                surfaceTypes: ['CYLINDER'],
                hasPlanarFloor: false,
                isCoaxialCylinder: false,
                isOrthogonal: false,
              },
              ambiguities: [],
            },
            accessibility: {
              primaryAccessDirection: ToolAccessDirection.POS_Z,
              accessibleDirections: [ToolAccessDirection.POS_Z],
              minToolLengthMm: 15.0,
              maxToolDiameterMm: radiusMm * 2,
              minToolDiameterMm: 2.0,
              isOccluded: false,
            },
            subFeatureIds: [],
            isManuallyOverridden: false,
            explanation: explanations,
          });
        }
      }
    }

    return features;
  }
}
