import { NurbsSurface } from './NurbsTypes';

export class SurfaceQualityMetricsEngine {
  public static analyzeSurface(surface: NurbsSurface): { maxGaussianCurvature: number } {
    return { maxGaussianCurvature: 0 };
  }
}
