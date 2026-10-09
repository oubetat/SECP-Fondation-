export interface ContactNode2D {
  nodeIndex: number;
  currentCoord: [number, number];
}
export class SurfaceContactEngine {
  static evaluateContact2D(a: any, b: any, c: any, d: any, e: any) {
    return { contactForce: [], contactTangent: { data: [] }, totalContactEnergy: 0, activeContactsCount: 0, maxPenetration: 0 };
  }
}
