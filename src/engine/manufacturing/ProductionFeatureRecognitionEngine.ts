/**
 * SECP-056 Topology-Aware Manufacturing Feature Recognition Engine
 */

import { DesignHistory, FeatureDefinition } from '../features/FeatureTypes';
import { ProcessType, Vector3D } from './ManufacturingTypes';
import {
  ProductionManufacturingFeature,
  ProductionFeatureType,
  ManufacturingFeatureGraph,
  FeatureAccessibility,
  FeatureToolRequirements,
  FeatureDimensions,
  FeatureTolerances
} from './ProductionManufacturingTypes';
import { PersistentTopologyIdentity } from '../topology/PersistentTopologyTypes';

export class ProductionFeatureRecognitionEngine {

  /**
   * Recognize 14 Manufacturing Feature types with B-Rep Persistent Topology IDs (056-A / 056-B)
   */
  public static extractManufacturingFeatures(
    history: DesignHistory,
    topologyIdentities: PersistentTopologyIdentity[] = []
  ): ProductionManufacturingFeature[] {
    const features: ProductionManufacturingFeature[] = [];

    for (const f of history.features) {
      if (f.suppressionState === 'SUPPRESSED') continue;
      const extracted = this.recognizeFeatureFromDefinition(f, topologyIdentities);
      features.push(...extracted);
    }

    return features;
  }

  private static recognizeFeatureFromDefinition(
    f: FeatureDefinition,
    topologyIdentities: PersistentTopologyIdentity[]
  ): ProductionManufacturingFeature[] {
    const results: ProductionManufacturingFeature[] = [];
    const p = f.parameters || {};

    // Get matching persistent topology IDs for this feature
    const matchingTopoIds = topologyIdentities
      .filter(t => (t as any).featureId === f.featureId || (t as any).persistentId?.includes(f.featureId))
      .map(t => (t as any).persistentId || (t as any).canonicalPath || `p-topo-${f.featureId}`);

    const baseTopoIds = matchingTopoIds.length > 0 ? matchingTopoIds : [`p-topo-${f.featureId}-face-01`];

    // 1. HOLE
    if (p.isHole || p.diameter || (f.name && f.name.toLowerCase().includes('hole'))) {
      const diameter = p.diameter || 10;
      const depth = p.depth || p.height || 20;

      results.push({
        featureId: `mfg-feat-hole-${f.featureId}`,
        type: 'HOLE',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { diameter, depth, accessVector: { x: 0, y: 0, z: 1 } },
        dimensions: { diameterMm: diameter, depthMm: depth },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: {
          isAccessible3Axis: true,
          isAccessible5Axis: true,
          minimumToolReachMm: depth,
          primaryAccessVector: { x: 0, y: 0, z: 1 }
        },
        toolRequirements: {
          toolType: 'DRILL',
          minToolDiameterMm: diameter,
          maxToolDiameterMm: diameter,
          minToolReachMm: depth,
          flutesRequired: 2
        },
        processCandidates: [ProcessType.DRILLING, ProcessType.MILLING_3AXIS],
        provenance: `f-recog-hole-${f.featureId}`
      });
    }

    // 2. COUNTERBORE
    if (p.isCounterbore || (f.name && f.name.toLowerCase().includes('counterbore'))) {
      const cbDiam = p.counterboreDiameter || 15;
      const cbDepth = p.counterboreDepth || 5;
      results.push({
        featureId: `mfg-feat-cbore-${f.featureId}`,
        type: 'COUNTERBORE',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { diameter: cbDiam, depth: cbDepth },
        dimensions: { counterboreDiameterMm: cbDiam, counterboreDepthMm: cbDepth },
        tolerances: { dimensionalToleranceMm: 0.02, surfaceFinishRaUm: 0.8 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: cbDepth, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'COUNTERBORE_DRILL', minToolDiameterMm: cbDiam, maxToolDiameterMm: cbDiam, minToolReachMm: cbDepth },
        processCandidates: [ProcessType.DRILLING, ProcessType.MILLING_3AXIS],
        provenance: `f-recog-cbore-${f.featureId}`
      });
    }

    // 3. COUNTERSINK
    if (p.isCountersink || (f.name && f.name.toLowerCase().includes('countersink'))) {
      const csAngle = p.countersinkAngle || 90;
      results.push({
        featureId: `mfg-feat-csink-${f.featureId}`,
        type: 'COUNTERSINK',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { draftAngleDeg: csAngle },
        dimensions: { countersinkAngleDeg: csAngle },
        tolerances: { dimensionalToleranceMm: 0.1, surfaceFinishRaUm: 3.2 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 10, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'COUNTERSINK_BIT', minToolDiameterMm: 5, maxToolDiameterMm: 12, minToolReachMm: 10 },
        processCandidates: [ProcessType.DRILLING, ProcessType.MILLING_3AXIS],
        provenance: `f-recog-csink-${f.featureId}`
      });
    }

    // 4. POCKET (Deep vs Shallow Accessibility Test)
    if (p.isPocket || (f.type === 'EXTRUSION' && p.isCut) || (f.name && f.name.toLowerCase().includes('pocket'))) {
      const width = p.width || 20;
      const length = p.length || p.height || 30;
      const depth = p.depth || 10;
      const cornerRadius = p.cornerRadius !== undefined ? p.cornerRadius : 2;

      // Deep pocket rule: depth > 5 * width -> Not accessible by standard 3-axis tool without 5-axis indexing
      const isDeepPocket = depth > 5 * width;
      const is3AxisAccessible = !isDeepPocket && !p.isObstructed;

      results.push({
        featureId: `mfg-feat-pocket-${f.featureId}`,
        type: 'POCKET',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width, length, depth, cornerRadius, isObstructed: !is3AxisAccessible },
        dimensions: { widthMm: width, lengthMm: length, depthMm: depth, cornerRadiusMm: cornerRadius },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: {
          isAccessible3Axis: is3AxisAccessible,
          isAccessible5Axis: true,
          minimumToolReachMm: depth,
          primaryAccessVector: p.accessVector || { x: 0, y: 0, z: 1 }
        },
        toolRequirements: {
          toolType: 'END_MILL',
          minToolDiameterMm: Math.max(1, cornerRadius * 2),
          maxToolDiameterMm: width * 0.8,
          minToolReachMm: depth,
          flutesRequired: 3
        },
        processCandidates: is3AxisAccessible ? [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS] : [ProcessType.MILLING_5AXIS],
        provenance: `f-recog-pocket-${f.featureId}`
      });
    }

    // 5. SLOT
    if (p.isSlot || (f.name && f.name.toLowerCase().includes('slot'))) {
      const width = p.width || 12;
      const length = p.length || 40;
      const depth = p.depth || 10;
      results.push({
        featureId: `mfg-feat-slot-${f.featureId}`,
        type: 'SLOT',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width, length, depth },
        dimensions: { widthMm: width, lengthMm: length, depthMm: depth },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: depth, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: width, maxToolDiameterMm: width, minToolReachMm: depth },
        processCandidates: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS],
        provenance: `f-recog-slot-${f.featureId}`
      });
    }

    // 6. STEP
    if (p.isStep || (f.name && f.name.toLowerCase().includes('step'))) {
      results.push({
        featureId: `mfg-feat-step-${f.featureId}`,
        type: 'STEP',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width: p.width || 15, depth: p.depth || 8 },
        dimensions: { widthMm: p.width || 15, depthMm: p.depth || 8 },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 8, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 5, maxToolDiameterMm: 12, minToolReachMm: 8 },
        processCandidates: [ProcessType.MILLING_3AXIS],
        provenance: `f-recog-step-${f.featureId}`
      });
    }

    // 7. BOSS
    if (f.type === 'EXTRUSION' && !p.isCut && !p.isHole && !p.isPocket && results.length === 0) {
      const width = p.width || 20;
      const length = p.length || p.height || 20;
      const depth = p.depth || 15;
      results.push({
        featureId: `mfg-feat-boss-${f.featureId}`,
        type: 'BOSS',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width, length, depth },
        dimensions: { widthMm: width, lengthMm: length, depthMm: depth },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: depth, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 4, maxToolDiameterMm: 12, minToolReachMm: depth },
        processCandidates: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS],
        provenance: `f-recog-boss-${f.featureId}`
      });
    }

    // 8. FACE
    if (p.isFace || (f.name && f.name.toLowerCase().includes('face'))) {
      results.push({
        featureId: `mfg-feat-face-${f.featureId}`,
        type: 'FACE',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width: 50, length: 50 },
        dimensions: { widthMm: 50, lengthMm: 50 },
        tolerances: { dimensionalToleranceMm: 0.02, surfaceFinishRaUm: 0.8 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 5, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 20, maxToolDiameterMm: 50, minToolReachMm: 5 },
        processCandidates: [ProcessType.MILLING_3AXIS],
        provenance: `f-recog-face-${f.featureId}`
      });
    }

    // 9. GROOVE
    if (p.isGroove || (f.name && f.name.toLowerCase().includes('groove'))) {
      results.push({
        featureId: `mfg-feat-groove-${f.featureId}`,
        type: 'GROOVE',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width: 3, depth: 2 },
        dimensions: { widthMm: 3, depthMm: 2 },
        tolerances: { dimensionalToleranceMm: 0.02, surfaceFinishRaUm: 0.8 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 2, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 3, maxToolDiameterMm: 3, minToolReachMm: 2 },
        processCandidates: [ProcessType.TURNING, ProcessType.MILLING_3AXIS],
        provenance: `f-recog-groove-${f.featureId}`
      });
    }

    // 10. CHAMFER
    if (f.type === 'CHAMFER' || p.isChamfer) {
      const dist = p.distance || 1.0;
      results.push({
        featureId: `mfg-feat-chamfer-${f.featureId}`,
        type: 'CHAMFER',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width: dist },
        dimensions: { widthMm: dist, angleDeg: 45 },
        tolerances: { dimensionalToleranceMm: 0.1, surfaceFinishRaUm: 3.2 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 5, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'CHAMFER_MILL', minToolDiameterMm: 6, maxToolDiameterMm: 12, minToolReachMm: 5 },
        processCandidates: [ProcessType.MILLING_3AXIS],
        provenance: `f-recog-chamfer-${f.featureId}`
      });
    }

    // 11. FILLET
    if (f.type === 'FILLET' || p.isFillet) {
      const rad = p.radius || 2.0;
      results.push({
        featureId: `mfg-feat-fillet-${f.featureId}`,
        type: 'FILLET',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { cornerRadius: rad },
        dimensions: { cornerRadiusMm: rad },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 5, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'BALL_MILL', minToolDiameterMm: rad * 2, maxToolDiameterMm: rad * 2, minToolReachMm: 5 },
        processCandidates: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS],
        provenance: `f-recog-fillet-${f.featureId}`
      });
    }

    // 12. THREAD
    if (p.isThread || (f.name && f.name.toLowerCase().includes('thread'))) {
      results.push({
        featureId: `mfg-feat-thread-${f.featureId}`,
        type: 'THREAD',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { diameter: 8, depth: 15 },
        dimensions: { diameterMm: 8, depthMm: 15 },
        tolerances: { dimensionalToleranceMm: 0.01, surfaceFinishRaUm: 0.8 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 15, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'TAP', minToolDiameterMm: 8, maxToolDiameterMm: 8, minToolReachMm: 15 },
        processCandidates: [ProcessType.DRILLING, ProcessType.MILLING_3AXIS],
        provenance: `f-recog-thread-${f.featureId}`
      });
    }

    // 13. PATTERN
    if (p.isPattern || f.type === 'PATTERN' || (f.name && f.name.toLowerCase().includes('pattern'))) {
      results.push({
        featureId: `mfg-feat-pattern-${f.featureId}`,
        type: 'PATTERN',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { width: 100, length: 100 },
        dimensions: { widthMm: 100, lengthMm: 100 },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 10, primaryAccessVector: { x: 0, y: 0, z: 1 } },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 5, maxToolDiameterMm: 10, minToolReachMm: 10 },
        processCandidates: [ProcessType.MILLING_3AXIS],
        provenance: `f-recog-pattern-${f.featureId}`
      });
    }

    // 14. UNDERCUT (Requires 5-Axis Milling)
    if (p.isUndercut || (p.accessVector && p.accessVector.z < 0)) {
      results.push({
        featureId: `mfg-feat-undercut-${f.featureId}`,
        type: 'UNDERCUT',
        sourceFeatureIds: [f.featureId],
        persistentTopologyIds: baseTopoIds,
        geometry: { depth: 5, accessVector: { x: 0, y: 1, z: -1 } },
        dimensions: { depthMm: 5 },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: {
          isAccessible3Axis: false, // Inaccessible to 3-Axis!
          isAccessible5Axis: true,
          minimumToolReachMm: 15,
          primaryAccessVector: { x: 0, y: 1, z: -1 }
        },
        toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 4, maxToolDiameterMm: 8, minToolReachMm: 15 },
        processCandidates: [ProcessType.MILLING_5AXIS],
        provenance: `f-recog-undercut-${f.featureId}`
      });
    }

    return results;
  }

  /**
   * Build Manufacturing Feature Graph (056-B)
   */
  public static buildManufacturingFeatureGraph(
    features: ProductionManufacturingFeature[],
    revision: number = 1
  ): ManufacturingFeatureGraph {
    const adjacencyMap: Record<string, string[]> = {};
    const accessibilityGraph: Record<string, { isAccessible3Axis: boolean; isAccessible5Axis: boolean }> = {};

    for (let i = 0; i < features.length; i++) {
      const featA = features[i];
      adjacencyMap[featA.featureId] = [];
      accessibilityGraph[featA.featureId] = {
        isAccessible3Axis: featA.accessibility.isAccessible3Axis,
        isAccessible5Axis: featA.accessibility.isAccessible5Axis
      };

      for (let j = 0; j < features.length; j++) {
        if (i === j) continue;
        const featB = features[j];
        // Connect features if they share topology references or source features
        const sharesTopo = featA.persistentTopologyIds.some(id => featB.persistentTopologyIds.includes(id));
        const sharesFeature = featA.sourceFeatureIds.some(sf => featB.sourceFeatureIds.includes(sf));

        if (sharesTopo || sharesFeature) {
          adjacencyMap[featA.featureId].push(featB.featureId);
        }
      }
    }

    return {
      nodes: features,
      adjacencyMap,
      accessibilityGraph,
      graphRevision: revision,
      isInvalidated: false
    };
  }

  /**
   * Invalidate & Recompute Feature Identity on Topology Updates (056-B Evolution Tracker Link)
   */
  public static updateFeatureGraphOnTopologyEvolution(
    currentGraph: ManufacturingFeatureGraph,
    modifiedTopologyIds: string[],
    newFeatures: ProductionManufacturingFeature[]
  ): ManufacturingFeatureGraph {
    // If modified topology intersects with feature graph persistent topology IDs, mark graph as invalidated and recompute
    const affected = currentGraph.nodes.some(node =>
      node.persistentTopologyIds.some(id => modifiedTopologyIds.includes(id))
    );

    const updatedFeatures = affected ? newFeatures : currentGraph.nodes;
    const recomputed = this.buildManufacturingFeatureGraph(updatedFeatures, currentGraph.graphRevision + 1);

    return {
      ...recomputed,
      isInvalidated: affected
    };
  }
}
