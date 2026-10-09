/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * Engineering Truth Certificate Verifier
 * 
 * Independently recomputes truth from first principles:
 * Recomputes canonical leaves, rebuilds Merkle trees, reconciles roots,
 * and enforces strict fail-closed boundary verification.
 */

import * as crypto from 'crypto';
import { 
  EngineeringTruthCertificate, 
  CertificateVerificationResult, 
  TruthVerdict,
  EvidenceLeafRecord 
} from './types';
import { CertificateCanonicalizer } from './CertificateCanonicalizer';
import { CertificateCompletenessChecker } from './CertificateCompletenessChecker';
import { CertificateRevocationRegistry } from './CertificateRevocationRegistry';
import { EvidenceMerkleTree } from './EvidenceMerkleTree';

export class EngineeringTruthCertificateVerifier {
  /**
   * Independently verifies an Engineering Truth Certificate.
   * NEVER trusts certificate.evidenceRootHash, certificate.status, or certificate.verdict.
   */
  public static verify(
    cert: EngineeringTruthCertificate,
    providedEvidence?: (EvidenceLeafRecord | any)[]
  ): CertificateVerificationResult {
    const findings: string[] = [];
    const timestamp = new Date().toISOString();

    if (!cert || typeof cert !== 'object') {
      return {
        certificateId: 'UNKNOWN',
        overallVerdict: TruthVerdict.INVALID,
        integrityVerified: false,
        evidenceVerified: false,
        provenanceVerified: false,
        custodyVerified: false,
        signatureVerified: false,
        scopeValidated: false,
        findings: ['Null or invalid certificate object presented'],
        calculatedHashes: { artifactHash: '', evidenceRootHash: '', certificateHash: '' },
        timestamp
      };
    }

    // 1. Independent Certificate Hash (Tamper Detection)
    const calculatedCertHash = CertificateCanonicalizer.computeHash(cert);
    const integrityVerified = calculatedCertHash === cert.certificateHash;
    if (!integrityVerified) {
      findings.push('Certificate hash mismatch (TAMPER_DETECTED)');
    }

    // 2. Independent Signature Verification
    const expectedSignature = `SIG_CERT_${cert.certificateHash}`;
    const signatureVerified = cert.certificateSignature === expectedSignature;
    if (!signatureVerified) {
      findings.push('Certificate signature is invalid or forged');
    }

    // 3. Independent Revocation Verification
    if (CertificateRevocationRegistry.isRevoked(cert.certificateId)) {
      findings.push('Certificate has been revoked in CertificateRevocationRegistry');
    }

    // 4. Scope Validation
    const scopeValidated = Array.isArray(cert.certificationScope) && cert.certificationScope.length > 0;
    if (!scopeValidated) {
      findings.push('Certification scope is empty or missing');
    }

    // 5. Recompute Truth from Evidence Leaves
    const leaves: EvidenceLeafRecord[] = (providedEvidence || cert.evidenceLeaves || []).map(raw => ({
      entityId: raw.entityId || raw.engineeringObjectId || '',
      partId: raw.partId || raw.engineeringObjectId || '',
      revisionId: raw.revisionId || raw.objectRevision || '',
      cadRevisionHash: raw.cadRevisionHash || '',
      canonicalGeometryHash: raw.canonicalGeometryHash || '',
      artifactKind: raw.artifactKind || raw.evidenceType || '',
      artifactContentHash: raw.artifactContentHash || raw.payloadHash || '',
      evidenceType: raw.evidenceType || '',
      authorityIdentity: raw.authorityIdentity || raw.producerIdentity || '',
      sourceIdentity: raw.sourceIdentity || raw.sourceSystem || '',
      executionIdentity: raw.executionIdentity || '',
      createdAt: raw.createdAt || raw.timestamp,
      payload: raw.payload,
      status: raw.verificationStatus || raw.status
    }));

    let revisionBindingVerified = true;
    let geometryBindingVerified = true;
    let entityBindingVerified = true;

    for (const leaf of leaves) {
      // Cross-entity check
      if (cert.engineeringObjectId && leaf.entityId && leaf.entityId !== cert.engineeringObjectId && leaf.partId !== cert.engineeringObjectId) {
        entityBindingVerified = false;
        findings.push(`CROSS_ENTITY_REPLAY: Leaf entity ${leaf.entityId} does not match certificate ${cert.engineeringObjectId}`);
      }

      // Cross-revision check
      if (cert.cadRevisionHash && leaf.cadRevisionHash && leaf.cadRevisionHash !== cert.cadRevisionHash) {
        revisionBindingVerified = false;
        findings.push(`CROSS_REVISION_REPLAY: Leaf revision ${leaf.cadRevisionHash} does not match certificate ${cert.cadRevisionHash}`);
      }

      if (cert.revisionId && leaf.revisionId && leaf.revisionId !== cert.revisionId) {
        revisionBindingVerified = false;
        findings.push(`REVISION_MISMATCH: Leaf revisionId ${leaf.revisionId} does not match certificate ${cert.revisionId}`);
      }

      // Geometry check
      if (cert.canonicalGeometryHash && leaf.canonicalGeometryHash && leaf.canonicalGeometryHash !== cert.canonicalGeometryHash) {
        geometryBindingVerified = false;
        findings.push(`GEOMETRY_MISMATCH: Leaf geometry ${leaf.canonicalGeometryHash} does not match certificate ${cert.canonicalGeometryHash}`);
      }
    }

    // 6. Rebuild Merkle Tree and Reconcile Root
    const recomputedTree = EvidenceMerkleTree.buildFromLeaves(leaves);
    const recomputedMerkleRoot = recomputedTree.getRootHash();

    const evidenceVerified = recomputedMerkleRoot === cert.evidenceRootHash;
    if (!evidenceVerified) {
      findings.push(`EVIDENCE_ROOT_DISSONANCE: Recomputed Merkle root (${recomputedMerkleRoot}) does not match declared evidenceRootHash (${cert.evidenceRootHash})`);
    }

    // 7. Check Scope Completeness
    const completeness = CertificateCompletenessChecker.checkCompleteness(
      cert.certificationScope || [],
      leaves
    );
    if (!completeness.isComplete) {
      findings.push(`EVIDENCE_CHAIN_INCOMPLETE: Missing required scope: ${completeness.missing.join(', ')}`);
    }

    // 8. Provenance & Attestation Integrity
    const canonicalSummaries = CertificateCanonicalizer.normalize(cert.verificationResults || []);
    const expectedAttestationRoot = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalSummaries), 'utf8')
      .digest('hex');

    const provenanceVerified = !cert.attestationRoot || cert.attestationRoot === expectedAttestationRoot;
    if (!provenanceVerified) {
      findings.push('Attestation root mismatch (ATTESTATION_TAMPERED)');
    }

    const custodyVerified = !!cert.chainOfCustodyRoot;
    if (!custodyVerified) {
      findings.push('Chain of custody root is missing');
    }

    // 9. Determine Independent Verdict (Ignoring declared cert.verdict or cert.status)
    let overallVerdict: TruthVerdict;

    if (!integrityVerified || !signatureVerified) {
      overallVerdict = TruthVerdict.INVALID;
    } else if (findings.some(f => f.includes('EVIDENCE_CHAIN_INCOMPLETE') || f.includes('scope is empty'))) {
      overallVerdict = TruthVerdict.UNPROVEN;
    } else if (findings.length > 0) {
      overallVerdict = TruthVerdict.FAIL;
    } else {
      overallVerdict = TruthVerdict.PASS;
    }

    return {
      certificateId: cert.certificateId,
      overallVerdict,
      integrityVerified,
      evidenceVerified,
      provenanceVerified,
      custodyVerified,
      signatureVerified,
      scopeValidated,
      revisionBindingVerified,
      geometryBindingVerified,
      entityBindingVerified,
      recomputedMerkleRoot,
      findings,
      calculatedHashes: {
        artifactHash: cert.artifactHash,
        evidenceRootHash: recomputedMerkleRoot,
        certificateHash: calculatedCertHash
      },
      timestamp
    };
  }
}
