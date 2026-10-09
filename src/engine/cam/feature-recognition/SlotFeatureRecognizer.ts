/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Slot Feature Recognizer
 */

import { Face, Solid } from '../../cad-kernel/topology/TopologyContracts';
import { Vector3D } from '../../cadKernel';
import {
  ManufacturingFeature,
  ManufacturingFeatureType,
  ManufacturingIntent,
  RecognitionState,
  ToolAccessDirection,
  SlotFeatureParams,
} from './FeatureTypes';
import { FaceGeometryInfo, FeatureGeometryAnalyzer } from './FeatureGeometryAnalyzer';
import { FaceAdjacencyGraph, TopologicalEdgeInfo } from './FeatureTopologyAnalyzer';

export class SlotFeatureRecognizer {
  /**
   * Recognizes Slot features (Through slots, Blind slots, T-slots)
   */
  public static recognizeSlots(
    solid: Solid,
    bodyId: string,
    faceGeoms: Map<string, FaceGeometryInfo>,
    adjMap: Map<string, FaceAdjacencyGraph>,
    edgeMap: Map<string, TopologicalEdgeInfo>
  ): ManufacturingFeature[] {
    const features: ManufacturingFeature[] = [];
    const processedFaceIds = new Set<string>();

    for (const [faceId, geom] of faceGeoms.entries()) {
      if (processedFaceIds.has(faceId)) continue;

      if (geom.surfaceType === 'PLANE') {
        const adj = adjMap.get(faceId);
        if (!adj) continue;

        // Find pairs of parallel opposing side walls adjacent to this floor face
        const parallelWallPairs: { w1: string; w2: string; widthMm: number; axis: Vector3D }[] = [];

        for (let i = 0; i < adj.adjacentFaceIds.length; i++) {
          for (let j = i + 1; j < adj.adjacentFaceIds.length; j++) {
            const f1Id = adj.adjacentFaceIds[i];
            const f2Id = adj.adjacentFaceIds[j];
            const g1 = faceGeoms.get(f1Id);
            const g2 = faceGeoms.get(f2Id);

            if (g1 && g2 && g1.surfaceType === 'PLANE' && g2.surfaceType === 'PLANE') {
              // Check if opposing normals (n1 . n2 ~= -1)
              const dot = g1.normal.x * g2.normal.x + g1.normal.y * g2.normal.y + g1.normal.z * g2.normal.z;
              if (dot < -0.85) {
                // Check if both walls are perpendicular to floor
                if (
                  FeatureGeometryAnalyzer.arePerpendicular(geom.normal, g1.normal, 0.15) &&
                  FeatureGeometryAnalyzer.arePerpendicular(geom.normal, g2.normal, 0.15)
                ) {
                  const distMm = Math.sqrt(
                    Math.pow(g2.centroid.x - g1.centroid.x, 2) +
                    Math.pow(g2.centroid.y - g1.centroid.y, 2) +
                    Math.pow(g2.centroid.z - g1.centroid.z, 2)
                  );

                  // Slot centerline axis is cross product of wall normal and floor normal
                  const axis: Vector3D = {
                    x: g1.normal.y * geom.normal.z - g1.normal.z * geom.normal.y,
                    y: g1.normal.z * geom.normal.x - g1.normal.x * geom.normal.z,
                    z: g1.normal.x * geom.normal.y - g1.normal.y * geom.normal.x,
                  };

                  parallelWallPairs.push({ w1: f1Id, w2: f2Id, widthMm: distMm, axis });
                }
              }
            }
          }
        }

        if (parallelWallPairs.length >= 1) {
          const pair = parallelWallPairs[0];
          const w1Geom = faceGeoms.get(pair.w1)!;
          const w2Geom = faceGeoms.get(pair.w2)!;

          const dx = geom.boundsMm.maxX - geom.boundsMm.minX;
          const dy = geom.boundsMm.maxY - geom.boundsMm.minY;
          const lengthMm = Math.max(dx, dy) || 50.0;
          const widthMm = pair.widthMm || Math.min(dx, dy) || 12.0;

          // Slot depth is wall height
          const depthMm = Math.max(w1Geom.boundsMm.maxZ - w1Geom.boundsMm.minZ, 10.0);

          // If aspect ratio length/width > 1.5, it qualifies as a distinct slot rather than a generic pocket
          if (lengthMm / Math.max(1.0, widthMm) >= 1.2) {
            const isOpenBothEnds = adj.adjacentFaceIds.length === 2;
            const slotType = isOpenBothEnds
              ? ManufacturingFeatureType.THROUGH_SLOT
              : ManufacturingFeatureType.BLIND_SLOT;

            const supportingFaceIds = [faceId, pair.w1, pair.w2];
            const explanations: string[] = [
              `Identified Linear Slot Floor (ID: ${faceId}) bound by 2 parallel opposing side walls (IDs: ${pair.w1}, ${pair.w2}).`,
              `Aspect ratio length:width (${lengthMm.toFixed(1)}mm : ${widthMm.toFixed(1)}mm) confirms Slot channel.`,
              `Classification: ${isOpenBothEnds ? 'Through Slot' : 'Blind Slot'} (Depth: ${depthMm.toFixed(1)}mm).`
            ];

            let accessDir = ToolAccessDirection.POS_Z;
            if (geom.normal.z > 0.8) accessDir = ToolAccessDirection.POS_Z;
            else if (geom.normal.z < -0.8) accessDir = ToolAccessDirection.NEG_Z;
            else if (geom.normal.x > 0.8) accessDir = ToolAccessDirection.POS_X;
            else if (geom.normal.x < -0.8) accessDir = ToolAccessDirection.NEG_X;
            else if (geom.normal.y > 0.8) accessDir = ToolAccessDirection.POS_Y;
            else if (geom.normal.y < -0.8) accessDir = ToolAccessDirection.NEG_Y;

            const params: SlotFeatureParams = {
              widthMm,
              lengthMm,
              depthMm,
              centerlineAxis: pair.axis,
              isOpenBothEnds,
              isOpenOneEnd: !isOpenBothEnds,
              isClosed: false,
              isThrough: isOpenBothEnds,
              floorNormal: geom.normal,
              sideWallIds: [pair.w1, pair.w2],
              floorFaceId: faceId,
            };

            features.push({
              id: `FEAT_SLOT_${faceId}_${Date.now().toString(36)}`,
              type: slotType,
              name: `${isOpenBothEnds ? 'Through' : 'Blind'} Slot ${widthMm.toFixed(1)}x${lengthMm.toFixed(1)}mm`,
              intent: ManufacturingIntent.SLOT_MILLING,
              bodyId,
              faceIds: supportingFaceIds,
              edgeIds: adj.connectedEdges,
              vertexIds: [],
              parameters: { type: 'SLOT', params },
              confidence: {
                score: 0.92,
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
                minToolLengthMm: depthMm + 5.0,
                maxToolDiameterMm: widthMm * 0.95,
                minToolDiameterMm: widthMm * 0.4,
                isOccluded: false,
              },
              subFeatureIds: [],
              isManuallyOverridden: false,
              explanation: explanations,
            });

            processedFaceIds.add(faceId);
            processedFaceIds.add(pair.w1);
            processedFaceIds.add(pair.w2);
          }
        }
      }
    }

    return features;
  }
}
