import { Matrix, solveLinearSystem } from "./MathUtils";

export class LinearSystemEngine {
  solve(K: Matrix, F: number[]): number[] {
    try {
      return solveLinearSystem(K, F);
    } catch (e: any) {
      if (e.message.includes("singular")) {
        throw new Error("UNEXPECTED_SINGULARITY: or UNDER_CONSTRAINED_MODEL");
      }
      throw e;
    }
  }
}
