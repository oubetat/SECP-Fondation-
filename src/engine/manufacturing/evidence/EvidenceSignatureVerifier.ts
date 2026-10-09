/**
 * SECP Industrial OS v2 — Evidence Signature Verifier
 */

import { ManufacturingEvidenceRecord, SignatureStatus } from "./types";
import { ManufacturingEvidenceHashPolicy } from "./ManufacturingEvidenceHashPolicy";
import { createHash } from "crypto";

export class EvidenceSignatureVerifier {
  private registeredKeys: Map<string, { publicKey: string; expired: boolean }> = new Map();

  constructor() {
    // Default system keys for simulation / verification
    this.registeredKeys.set("KEY_CAD_RELEASE_01", { publicKey: "PUB_CAD_01", expired: false });
    this.registeredKeys.set("KEY_CAM_ENG_01", { publicKey: "PUB_CAM_01", expired: false });
    this.registeredKeys.set("KEY_GCODE_VERIFIER_01", { publicKey: "PUB_GCODE_01", expired: false });
    this.registeredKeys.set("KEY_CNC_CTRL_01", { publicKey: "PUB_CNC_01", expired: false });
    this.registeredKeys.set("KEY_INSPECTOR_01", { publicKey: "PUB_INSP_01", expired: false });
    this.registeredKeys.set("KEY_EXPIRED_01", { publicKey: "PUB_OLD_01", expired: true });
  }

  public registerKey(keyRef: string, publicKey: string, expired = false): void {
    this.registeredKeys.set(keyRef, { publicKey, expired });
  }

  /**
   * Helper to mock-sign an evidence canonical payload with a key reference.
   */
  public static generateSignature(canonicalHash: string, keyRef: string): string {
    return createHash("sha256").update(`${keyRef}:${canonicalHash}:SIGNED`).digest("hex");
  }

  /**
   * Verify signature authenticity.
   */
  public verifySignature(record: ManufacturingEvidenceRecord): {
    status: SignatureStatus;
    details: string;
    signerAsserted: boolean;
  } {
    const signature = record.contract.signature;
    const keyRef = record.contract.signingIdentity;

    if (!signature || !keyRef) {
      return {
        status: SignatureStatus.MISSING,
        details: "No signature or signing identity provided.",
        signerAsserted: false,
      };
    }

    const keyInfo = this.registeredKeys.get(keyRef);
    if (!keyInfo) {
      return {
        status: SignatureStatus.UNKNOWN_KEY,
        details: `Key reference '${keyRef}' is unknown to signature verifier.`,
        signerAsserted: false,
      };
    }

    if (keyInfo.expired) {
      return {
        status: SignatureStatus.EXPIRED_KEY,
        details: `Key reference '${keyRef}' is expired.`,
        signerAsserted: false,
      };
    }

    const expectedSig = EvidenceSignatureVerifier.generateSignature(record.contract.canonicalHash, keyRef);
    if (signature !== expectedSig) {
      return {
        status: SignatureStatus.INVALID,
        details: "Signature hash mismatch. Record content or signature was tampered.",
        signerAsserted: false,
      };
    }

    return {
      status: SignatureStatus.VALID,
      details: `Valid signature from '${keyRef}'. Signer asserts this evidence record payload.`,
      signerAsserted: true,
    };
  }
}
