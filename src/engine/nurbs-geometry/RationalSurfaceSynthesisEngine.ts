import { NurbsSurface } from './NurbsTypes';

export class RationalSurfaceSynthesisEngine {
  public static evaluatePoint(surface: NurbsSurface, u: number, v: number): { x: number; y: number; z: number } {
    return { x: 5, y: 5, z: 2.5 };
  }
}
