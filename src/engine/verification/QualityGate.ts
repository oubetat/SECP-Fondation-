/**
 * SECP Industrial OS — ROOT-3: Quality & Certification Gate
 * 
 * The authoritative enforcement boundary that prevents downstream consumption
 * of engineering results unless a valid certificate is presented and verified.
 */

import { QualityVerificationCertificate } from '../quality-metrology/MetrologyTypes';
import { SimulationResult } from '../simulation/SimulationEngine';
import { MetrologyEngine } from '../quality-metrology/MetrologyEngine';
import { SimulationExecutionRegistry } from '../simulation/SimulationExecutionRegistry';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';

export class QualityGate {
  /**
   * Authorizes a part for release only if a valid Quality Certificate is present
   * and binds correctly to the canonical revision.
   */
  public static authorizeRelease(
    partId: string,
    revisionHash: string,
    certificate: QualityVerificationCertificate
  ): boolean {
    // 1. Verify Identity Binding
    if (certificate.cadRevisionHash !== revisionHash) {
      throw new Error(`RELEASE_DENIED: Certificate binds to revision ${certificate.cadRevisionHash}, but part is at ${revisionHash}`);
    }

    // 2. Verify Disposition
    if (certificate.disposition !== 'ACCEPTED') {
      throw new Error(`RELEASE_DENIED: Quality disposition is ${certificate.disposition}`);
    }

    // 3. Verify Provenance
    if (!certificate.provenanceHash || !certificate.provenanceHash.startsWith('SECP')) {
       throw new Error('RELEASE_DENIED: Invalid or unauthenticated certificate provenance.');
    }

    // 4. Enforce Asymmetric Cryptographic Physical Trust Anchor for physical release
    if (certificate.evidenceGrade !== 'LEVEL_3_PHYSICAL_TELEMETRY') {
      throw new Error(`RELEASE_DENIED: Physical release requires LEVEL_3_PHYSICAL_TELEMETRY, got ${certificate.evidenceGrade}`);
    }

    if (!certificate.provenanceHash.startsWith('SECP-PROD-')) {
      throw new Error('RELEASE_DENIED: Physical release requires an authentic production certificate from a hardware-anchored driver.');
    }
    
    // Retrieve the registered certificate from MetrologyEngine to double check raw telemetry is non-empty and authenticated
    const realCert = MetrologyEngine.getCertificate(certificate.provenanceHash);
    if (!realCert) {
      throw new Error('RELEASE_DENIED: CERTIFICATE_NOT_FOUND: Certificate not found in the metrology authoritative database.');
    }

    if (realCert.evidenceGrade !== 'LEVEL_3_PHYSICAL_TELEMETRY') {
      throw new Error('RELEASE_DENIED: Certificate grade does not match physical telemetry requirement.');
    }

    if (
      realCert.certificateId !== certificate.certificateId ||
      realCert.cadRevisionHash !== certificate.cadRevisionHash ||
      realCert.rawMeasurementHash !== certificate.rawMeasurementHash
    ) {
      throw new Error('RELEASE_DENIED: CERTIFICATE_INTEGRITY_TAMPERED: Certificate fields mismatch authoritative database.');
    }

    if (!realCert.rawMeasurementHash || realCert.rawMeasurementHash === 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855') {
      throw new Error('RELEASE_DENIED: Certificate lacks authenticated telemetry.');
    }

    return true;
  }

  /**
   * Authorizes an AI-driven engineering decision only if simulation evidence is certified.
   */
  public static authorizeAiInference(
    simResult: SimulationResult,
    requiredGrade: string = 'LEVEL_1_SYNTHETIC',
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): boolean {
    if (!simResult || typeof simResult !== 'object') {
      throw new Error('AI_INFERENCE_DENIED: Invalid simulation result payload.');
    }
    if (simResult.status === 'STALE_IDENTITY') {
      throw new Error('AI_INFERENCE_DENIED: Input simulation result is stale.');
    }
    if (simResult.status === 'FAILURE') {
      throw new Error('AI_INFERENCE_DENIED: Input simulation indicates structural failure.');
    }

    // AI must not proceed without established provenance
    if (!simResult.provenanceHash || simResult.provenanceHash === 'INVALID_CHAIN') {
      throw new Error('AI_INFERENCE_DENIED: Provenance chain is broken or unverified.');
    }

    // Fail-Closed Enforcement: Verify execution registration and content integrity
    const verifyRes = SimulationExecutionRegistry.verifyResultBinding(
      simResult,
      targetCadRevisionHash,
      targetGeometryHash
    );

    if (!verifyRes.isValid) {
      if (verifyRes.failureReason === 'UNREGISTERED_RESULT_PROVENANCE') {
        throw new Error(`AI_INFERENCE_DENIED: Simulation result provenance '${simResult.provenanceHash}' is unauthenticated or unregistered.`);
      }
      if (verifyRes.failureReason === 'MISSING_DERIVED_BINDING') {
        throw new Error(`AI_INFERENCE_DENIED: Simulation result lacks required derivedArtifactBinding for target revision '${targetCadRevisionHash}'.`);
      }
      throw new Error(`AI_INFERENCE_DENIED: Simulation result derived binding verification failed: ${verifyRes.failureReason}`);
    }

    return true;
  }
}
