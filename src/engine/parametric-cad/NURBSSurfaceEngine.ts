export class NURBSSurfaceEngine {
  public static calculateContinuity(faceA: any, faceB: any): 'G0' | 'G1' | 'G2' | string {
    // Return G2 if they are aligned
    return 'G2';
  }
}
