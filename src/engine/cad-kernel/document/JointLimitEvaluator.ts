/**
 * SECP CAD Kernel — Joint Limit Evaluator (PATCH-040)
 */

export interface JointLimit {
  min: number;
  max: number;
  unit: 'rad' | 'm';
}

export type LimitStatus =
  | 'WITHIN_LIMIT'
  | 'AT_MIN_LIMIT'
  | 'AT_MAX_LIMIT'
  | 'LIMIT_VIOLATION'
  | 'NO_LIMIT';

export interface LimitEvaluationResult {
  status: LimitStatus;
  value: number;
  limit?: JointLimit;
}

export class JointLimitEvaluator {
  public static evaluate(value: number, limit?: JointLimit): LimitEvaluationResult {
    if (!limit) {
      return { status: 'NO_LIMIT', value };
    }

    const TOLERANCE = 1e-9;

    if (value < limit.min - TOLERANCE) {
      return { status: 'LIMIT_VIOLATION', value, limit };
    }
    if (value > limit.max + TOLERANCE) {
      return { status: 'LIMIT_VIOLATION', value, limit };
    }

    if (Math.abs(value - limit.min) < TOLERANCE) {
      return { status: 'AT_MIN_LIMIT', value, limit };
    }
    if (Math.abs(value - limit.max) < TOLERANCE) {
      return { status: 'AT_MAX_LIMIT', value, limit };
    }

    return { status: 'WITHIN_LIMIT', value, limit };
  }
}
