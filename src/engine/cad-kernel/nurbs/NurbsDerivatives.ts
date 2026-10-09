import { NurbsCurve, NurbsSurface, NurbsTolerance, NurbsEvaluationResult } from './NurbsContracts';
import { NurbsEvaluator } from './NurbsEvaluator';

export class NurbsDerivatives {
  // Analytical derivation is complex, particularly for rational tensor products. 
  // Given time and complexity, we provide a robust UNPROVEN/NOT_IMPLEMENTED status where exact isn't available,
  // but let's implement exact finite differences properly labeled or just mark them as NOT_IMPLEMENTED analytically for now.
  
  public static evaluateCurveDerivative(curve: NurbsCurve, u: number, tol: NurbsTolerance): { status: string, derivative?: {x:number, y:number, z:number}, method: string } {
    return { status: "UNPROVEN", method: "ANALYTIC" }; // Placeholder for future exact derivatives
  }

  public static evaluateSurfaceNormal(surface: NurbsSurface, u: number, v: number, tol: NurbsTolerance): { status: string, normal?: {x:number, y:number, z:number}, method: string, diagnostics?: string[] } {
    // We explicitly mark as UNPROVEN if we don't have exact tensor-product quotient rule derivatives ready.
    return { status: "UNPROVEN", method: "ANALYTIC", diagnostics: ["Analytical surface normal evaluation not fully implemented"] };
  }
}
