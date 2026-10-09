
import { Vector3D } from '../cadKernel';
import { AssemblyTransformEngine } from './AssemblyTransformEngine';

export interface SnapResult {
  snapped: boolean;
  point: Vector3D;
  targetId?: string;
  type?: 'VERTEX' | 'EDGE' | 'FACE' | 'CENTER';
  distance: number;
}

export interface SnapSettings {
  enabled: boolean;
  tolerance: number;
  vertex: boolean;
  edge: boolean;
  face: boolean;
  center: boolean;
}

export class SnapEngine {
  private settings: SnapSettings = {
    enabled: true,
    tolerance: 5.0, // 5mm tolerance for snapping
    vertex: true,
    edge: true,
    face: true,
    center: true
  };

  /**
   * Resolves snapping for a given cursor position against assembly components
   */
  public resolveSnap(
    cursorPos: Vector3D,
    candidates: { id: string; points: Vector3D[] }[]
  ): SnapResult {
    if (!this.settings.enabled) {
      return { snapped: false, point: cursorPos, distance: 0 };
    }

    let bestSnap: SnapResult = { snapped: false, point: cursorPos, distance: Infinity };

    for (const candidate of candidates) {
      for (const p of candidate.points) {
        const d = this.distance(cursorPos, p);
        if (d < this.settings.tolerance && d < bestSnap.distance) {
          bestSnap = {
            snapped: true,
            point: { ...p },
            targetId: candidate.id,
            type: 'VERTEX',
            distance: d
          };
        }
      }
    }

    return bestSnap.snapped ? bestSnap : { snapped: false, point: cursorPos, distance: 0 };
  }

  private distance(a: Vector3D, b: Vector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public updateSettings(newSettings: Partial<SnapSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }
}
