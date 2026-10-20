/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Comprehensive Multi-Domain PCB Verification Service & Forensic Evidence Binder:
 * Coordinates Canonical, Schematic, Electrical Connectivity, 2D/3D Geometry,
 * Design Rule Checks (DRC), and Manufacturing Checks (DFM).
 * Authoritatively binds verdicts to EngineeringEvidenceLedger with cryptographic hash chains.
 */

import { createHash } from 'crypto';
import {
  PcbCanonicalModel,
  PcbCanonicalModelValidator
} from './PcbCanonicalModel';
import { PcbDesignRuleset, PcbDesignRulesManager } from './PcbDesignRules';
import { PcbConnectivityVerifier, ConnectivityReport } from './PcbConnectivityVerifier';
import { PcbGeometryVerifier, GeometryReport } from './PcbGeometryVerifier';
import { PcbMechanicalVerifier, MechanicalReport } from './PcbMechanicalVerifier';
import { PcbSchematicConsistencyVerifier, SchematicConsistencyReport } from './PcbSchematicConsistencyVerifier';
import { PcbDrcDfmVerifier, DrcDfmReport } from './PcbDrcDfmVerifier';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import { EvidenceLedgerEntry } from '../evidence/ledger/types';

export type OverallVerificationStatus = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_PROVEN';

export interface PcbVerificationEvidenceRecord {
  verificationRunId: string;
  verifierVersion: string;
  designId: string;
  revisionId: string;
  canonicalModelHash: string;
  rulesetHash: string;
  compositeEvidenceHash: string;
  overallStatus: OverallVerificationStatus;
  passed: boolean;
  canonicalValidationPassed: boolean;
  schematicConsistencyStatus: 'PASS' | 'FAIL' | 'INCOMPLETE';
  connectivityStatus: string;
  geometryPassed: boolean;
  drcDfmStatus: 'PASS' | 'FAIL' | 'INCOMPLETE';
  mechanicalFitStatus: string;
  totalViolationsCount: number;
  totalWarningsCount: number;
  ledgerEntryHash?: string;
  evidenceReference: string;
  timestamp: string;
}

export interface ComprehensivePcbVerificationResult {
  overallStatus: OverallVerificationStatus;
  passed: boolean;
  evidence: PcbVerificationEvidenceRecord;
  canonicalReport: ReturnType<typeof PcbCanonicalModelValidator.validate>;
  schematicReport: SchematicConsistencyReport;
  connectivityReport: ConnectivityReport;
  geometryReport: GeometryReport;
  drcDfmReport: DrcDfmReport;
  mechanicalReport: MechanicalReport;
  ledgerEntry?: EvidenceLedgerEntry;
}

export class PcbVerificationService {
  public static readonly VERIFIER_VERSION = '2.0.0-PROD-PHASE2';

  /**
   * Computes composite SHA-256 hash tying model hash, ruleset hash, and revision.
   */
  public static computeCompositeHash(
    modelHash: string,
    rulesetHash: string,
    revisionId: string
  ): string {
    const payload = `${modelHash}:${rulesetHash}:${revisionId}:${this.VERIFIER_VERSION}`;
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Executes full-suite PCB verification and registers cryptographic evidence in SECP ledger.
   */
  public static verifyAndAttest(
    model: PcbCanonicalModel,
    customRuleset?: PcbDesignRuleset,
    registerInLedger: boolean = true
  ): ComprehensivePcbVerificationResult {
    const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const designId = model.designId || 'SECP-PCB-CANONICAL-REF';
    const revisionId = model.revisionId || 'REV-2.0.0';

    // 1. Resolve Ruleset and compute hashes
    const ruleset = customRuleset || model.ruleset || PcbDesignRulesManager.getDefaultStandardRuleset();
    const rulesetValidation = PcbDesignRulesManager.validateRuleset(ruleset);
    const canonicalModelHash = PcbCanonicalModelValidator.computeCanonicalHash(model);
    const rulesetHash = rulesetValidation.rulesetHash;
    const compositeHash = this.computeCompositeHash(canonicalModelHash, rulesetHash, revisionId);

    // 2. Execute Verifiers
    const canonicalReport = PcbCanonicalModelValidator.validate(model);
    const connectivityReport = PcbConnectivityVerifier.verify(model);
    const schematicReport = PcbSchematicConsistencyVerifier.verify(model, connectivityReport);
    const geometryReport = PcbGeometryVerifier.verify(model);
    const drcDfmReport = PcbDrcDfmVerifier.verify(model, ruleset);
    const mechanicalReport = PcbMechanicalVerifier.verify(model);

    // 3. Determine Overall Status
    let overallStatus: OverallVerificationStatus = 'PASS';

    // If incomplete data
    if (
      connectivityReport.status === 'INCOMPLETE_FOOTPRINT_DATA' ||
      schematicReport.status === 'INCOMPLETE' ||
      drcDfmReport.status === 'INCOMPLETE'
    ) {
      overallStatus = 'INCOMPLETE';
    } else if (
      !canonicalReport.valid ||
      !connectivityReport.passed ||
      !schematicReport.passed ||
      !geometryReport.passed ||
      !drcDfmReport.passed ||
      !mechanicalReport.passed
    ) {
      overallStatus = 'FAIL';
    } else {
      overallStatus = 'PASS';
    }

    const totalViolations = 
      canonicalReport.violations.length +
      connectivityReport.violations.length +
      schematicReport.violations.length +
      geometryReport.violations.length +
      drcDfmReport.violationsCount +
      mechanicalReport.violations.length;

    const totalWarnings = 
      schematicReport.violations.filter(v => v.severity === 'WARNING').length +
      geometryReport.warningsCount +
      drcDfmReport.warningsCount;

    const evidenceReference = `SECP-EVID-PCB-${designId}-${compositeHash.substring(0, 12)}`;

    const evidenceRecord: PcbVerificationEvidenceRecord = {
      verificationRunId: runId,
      verifierVersion: this.VERIFIER_VERSION,
      designId,
      revisionId,
      canonicalModelHash,
      rulesetHash,
      compositeEvidenceHash: compositeHash,
      overallStatus,
      passed: overallStatus === 'PASS',
      canonicalValidationPassed: canonicalReport.valid,
      schematicConsistencyStatus: schematicReport.status,
      connectivityStatus: connectivityReport.status,
      geometryPassed: geometryReport.passed,
      drcDfmStatus: drcDfmReport.status,
      mechanicalFitStatus: mechanicalReport.boardFitStatus,
      totalViolationsCount: totalViolations,
      totalWarningsCount: totalWarnings,
      evidenceReference,
      timestamp: new Date().toISOString()
    };

    let ledgerEntry: EvidenceLedgerEntry | undefined;

    if (registerInLedger) {
      const ledger = EngineeringEvidenceLedger.getInstance();
      ledgerEntry = ledger.registerEvidence({
        evidenceType: 'QUALITY_CONFORMANCE',
        engineeringObjectId: designId,
        objectRevision: revisionId,
        organizationId: 'SECP-FOUNDATION',
        producerIdentity: 'SECP-PCB-DESIGN-INTELLIGENCE-V2',
        producerType: 'ALGORITHMIC',
        sourceSystem: 'SECP-PCB-ENGINE-PHASE2',
        sourceVersion: this.VERIFIER_VERSION,
        payload: {
          ...evidenceRecord,
          evidenceHash: compositeHash,
          rulesetProfile: ruleset.manufacturerProfile
        }
      });

      evidenceRecord.ledgerEntryHash = ledgerEntry.entryHash;
    }

    return {
      overallStatus,
      passed: overallStatus === 'PASS',
      evidence: evidenceRecord,
      canonicalReport,
      schematicReport,
      connectivityReport,
      geometryReport,
      drcDfmReport,
      mechanicalReport,
      ledgerEntry
    };
  }

  /**
   * Forensic check ensuring an evidence record matches the current model and ruleset.
   * Detects stale verification proofs if geometry or rules changed!
   */
  public static verifyEvidenceFreshness(
    evidence: PcbVerificationEvidenceRecord,
    currentModel: PcbCanonicalModel,
    currentRuleset: PcbDesignRuleset
  ): { isFresh: boolean; reason?: string } {
    const currentModelHash = PcbCanonicalModelValidator.computeCanonicalHash(currentModel);
    const currentRulesetHash = PcbDesignRulesManager.computeRulesetHash(currentRuleset);

    if (evidence.canonicalModelHash !== currentModelHash) {
      return {
        isFresh: false,
        reason: `Model geometry mutated: evidence had hash ${evidence.canonicalModelHash.substring(0, 10)}..., but model is now ${currentModelHash.substring(0, 10)}...`
      };
    }

    if (evidence.rulesetHash !== currentRulesetHash) {
      return {
        isFresh: false,
        reason: `Design rules mutated: evidence had ruleset hash ${evidence.rulesetHash.substring(0, 10)}..., but ruleset is now ${currentRulesetHash.substring(0, 10)}...`
      };
    }

    if (evidence.revisionId !== (currentModel.revisionId || 'REV-2.0.0')) {
      return {
        isFresh: false,
        reason: `Revision mismatch: evidence was for ${evidence.revisionId}, current model is ${currentModel.revisionId}`
      };
    }

    return { isFresh: true };
  }
}
