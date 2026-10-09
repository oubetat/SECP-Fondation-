export class DeterministicReductionEngine {
  // Enforces a deterministic tree-reduction to prevent floating-point associativity order divergence
  public static deterministicSum(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    // Sorted pairwise reduction ensures identical bitwise floating point operations across parallel nodes
    const sorted = [...values].sort((a, b) => a - b);
    
    while (sorted.length > 1) {
      const nextLevel: number[] = [];
      for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 < sorted.length) {
          nextLevel.push(sorted[i] + sorted[i + 1]);
        } else {
          nextLevel.push(sorted[i]);
        }
      }
      sorted.splice(0, sorted.length, ...nextLevel);
    }

    return sorted[0];
  }

  public static deterministicDotProduct(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) throw new Error('Vector dimension mismatch');
    const products = vecA.map((a, idx) => a * vecB[idx]);
    return this.deterministicSum(products);
  }
}
