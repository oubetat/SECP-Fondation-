
import { DesignIntent, IntentType, Vector3D } from './IntentTypes';

export class FeatureIntentRecognizer {
  
  /**
   * Recognizes a potential pattern intent from a set of geometry positions.
   */
  public recognizePatternIntent(
    featureIds: string[],
    positions: Vector3D[]
  ): DesignIntent | null {
    if (featureIds.length < 3) return null;

    // Check for Linear Pattern (constant distance vector)
    const deltas: Vector3D[] = [];
    for (let i = 1; i < positions.length; i++) {
      deltas.push({
        x: positions[i].x - positions[i-1].x,
        y: positions[i].y - positions[i-1].y,
        z: positions[i].z - positions[i-1].z
      });
    }

    const firstDelta = deltas[0];
    const isLinear = deltas.every(d => 
      Math.abs(d.x - firstDelta.x) < 1e-4 &&
      Math.abs(d.y - firstDelta.y) < 1e-4 &&
      Math.abs(d.z - firstDelta.z) < 1e-4
    );

    if (isLinear) {
      return this.createIntent('PATTERN_RELATIONSHIP', featureIds, [], {
        type: 'LINEAR_SPACING_MATCH',
        measuredValue: Math.sqrt(firstDelta.x**2 + firstDelta.y**2 + firstDelta.z**2),
        expectedValue: Math.sqrt(firstDelta.x**2 + firstDelta.y**2 + firstDelta.z**2),
        tolerance: 1e-4,
        deviation: 0,
        timestamp: new Date().toISOString(),
        kernelVersion: '1.0.0'
      }, 'LINEAR_PATTERN_CANDIDATE');
    }

    return null;
  }

  /**
   * Recognizes a potential hole intent.
   */
  public recognizeHoleIntent(faceIds: string[], geometryType: string): DesignIntent | null {
    if (geometryType === 'CYLINDRICAL_INNER') {
      return this.createIntent('HOLE_ALIGNMENT', faceIds, [], {
        type: 'TOPOLOGY_MATCH',
        measuredValue: 1,
        expectedValue: 1,
        tolerance: 0,
        deviation: 0,
        timestamp: new Date().toISOString(),
        kernelVersion: '1.0.0'
      }, 'HOLE_INTENT_CANDIDATE');
    }
    return null;
  }

  private createIntent(
    type: IntentType, 
    sourceIds: string[], 
    targetIds: string[], 
    evidence: any,
    label: string
  ): DesignIntent {
    return {
      id: `intent_${type}_${Date.now()}`,
      type,
      sourceGeometryIds: sourceIds,
      targetGeometryIds: targetIds,
      evidence: [evidence],
      confidence: 0.95,
      status: 'DETECTED',
      priority: 'DETECTED_PATTERN',
      isLocked: false,
      metadata: { label },
      dependencies: [],
      createdBy: 'FEATURE_RECOGNIZER',
      createdAt: new Date().toISOString()
    };
  }
}
