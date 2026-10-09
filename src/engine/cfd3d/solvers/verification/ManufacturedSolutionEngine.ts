/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-070: Manufactured Solution Engine (MMS)
 */

export interface ErrorNorms {
  readonly l1: number;
  readonly l2: number;
  readonly lMax: number;
}

export class ManufacturedSolutionEngine {
  // Evaluates a simple 2D manufactured field: phi(x,y) = sin(pi*x) * cos(pi*y)
  public static evaluateManufacturedField(x: number, y: number): number {
    return Math.sin(Math.PI * x) * Math.cos(Math.PI * y);
  }

  // Derived source term for advection-diffusion equation with the manufactured field
  public static evaluateManufacturedSource(x: number, y: number, k: number): number {
    // -k * div(grad(phi)) = 2 * k * pi^2 * sin(pi*x) * cos(pi*y)
    return 2.0 * k * Math.PI * Math.PI * Math.sin(Math.PI * x) * Math.cos(Math.PI * y);
  }

  public static calculateFieldErrors(
    numerical: readonly number[],
    coords: readonly { x: number; y: number }[]
  ): ErrorNorms {
    const size = numerical.length;
    let sumSq = 0.0;
    let sumAbs = 0.0;
    let maxDiff = 0.0;

    for (let i = 0; i < size; i++) {
      const exact = this.evaluateManufacturedField(coords[i].x, coords[i].y);
      const diff = Math.abs(numerical[i] - exact);

      sumSq += diff * diff;
      sumAbs += diff;
      if (diff > maxDiff) {
        maxDiff = diff;
      }
    }

    const l2 = Math.sqrt(sumSq / size);
    const l1 = sumAbs / size;
    const lMax = maxDiff;

    return { l1, l2, lMax };
  }
}
