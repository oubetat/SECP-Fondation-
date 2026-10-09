/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Step Feature Recognizer
 */

import { Face, Solid } from '../../cad-kernel/topology/TopologyContracts';
import { Vector3D } from '../../cadKernel';
import {
  ManufacturingFeature,
  ManufacturingFeatureType,
  ManufacturingIntent,
  RecognitionState,
  ToolAccessDirection,
  StepFeatureParams,
} from './FeatureTypes';
import { FaceGeometryInfo, FeatureGeometryAnalyzer } from './FeatureGeometryAnalyzer';
import { FaceAdjacencyGraph, TopologicalEdgeInfo } from './FeatureTopologyAnalyzer';

export class StepFeatureRecognizer {
  /**
   * Recognizes internal and external Step features
   */
  public static recognizeSteps(
    solid: Solid,
    bodyId: string,
    faceGeoms: Map<string, FaceGeometryInfo>,
    adjMap: Map<string, FaceAdjacencyGraph>,
    edgeMap: Map<string, TopologicalEdgeInfo>
  ): ManufacturingFeature[] {
    const features: ManufacturingFeature[] = [];
    const processedFaceIds = new Set<string>();

    for (const [faceId, geom] of faceGeoms.entries()) {
      if (processedFaceIds.has(faceId) || geom.surfaceType !== 'PLANE') continue;

      const adj = adjMap.get(faceId);
      if (!adj) continue;

      // Look for a riser face that connects this face (e.g. lower face) to an upper parallel face
      for (const riserId of adj.adjacentFaceIds) {
        const riserGeom = faceGeoms.get(riserId);
        if (!riserGeom || riserGeom.surfaceType !== 'PLANE') continue;

        // Riser must be perpendicular to current face
        if (!FeatureGeometryAnalyzer.arePerpendicular(geom.normal, riserGeom.normal, 0.15)) continue;

        const riserAdj = adjMap.get(riserId);
        if (!riserAdj) continue;

        for (const upperId of riserAdj.adjacentFaceIds) {
          if (upperId === faceId) continue;
          const upperGeom = faceGeoms.get(upperId);
          if (!upperGeom || upperGeom.surfaceType !== 'PLANE') continue;

          // Upper face must be parallel to current face and share same normal direction
          if (FeatureGeometryAnalyzer.areParallel(geom.normal, upperGeom.normal, 0.1)) {
            // Calculate step height along normal
            const diffZ = Math.abs(
              (upperGeom.centroid.x - geom.centroid.x) * geom.normal.x +
              (upperGeom.centroid.y - geom.centroid.y) * geom.normal.y +
              (upperGeom.centroid.z - geom.centroid.z) * geom.normal.z
            );

            if (diffZ > 1.0) {
              const dx = riserGeom.boundsMm.maxX - riserGeom.boundsMm.minX;
              const dy = riserGeom.boundsMm.maxY - riserGeom.boundsMm.minY;
              const stepLengthMm = Math.max(dx, dy) || 30.0;
              const stepWidthMm = Math.min(dx, dy) || 15.0;

              const isExternal = (adj.convexNeighborCount >= adj.concaveNeighborCount);
              const stepType = isExternal
                ? ManufacturingFeatureType.EXTERNAL_STEP
                : ManufacturingFeatureType.INTERNAL_STEP;

              const supportingFaceIds = [faceId, upperId, riserId];
              const explanations: string[] = [
                `Detected parallel planar faces (IDs: ${faceId}, ${upperId}) separated by height $\\Delta = ${diffZ.toFixed(1)}$mm.`,
                `Connected via perpendicular riser face (ID: ${riserId}).`,
                `Classification: ${isExternal ? 'External Step' : 'Internal Step / Shoulder'} (Length: ${stepLengthMm.toFixed(1)}mm, Height: ${diffZ.toFixed(1)}mm).`
              ];

              let accessDir = ToolAccessDirection.POS_Z;
              if (geom.normal.z > 0.8) accessDir = ToolAccessDirection.POS_Z;
              else if (geom.normal.z < -0.8) accessDir = ToolAccessDirection.NEG_Z;
              else if (geom.normal.x > 0.8) accessDir = ToolAccessDirection.POS_X;
              else if (geom.normal.x < -0.8) accessDir = ToolAccessDirection.NEG_X;
              else if (geom.normal.y > 0.8) accessDir = ToolAccessDirection.POS_Y;
              else if (geom.normal.y < -0.8) accessDir = ToolAccessDirection.NEG_Y;

              const params: StepFeatureParams = {
                stepHeightMm: diffZ,
                stepWidthMm,
                stepLengthMm,
                stepDirection: riserGeom.normal,
                isExternal,
                upperFaceId: upperId,
                lowerFaceId: faceId,
                riserFaceId: riserId,
              };

              features.push({
                id: `FEAT_STEP_${faceId}_${Date.now().toString(36)}`,
                type: stepType,
                name: `${isExternal ? 'External' : 'Internal'} Step h=${diffZ.toFixed(1)}mm`,
                intent: ManufacturingIntent.PROFILE_ROUGHING,
                bodyId,
                faceIds: supportingFaceIds,
                edgeIds: adj.connectedEdges,
                vertexIds: [],
                parameters: { type: 'STEP', params },
                confidence: {
                  score: 0.90,
                  state: RecognitionState.PROVEN,
                  detectionEvidence: explanations,
                  supportingTopology: {
                    facesCount: supportingFaceIds.length,
                    edgesCount: adj.connectedEdges.length,
                    concaveEdgesCount: adj.concaveNeighborCount,
                    convexEdgesCount: adj.convexNeighborCount,
                  },
                  supportingGeometry: {
                    surfaceTypes: ['PLANE'],
                    hasPlanarFloor: true,
                    isCoaxialCylinder: false,
                    isOrthogonal: true,
                  },
                  ambiguities: [],
                },
                accessibility: {
                  primaryAccessDirection: accessDir,
                  accessibleDirections: [accessDir],
                  minToolLengthMm: diffZ + 5.0,
                  maxToolDiameterMm: 25.0,
                  minToolDiameterMm: 4.0,
                  isOccluded: false,
                },
                subFeatureIds: [],
                isManuallyOverridden: false,
                explanation: explanations,
              });

              processedFaceIds.add(faceId);
              processedFaceIds.add(upperId);
              processedFaceIds.add(riserId);
              break;
            }
          }
        }
      }
    }

    return features;
  }
}
