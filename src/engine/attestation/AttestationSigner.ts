/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Cryptographic Attestation Signer Abstraction
 * 
 * Strict separation between Integrity (SHA-256 Hashing), Authenticity (Digital Signatures),
 * and Attestation (Engineering Context Binding).
 */

import * as crypto from 'crypto';
import { SignatureResult, SigningBackendStatus, SigningKeyPair } from './types';

export class AttestationSigner {
  /**
   * Signs a canonical payload string using real cryptographic signing.
   * If no valid key is provided, returns UNAVAILABLE or UNPROVEN status without fabricating a signature.
   */
  public static sign(
    canonicalPayload: string,
    keyPair?: SigningKeyPair
  ): SignatureResult {
    if (!keyPair || !keyPair.privateKey || !keyPair.keyId) {
      return {
        signature: '',
        signingKeyId: '',
        algorithm: 'NONE',
        status: 'UNAVAILABLE',
      };
    }

    try {
      if (keyPair.algorithm === 'HMAC-SHA256') {
        const hmac = crypto.createHmac('sha256', keyPair.privateKey);
        hmac.update(canonicalPayload, 'utf8');
        const signatureHex = hmac.digest('hex');
        return {
          signature: signatureHex,
          signingKeyId: keyPair.keyId,
          algorithm: 'HMAC-SHA256',
          status: 'AVAILABLE',
        };
      }

      if (keyPair.algorithm === 'ECDSA-P256-SHA256') {
        const sign = crypto.createSign('SHA256');
        sign.update(canonicalPayload, 'utf8');
        sign.end();
        const signature = sign.sign(keyPair.privateKey, 'hex');
        return {
          signature,
          signingKeyId: keyPair.keyId,
          algorithm: 'ECDSA-P256-SHA256',
          status: 'AVAILABLE',
        };
      }

      if (keyPair.algorithm === 'ED25519') {
        const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), keyPair.privateKey).toString('hex');
        return {
          signature,
          signingKeyId: keyPair.keyId,
          algorithm: 'ED25519',
          status: 'AVAILABLE',
        };
      }

      return {
        signature: '',
        signingKeyId: keyPair.keyId,
        algorithm: keyPair.algorithm,
        status: 'UNPROVEN',
      };
    } catch (err) {
      console.warn('[AttestationSigner] Signing failed:', err);
      return {
        signature: '',
        signingKeyId: keyPair.keyId,
        algorithm: keyPair.algorithm,
        status: 'UNPROVEN',
      };
    }
  }

  /**
   * Cryptographically verifies a digital signature against the canonical payload.
   * Returns:
   * - true: signature verified and authentic
   * - false: signature invalid or forged
   * - 'UNAVAILABLE': no public key available for verification
   * - 'UNPROVEN': verification algorithm or key format not provable
   */
  public static verifySignature(
    canonicalPayload: string,
    signature: string | undefined,
    signingKeyId: string | undefined,
    algorithm: string,
    trustedPublicKeys?: Record<string, string>
  ): boolean | 'UNAVAILABLE' | 'UNPROVEN' {
    if (!signature || !signingKeyId) {
      return 'UNAVAILABLE';
    }

    if (!trustedPublicKeys || !trustedPublicKeys[signingKeyId]) {
      return 'UNAVAILABLE';
    }

    const publicKeyOrSecret = trustedPublicKeys[signingKeyId];

    try {
      if (algorithm === 'HMAC-SHA256') {
        const hmac = crypto.createHmac('sha256', publicKeyOrSecret);
        hmac.update(canonicalPayload, 'utf8');
        const expectedSig = hmac.digest('hex');
        // Constant-time buffer equality check
        const sigBuf = Buffer.from(signature, 'hex');
        const expectedBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length !== expectedBuf.length) {
          return false;
        }
        return crypto.timingSafeEqual(sigBuf, expectedBuf);
      }

      if (algorithm === 'ECDSA-P256-SHA256') {
        const verify = crypto.createVerify('SHA256');
        verify.update(canonicalPayload, 'utf8');
        verify.end();
        return verify.verify(publicKeyOrSecret, signature, 'hex');
      }

      if (algorithm === 'ED25519') {
        return crypto.verify(
          null,
          Buffer.from(canonicalPayload, 'utf8'),
          publicKeyOrSecret,
          Buffer.from(signature, 'hex')
        );
      }

      return 'UNPROVEN';
    } catch (err) {
      console.warn('[AttestationSigner] Signature verification threw error:', err);
      return false;
    }
  }

  /**
   * Generates a real ephemeral key pair for authentic testing and operational signing.
   */
  public static generateTestKeyPair(
    algorithm: 'HMAC-SHA256' | 'ECDSA-P256-SHA256' | 'ED25519' = 'HMAC-SHA256',
    keyId = 'SECP_ROOT_SIGNING_KEY_01'
  ): SigningKeyPair {
    if (algorithm === 'HMAC-SHA256') {
      const secret = crypto.randomBytes(32).toString('hex');
      return {
        keyId,
        algorithm: 'HMAC-SHA256',
        publicKey: secret,
        privateKey: secret,
      };
    }

    if (algorithm === 'ECDSA-P256-SHA256') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return {
        keyId,
        algorithm: 'ECDSA-P256-SHA256',
        publicKey,
        privateKey,
      };
    }

    if (algorithm === 'ED25519') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      return {
        keyId,
        algorithm: 'ED25519',
        publicKey,
        privateKey,
      };
    }

    throw new Error(`Unsupported signing algorithm: ${algorithm}`);
  }
}
