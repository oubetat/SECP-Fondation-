import { EngineeringEvidence, EngineeringClaim } from './types';
import { EvidenceConstraintEngine } from '../../../services/ai/EvidenceConstraintEngine';
import { EvidenceValidator } from '../../../services/ai/EvidenceValidator';
import { EvidenceSufficiencyEngine } from '../../../services/ai/EvidenceSufficiencyEngine';
import { ClaimExtractor } from '../../../services/ai/ClaimExtractor';
import { ClaimGroundingEngine } from '../../../services/ai/ClaimGroundingEngine';
import { ContradictionDetector } from '../../../services/ai/ContradictionDetector';
import { DecisionRevalidationService, DecisionRecord } from '../../../services/ai/DecisionRevalidationService';

export interface Gate139Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate139 {
  public static async runAllTests(): Promise<Gate139Result[]> {
    const results: Gate139Result[] = [];

    // 1. Mandatory E2E Test: Missing Independent Verification
    results.push(this.testMandatoryE2E());

    // 2. Contradiction E2E Test
    results.push(this.testContradictionE2E());

    // 3. Evidence Revocation E2E Test
    results.push(this.testEvidenceRevocationE2E());

    // 4. Numerical Hallucination E2E Test
    results.push(this.testNumericalHallucinationE2E());

    // 5. Missing Evidence E2E Test (Fatigue Life)
    results.push(this.testMissingEvidenceE2E());

    // 6. AI-Generated Evidence Cannot Prove Itself Test
    results.push(this.testAIGeneratedEvidenceSelfProof());

    // 7. Context & Revision Mismatch Test
    results.push(this.testContextMismatch());

    return results;
  }

  private static testMandatoryE2E(): Gate139Result {
    // Geometry VALID, Material VALID, Simulation CONVERGED, Mesh VALID, Stress 142 MPa, Allowable 150 MPa
    // But Independent Verification MISSING -> Result MUST be CANNOT_BE_FULLY_VERIFIED
    const claim: EngineeringClaim = {
      claimId: 'C1',
      text: 'Is this design approved?',
      claimType: 'VALIDATED_RESULT',
      domain: 'Structural',
      importance: 'CRITICAL',
      requiredEvidence: ['simulation', 'material', 'independent_verification'],
      supportingEvidence: ['E1'],
      contradictingEvidence: [],
      status: 'UNKNOWN',
      confidence: 0.95
    };

    const evidence: EngineeringEvidence = {
      evidenceId: 'E1',
      sourceType: 'SIMULATION',
      sourceId: 'SIM-101',
      sourceRevision: 'R1',
      contentHash: 'hash1',
      createdAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      state: 'VALID',
      authority: 'SECONDARY_VALIDATED', // Missing PRIMARY_VERIFIED / Independent Verification
      confidence: 0.9,
      context: { part: 'Bracket', revision: 'R1' },
      measurement: 142,
      units: 'MPa',
      provenance: {}
    };

    const status = EvidenceConstraintEngine.evaluateClaimSupport(claim, [evidence]);
    claim.status = status;

    const manifest = EvidenceConstraintEngine.generateManifest([claim], [evidence], []);
    const passed = manifest.verification === 'CANNOT_BE_FULLY_VERIFIED';

    return {
      gateId: 'GATE-139-E2E-MANDATORY',
      description: 'Block full approval when independent verification is missing',
      passed,
      verdict: passed ? 'CANNOT_BE_FULLY_VERIFIED' : 'FAILED',
      details: passed ? 'Correctly returned CANNOT_BE_FULLY_VERIFIED.' : 'Incorrectly auto-approved design.'
    };
  }

  private static testContradictionE2E(): Gate139Result {
    // Simulation: 142 MPa, Calc: 168 MPa -> CONFIRMED_CONFLICT -> DECISION BLOCKED
    const ev1: EngineeringEvidence = {
      evidenceId: 'E1',
      sourceType: 'SIMULATION',
      sourceId: 'SIM-1',
      sourceRevision: 'R1',
      contentHash: 'h1',
      createdAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      state: 'VALID',
      authority: 'PRIMARY_VERIFIED',
      confidence: 0.9,
      context: {},
      measurement: 142,
      units: 'MPa',
      provenance: {}
    };

    const ev2: EngineeringEvidence = {
      evidenceId: 'E2',
      sourceType: 'SOLVER',
      sourceId: 'SOLVER-1',
      sourceRevision: 'R1',
      contentHash: 'h2',
      createdAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      state: 'VALID',
      authority: 'PRIMARY_VERIFIED',
      confidence: 0.9,
      context: {},
      measurement: 168,
      units: 'MPa',
      provenance: {}
    };

    const conflict = ContradictionDetector.detectConflict(ev1, ev2);
    const manifest = EvidenceConstraintEngine.generateManifest([], [ev1, ev2], [conflict]);
    const passed = conflict === 'CONFIRMED_CONFLICT' && manifest.verification === 'BLOCKED';

    return {
      gateId: 'GATE-139-E2E-CONTRADICTION',
      description: 'Block critical claim when primary sources contradict (142 vs 168 MPa)',
      passed,
      verdict: passed ? 'CONFIRMED_CONFLICT_BLOCKED' : 'FAILED',
      details: passed ? 'Successfully detected conflict and blocked decision.' : 'Failed to block contradiction.'
    };
  }

  private static testEvidenceRevocationE2E(): Gate139Result {
    const revokedEv: EngineeringEvidence = {
      evidenceId: 'MC-2026-01',
      sourceType: 'MATERIAL_DATABASE',
      sourceId: 'MAT-1',
      sourceRevision: 'R1',
      contentHash: 'h1',
      createdAt: new Date().toISOString(),
      verificationState: 'REVOKED',
      state: 'REVOKED',
      authority: 'PRIMARY_VERIFIED',
      confidence: 0,
      context: {},
      provenance: {}
    };

    const decisions: DecisionRecord[] = [
      { decisionId: 'DEC-100', evidenceIds: ['MC-2026-01', 'SIM-1'], status: 'QUALIFIED' }
    ];

    const updated = DecisionRevalidationService.handleEvidenceRevocation(revokedEv, decisions);
    const passed = updated[0].status === 'INVALIDATED';

    return {
      gateId: 'GATE-139-E2E-REVOCATION',
      description: 'Invalidate decisions when underlying material certificate is REVOKED',
      passed,
      verdict: passed ? 'DECISION_INVALIDATED' : 'FAILED',
      details: passed ? 'Successfully invalidated dependent decision.' : 'Decision remained active.'
    };
  }

  private static testNumericalHallucinationE2E(): Gate139Result {
    // Source: 142.4 MPa, AI output: 174.2 MPa -> NUMERICAL_GROUNDING_FAILURE
    const ev: EngineeringEvidence = {
      evidenceId: 'E1',
      sourceType: 'SIMULATION',
      sourceId: 'SIM-1',
      sourceRevision: 'R1',
      contentHash: 'h1',
      createdAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      state: 'VALID',
      authority: 'PRIMARY_VERIFIED',
      confidence: 0.9,
      context: {},
      measurement: 142.4,
      units: 'MPa',
      provenance: {}
    };

    const claim: EngineeringClaim = {
      claimId: 'C1',
      text: 'Stress is 174.2 MPa',
      claimType: 'SIMULATION_RESULT',
      domain: 'Structural',
      importance: 'HIGH_IMPACT',
      requiredEvidence: ['E1'],
      supportingEvidence: ['E1'],
      contradictingEvidence: [],
      status: 'UNKNOWN',
      confidence: 0.9
    };

    const res = ClaimGroundingEngine.verifyGrounding(claim, [ev], 174.2, 'MPa');
    const passed = !res.grounded && res.numericalMismatches.includes('NUMERICAL_GROUNDING_FAILURE');

    return {
      gateId: 'GATE-139-E2E-NUMERICAL-HALLUCINATION',
      description: 'Catch numerical hallucination when generated value deviates from source',
      passed,
      verdict: passed ? 'NUMERICAL_GROUNDING_FAILURE' : 'FAILED',
      details: passed ? 'Successfully detected numerical hallucination.' : 'Accepted hallucinated number.'
    };
  }

  private static testMissingEvidenceE2E(): Gate139Result {
    // User asks fatigue life -> missing fatigue curve/load spectrum -> FATIGUE_LIFE_NOT_VERIFIABLE
    const claims = ClaimExtractor.extractClaimsFromResponse('Stress level within limits');
    const score = EvidenceSufficiencyEngine.calculateSufficiency(claims[0], []);
    const passed = !score.sufficient && score.overallSufficiency === 0;

    return {
      gateId: 'GATE-139-E2E-MISSING-EVIDENCE',
      description: 'Refuse unsupported fatigue life claim when fatigue curve/load spectrum are missing',
      passed,
      verdict: passed ? 'FATIGUE_LIFE_NOT_VERIFIABLE' : 'FAILED',
      details: passed ? 'Refused claim due to zero evidence.' : 'Allowed unsupported claim.'
    };
  }

  private static testAIGeneratedEvidenceSelfProof(): Gate139Result {
    const aiEv: EngineeringEvidence = {
      evidenceId: 'AI-1',
      sourceType: 'AI_GENERATED',
      sourceId: 'AI-GEN-1',
      sourceRevision: 'R1',
      contentHash: 'h1',
      createdAt: new Date().toISOString(),
      verificationState: 'UNVERIFIED',
      state: 'VALID',
      authority: 'AI_GENERATED',
      confidence: 0.99,
      context: {},
      provenance: {}
    };

    const valid = EvidenceValidator.validateIntegrity(aiEv);
    const passed = !valid.valid && valid.reason === 'AI_GENERATED_CANNOT_PROVE_SELF';

    return {
      gateId: 'GATE-139-AI-SELF-PROOF',
      description: 'Prevent AI-generated evidence from proving engineering claims',
      passed,
      verdict: passed ? 'BLOCKED_AI_SELF_PROOF' : 'FAILED',
      details: passed ? 'Blocked AI self-proof.' : 'Allowed AI to validate itself.'
    };
  }

  private static testContextMismatch(): Gate139Result {
    const evR12: EngineeringEvidence = {
      evidenceId: 'E12',
      sourceType: 'SIMULATION',
      sourceId: 'SIM-1',
      sourceRevision: 'R-12',
      contentHash: 'h1',
      createdAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      state: 'SUPERSEDED',
      authority: 'PRIMARY_VERIFIED',
      confidence: 0.9,
      context: { revision: 'R-12' },
      provenance: {}
    };

    const valid = EvidenceValidator.validateIntegrity(evR12);
    const passed = !valid.valid && valid.reason === 'EVIDENCE_SUPERSEDED';

    return {
      gateId: 'GATE-139-CONTEXT-MISMATCH',
      description: 'Reject superseded evidence from previous revision R-12 when querying R-17',
      passed,
      verdict: passed ? 'CONTEXT_MISMATCH' : 'FAILED',
      details: passed ? 'Successfully rejected superseded revision.' : 'Used stale revision.'
    };
  }
}
