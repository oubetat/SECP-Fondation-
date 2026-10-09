export interface ElementAssemblyResult {}
export interface ElementKinematicsData {
  elementId: string;
  nodeIndices: number[];
  referenceCoords: number[][];
  currentCoords: number[][];
  gaussPoints: any[];
}
export class TangentStiffnessEngine {
  static evaluateElement(a: any, b: any, c: any, d: any) {
    return { strainEnergy: 0, newStates: [], fInternal: [], kTangent: { get: () => 0 } };
  }
}
