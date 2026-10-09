/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-167: Hard Acceptance Gate
 * Mandatory validation for Engineering Chain-of-Custody integrity.
 */

import { ChainOfCustodyService } from './ChainOfCustodyService';
import { ChainOfCustodyVerifier } from './ChainOfCustodyVerifier';
import { WallClock } from '../core/clock';
import {
  CustodyArtifactType,
  CustodyActorType,
  CustodyEventType,
  CustodyStatus
} from './types';

export interface Gate167Check {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly passed: boolean;
  readonly verdict: CustodyStatus | 'PASS' | 'FAIL';
  readonly details?: string;
}

export interface Gate167Report {
  readonly gateId: 'GATE-167-CHAIN-OF-CUSTODY';
  readonly patch: 'PATCH-167';
  readonly verdict: 'PASS' | 'FAIL' | 'UNPROVEN';
  readonly evaluatedAt: string;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly checks: readonly Gate167Check[];
  readonly summary: string;
}

export class HardAcceptanceGate167 {
  public static evaluate(): Gate167Report {
    const checks: Gate167Check[] = [];
    const clock = new WallClock();
    const processIdentity = "GATE-167-EVALUATOR";
    const softwareVersion = "1.0.0";
    const environmentFingerprint = "LOCAL-NODE-01";

    // Scenario: Creation -> Modification -> Verification -> Revocation (Adversarial)

    // 1. Successful Chain Creation
    const artifactId = "PART-12345-AIRFOIL";
    const record = ChainOfCustodyService.createRecord({
      artifactId,
      artifactType: CustodyArtifactType.DESIGN,
      engineeringIdentity: `SECP:DESIGN:${artifactId}:REV1`,
      actorId: "ENGINEER-B",
      actorType: CustodyActorType.HUMAN,
      operation: "INITIAL_DESIGN_UPLOAD",
      resultingHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA256 of empty (placeholder)
      clock,
      processIdentity,
      softwareVersion,
      environmentFingerprint
    });

    const check1Result = ChainOfCustodyVerifier.verifyRecord(record);
    const check1Passed = check1Result.status === CustodyStatus.VALID;
    checks.push({
      id: 'CHECK-01-GENESIS-INTEGRITY',
      name: 'Genesis Chain Integrity',
      description: 'Verifies a newly created custody record is cryptographically valid and linked to GENESIS',
      passed: check1Passed,
      verdict: check1Result.status,
      details: check1Passed ? `Genesis hash: ${record.finalHash}` : check1Result.errors.join('; ')
    });

    // 2. Linear Extension
    const modifiedRecord = ChainOfCustodyService.appendEvent(record, {
      eventType: CustodyEventType.MODIFIED,
      actorId: "AGENT-CAD-OPTIMIZER",
      actorType: CustodyActorType.AI_AGENT,
      operation: "SURFACE_SMOOTHING",
      sourceHash: record.finalHash,
      resultingHash: "f3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
      clock,
      processIdentity: "CAD-SURFACE-SVC",
      softwareVersion: "2.4.0",
      environmentFingerprint
    });

    const check2Result = ChainOfCustodyVerifier.verifyRecord(modifiedRecord);
    const check2Passed = check2Result.status === CustodyStatus.VALID && modifiedRecord.events.length === 2;
    checks.push({
      id: 'CHECK-02-CHAIN-EXTENSION',
      name: 'Cryptographic Chain Extension',
      description: 'Verifies that appending an event correctly links to the previous hash and maintains validity',
      passed: check2Passed,
      verdict: check2Result.status,
      details: check2Passed ? `Extended hash: ${modifiedRecord.finalHash}` : check2Result.errors.join('; ')
    });

    // 3. Tamper Detection - Hash Collision/Manipulation
    const tamperedRecord = JSON.parse(JSON.stringify(modifiedRecord));
    tamperedRecord.events[1].operation = "FORGED_OPERATION"; // Modify data without updating hash
    
    const check3Result = ChainOfCustodyVerifier.verifyRecord(tamperedRecord);
    const check3Passed = check3Result.status === CustodyStatus.INVALID;
    checks.push({
      id: 'CHECK-03-TAMPER-DETECTION-DATA',
      name: 'Data Tamper Detection',
      description: 'Verifies that any modification to event metadata (e.g. operation) invalidates the cryptographic hash',
      passed: check3Passed,
      verdict: check3Result.status,
      details: check3Passed ? 'Correct rejected tampered record' : 'Failed to detect metadata tampering'
    });

    // 4. Tamper Detection - Chain Linkage
    const brokenChainRecord = JSON.parse(JSON.stringify(modifiedRecord));
    brokenChainRecord.events[1].previousCustodyHash = "FORGED_HASH";
    
    const check4Result = ChainOfCustodyVerifier.verifyRecord(brokenChainRecord);
    const check4Passed = check4Result.status === CustodyStatus.INVALID;
    checks.push({
      id: 'CHECK-04-TAMPER-DETECTION-LINKAGE',
      name: 'Linkage Tamper Detection',
      description: 'Verifies that modifying the previousCustodyHash breaks the chain linkage and is detected',
      passed: check4Passed,
      verdict: check4Result.status,
      details: check4Passed ? 'Correctly detected broken chain linkage' : 'Failed to detect linkage tampering'
    });

    // 5. Revocation Propagation
    const revokedRecord = ChainOfCustodyService.revoke(modifiedRecord, {
      actorId: "SECURITY-OFFICER-01",
      reason: "COMPROMISED_ENVIRONMENT",
      clock,
      processIdentity
    });

    const check5Result = ChainOfCustodyVerifier.verifyRecord(revokedRecord);
    const check5Passed = check5Result.status === CustodyStatus.REVOKED;
    checks.push({
      id: 'CHECK-05-REVOCATION-STATUS',
      name: 'Revocation Propagation',
      description: 'Verifies that a revocation event correctly updates the record status to REVOKED while maintaining chain integrity',
      passed: check5Passed,
      verdict: check5Result.status,
      details: check5Passed ? `Revoked at: ${revokedRecord.events[revokedRecord.events.length - 1].timestamp}` : 'Failed to propagate revocation status'
    });

    const passedChecks = checks.filter(c => c.passed).length;
    const allPassed = passedChecks === checks.length;

    return {
      gateId: 'GATE-167-CHAIN-OF-CUSTODY',
      patch: 'PATCH-167',
      verdict: allPassed ? 'PASS' : 'FAIL',
      evaluatedAt: clock.iso!(),
      totalChecks: checks.length,
      passedChecks,
      checks,
      summary: allPassed
        ? 'Hard Acceptance Gate 167 PASSED: Chain-of-Custody system verified for cryptographic integrity, tamper detection, and status propagation.'
        : 'Hard Acceptance Gate 167 FAILED: Custody verification errors detected.'
    };
  }
}
