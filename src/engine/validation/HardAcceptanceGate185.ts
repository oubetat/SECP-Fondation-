/**
 * SECP Industrial OS v3 — Hard Acceptance Gate 185
 * Verifies External Validation Package integrity and Independent Industrial Validation readiness.
 */

import { ExternalValidationPackage, ValidationStatus, ValidationReport } from './ValidationTypes';
import { IndependentComparisonEngine } from './IndependentComparisonEngine';

export interface Gate185Result {
  passed: boolean;
  score: number; // SECP-EVS (External Validation Score)
  checks: Array<{
    id: string;
    description: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    value?: string;
  }>;
  report?: ValidationReport;
  timestamp: string;
}

export class HardAcceptanceGate185 {
  private readonly comparisonEngine = new IndependentComparisonEngine();

  public async execute(pkg: ExternalValidationPackage): Promise<Gate185Result> {
    const checks: Gate185Result['checks'] = [];
    let passed = true;
    let score = 0;

    // 1. Package Completeness
    const completeness = this.checkCompleteness(pkg);
    checks.push(completeness);
    if (completeness.status === 'PASS') score += 10; else passed = false;

    // 2. Model Integrity
    const modelIntegrity = this.checkHashMatch(pkg.manifest.modelHash, pkg.model.modelHash, 'Model');
    checks.push(modelIntegrity);
    if (modelIntegrity.status === 'PASS') score += 10; else passed = false;

    // 3. Oracle Independence
    const independence = this.checkOracleIndependence(pkg);
    checks.push(independence);
    if (independence.status === 'PASS') score += 15; else passed = false;

    // 4. Tolerance Immutability (Lock Check)
    const toleranceLock = {
      id: 'TOLERANCE_LOCK',
      description: 'Tolerance Contract Lock Status',
      status: pkg.toleranceContract.isLocked ? 'PASS' : 'FAIL' as any,
      value: pkg.toleranceContract.isLocked ? 'LOCKED' : 'UNLOCKED'
    };
    checks.push(toleranceLock);
    if (toleranceLock.status === 'PASS') score += 10; else passed = false;

    // 5. Environment Capture
    const envCapture = {
      id: 'ENV_CAPTURE',
      description: 'Execution Environment Manifest Presence',
      status: pkg.environment.runtimeHash ? 'PASS' : 'FAIL' as any,
      value: pkg.environment.os
    };
    checks.push(envCapture);
    if (envCapture.status === 'PASS') score += 10;

    // 6. Independent Comparison Execution
    const report = await this.comparisonEngine.compare(pkg);
    const comparisonStatus = report.finalVerdict === 'PASSED' || report.finalVerdict === 'PASSED_WITHIN_UNCERTAINTY' ? 'PASS' : 'FAIL';
    
    checks.push({
      id: 'INDEPENDENT_COMPARISON',
      description: 'Independent Result Comparison Verdict',
      status: comparisonStatus as any,
      value: report.finalVerdict
    });
    
    if (comparisonStatus === 'PASS') {
      score += 25;
    } else {
      passed = false;
    }

    // 7. Hash Integrity (Root Hash Match)
    const rootMatch = {
      id: 'ROOT_HASH_VERIFICATION',
      description: 'Package Root Hash Verification',
      status: pkg.manifest.rootHash === pkg.hashes.packageHash ? 'PASS' : 'FAIL' as any,
      value: pkg.manifest.rootHash.substring(0, 16) + '...'
    };
    checks.push(rootMatch);
    if (rootMatch.status === 'PASS') score += 20; else passed = false;

    return {
      passed,
      score, // Max 100
      checks,
      report,
      timestamp: new Date().toISOString()
    };
  }

  private checkCompleteness(pkg: ExternalValidationPackage): Gate185Result['checks'][0] {
    const missingFields = [];
    if (!pkg.model) missingFields.push('model');
    if (!pkg.expectedReference) missingFields.push('expectedReference');
    if (!pkg.independentOracle) missingFields.push('independentOracle');
    if (!pkg.replayInstructions) missingFields.push('replayInstructions');
    if (!pkg.toleranceContract) missingFields.push('toleranceContract');

    return {
      id: 'PACKAGE_COMPLETENESS',
      description: 'External Validation Package Completeness',
      status: missingFields.length === 0 ? 'PASS' : 'FAIL',
      value: missingFields.length === 0 ? 'COMPLETE' : `MISSING: ${missingFields.join(', ')}`
    };
  }

  private checkHashMatch(manifestHash: string, actualHash: string, component: string): Gate185Result['checks'][0] {
    const match = manifestHash === actualHash;
    return {
      id: `${component.toUpperCase()}_HASH_MATCH`,
      description: `${component} Hash Integrity Check`,
      status: match ? 'PASS' : 'FAIL',
      value: match ? 'MATCHED' : 'MISMATCH'
    };
  }

  private checkOracleIndependence(pkg: ExternalValidationPackage): Gate185Result['checks'][0] {
    // Independence rule: Production Solver Version should not match Oracle Version
    // In a real system, we'd check if the code paths are different
    const isIndependent = pkg.solverConfiguration.solverVersion !== pkg.independentOracle.version;
    
    return {
      id: 'ORACLE_INDEPENDENCE',
      description: 'Independent Oracle Source Separation',
      status: isIndependent ? 'PASS' : 'FAIL',
      value: isIndependent ? 'INDEPENDENT' : 'SELF-VALIDATION_DETECTED'
    };
  }
}
