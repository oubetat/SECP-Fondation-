/**
 * SECP Industrial OS v2 — Boolean Adversarial Battery Runner
 * Phase 15 (PATCH-172)
 *
 * Executes cases, runs independent verifiers, computes invariants, logs cryptographic evidence.
 */

import { AdversarialTestCase, BooleanEvidenceRecord, AdversarialVerdict } from './types';
import { BooleanEngine } from '../../cad-kernel/boolean/BooleanEngine';
import { IndependentTopologyVerifier } from './IndependentTopologyVerifier';
import { IndependentGeometricOracle } from './IndependentGeometricOracle';
import { BooleanDeterminismAuditor } from './BooleanDeterminismAuditor';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { BooleanTolerance } from '../../cad-kernel/boolean/BooleanTolerance';
import { TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';

export class BooleanAdversarialRunner {
  /**
   * Executes a single adversarial test case.
   */
  public static executeCase(testCase: AdversarialTestCase, seed: number = 100): BooleanEvidenceRecord {
    const { operandA, operandB, expectedBehavior } = testCase.generator(seed);

    const inputHash = EngineeringHashChain.computeCanonicalHash({
      caseId: testCase.id,
      seed,
      opA: operandA?.id || 'null',
      opB: operandB?.id || 'null'
    }).canonicalHash;

    const tStart = performance.now();
    let kernelResult: any = null;
    let executionError: any = null;

    try {
      kernelResult = BooleanEngine.execute(testCase.operation, operandA, operandB);
    } catch (e: any) {
      executionError = e;
    }
    const tEnd = performance.now();
    const executionTimeMs = Math.max(0.001, tEnd - tStart);

    let verdict: AdversarialVerdict = 'UNPROVEN';
    const diagnostics: string[] = [];

    let topologyValidation = IndependentTopologyVerifier.verify(kernelResult?.resultShape || null);
    let invariants = IndependentGeometricOracle.verifyInvariants(
      testCase.operation,
      operandA,
      operandB,
      kernelResult?.resultShape || null,
      expectedBehavior.expectedVolume
    );

    let determinismResult = {
      isDeterministic: true,
      passCount: 1,
      driftCount: 0,
      hashes: [kernelResult?.determinismHash || 'NO_HASH']
    };

    if (executionError) {
      verdict = 'NUMERICAL_FAILURE';
      diagnostics.push(`Execution exception: ${executionError.message || String(executionError)}`);
    } else if (kernelResult.status === 'INVALID_INPUT') {
      verdict = 'INVALID_INPUT';
      diagnostics.push(...kernelResult.diagnostics.map((d: any) => d.message));
    } else if (kernelResult.status === 'DEGENERATE_INPUT') {
      verdict = 'DEGENERATE_INPUT';
      diagnostics.push(...kernelResult.diagnostics.map((d: any) => d.message));
    } else if (kernelResult.status === 'UNSUPPORTED' || kernelResult.status === 'UNPROVEN') {
      verdict = 'UNPROVEN';
      diagnostics.push(`Operation unsupported or unproven for surface types in kernel`);
    } else if (kernelResult.status === 'SUCCESS' || kernelResult.status === 'EMPTY_RESULT') {
      // Run Determinism Check
      const detAudit = BooleanDeterminismAuditor.audit(testCase.operation, operandA, operandB, 3);
      determinismResult = {
        isDeterministic: detAudit.isDeterministic,
        passCount: detAudit.passCount,
        driftCount: detAudit.driftCount,
        hashes: detAudit.hashes
      };

      if (!detAudit.isDeterministic) {
        verdict = 'NON_DETERMINISTIC';
        diagnostics.push(...detAudit.details);
      } else if (!invariants.invariantsSatisfied) {
        verdict = 'NUMERICAL_FAILURE';
        diagnostics.push(...invariants.details);
      } else if (!topologyValidation.isManifold && kernelResult.resultShape) {
        verdict = 'TOPOLOGY_FAILURE';
        diagnostics.push(...topologyValidation.issues);
      } else {
        verdict = 'PASS';
        diagnostics.push('Independent geometric and topological invariants strictly verified');
      }
    } else {
      verdict = 'FAIL';
      diagnostics.push(`Kernel returned status ${kernelResult.status}`);
    }

    const volume = kernelResult?.resultShape ? IndependentGeometricOracle.computeVolume(kernelResult.resultShape) : 0.0;
    const surfaceArea = kernelResult?.resultShape ? IndependentGeometricOracle.computeSurfaceArea(kernelResult.resultShape) : 0.0;
    const boundingBox = IndependentGeometricOracle.computeBoundingBox(kernelResult?.resultShape || null);

    const resultTopologyHash = EngineeringHashChain.computeCanonicalHash({
      verdict,
      topoIssues: topologyValidation.issues,
      euler: topologyValidation.eulerCharacteristic
    }).canonicalHash;

    const resultGeometryHash = EngineeringHashChain.computeCanonicalHash({
      volume,
      surfaceArea,
      boundingBox
    }).canonicalHash;

    const attestationSignature = EngineeringHashChain.computeCanonicalHash({
      testId: testCase.id,
      inputHash,
      resultTopologyHash,
      resultGeometryHash,
      verdict,
      executionTimeMs
    }).canonicalHash;

    return {
      testId: testCase.id,
      seed,
      operation: testCase.operation,
      category: testCase.category,
      operandAIdentity: operandA?.id || 'null',
      operandBIdentity: operandB?.id || 'null',
      inputHash,
      kernelVersion: BooleanEngine.KERNEL_VERSION,
      tolerance: BooleanTolerance.resolve(),
      executionTimeMs,
      resultTopologyHash,
      resultGeometryHash,
      volume,
      surfaceArea,
      boundingBox,
      invariants,
      topologyValidation,
      determinismResult,
      verdict,
      diagnostics,
      ledgerTimestamp: new Date().toISOString(),
      attestationSignature
    };
  }
}
