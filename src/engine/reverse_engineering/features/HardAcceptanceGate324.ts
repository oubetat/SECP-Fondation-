
import { 
  ParametricFeatureTree, 
  RebuildValidationResult, 
  ClassificationStatus 
} from './ParametricFeatureTypes324';

export class HardAcceptanceGate324 {
  static validate(tree: ParametricFeatureTree, rebuildResult: RebuildValidationResult): {
    passed: boolean;
    verdict: string;
    details: string[];
  } {
    const details: string[] = [];
    let passed = true;

    // 1. Structural Integrity
    if (!tree.rootId) {
      passed = false;
      details.push('FAIL: Feature tree must have a root node.');
    } else {
      details.push('PASS: Feature tree structure initialized.');
    }

    // 2. Kernel Rebuild Status
    if (!rebuildResult.isValid) {
      passed = false;
      details.push(`FAIL: Kernel rebuild failed. Errors: ${rebuildResult.errors.join(', ')}`);
    } else {
      details.push('PASS: Kernel rebuild successful.');
    }

    // 3. Feature Classification Analysis
    const inferredCount = tree.features.filter(f => f.status === ClassificationStatus.INFERRED).length;
    const reconstructedCount = tree.features.filter(f => f.status === ClassificationStatus.RECONSTRUCTED).length;
    const ambiguousCount = tree.features.filter(f => f.status === ClassificationStatus.AMBIGUOUS).length;

    details.push(`INFO: Feature Stats - Reconstructed: ${reconstructedCount}, Inferred: ${inferredCount}, Ambiguous: ${ambiguousCount}`);

    if (ambiguousCount > 5) {
      details.push('WARN: High level of ambiguity in feature tree. Model editability may be compromised.');
    }

    // 4. Source Consistency (Deviation)
    const MAX_DEVIATION = 0.5; // mm
    if (rebuildResult.geometryDeviation && rebuildResult.geometryDeviation > MAX_DEVIATION) {
      passed = false;
      details.push(`FAIL: Source deviation (${rebuildResult.geometryDeviation.toFixed(4)}mm) exceeds threshold (${MAX_DEVIATION}mm).`);
    } else {
      details.push(`PASS: Source consistency within tolerance (${rebuildResult.geometryDeviation?.toFixed(4) || 0}mm).`);
    }

    // 5. Reference Stability
    if (rebuildResult.brokenReferences.length > 0) {
      passed = false;
      details.push(`FAIL: Broken references detected: ${rebuildResult.brokenReferences.length} entities lost.`);
    } else {
      details.push('PASS: References are stable across rebuild.');
    }

    return {
      passed,
      verdict: passed ? 'PARAMETRIC_TRUTH_VALIDATED' : 'PARAMETRIC_TRUTH_FAILED',
      details
    };
  }
}
