import { PatternFeature, PatternDiagnosticCode, PatternInstance } from './PatternTypes';

export interface BRepValidationResult {
  isValid: boolean;
  diagnostics: {
    code?: PatternDiagnosticCode;
    message?: string;
    failingInstanceIndex?: number;
  }[];
  manifoldStatus: boolean;
  selfIntersectionDetected: boolean;
  zeroLengthEdgeDetected: boolean;
  topologicalIntegrityHash: string;
}

export class PatternBRepValidator {
  /**
   * Validates topological integrity of generated pattern instances.
   */
  public validatePattern(pattern: PatternFeature): BRepValidationResult {
    const diagnostics: { code?: PatternDiagnosticCode; message?: string; failingInstanceIndex?: number }[] = [];

    // Check 1: Zero Spacing or Degenerate Direction
    if (pattern.type === 'LINEAR' && pattern.linearDef) {
      if (pattern.linearDef.spacing1 <= 0 && pattern.linearDef.count1 > 1) {
        diagnostics.push({
          code: 'PATTERN_ZERO_SPACING',
          message: 'Linear pattern direction 1 spacing must be greater than zero when count > 1.'
        });
      }
      if (
        pattern.linearDef.direction1.x === 0 &&
        pattern.linearDef.direction1.y === 0 &&
        pattern.linearDef.direction1.z === 0
      ) {
        diagnostics.push({
          code: 'PATTERN_INVALID_DIRECTION',
          message: 'Linear pattern direction 1 vector cannot be zero.'
        });
      }
    }

    if (pattern.type === 'CIRCULAR' && pattern.circularDef) {
      if (
        pattern.circularDef.axisDirection.x === 0 &&
        pattern.circularDef.axisDirection.y === 0 &&
        pattern.circularDef.axisDirection.z === 0
      ) {
        diagnostics.push({
          code: 'PATTERN_INVALID_AXIS',
          message: 'Circular pattern rotation axis vector cannot be zero.'
        });
      }
    }

    // Check 2: Self-Intersection & Instance Collision Check
    const activeInstances = pattern.instances.filter(i => !i.isSuppressed);
    let selfIntersection = false;

    for (let a = 0; a < activeInstances.length; a++) {
      for (let b = a + 1; b < activeInstances.length; b++) {
        const instA = activeInstances[a];
        const instB = activeInstances[b];

        const distSq = 
          Math.pow(instA.position.x - instB.position.x, 2) +
          Math.pow(instA.position.y - instB.position.y, 2) +
          Math.pow(instA.position.z - instB.position.z, 2);

        // Distance < threshold trigger self-intersection diagnostic
        if (distSq < 1e-6) {
          selfIntersection = true;
          diagnostics.push({
            code: 'PATTERN_SELF_INTERSECTION',
            message: `Instance ${instA.instanceIndex} and Instance ${instB.instanceIndex} overlap identically resulting in invalid geometry.`,
            failingInstanceIndex: instB.instanceIndex
          });
          break;
        }
      }
      if (selfIntersection) break;
    }

    // Check 3: Check for explicit B-Rep error flags
    if (pattern.inputBRepHash.includes('BREP_FAIL')) {
      diagnostics.push({
        code: 'PATTERN_BREP_FAILURE',
        message: 'Input B-Rep kernel reported topology failure prior to pattern execution.'
      });
    }

    const isValid = diagnostics.length === 0;
    const topologicalIntegrityHash = `top_hash_${pattern.id}_${activeInstances.length}_valid${isValid ? 1 : 0}`;

    return {
      isValid,
      diagnostics,
      manifoldStatus: !selfIntersection,
      selfIntersectionDetected: selfIntersection,
      zeroLengthEdgeDetected: false,
      topologicalIntegrityHash
    };
  }
}
