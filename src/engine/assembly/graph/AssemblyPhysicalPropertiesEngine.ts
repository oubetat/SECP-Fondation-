/**
 * PATCH-113: Assembly Physical Properties & Interference Candidate Engine
 * Calculates Mass, Center of Mass, Transformed Bounding Box & Interference Candidates
 */

import { AssemblyGraph } from "./AssemblyGraph";
import {
  AssemblyPhysicalProperties,
  Vector3D,
  BoundingBox3D,
  InterferenceCandidate,
  OccurrenceConfigurationState
} from "./types";
import { TransformMatrix } from "./TransformMatrix";

export class AssemblyPhysicalPropertiesEngine {
  /**
   * Compute Total Mass, Center of Mass and World Bounding Box
   */
  public static computePhysicalProperties(
    graph: AssemblyGraph,
    configurationId?: string
  ): AssemblyPhysicalProperties {
    const configId = configurationId || graph.activeConfigurationId || "DEFAULT";
    const config = graph.configurations.get(configId);

    let totalMassKg = 0;
    let sumMassX = 0;
    let sumMassY = 0;
    let sumMassZ = 0;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    let activeCount = 0;
    let suppressedCount = 0;

    for (const [occId, occ] of graph.occurrences) {
      if (occId === graph.rootOccurrenceId) continue;

      const state = config?.occurrenceStates[occId] || occ.configurationState;
      if (state === OccurrenceConfigurationState.SUPPRESSED || state === OccurrenceConfigurationState.EXCLUDED) {
        suppressedCount++;
        continue;
      }

      activeCount++;

      // Retrieve part definition
      const partKey = `${occ.partId}:${occ.partRevision}`;
      const partDef = graph.partDefinitions.get(partKey);

      const partMass = partDef?.massKg || 1.0;
      const partComLocal = partDef?.centerOfMassLocal || { x: 0, y: 0, z: 0 };
      const partBBoxLocal = partDef?.boundingBoxLocal || {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 10, y: 10, z: 10 }
      };

      // Transform Center of Mass to World
      const comWorld = TransformMatrix.transformPoint(occ.worldTransform.matrix, partComLocal);

      totalMassKg += partMass;
      sumMassX += partMass * comWorld.x;
      sumMassY += partMass * comWorld.y;
      sumMassZ += partMass * comWorld.z;

      // Transform Bounding Box to World
      const bboxWorld = TransformMatrix.transformBoundingBox(occ.worldTransform.matrix, partBBoxLocal);

      if (bboxWorld.min.x < minX) minX = bboxWorld.min.x;
      if (bboxWorld.min.y < minY) minY = bboxWorld.min.y;
      if (bboxWorld.min.z < minZ) minZ = bboxWorld.min.z;
      if (bboxWorld.max.x > maxX) maxX = bboxWorld.max.x;
      if (bboxWorld.max.y > maxY) maxY = bboxWorld.max.y;
      if (bboxWorld.max.z > maxZ) maxZ = bboxWorld.max.z;
    }

    if (activeCount === 0) {
      return {
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        totalMassKg: 0,
        centerOfMassWorld: { x: 0, y: 0, z: 0 },
        boundingBoxWorld: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        activeComponentCount: 0,
        suppressedComponentCount: suppressedCount
      };
    }

    const centerOfMassWorld: Vector3D = {
      x: Number((sumMassX / totalMassKg).toFixed(6)),
      y: Number((sumMassY / totalMassKg).toFixed(6)),
      z: Number((sumMassZ / totalMassKg).toFixed(6))
    };

    const boundingBoxWorld: BoundingBox3D = {
      min: { x: Number(minX.toFixed(4)), y: Number(minY.toFixed(4)), z: Number(minZ.toFixed(4)) },
      max: { x: Number(maxX.toFixed(4)), y: Number(maxY.toFixed(4)), z: Number(maxZ.toFixed(4)) }
    };

    return {
      assemblyId: graph.assemblyId,
      assemblyRevision: graph.assemblyRevision,
      totalMassKg: Number(totalMassKg.toFixed(4)),
      centerOfMassWorld,
      boundingBoxWorld,
      activeComponentCount: activeCount,
      suppressedComponentCount: suppressedCount
    };
  }

  /**
   * Identify Interference Candidates via AABB Overlap Analysis
   * Graph-level candidate generation before geometric solver
   */
  public static findInterferenceCandidates(
    graph: AssemblyGraph,
    clearanceMarginMm: number = 0.5
  ): InterferenceCandidate[] {
    const candidates: InterferenceCandidate[] = [];
    const activeOccurrences = Array.from(graph.occurrences.values()).filter(
      o => o.occurrenceId !== graph.rootOccurrenceId && o.configurationState === OccurrenceConfigurationState.ACTIVE
    );

    // Compute bounding boxes for all active occurrences
    const occBoxes = new Map<string, BoundingBox3D>();
    for (const occ of activeOccurrences) {
      const partKey = `${occ.partId}:${occ.partRevision}`;
      const partDef = graph.partDefinitions.get(partKey);
      const bboxLocal = partDef?.boundingBoxLocal || {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 10, y: 10, z: 10 }
      };
      const bboxWorld = TransformMatrix.transformBoundingBox(occ.worldTransform.matrix, bboxLocal);
      occBoxes.set(occ.occurrenceId, bboxWorld);
    }

    // Pairwise test
    for (let i = 0; i < activeOccurrences.length; i++) {
      for (let j = i + 1; j < activeOccurrences.length; j++) {
        const occA = activeOccurrences[i];
        const occB = activeOccurrences[j];

        const boxA = occBoxes.get(occA.occurrenceId)!;
        const boxB = occBoxes.get(occB.occurrenceId)!;

        // Check AABB overlap with margin
        const overlapX = boxA.min.x <= boxB.max.x + clearanceMarginMm && boxA.max.x >= boxB.min.x - clearanceMarginMm;
        const overlapY = boxA.min.y <= boxB.max.y + clearanceMarginMm && boxA.max.y >= boxB.min.y - clearanceMarginMm;
        const overlapZ = boxA.min.z <= boxB.max.z + clearanceMarginMm && boxA.max.z >= boxB.min.z - clearanceMarginMm;

        if (overlapX && overlapY && overlapZ) {
          const directOverlap = boxA.min.x <= boxB.max.x && boxA.max.x >= boxB.min.x &&
                                boxA.min.y <= boxB.max.y && boxA.max.y >= boxB.min.y &&
                                boxA.min.z <= boxB.max.z && boxA.max.z >= boxB.min.z;

          candidates.push({
            candidateId: `INTERF_${occA.occurrenceId}_${occB.occurrenceId}`,
            occurrenceAId: occA.occurrenceId,
            occurrenceBId: occB.occurrenceId,
            boundingBoxOverlap: directOverlap,
            distanceEstimateMm: directOverlap ? 0 : clearanceMarginMm,
            candidateType: directOverlap ? "POTENTIAL_COLLISION" : "CLEARANCE_WARNING"
          });
        }
      }
    }

    return candidates;
  }
}
