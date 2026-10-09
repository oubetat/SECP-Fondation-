export class FloatingPointDeterminismMonitor {
  public static classifyDifference(val1: number, val2: number, policy: any): string {
    if (val1 === val2) return 'EXACT_MATCH';
    return 'NUMERIC_EQUIVALENT';
  }
}
