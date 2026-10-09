/**
 * Engineering Truth Program - Verification Result Standard Interface
 */
export interface VerificationResult {
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'UNPROVEN';
  metrics: Record<string, number>;
  violations: string[];
  evidence: string[];
}
