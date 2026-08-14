import { DesignHistory, FeatureDefinition } from '../features/FeatureTypes';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { 
  RecognizedManufacturingFeature, 
  ManufacturingFeatureType, 
  ProcessType,
  Vector3D
} from './ManufacturingTypes';

/**
 * PATCH-SECP-049-A — Manufacturing Feature Recognition
 * Automatically extracts engineering manufacturing features (Holes, Pockets, Thin Walls, Slots, Undercuts, Fillets)
 * from B-Rep feature history and topology.
 */
export class ManufacturingFeatureRecognizer {

  public static async recognizeFeatures(
    history: DesignHistory,
    shape?: ShapeHandle
  ): Promise<RecognizedManufacturingFeature[]> {
    const recognized: RecognizedManufacturingFeature[] = [];

    for (const f of history.features) {
      if (f.suppressionState === 'SUPPRESSED') continue;

      const recognizedForFeature = this.analyzeFeature(f);
      recognized.push(...recognizedForFeature);
    }

    return recognized;
  }

  private static analyzeFeature(feature: FeatureDefinition): RecognizedManufacturingFeature[] {
    const results: RecognizedManufacturingFeature[] = [];
    const p = feature.parameters || {};

    // 1. Hole Recognition
    if (p.isHole || p.diameter || (feature.name && feature.name.toLowerCase().includes('hole'))) {
      const diameter = p.diameter || 10;
      const depth = p.depth || p.height || 20;
      const aspectRatio = depth / diameter;

      results.push({
        mfgFeatureId: `mfg-hole-${feature.featureId}`,
        type: ManufacturingFeatureType.HOLE,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          diameter,
          depth,
          aspectRatio,
          accessVector: p.accessVector || { x: 0, y: 0, z: 1 }
        },
        confidence: 0.98,
        suitableProcesses: [ProcessType.DRILLING, ProcessType.MILLING_3AXIS],
        primaryAccessDirection: p.accessVector || { x: 0, y: 0, z: 1 }
      });
    }

    // 2. Pocket / Slot Recognition
    if (p.isPocket || (feature.type === 'EXTRUSION' && p.isCut) || (feature.name && feature.name.toLowerCase().includes('pocket'))) {
      const width = p.width || 20;
      const length = p.length || p.height || 30;
      const depth = p.depth || 10;
      const cornerRadius = p.cornerRadius !== undefined ? p.cornerRadius : 0;
      const hasSharpInternalCorner = cornerRadius <= 0.001;

      results.push({
        mfgFeatureId: `mfg-pocket-${feature.featureId}`,
        type: ManufacturingFeatureType.POCKET,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          width,
          length,
          depth,
          cornerRadius,
          hasSharpInternalCorner,
          accessVector: p.accessVector || { x: 0, y: 0, z: 1 },
          isObstructed: !!p.isObstructed
        },
        confidence: 0.95,
        suitableProcesses: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS],
        primaryAccessDirection: p.accessVector || { x: 0, y: 0, z: 1 }
      });
    }

    // 3. Thin Wall Recognition
    const wallThick = p.thickness || p.wallThickness || p.depth || 10;
    if (feature.type === 'EXTRUSION' && !p.isCut && wallThick < 2.5) {
      results.push({
        mfgFeatureId: `mfg-thinwall-${feature.featureId}`,
        type: ManufacturingFeatureType.THIN_WALL,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          wallThickness: wallThick,
          height: p.height || p.width || 10,
          accessVector: { x: 0, y: 0, z: 1 }
        },
        confidence: 0.92,
        suitableProcesses: [ProcessType.MILLING_3AXIS, ProcessType.ADDITIVE_SLS_SLM],
        primaryAccessDirection: { x: 0, y: 0, z: 1 }
      });
    }

    // 4. Undercut Recognition
    if (p.isUndercut || (p.accessVector && (p.accessVector.x !== 0 || p.accessVector.y !== 0) && p.accessVector.z < 0)) {
      results.push({
        mfgFeatureId: `mfg-undercut-${feature.featureId}`,
        type: ManufacturingFeatureType.UNDERCUT,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          depth: p.depth || 5,
          accessVector: p.accessVector || { x: -1, y: 0, z: -1 },
          isObstructed: true
        },
        confidence: 0.90,
        suitableProcesses: [ProcessType.MILLING_5AXIS],
        primaryAccessDirection: p.accessVector || { x: -1, y: 0, z: -1 }
      });
    }

    // 5. Fillet & Chamfer
    if (feature.type === 'FILLET') {
      results.push({
        mfgFeatureId: `mfg-fillet-${feature.featureId}`,
        type: ManufacturingFeatureType.FILLET,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          cornerRadius: p.radius || 1.0
        },
        confidence: 0.99,
        suitableProcesses: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS],
        primaryAccessDirection: { x: 0, y: 0, z: 1 }
      });
    }

    if (feature.type === 'CHAMFER') {
      results.push({
        mfgFeatureId: `mfg-chamfer-${feature.featureId}`,
        type: ManufacturingFeatureType.CHAMFER,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          width: p.distance || 1.0
        },
        confidence: 0.99,
        suitableProcesses: [ProcessType.MILLING_3AXIS, ProcessType.TURNING],
        primaryAccessDirection: { x: 0, y: 0, z: 1 }
      });
    }

    // Fallback: If no specialized mfg feature extracted, default to general milling block/boss
    if (results.length === 0 && feature.type === 'EXTRUSION') {
      results.push({
        mfgFeatureId: `mfg-boss-${feature.featureId}`,
        type: ManufacturingFeatureType.BOSS,
        sourceFeatureIds: [feature.featureId],
        geometricParams: {
          width: p.width || 10,
          length: p.height || 10,
          depth: p.depth || 10,
          wallThickness: p.thickness || 10
        },
        confidence: 0.85,
        suitableProcesses: [ProcessType.MILLING_3AXIS, ProcessType.TURNING],
        primaryAccessDirection: { x: 0, y: 0, z: 1 }
      });
    }

    return results;
  }
}
