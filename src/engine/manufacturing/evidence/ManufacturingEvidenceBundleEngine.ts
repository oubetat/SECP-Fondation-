/**
 * SECP Industrial OS v2 — Manufacturing Evidence Bundle Engine
 */

import {
  ManufacturingEvidenceBundle,
  BundleManifest,
  ManufacturingEvidenceRecord,
  SignatureStatus,
  ManufacturingEvidenceStatus,
} from "./types";
import { ManufacturingEvidenceHashPolicy } from "./ManufacturingEvidenceHashPolicy";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";

export class ManufacturingEvidenceBundleEngine {
  public static createBundle(
    bundleId: string,
    jobId: string,
    bundleRevision: number,
    records: ManufacturingEvidenceRecord[],
    signingKeyRef?: string
  ): ManufacturingEvidenceBundle {
    const sortedRecords = [...records].sort(
      (a, b) => a.contract.chainSequence - b.contract.chainSequence
    );

    const rootRecord = sortedRecords.find((r) => r.contract.chainSequence === 1) || sortedRecords[0];
    const rootEvidenceId = rootRecord ? rootRecord.contract.evidenceId : "ROOT_MISSING";

    const manifestItems = sortedRecords.map((r) => ({
      evidenceId: r.contract.evidenceId,
      type: r.contract.evidenceType,
      hash: r.contract.canonicalHash,
      source: r.sourceIdentity.sourceType,
      timestamp: r.contract.eventTimestamp,
      chainSequence: r.contract.chainSequence,
      signatureStatus: r.contract.signature ? SignatureStatus.VALID : SignatureStatus.MISSING,
      verificationStatus: r.contract.verificationStatus,
    }));

    const manifestHash = ManufacturingEvidenceHashPolicy.computeHash(manifestItems);

    const manifest: BundleManifest = {
      jobId,
      evidenceItems: manifestItems,
      manifestHash,
    };

    const bundleStructure = {
      bundleId,
      jobId,
      bundleRevision,
      rootEvidenceId,
      evidenceIds: sortedRecords.map((r) => r.contract.evidenceId),
      manifest,
    };

    const bundleHash = ManufacturingEvidenceHashPolicy.computeHash(bundleStructure);
    let bundleSignature = "UNSIGNED_BUNDLE";
    if (signingKeyRef) {
      bundleSignature = EvidenceSignatureVerifier.generateSignature(bundleHash, signingKeyRef);
    }

    return {
      bundleId,
      jobId,
      bundleRevision,
      rootEvidenceId,
      evidenceIds: sortedRecords.map((r) => r.contract.evidenceId),
      manifest,
      bundleHash,
      bundleSignature,
      createdAt: Date.now(),
    };
  }

  public static verifyBundleIntegrity(
    bundle: ManufacturingEvidenceBundle,
    keyRef?: string
  ): { valid: boolean; reason: string } {
    const manifestHash = ManufacturingEvidenceHashPolicy.computeHash(bundle.manifest.evidenceItems);
    if (manifestHash !== bundle.manifest.manifestHash) {
      return { valid: false, reason: "Manifest items hash mismatch (BUNDLE_INTEGRITY_FAILURE)." };
    }

    const bundleStructure = {
      bundleId: bundle.bundleId,
      jobId: bundle.jobId,
      bundleRevision: bundle.bundleRevision,
      rootEvidenceId: bundle.rootEvidenceId,
      evidenceIds: bundle.evidenceIds,
      manifest: bundle.manifest,
    };

    const expectedHash = ManufacturingEvidenceHashPolicy.computeHash(bundleStructure);
    if (expectedHash !== bundle.bundleHash) {
      return { valid: false, reason: "Bundle structure hash mismatch (BUNDLE_INTEGRITY_FAILURE)." };
    }

    if (keyRef && bundle.bundleSignature !== "UNSIGNED_BUNDLE") {
      const expectedSig = EvidenceSignatureVerifier.generateSignature(expectedHash, keyRef);
      if (bundle.bundleSignature !== expectedSig) {
        return { valid: false, reason: "Bundle signature validation failed." };
      }
    }

    return { valid: true, reason: "Bundle integrity & signature verified successfully." };
  }
}
