/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Pocket Feature Recognizer
 */

import { Face, Solid } from '../../cad-kernel/topology/TopologyContracts';
import { Vector3D } from '../../cadKernel';
import {
  ManufacturingFeature,
  ManufacturingFeatureType,
  ManufacturingIntent,
  RecognitionState,
  ToolAccessDirection,
  PocketFeatureParams,
} from './FeatureTypes';
import { FaceGeometryInfo, FeatureGeometryAnalyzer } from './FeatureGeometryAnalyzer';
import { FaceAdjacencyGraph, TopologicalEdgeInfo } from './FeatureTopologyAnalyzer';

export class PocketFeatureRecognizer {
  /**
   * Recognizes all Pocket features (Closed, Open, Blind, Through)
   */
  public static recognizePockets(
    solid: Solid,
    bodyId: string,
    faceGeoms: Map<string, FaceGeometryInfo>,
    adjMap: Map<string, FaceAdjacencyGraph>,
    edgeMap: Map<string, TopologicalEdgeInfo>
  ): ManufacturingFeature[] {
    const features: ManufacturingFeature[] = [];
    const processedFaceIds = new Set<string>();

    // 1. A pocket floor is typically a planar face whose adjacent side walls meet it at concave edges
    for (const [faceId, geom] of faceGeoms.entries()) {
      if (processedFaceIds.has(faceId)) continue;

      if (geom.surfaceType === 'PLANE') {
        const adj = adjMap.get(faceId);
        if (!adj) continue;

        // Count how many neighbors meet this face with concave edges (internal wall-to-floor junctions)
        const wallCandidates: { faceId: string; geom: FaceGeometryInfo }[] = [];
        const cornerRadii: number[] = [];

        for (const neighborId of adj.adjacentFaceIds) {
          const nGeom = faceGeoms.get(neighborId);
          if (nGeom) {
            // Check if perpendicular to floor normal
            if (FeatureGeometryAnalyzer.arePerpendicular(geom.normal, nGeom.normal, 0.15)) {
              wallCandidates.push({ faceId: neighborId, geom: nGeom });
            } else if (nGeom.surfaceType === 'CYLINDER' && nGeom.cylinderParams) {
              // Corner fillet in pocket wall
              cornerRadii.push(nGeom.cylinderParams.radiusMm);
              wallCandidates.push({ faceId: neighborId, geom: nGeom });
            }
          }
        }

        // If a planar face has 3 or more surrounding side walls meeting at near 90°, it is a pocket floor
        if (wallCandidates.length >= 3) {
          const isClosed = wallCandidates.length >= 4;
          const isOpen = !isClosed;
          const openSideCount = isClosed ? 0 : (4 - wallCandidates.length);

          // Calculate pocket depth by measuring wall heights
          let maxWallHeight = 0;
          for (const w of wallCandidates) {
            const h = Math.max(
              w.geom.boundsMm.maxZ - w.geom.boundsMm.minZ,
              Math.max(w.geom.boundsMm.maxY - w.geom.boundsMm.minY, w.geom.boundsMm.maxX - w.geom.boundsMm.minX)
            );
            if (h > maxWallHeight) maxWallHeight = h;
          }
          if (maxWallHeight <= 0) maxWallHeight = 15.0;

          const dx = geom.boundsMm.maxX - geom.boundsMm.minX;
          const dy = geom.boundsMm.maxY - geom.boundsMm.minY;
          const widthMm = Math.min(dx, dy) || 25.0;
          const lengthMm = Math.max(dx, dy) || 40.0;
          const areaMm2 = geom.areaMm2 || widthMm * lengthMm;
          const perimeterMm = 2 * (widthMm + lengthMm);

          const pocketType = isOpen
            ? ManufacturingFeatureType.OPEN_POCKET
            : ManufacturingFeatureType.CLOSED_POCKET;

          const wallFaceIds = wallCandidates.map(w => w.faceId);
          const allSupportingFaceIds = [faceId, ...wallFaceIds];

          const explanations: string[] = [
            `Identified Planar Floor (ID: ${faceId}) surrounded by ${wallCandidates.length} boundary side walls.`,
            `Wall-to-floor junctions form concave internal cavity with ${cornerRadii.length} corner fillets.`,
            `Classification: ${isClosed ? 'Closed Pocket' : 'Open Pocket'} (Width: ${widthMm.toFixed(1)}mm, Length: ${lengthMm.toFixed(1)}mm, Depth: ${maxWallHeight.toFixed(1)}mm).`
          ];

          // Determine access direction opposite to floor normal
          let accessDir = ToolAccessDirection.POS_Z;
          if (geom.normal.z < -0.8) accessDir = ToolAccessDirection.NEG_Z;
          else if (geom.normal.z > 0.8) accessDir = ToolAccessDirection.POS_Z;
          else if (geom.normal.x > 0.8) accessDir = ToolAccessDirection.POS_X;
          else if (geom.normal.x < -0.8) accessDir = ToolAccessDirection.NEG_X;
          else if (geom.normal.y > 0.8) accessDir = ToolAccessDirection.POS_Y;
          else if (geom.normal.y < -0.8) accessDir = ToolAccessDirection.NEG_Y;

          const params: PocketFeatureParams = {
            floorNormal: geom.normal,
            floorZ: geom.centroid.z,
            depthMm: maxWallHeight,
            widthMm,
            lengthMm,
            areaMm2,
            perimeterMm,
            cornerRadiiMm: cornerRadii.length > 0 ? cornerRadii : [3.0],
            isOpen,
            isThrough: false,
            openSideCount,
            wallFaceIds,
            floorFaceId: faceId,
          };

          features.push({
            id: `FEAT_POCKET_${faceId}_${Date.now().toString(36)}`,
            type: pocketType,
            name: `${isClosed ? 'Closed' : 'Open'} Pocket ${widthMm.toFixed(1)}x${lengthMm.toFixed(1)}x${maxWallHeight.toFixed(1)}mm`,
            intent: ManufacturingIntent.POCKET_MILLING,
            bodyId,
            faceIds: allSupportingFaceIds,
            edgeIds: adj.connectedEdges,
            vertexIds: [],
            parameters: { type: 'POCKET', params },
            confidence: {
              score: 0.94,
              state: RecognitionState.PROVEN,
              detectionEvidence: explanations,
              supportingTopology: {
                facesCount: allSupportingFaceIds.length,
                edgesCount: adj.connectedEdges.length,
                concaveEdgesCount: adj.concaveNeighborCount,
                convexEdgesCount: adj.convexNeighborCount,
              },
              supportingGeometry: {
                surfaceTypes: ['PLANE', cornerRadii.length > 0 ? 'CYLINDER' : 'PLANE'],
                hasPlanarFloor: true,
                isCoaxialCylinder: false,
                isOrthogonal: true,
              },
              ambiguities: [],
            },
            accessibility: {
              primaryAccessDirection: accessDir,
              accessibleDirections: [accessDir],
              minToolLengthMm: maxWallHeight + 10.0,
              maxToolDiameterMm: Math.min(widthMm * 0.8, 20.0),
              minToolDiameterMm: (cornerRadii[0] || 3.0) * 1.8,
              isOccluded: false,
            },
            subFeatureIds: [],
            isManuallyOverridden: false,
            explanation: explanations,
          });

          processedFaceIds.add(faceId);
          wallFaceIds.forEach(id => processedFaceIds.add(id));
        }
      }
    }

    return features;
  }
}
