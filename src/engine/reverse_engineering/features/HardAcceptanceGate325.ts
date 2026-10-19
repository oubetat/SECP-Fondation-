import { FeatureRecognitionEngine320 } from './FeatureRecognitionEngine320';
import { HealedMeshDataset } from '../mesh/MeshHealingTypes319';

export class HardAcceptanceGate325 {
  public static async runGate(): Promise<{
    passed: boolean;
    verdict: string;
    score: number;
    totalAssertions: number;
    passedAssertions: number;
    details: string[];
  }> {
    const details: string[] = [];
    const addDetail = (passed: boolean, msg: string) => {
      details.push(`${passed ? 'PASS' : 'FAIL'}: ${msg}`);
      return passed;
    };

    // 1. Setup Data
    const canonicalMesh: HealedMeshDataset = {
      healedMeshId: 'MESH-HAG325',
      parentMeshId: 'MESH-HAG325-RAW',
      status: 'COMMITTED',
      vertices: [
        { x: 0, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }
      ] as any,
      triangles: [{ v0: 0, v1: 1, v2: 2 }],
      halfEdges: [],
      defectsDetected: [],
      defectsRepaired: [],
      units: 'mm',
      globalCoordinateFrame: 'WORLD_MM',
      bounds: { minX: 0, minY: 0, minZ: 0, maxX: 50, maxY: 50, maxZ: 100 } as any,
      topologyMetrics: { isManifold: true, closed: true } as any,
      provenance: {} as any,
      createdAt: new Date().toISOString()
    };

    // 2. Run Engine
    const engine = FeatureRecognitionEngine320.getInstance();
    const session = engine.prepare(canonicalMesh);
    engine.segment(session, canonicalMesh, { normalToleranceDeg: 5 } as any);
    engine.detectPrimitives(session, canonicalMesh);
    engine.classify(session);
    const features = engine.commit(session);

    // 3. Assertions
    const a1 = addDetail(features.length > 0, 'Features recognized');
    const a2 = addDetail(session.status === 'COMPLETED', 'Pipeline status is COMPLETED');
    const a3 = addDetail(features[0]?.confidence.score > 0.5, 'Feature confidence high');

    const passedAssertions = [a1, a2, a3].filter(Boolean).length;
    
    return {
      passed: passedAssertions === 3,
      verdict: passedAssertions === 3 ? 'REAL_PIPELINE_VERIFIED' : 'PIPELINE_FAILED',
      score: (passedAssertions / 3) * 100,
      totalAssertions: 3,
      passedAssertions,
      details
    };
  }
}
