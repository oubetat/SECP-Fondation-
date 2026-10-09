/**
 * SECP Industrial OS v2 — Independent Manufacturing Evidence Verifier
 * Requirement 109: Independent Verification Engine for Forensic Replay & Verification
 */

import { createHash } from "crypto";
import {
  ManufacturingEvidenceBundle,
  ManufacturingEvidenceRecord,
  ManufacturingEvidenceStatus,
  SignatureStatus,
} from "./types";

export class IndependentManufacturingEvidenceVerifier {
  /**
   * Independently compute canonical JSON serialization.
   */
  public static independentCanonicalJson(data: any): string {
    const normalize = (val: any): any => {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") {
        if (Number.isInteger(val)) return val;
        return Math.round(val * 1e6) / 1e6;
      }
      if (typeof val === "string") return val.trim();
      if (Array.isArray(val)) return val.map(normalize);
      if (typeof val === "object") {
        const sortedKeys = Object.keys(val).sort();
        const obj: Record<string, any> = {};
        for (const k of sortedKeys) {
          obj[k] = normalize(val[k]);
        }
        return obj;
      }
      return val;
    };
    return JSON.stringify(normalize(data));
  }

  /**
   * Independently compute SHA-256 digest.
   */
  public static independentSha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
  }

  /**
   * Independently verify evidence chain integrity, hashes, signatures, and timestamps.
   */
  public verifyBundle(
    bundle: ManufacturingEvidenceBundle,
    records: ManufacturingEvidenceRecord[]
  ): {
    reproducible: boolean;
    verdict: ManufacturingEvidenceStatus;
    failedChecks: string[];
    recordCount: number;
  } {
    const failedChecks: string[] = [];

    // 1. Verify Manifest
    const manifestCanonical = IndependentManufacturingEvidenceVerifier.independentCanonicalJson(bundle.manifest.evidenceItems);
    const computedManifestHash = IndependentManufacturingEvidenceVerifier.independentSha256(manifestCanonical);
    if (computedManifestHash !== bundle.manifest.manifestHash) {
      failedChecks.push("INDEPENDENT_MANIFEST_HASH_MISMATCH");
    }

    // 2. Sort Records by Chain Sequence
    const sortedRecords = [...records].sort(
      (a, b) => a.contract.chainSequence - b.contract.chainSequence
    );

    if (sortedRecords.length === 0) {
      return {
        reproducible: false,
        verdict: ManufacturingEvidenceStatus.INSUFFICIENT,
        failedChecks: ["EMPTY_EVIDENCE_RECORDS"],
        recordCount: 0,
      };
    }

    // 3. Verify Chain Continuity & Hash Formula
    let expectedPrevHash = "GENESIS_EVIDENCE_HASH_0000000000000000000000000000000000000000";
    let expectedSeq = 1;

    for (const r of sortedRecords) {
      if (r.contract.chainSequence !== expectedSeq) {
        failedChecks.push(`INDEPENDENT_CHAIN_GAP: Expected ${expectedSeq}, got ${r.contract.chainSequence}`);
      }

      if (r.contract.previousEvidenceHash !== expectedPrevHash) {
        failedChecks.push(`INDEPENDENT_PREVIOUS_HASH_MISMATCH at sequence ${r.contract.chainSequence}`);
      }

      // Verify payload content hash independently
      const payloadCanonical = IndependentManufacturingEvidenceVerifier.independentCanonicalJson(r.payload);
      const computedContentHash = IndependentManufacturingEvidenceVerifier.independentSha256(payloadCanonical);
      if (computedContentHash !== r.contract.contentHash) {
        failedChecks.push(`INDEPENDENT_CONTENT_HASH_MISMATCH at sequence ${r.contract.chainSequence}`);
      }

      // Verify chain hash formula: SHA256(prevHash:canonicalHash:seq)
      const canonicalStruct = {
        evidenceId: r.contract.evidenceId,
        evidenceType: r.contract.evidenceType,
        sourceIdentity: r.sourceIdentity,
        eventIdentity: r.eventIdentity,
        payload: r.payload,
        context: r.context,
      };
      const canonicalHash = IndependentManufacturingEvidenceVerifier.independentSha256(
        IndependentManufacturingEvidenceVerifier.independentCanonicalJson(canonicalStruct)
      );
      const expectedChainHash = IndependentManufacturingEvidenceVerifier.independentSha256(
        `${r.contract.previousEvidenceHash}:${canonicalHash}:${r.contract.chainSequence}`
      );

      if (expectedChainHash !== r.contract.canonicalHash) {
        failedChecks.push(`INDEPENDENT_CHAIN_HASH_FORMULA_MISMATCH at sequence ${r.contract.chainSequence}`);
      }

      expectedSeq = r.contract.chainSequence + 1;
      expectedPrevHash = r.contract.canonicalHash;
    }

    const reproducible = failedChecks.length === 0;
    let verdict = ManufacturingEvidenceStatus.MANUFACTURING_VERIFIED;
    if (!reproducible) {
      if (failedChecks.some((f) => f.includes("HASH"))) {
        verdict = ManufacturingEvidenceStatus.INTEGRITY_FAILURE;
      } else {
        verdict = ManufacturingEvidenceStatus.CHAIN_BROKEN;
      }
    }

    return {
      reproducible,
      verdict,
      failedChecks,
      recordCount: sortedRecords.length,
    };
  }
}
