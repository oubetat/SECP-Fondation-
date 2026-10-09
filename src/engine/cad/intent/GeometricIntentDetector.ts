
import { DesignIntent, IntentType, IntentStatus, IntentEvidence, Vector3D } from './IntentTypes';

export class GeometricIntentDetector {
  private tolerance = 1e-4;

  /**
   * Detects parallel relationship between two normal vectors (faces/planes) or axis vectors.
   */
  public detectParallel(
    id1: string,
    v1: Vector3D,
    id2: string,
    v2: Vector3D
  ): DesignIntent | null {
    const dot = Math.abs(this.dotProduct(v1, v2));
    const deviation = 1.0 - dot;

    if (deviation < this.tolerance) {
      return this.createIntent('PARALLEL', [id1], [id2], {
        type: 'DOT_PRODUCT',
        measuredValue: dot,
        expectedValue: 1.0,
        tolerance: this.tolerance,
        deviation,
        timestamp: new Date().toISOString(),
        kernelVersion: '1.0.0'
      });
    }
    return null;
  }

  /**
   * Detects perpendicular relationship.
   */
  public detectPerpendicular(
    id1: string,
    v1: Vector3D,
    id2: string,
    v2: Vector3D
  ): DesignIntent | null {
    const dot = Math.abs(this.dotProduct(v1, v2));
    const deviation = dot;

    if (deviation < this.tolerance) {
      return this.createIntent('PERPENDICULAR', [id1], [id2], {
        type: 'DOT_PRODUCT',
        measuredValue: dot,
        expectedValue: 0.0,
        tolerance: this.tolerance,
        deviation,
        timestamp: new Date().toISOString(),
        kernelVersion: '1.0.0'
      });
    }
    return null;
  }

  /**
   * Detects concentric/coaxial relationship.
   */
  public detectCoaxial(
    id1: string,
    origin1: Vector3D,
    axis1: Vector3D,
    id2: string,
    origin2: Vector3D,
    axis2: Vector3D
  ): DesignIntent | null {
    // 1. Check if axes are parallel
    const parallel = this.detectParallel(id1, axis1, id2, axis2);
    if (!parallel) return null;

    // 2. Check if origin1 lies on axis2
    const v = {
      x: origin1.x - origin2.x,
      y: origin1.y - origin2.y,
      z: origin1.z - origin2.z
    };
    
    // Cross product of v and axis2 should be zero
    const cross = this.crossProduct(v, axis2);
    const crossLen = Math.sqrt(cross.x ** 2 + cross.y ** 2 + cross.z ** 2);

    if (crossLen < this.tolerance) {
      return this.createIntent('COAXIAL', [id1], [id2], {
        type: 'AXIS_ALIGNMENT',
        measuredValue: crossLen,
        expectedValue: 0.0,
        tolerance: this.tolerance,
        deviation: crossLen,
        timestamp: new Date().toISOString(),
        kernelVersion: '1.0.0'
      });
    }
    return null;
  }

  private dotProduct(v1: Vector3D, v2: Vector3D): number {
    const n1 = this.normalize(v1);
    const n2 = this.normalize(v2);
    return n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  }

  private crossProduct(v1: Vector3D, v2: Vector3D): Vector3D {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
  }

  private normalize(v: Vector3D): Vector3D {
    const len = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  private createIntent(
    type: IntentType, 
    sourceIds: string[], 
    targetIds: string[], 
    evidence: IntentEvidence
  ): DesignIntent {
    return {
      id: `intent_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      sourceGeometryIds: sourceIds,
      targetGeometryIds: targetIds,
      evidence: [evidence],
      confidence: 1.0 - evidence.deviation,
      status: 'DETECTED',
      priority: 'HEURISTIC_CANDIDATE',
      isLocked: false,
      dependencies: [],
      createdBy: 'ENGINE_DETECTOR',
      createdAt: new Date().toISOString()
    };
  }
}
