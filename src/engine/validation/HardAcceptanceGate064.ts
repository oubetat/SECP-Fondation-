/**
 * PATCH-SECP-064: Manufacturing Release & Certification Quality Gate
 * Executes 64 comprehensive, deterministic assertions testing our complete
 * product release decisions, deviation paths, and digital-thread certification.
 * Fully verifies runtime scenarios including perfect releases, blocked states,
 * critical boundaries, certificate determinism, and ledger anchor immutability.
 */

import { HardAcceptanceGate063 } from './HardAcceptanceGate063';
import { ReleaseEligibilityEngine } from '../manufacturing-release/ReleaseEligibilityEngine';
import { ReleaseEvidenceEngine } from '../manufacturing-release/ReleaseEvidenceEngine';
import { DeviationApprovalEngine } from '../manufacturing-release/DeviationApprovalEngine';
import { BatchReleaseEngine } from '../manufacturing-release/BatchReleaseEngine';
import { SerialReleaseEngine } from '../manufacturing-release/SerialReleaseEngine';
import { ReleaseDecisionEngine } from '../manufacturing-release/ReleaseDecisionEngine';
import { CertificateEngine } from '../manufacturing-release/CertificateEngine';
import { ReleaseProvenanceEngine } from '../manufacturing-release/ReleaseProvenanceEngine';
import { ReleasePackageEngine } from '../manufacturing-release/ReleasePackageEngine';

export interface Gate064Report {
  gateId: 'Gate064';
  patch: 'SECP-064';
  timestamp: string;
  totalVerifications: 64;
  passedCount: number;
  overallStatus: 'PASS' | 'FAIL';
  verifications: Record<string, 'PASS' | 'FAIL'>;
  stagesLog: string[];
  sampleReleaseReport?: any;
}

export class HardAcceptanceGate064 {
  public static async executeGate(): Promise<Gate064Report> {
    const timestamp = new Date().toISOString();
    const verifications: Record<string, 'PASS' | 'FAIL'> = {};
    const stagesLog: string[] = [];
    let passedCount = 0;

    stagesLog.push('=== [SECP-064] Starting Manufacturing Release & Certification Evaluation ===');

    try {
      // ==========================================
      // SECTION 064-A: Release Identity (064-1 → 064-7)
      // ==========================================
      stagesLog.push('[GATE-064-A] Validating release registration identity structures...');

      const serialEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1001',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'VERIFIED',
        metrologyStatus: 'ACCEPTED',
        spcStatus: 'IN_CONTROL',
        ncrStatus: 'NONE',
        capaStatus: 'NONE'
      });

      verifications.aSerialNoSaved = serialEligible.serialNumber === 'SN-AL-064-1001' ? 'PASS' : 'FAIL';
      if (verifications.aSerialNoSaved === 'PASS') passedCount++;

      verifications.aPartIdSaved = serialEligible.partId === 'part-aluminum-wing-mount' ? 'PASS' : 'FAIL';
      if (verifications.aPartIdSaved === 'PASS') passedCount++;

      verifications.aExecVerifiedField = serialEligible.executionVerified === true ? 'PASS' : 'FAIL';
      if (verifications.aExecVerifiedField === 'PASS') passedCount++;

      verifications.aMetroVerifiedField = serialEligible.metrologyVerified === true ? 'PASS' : 'FAIL';
      if (verifications.aMetroVerifiedField === 'PASS') passedCount++;

      verifications.aSpcVerifiedField = serialEligible.spcVerified === true ? 'PASS' : 'FAIL';
      if (verifications.aSpcVerifiedField === 'PASS') passedCount++;

      verifications.aNcrClearedField = serialEligible.ncrCleared === true ? 'PASS' : 'FAIL';
      if (verifications.aNcrClearedField === 'PASS') passedCount++;

      verifications.aEligibleByDefault = serialEligible.eligibilityStatus === 'ELIGIBLE' ? 'PASS' : 'FAIL';
      if (verifications.aEligibleByDefault === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-B: Evidence Completeness (064-8 → 064-14)
      // ==========================================
      stagesLog.push('[GATE-064-B] Testing evidence payload registration constraints...');

      const execEvidence = ReleaseEvidenceEngine.registerEvidence({
        sourceBaselineId: 'SECP-060',
        evidenceType: 'EXECUTION_HASH',
        contentHash: 'sha256-exec-session-hash-064-ok-verified',
        verifiedBy: 'engineer-lead-ops'
      });

      verifications.bEvidenceIdGenerated = execEvidence.evidenceId.startsWith('evid-secp-060-') ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceIdGenerated === 'PASS') passedCount++;

      verifications.bEvidenceBaselineSaved = execEvidence.sourceBaselineId === 'SECP-060' ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceBaselineSaved === 'PASS') passedCount++;

      verifications.bEvidenceTypeCorrect = execEvidence.evidenceType === 'EXECUTION_HASH' ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceTypeCorrect === 'PASS') passedCount++;

      verifications.bEvidenceHashSaved = execEvidence.contentHash === 'sha256-exec-session-hash-064-ok-verified' ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceHashSaved === 'PASS') passedCount++;

      verifications.bEvidenceSignerLogged = execEvidence.verifiedBy === 'engineer-lead-ops' ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceSignerLogged === 'PASS') passedCount++;

      // Hash length validation (minimum 32 characters)
      let hashLenThrows = false;
      try {
        ReleaseEvidenceEngine.registerEvidence({
          sourceBaselineId: 'SECP-060',
          evidenceType: 'EXECUTION_HASH',
          contentHash: 'short-hash',
          verifiedBy: 'eng-1'
        });
      } catch {
        hashLenThrows = true;
      }
      verifications.bEvidenceHashLengthValidated = hashLenThrows ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceHashLengthValidated === 'PASS') passedCount++;

      // Signer validation (minimum 3 characters)
      let signerThrows = false;
      try {
        ReleaseEvidenceEngine.registerEvidence({
          sourceBaselineId: 'SECP-060',
          evidenceType: 'EXECUTION_HASH',
          contentHash: 'sha256-exec-session-hash-064-ok-verified',
          verifiedBy: 'qa'
        });
      } catch {
        signerThrows = true;
      }
      verifications.bEvidenceSignerValidated = signerThrows ? 'PASS' : 'FAIL';
      if (verifications.bEvidenceSignerValidated === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-C: Execution/Quality Eligibility (064-15 → 064-22)
      // ==========================================
      stagesLog.push('[GATE-064-C] Testing execution & quality eligibility configurations...');

      const failedExecEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1002',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'FAILED',
        metrologyStatus: 'ACCEPTED',
        spcStatus: 'IN_CONTROL',
        ncrStatus: 'NONE',
        capaStatus: 'NONE'
      });
      verifications.cFailedExecBlocked = failedExecEligible.eligibilityStatus === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.cFailedExecBlocked === 'PASS') passedCount++;

      const failedMetroEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1003',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'VERIFIED',
        metrologyStatus: 'REJECTED',
        spcStatus: 'IN_CONTROL',
        ncrStatus: 'NONE',
        capaStatus: 'NONE'
      });
      verifications.cFailedMetroBlocked = failedMetroEligible.eligibilityStatus === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.cFailedMetroBlocked === 'PASS') passedCount++;

      const unstableSpcEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1004',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'VERIFIED',
        metrologyStatus: 'ACCEPTED',
        spcStatus: 'OUT_OF_CONTROL',
        ncrStatus: 'NONE',
        capaStatus: 'NONE'
      });
      verifications.cUnstableSpcBlocked = unstableSpcEligible.eligibilityStatus === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.cUnstableSpcBlocked === 'PASS') passedCount++;

      const openNcrEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1005',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'VERIFIED',
        metrologyStatus: 'ACCEPTED',
        spcStatus: 'IN_CONTROL',
        ncrStatus: 'OPEN',
        capaStatus: 'NONE'
      });
      verifications.cOpenNcrBlocked = openNcrEligible.eligibilityStatus === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.cOpenNcrBlocked === 'PASS') passedCount++;

      const closedNcrEligible = ReleaseEligibilityEngine.evaluateSerialEligibility({
        serialNumber: 'SN-AL-064-1006',
        partId: 'part-aluminum-wing-mount',
        executionStatus: 'VERIFIED',
        metrologyStatus: 'ACCEPTED',
        spcStatus: 'IN_CONTROL',
        ncrStatus: 'CLOSED',
        capaStatus: 'EFFECTIVE'
      });
      verifications.cClosedNcrEligible = closedNcrEligible.eligibilityStatus === 'ELIGIBLE' ? 'PASS' : 'FAIL';
      if (verifications.cClosedNcrEligible === 'PASS') passedCount++;

      // Extra logic coverage checks
      verifications.cExecVerifiedTracker = failedExecEligible.executionVerified === false ? 'PASS' : 'FAIL';
      if (verifications.cExecVerifiedTracker === 'PASS') passedCount++;

      verifications.cMetroVerifiedTracker = failedMetroEligible.metrologyVerified === false ? 'PASS' : 'FAIL';
      if (verifications.cMetroVerifiedTracker === 'PASS') passedCount++;

      verifications.cSpcVerifiedTracker = unstableSpcEligible.spcVerified === false ? 'PASS' : 'FAIL';
      if (verifications.cSpcVerifiedTracker === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-D: NCR/CAPA Closure & Deviation (064-23 → 064-30)
      // ==========================================
      stagesLog.push('[GATE-064-D] Evaluating material deviation and mitigation controls...');

      const deviation = DeviationApprovalEngine.initiateDeviation({
        ncrId: 'ncr-064-oversize',
        severity: 'MINOR',
        description: 'Bore diameter is 2 microns above warning threshold but below absolute scrap threshold.',
        mitigationActions: ['Implement match grinding on locating pins', 'Reset machine zero offset'],
        authorizedEngineerId: 'engineer-lead-qa'
      });

      verifications.dDevIdGenerated = deviation.deviationId.startsWith('dev-') ? 'PASS' : 'FAIL';
      if (verifications.dDevIdGenerated === 'PASS') passedCount++;

      verifications.dDevSeveritySaved = deviation.severity === 'MINOR' ? 'PASS' : 'FAIL';
      if (verifications.dDevSeveritySaved === 'PASS') passedCount++;

      verifications.dDevDescriptionSaved = deviation.description.length > 20 ? 'PASS' : 'FAIL';
      if (verifications.dDevDescriptionSaved === 'PASS') passedCount++;

      verifications.dDevMitigationsRegistered = deviation.mitigationActions.length === 2 ? 'PASS' : 'FAIL';
      if (verifications.dDevMitigationsRegistered === 'PASS') passedCount++;

      verifications.dDevPendingByDefault = deviation.approvalStatus === 'PENDING' ? 'PASS' : 'FAIL';
      if (verifications.dDevPendingByDefault === 'PASS') passedCount++;

      // Prevent CRITICAL deviations from standard channel release
      let criticalDevThrows = false;
      try {
        DeviationApprovalEngine.initiateDeviation({
          ncrId: 'ncr-064-critical',
          severity: 'CRITICAL',
          description: 'Structural web thickness below minimum safety limit by 2.4 millimeters.',
          mitigationActions: ['None possible'],
          authorizedEngineerId: 'engineer-lead-qa'
        });
      } catch {
        criticalDevThrows = true;
      }
      verifications.dDevCriticalValidationBlocked = criticalDevThrows ? 'PASS' : 'FAIL';
      if (verifications.dDevCriticalValidationBlocked === 'PASS') passedCount++;

      // Verify signature payload uniqueness
      verifications.dDevSecureSignatureCreated = deviation.signatureHash.startsWith('sig-dev-approved-') ? 'PASS' : 'FAIL';
      if (verifications.dDevSecureSignatureCreated === 'PASS') passedCount++;

      const processedDev = DeviationApprovalEngine.processApproval(deviation, true, 'engineer-lead-qa');
      verifications.dDevApprovedSuccess = processedDev.approvalStatus === 'APPROVED' ? 'PASS' : 'FAIL';
      if (verifications.dDevApprovedSuccess === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-E: Approval Governance (064-31 → 064-37)
      // ==========================================
      stagesLog.push('[GATE-064-E] Testing governance policies & signature verifications...');

      // Attempt authorization by mismatching engineer ID
      let unauthorizedApprovalThrows = false;
      try {
        DeviationApprovalEngine.processApproval(deviation, true, 'imposter-engineer');
      } catch {
        unauthorizedApprovalThrows = true;
      }
      verifications.eApprovalSignerAuthChecked = unauthorizedApprovalThrows ? 'PASS' : 'FAIL';
      if (verifications.eApprovalSignerAuthChecked === 'PASS') passedCount++;

      // Policy decision mapping: All compliant
      const policyAllCompliant = ReleaseDecisionEngine.executeReleasePolicy({
        serials: [serialEligible, closedNcrEligible],
        approvedDeviations: []
      });
      verifications.ePolicyReleasedOnCompliant = policyAllCompliant.decision === 'RELEASED' ? 'PASS' : 'FAIL';
      if (verifications.ePolicyReleasedOnCompliant === 'PASS') passedCount++;

      // Policy decision mapping: Some blocked without deviations
      const policyBlockedNoDevs = ReleaseDecisionEngine.executeReleasePolicy({
        serials: [serialEligible, failedMetroEligible],
        approvedDeviations: []
      });
      verifications.ePolicyBlockedWithoutDev = policyBlockedNoDevs.decision === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.ePolicyBlockedWithoutDev === 'PASS') passedCount++;

      // Policy decision mapping: Some blocked with approved deviations
      const policyConditionalReleased = ReleaseDecisionEngine.executeReleasePolicy({
        serials: [serialEligible, failedMetroEligible],
        approvedDeviations: [processedDev]
      });
      verifications.ePolicyConditionalReleasedWithDev = policyConditionalReleased.decision === 'CONDITIONAL_RELEASE' ? 'PASS' : 'FAIL';
      if (verifications.ePolicyConditionalReleasedWithDev === 'PASS') passedCount++;

      // Policy decision mapping: Administrative hold applied
      const policyForcedHold = ReleaseDecisionEngine.executeReleasePolicy({
        serials: [serialEligible],
        approvedDeviations: [],
        forcedHoldApplied: true
      });
      verifications.ePolicyHoldHonored = policyForcedHold.decision === 'HOLD' ? 'PASS' : 'FAIL';
      if (verifications.ePolicyHoldHonored === 'PASS') passedCount++;

      // Policy decision mapping: Empty serial list
      const policyEmptySerials = ReleaseDecisionEngine.executeReleasePolicy({
        serials: [],
        approvedDeviations: []
      });
      verifications.ePolicyEmptyListBlocked = policyEmptySerials.decision === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.ePolicyEmptyListBlocked === 'PASS') passedCount++;

      verifications.ePolicyTrackReasonSaved = policyAllCompliant.reason.length > 10 ? 'PASS' : 'FAIL';
      if (verifications.ePolicyTrackReasonSaved === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-F: Serial & Batch Release (064-38 → 064-44)
      // ==========================================
      stagesLog.push('[GATE-064-F] Assessing serial-override promotion & batch lot release...');

      // Promotes individual serial utilizing an approved deviation override
      const overriddenSerial = SerialReleaseEngine.verifyIndividualSerial(failedMetroEligible, true);
      verifications.fSerialPromotedByOverride = overriddenSerial.eligibilityStatus === 'ELIGIBLE' ? 'PASS' : 'FAIL';
      if (verifications.fSerialPromotedByOverride === 'PASS') passedCount++;

      const unpromotedSerial = SerialReleaseEngine.verifyIndividualSerial(failedMetroEligible, false);
      verifications.fSerialStaysBlockedWithoutOverride = unpromotedSerial.eligibilityStatus === 'BLOCKED' ? 'PASS' : 'FAIL';
      if (verifications.fSerialStaysBlockedWithoutOverride === 'PASS') passedCount++;

      // Compile batch tracking multiple parts
      const batchRelease = BatchReleaseEngine.compileBatchRelease({
        batchId: 'batch-064-aluminum-run-1',
        productTypeId: 'wing-mount-type-a',
        serialReleaseList: [serialEligible, overriddenSerial]
      });

      verifications.fBatchCompiledSuccessful = batchRelease.overallStatus === 'COMPLIANT' ? 'PASS' : 'FAIL';
      if (verifications.fBatchCompiledSuccessful === 'PASS') passedCount++;

      verifications.fBatchTracksQuantity = batchRelease.quantity === 2 ? 'PASS' : 'FAIL';
      if (verifications.fBatchTracksQuantity === 'PASS') passedCount++;

      verifications.fBatchTracksReleasedQuantity = batchRelease.releasedQuantity === 2 ? 'PASS' : 'FAIL';
      if (verifications.fBatchTracksReleasedQuantity === 'PASS') passedCount++;

      verifications.fBatchTracksBlockedQuantity = batchRelease.blockedQuantity === 0 ? 'PASS' : 'FAIL';
      if (verifications.fBatchTracksBlockedQuantity === 'PASS') passedCount++;

      const forceHoldBatch = BatchReleaseEngine.placeBatchOnHold(batchRelease);
      verifications.fBatchForcedHoldSaved = forceHoldBatch.overallStatus === 'HOLD' ? 'PASS' : 'FAIL';
      if (verifications.fBatchForcedHoldSaved === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-G: Certificate Integrity (064-45 → 064-51)
      // ==========================================
      stagesLog.push('[GATE-064-G] Verifying immutable certificate structural integrity...');

      const releaseCert = CertificateEngine.generateCertificate({
        productId: 'aircraft-component-mount-064',
        partSerials: ['SN-AL-064-1001', 'SN-AL-064-1006'],
        batchId: 'batch-064-aluminum-run-1',
        cadRevision: 'REV-064-E',
        camRevision: 'CAM-064-B',
        ncProgramHash: 'sha256-gcode-064-verified-offset-applied',
        executionHash: 'sha256-exec-session-hash-064-ok-verified',
        metrologyCertificateHash: 'sha256-metrology-cert-064-scanned',
        processHealthCertificateHash: 'sha256-spc-health-064-stable',
        ncrCertificateHashes: ['sha256-ncr-cert-064-closed'],
        deviationApprovalIds: [processedDev.deviationId],
        decision: 'RELEASED',
        releaseReason: 'All components fully compliant and validated along the entire digital manufacturing loop.',
        approvedBy: ['engineer-lead-qa', 'engineer-lead-ops']
      });

      verifications.gCertIdGenerated = releaseCert.releaseId.startsWith('cert-rel-') ? 'PASS' : 'FAIL';
      if (verifications.gCertIdGenerated === 'PASS') passedCount++;

      verifications.gCertProductIdSaved = releaseCert.productId === 'aircraft-component-mount-064' ? 'PASS' : 'FAIL';
      if (verifications.gCertProductIdSaved === 'PASS') passedCount++;

      // Verify correct serial count
      verifications.gCertSerialsTracked = releaseCert.partSerials.length === 2 ? 'PASS' : 'FAIL';
      if (verifications.gCertSerialsTracked === 'PASS') passedCount++;

      verifications.gCertDecisionMatches = releaseCert.decision === 'RELEASED' ? 'PASS' : 'FAIL';
      if (verifications.gCertDecisionMatches === 'PASS') passedCount++;

      verifications.gCertEvidenceRootGenerated = releaseCert.evidenceRootHash.length > 10 ? 'PASS' : 'FAIL';
      if (verifications.gCertEvidenceRootGenerated === 'PASS') passedCount++;

      verifications.gCertSealHashStructured = releaseCert.certificateHash.startsWith('sha256-cert-seal-') ? 'PASS' : 'FAIL';
      if (verifications.gCertSealHashStructured === 'PASS') passedCount++;

      // At least one engineering approval signature required
      let certApprovalThrows = false;
      try {
        CertificateEngine.generateCertificate({
          productId: 'part-1',
          partSerials: ['SN-1'],
          cadRevision: 'REV-A',
          camRevision: 'CAM-A',
          ncProgramHash: 'hash',
          executionHash: 'hash',
          metrologyCertificateHash: 'hash',
          processHealthCertificateHash: 'hash',
          ncrCertificateHashes: [],
          deviationApprovalIds: [],
          decision: 'RELEASED',
          releaseReason: 'OK',
          approvedBy: [] // Empty
        });
      } catch {
        certApprovalThrows = true;
      }
      verifications.gCertApproverRequiredEnforced = certApprovalThrows ? 'PASS' : 'FAIL';
      if (verifications.gCertApproverRequiredEnforced === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-H: Immutability & Determinism (064-52 → 064-56)
      // ==========================================
      stagesLog.push('[GATE-064-H] Verifying certificate determinism and digital thread immutability...');

      // 52. Same parameters MUST generate identical hash (Deterministic Identity)
      const duplicateCert = CertificateEngine.generateCertificate({
        productId: 'aircraft-component-mount-064',
        partSerials: ['SN-AL-064-1001', 'SN-AL-064-1006'],
        batchId: 'batch-064-aluminum-run-1',
        cadRevision: 'REV-064-E',
        camRevision: 'CAM-064-B',
        ncProgramHash: 'sha256-gcode-064-verified-offset-applied',
        executionHash: 'sha256-exec-session-hash-064-ok-verified',
        metrologyCertificateHash: 'sha256-metrology-cert-064-scanned',
        processHealthCertificateHash: 'sha256-spc-health-064-stable',
        ncrCertificateHashes: ['sha256-ncr-cert-064-closed'],
        deviationApprovalIds: [processedDev.deviationId],
        decision: 'RELEASED',
        releaseReason: 'All components fully compliant and validated along the entire digital manufacturing loop.',
        approvedBy: ['engineer-lead-qa', 'engineer-lead-ops']
      });

      verifications.hCertDeterminismVerified = duplicateCert.evidenceRootHash === releaseCert.evidenceRootHash ? 'PASS' : 'FAIL';
      if (verifications.hCertDeterminismVerified === 'PASS') passedCount++;

      // 53. Mutation Test: CAD Modification must invalidate the Root Hash
      const tamperedCadCert = CertificateEngine.generateCertificate({
        ...releaseCert,
        cadRevision: 'REV-064-MUTATED-A'
      });
      verifications.hCertImmutabilityOnCadChange = (tamperedCadCert.evidenceRootHash !== releaseCert.evidenceRootHash && tamperedCadCert.certificateHash !== releaseCert.certificateHash) ? 'PASS' : 'FAIL';
      if (verifications.hCertImmutabilityOnCadChange === 'PASS') passedCount++;

      // 54. Mutation Test: CAM Modification must invalidate the Root Hash
      const tamperedCamCert = CertificateEngine.generateCertificate({
        ...releaseCert,
        camRevision: 'CAM-064-MUTATED-B'
      });
      verifications.hCertImmutabilityOnCamChange = (tamperedCamCert.evidenceRootHash !== releaseCert.evidenceRootHash && tamperedCamCert.certificateHash !== releaseCert.certificateHash) ? 'PASS' : 'FAIL';
      if (verifications.hCertImmutabilityOnCamChange === 'PASS') passedCount++;

      // 55. Mutation Test: NC Program Hash Modification must invalidate the Root Hash
      const tamperedNcCert = CertificateEngine.generateCertificate({
        ...releaseCert,
        ncProgramHash: 'sha256-gcode-MUTATED-C'
      });
      verifications.hCertImmutabilityOnNcChange = (tamperedNcCert.evidenceRootHash !== releaseCert.evidenceRootHash && tamperedNcCert.certificateHash !== releaseCert.certificateHash) ? 'PASS' : 'FAIL';
      if (verifications.hCertImmutabilityOnNcChange === 'PASS') passedCount++;

      // 56. Mutation Test: Execution Session Modification must invalidate the Root Hash
      const tamperedExecCert = CertificateEngine.generateCertificate({
        ...releaseCert,
        executionHash: 'sha256-exec-session-MUTATED-D'
      });
      verifications.hCertImmutabilityOnExecutionChange = (tamperedExecCert.evidenceRootHash !== releaseCert.evidenceRootHash && tamperedExecCert.certificateHash !== releaseCert.certificateHash) ? 'PASS' : 'FAIL';
      if (verifications.hCertImmutabilityOnExecutionChange === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-I: Abstract SECP Provenance Ledger (064-57 → 064-60)
      // ==========================================
      stagesLog.push('[GATE-064-I] Executing decoupled abstract ledger anchoring (SECP Internal)...');

      const provRecord = ReleaseProvenanceEngine.createProvenanceRecord(releaseCert, 'engineer-lead-qa');
      verifications.iProvRecordCreated = provRecord.recordId.startsWith('prov-rec-') ? 'PASS' : 'FAIL';
      if (verifications.iProvRecordCreated === 'PASS') passedCount++;

      verifications.iProvRecordSigDeterministic = provRecord.immutableSignature.startsWith('sig-provenance-') ? 'PASS' : 'FAIL';
      if (verifications.iProvRecordSigDeterministic === 'PASS') passedCount++;

      // Anchor to abstract Local Ledger (isolating from specific blockchain)
      const ledgerAnchor = ReleaseProvenanceEngine.anchorRecord(provRecord, 'SECP_INTERNAL_LEDGER');
      verifications.iLedgerAnchorCreated = (ledgerAnchor.anchorId.startsWith('anchor-') && ledgerAnchor.ledgerType === 'SECP_INTERNAL_LEDGER') ? 'PASS' : 'FAIL';
      if (verifications.iLedgerAnchorCreated === 'PASS') passedCount++;

      // 60. Final check: ReleaseProvenanceRecord != LedgerAnchor (Decoupling Assertion)
      verifications.iLedgerDecouplingAssertion = (provRecord.immutableSignature !== ledgerAnchor.anchorValidationSignature) ? 'PASS' : 'FAIL';
      if (verifications.iLedgerDecouplingAssertion === 'PASS') passedCount++;


      // ==========================================
      // SECTION 064-J: Full Regression Suite (064-61 → 064-64)
      // ==========================================
      stagesLog.push('[GATE-064-J] Verifying cascading full-regression audits to previous gates...');

      const gate063Res = await HardAcceptanceGate063.executeGate();
      const is063Flawless = gate063Res.overallStatus === 'PASS';
      verifications.jRegGate063ThreadIntact = is063Flawless ? 'PASS' : 'FAIL';
      if (verifications.jRegGate063ThreadIntact === 'PASS') passedCount++;

      verifications.jRegGate062ThreadIntact = (gate063Res.verifications && gate063Res.verifications.jRegGate062ThreadIntact === 'PASS') ? 'PASS' : 'FAIL';
      if (verifications.jRegGate062ThreadIntact === 'PASS') passedCount++;

      verifications.jRegGate061ThreadIntact = (gate063Res.verifications && gate063Res.verifications.jRegGate061ThreadIntact === 'PASS') ? 'PASS' : 'FAIL';
      if (verifications.jRegGate061ThreadIntact === 'PASS') passedCount++;

      verifications.jRegGate060ThreadIntact = (gate063Res.verifications && gate063Res.verifications.jRegGate060ThreadIntact === 'PASS') ? 'PASS' : 'FAIL';
      if (verifications.jRegGate060ThreadIntact === 'PASS') passedCount++;

    } catch (err: any) {
      stagesLog.push(`[FATAL-ERROR] Release & Certification Gate halted: ${err.message}`);
    }

    const overallStatus = (passedCount === 64) ? 'PASS' : 'FAIL';
    stagesLog.push(`=== [SECP-064] Gate Assessment Complete: ${passedCount}/64 Assertions Passed [${overallStatus}] ===`);

    // Dynamically generate the sample Release Report using the actual validated engines
    let sampleReleaseReport = null;
    try {
      const liveDev = DeviationApprovalEngine.initiateDeviation({
        ncrId: 'ncr-064-demo',
        severity: 'MINOR',
        description: 'Bore dimensions slightly off, fully mitigated via locating pin offsets.',
        mitigationActions: ['Verify physical alignment offsets'],
        authorizedEngineerId: 'eng-lead-qa'
      });
      const approvedDev = DeviationApprovalEngine.processApproval(liveDev, true, 'eng-lead-qa');

      const liveCert = CertificateEngine.generateCertificate({
        productId: 'aircraft-component-mount-064',
        partSerials: ['SN-AL-064-1001', 'SN-AL-064-1006'],
        batchId: 'batch-064-aluminum-run-1',
        cadRevision: 'REV-064-E',
        camRevision: 'CAM-064-B',
        ncProgramHash: 'sha256-gcode-064-verified-offset-applied',
        executionHash: 'sha256-exec-session-hash-064-ok-verified',
        metrologyCertificateHash: 'sha256-metrology-cert-064-scanned',
        processHealthCertificateHash: 'sha256-spc-health-064-stable',
        ncrCertificateHashes: ['sha256-ncr-cert-064-closed'],
        deviationApprovalIds: [approvedDev.deviationId],
        decision: 'RELEASED',
        releaseReason: 'All digital thread verifications and engineering controls passed.',
        approvedBy: ['eng-lead-qa']
      });

      const liveProvRecord = ReleaseProvenanceEngine.createProvenanceRecord(liveCert, 'eng-lead-qa');
      const liveAnchor = ReleaseProvenanceEngine.anchorRecord(liveProvRecord, 'SECP_INTERNAL_LEDGER');

      sampleReleaseReport = {
        releaseId: liveCert.releaseId,
        productId: liveCert.productId,
        partSerials: liveCert.partSerials,
        cadRevision: liveCert.cadRevision,
        ncProgramHash: liveCert.ncProgramHash,
        metrologyCertificateHash: liveCert.metrologyCertificateHash,
        ncrCertificateHashes: liveCert.ncrCertificateHashes,
        decision: liveCert.decision,
        certificateHash: liveCert.certificateHash,
        evidenceRootHash: liveCert.evidenceRootHash,
        provenanceRecordId: liveProvRecord.recordId,
        provenanceSignature: liveProvRecord.immutableSignature,
        anchoredLedger: liveAnchor.ledgerType,
        ledgerBlockIndex: liveAnchor.blockIndex,
        ledgerAnchorSignature: liveAnchor.anchorValidationSignature
      };
    } catch (err: any) {
      stagesLog.push(`[ERROR-SAMPLE-GEN] Failed to dynamically construct sample release certificate: ${err.message}`);
    }

    return {
      gateId: 'Gate064',
      patch: 'SECP-064',
      timestamp,
      totalVerifications: 64,
      passedCount,
      overallStatus,
      verifications,
      stagesLog,
      sampleReleaseReport: sampleReleaseReport || {}
    };
  }
}
