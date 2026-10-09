/**
 * SECP Industrial OS v2 — Authoritative Trust Domain
 * ProductionTrustRegistry — Sealed Hardware-Anchored Driver Authority
 * 
 * Hardware-anchored production trust registry. Once provisioned via signed
 * manifest from the SECP Provisioning Authority, this registry becomes strictly
 * immutable (frozen). Runtime application paths cannot dynamically register,
 * mutate, replace, or clear production driver identities.
 */

import { createHash, createSign, createVerify } from 'crypto';
import {
  ProvisionedDriverRecord,
  ProvisionedTrustManifest,
  TrustManifestVerificationResult
} from './ProductionTrustTypes';

export class ProductionTrustRegistry {
  public static readonly CANONICAL_AUTHORITY_ID = 'SECP-ROOT-PROVISIONING-AUTHORITY';

  // In-memory sealed driver registry
  private static readonly drivers = new Map<string, ProvisionedDriverRecord>();
  private static readonly driversBySerial = new Map<string, ProvisionedDriverRecord>();
  private static readonly driversByPublicKey = new Map<string, ProvisionedDriverRecord>();

  // Immutability state
  private static isFrozen = false;
  private static activeAuthorityId: string | null = null;
  private static activeManifestHash: string | null = null;

  // Active authority public key used to verify manifests
  private static authorityPublicKeyPem: string | null = null;

  /**
   * Initializes the registry with the root authority public key.
   */
  public static setAuthorityPublicKey(publicKeyPem: string): void {
    if (this.isFrozen) {
      throw new Error('PROVENANCE_BREACH: TRUST_REGISTRY_FROZEN_MUTATION_PROHIBITED');
    }
    this.authorityPublicKeyPem = publicKeyPem;
  }

  /**
   * Loads and validates an authoritative production trust manifest.
   * Once successfully loaded, the registry is sealed (frozen).
   */
  public static loadProvisionedTrust(manifest: ProvisionedTrustManifest): TrustManifestVerificationResult {
    if (this.isFrozen) {
      throw new Error('PROVENANCE_BREACH: TRUST_REGISTRY_FROZEN_MUTATION_PROHIBITED: Cannot reload or mutate frozen production trust registry.');
    }

    if (!manifest) {
      throw new Error('PROVENANCE_BREACH: MANIFEST_NULL_OR_UNDEFINED');
    }

    // 1. Schema Version Check
    if (manifest.manifestVersion !== '1.0.0') {
      throw new Error(`PROVENANCE_BREACH: UNSUPPORTED_MANIFEST_VERSION: ${manifest.manifestVersion}`);
    }

    // 2. Environment Isolation Check
    if (manifest.environment !== 'PRODUCTION') {
      throw new Error(`PROVENANCE_BREACH: INVALID_TRUST_ENVIRONMENT: Expected PRODUCTION, received ${manifest.environment}`);
    }

    // 3. Authority ID Verification
    if (manifest.authorityId !== this.CANONICAL_AUTHORITY_ID) {
      throw new Error(`PROVENANCE_BREACH: UNRECOGNIZED_AUTHORITY_ID: ${manifest.authorityId}`);
    }

    // 4. Algorithm Check if specified
    if ((manifest as any).algorithm && (manifest as any).algorithm !== 'ECDSA-SECP256K1' && (manifest as any).algorithm !== 'ED25519') {
      throw new Error(`PROVENANCE_BREACH: UNSUPPORTED_SIGNATURE_ALGORITHM: ${(manifest as any).algorithm}`);
    }

    // 5. Manifest Validity Interval Check
    const now = new Date();
    const issuedAt = new Date(manifest.issuedAt);
    const expiresAt = new Date(manifest.expiresAt);

    if (issuedAt.getTime() > now.getTime() + 1000) {
      throw new Error(`PROVENANCE_BREACH: MANIFEST_NOT_YET_VALID: Issued at ${manifest.issuedAt}, current time ${now.toISOString()}`);
    }

    if (now.getTime() > expiresAt.getTime()) {
      throw new Error(`PROVENANCE_BREACH: MANIFEST_EXPIRED: Manifest expired at ${manifest.expiresAt}`);
    }

    // 6. Manifest Hash Verification
    const expectedManifestHash = this.computeManifestPayloadHash(manifest);
    if (manifest.manifestHash !== expectedManifestHash) {
      throw new Error(`PROVENANCE_BREACH: MANIFEST_HASH_MISMATCH: Computed ${expectedManifestHash} does not match ${manifest.manifestHash}`);
    }

    // 7. Cryptographic Authority Signature Verification
    if (!this.authorityPublicKeyPem) {
      throw new Error('PROVENANCE_BREACH: NO_AUTHORITY_PUBLIC_KEY: Registry has no trusted authority public key to verify manifest.');
    }

    const isSigValid = this.verifySignature(this.authorityPublicKeyPem, manifest.manifestHash, manifest.authoritySignature);
    if (!isSigValid) {
      throw new Error('PROVENANCE_BREACH: INVALID_AUTHORITY_SIGNATURE: Manifest signature failed cryptographic verification.');
    }

    // 8. Individual Driver Record Validations
    const seenDriverIds = new Set<string>();
    const seenSerials = new Set<string>();
    const seenPublicKeys = new Set<string>();

    for (const driver of manifest.drivers) {
      // Required fields completeness check
      if (
        !driver.driverId ||
        !driver.driverType ||
        !driver.publicKeyPem ||
        !driver.deviceManufacturer ||
        !driver.deviceModel ||
        !driver.deviceSerial ||
        !driver.keyId ||
        !driver.certificateId ||
        !driver.validFrom ||
        !driver.validUntil ||
        !driver.status ||
        !driver.deviceBinding ||
        !driver.deviceBinding.instrumentId ||
        !driver.deviceBinding.serialNumber
      ) {
        throw new Error(`PROVENANCE_BREACH: MISSING_REQUIRED_DRIVER_FIELDS: Driver record has missing fields.`);
      }

      // Algorithm check if specified on driver
      if ((driver as any).algorithm && (driver as any).algorithm !== 'ECDSA-SECP256K1' && (driver as any).algorithm !== 'ED25519') {
        throw new Error(`PROVENANCE_BREACH: UNSUPPORTED_DRIVER_ALGORITHM: ${(driver as any).algorithm}`);
      }

      // Duplicate checks within manifest
      if (seenDriverIds.has(driver.driverId)) {
        throw new Error(`PROVENANCE_BREACH: DUPLICATE_DRIVER_ID: Multiple drivers with ID ${driver.driverId}`);
      }
      seenDriverIds.add(driver.driverId);

      if (seenSerials.has(driver.deviceSerial)) {
        throw new Error(`PROVENANCE_BREACH: DUPLICATE_DEVICE_SERIAL: Multiple drivers with serial ${driver.deviceSerial}`);
      }
      seenSerials.add(driver.deviceSerial);

      if (seenPublicKeys.has(driver.publicKeyPem)) {
        throw new Error(`PROVENANCE_BREACH: DUPLICATE_PUBLIC_KEY: Multiple drivers share the same public key.`);
      }
      seenPublicKeys.add(driver.publicKeyPem);

      // Hardware Device Binding check
      if (driver.deviceBinding.serialNumber !== driver.deviceSerial) {
        throw new Error(`PROVENANCE_BREACH: DEVICE_BINDING_SERIAL_MISMATCH: driver.deviceSerial ${driver.deviceSerial} !== binding.serialNumber ${driver.deviceBinding.serialNumber}`);
      }

      // Status check
      if (driver.status !== 'ACTIVE') {
        throw new Error(`PROVENANCE_BREACH: DRIVER_REVOKED: Driver ${driver.driverId} is ${driver.status}`);
      }

      // Expiration check
      const driverValidUntil = new Date(driver.validUntil);
      if (now.getTime() > driverValidUntil.getTime()) {
        throw new Error(`PROVENANCE_BREACH: DRIVER_CERTIFICATE_EXPIRED: Driver ${driver.driverId} expired at ${driver.validUntil}`);
      }

      // Driver record hash verification
      const expectedRecordHash = this.computeDriverRecordHash(driver);
      if (driver.recordHash !== expectedRecordHash) {
        throw new Error(`PROVENANCE_BREACH: DRIVER_RECORD_HASH_MISMATCH: Driver ${driver.driverId} computed hash ${expectedRecordHash} != ${driver.recordHash}`);
      }
    }

    // 9. Seal Registry State
    this.drivers.clear();
    this.driversBySerial.clear();
    this.driversByPublicKey.clear();

    for (const driver of manifest.drivers) {
      Object.freeze(driver);
      Object.freeze(driver.deviceBinding);
      this.drivers.set(driver.driverId, driver);
      this.driversBySerial.set(driver.deviceSerial, driver);
      this.driversByPublicKey.set(driver.publicKeyPem, driver);
    }

    this.isFrozen = true;
    this.activeAuthorityId = manifest.authorityId;
    this.activeManifestHash = manifest.manifestHash;

    return {
      valid: true,
      errors: [],
      loadedDriversCount: this.drivers.size,
      authorityId: manifest.authorityId,
      environment: manifest.environment
    };
  }

  /**
   * Look up a provisioned production driver by driverId.
   */
  public static lookup(driverId: string): ProvisionedDriverRecord | undefined {
    return this.drivers.get(driverId);
  }

  /**
   * Look up a provisioned production driver by hardware device serial number.
   */
  public static lookupBySerial(serial: string): ProvisionedDriverRecord | undefined {
    return this.driversBySerial.get(serial);
  }

  /**
   * Check if the production trust registry is sealed and frozen.
   */
  public static isRegistryFrozen(): boolean {
    return this.isFrozen;
  }

  /**
   * Get the active authority ID.
   */
  public static getActiveAuthorityId(): string | null {
    return this.activeAuthorityId;
  }

  /**
   * Get the active manifest hash.
   */
  public static getActiveManifestHash(): string | null {
    return this.activeManifestHash;
  }

  /**
   * Attempting to clear the production registry during runtime is strictly prohibited.
   */
  public static clearRegistry(): void {
    throw new Error('PROVENANCE_BREACH: RUNTIME_REGISTRY_CLEAR_PROHIBITED: Cannot clear frozen production trust registry at runtime.');
  }

  /**
   * Dynamic registration of production drivers at runtime is strictly prohibited.
   */
  public static registerTrustedDriver(): void {
    throw new Error('PROVENANCE_BREACH: DYNAMIC_PRODUCTION_REGISTRATION_PROHIBITED: Production drivers must be provisioned via signed manifest.');
  }

  /**
   * Test-only reset method for isolated test suites.
   */
  public static resetForTestHarnessOnly(): void {
    this.drivers.clear();
    this.driversBySerial.clear();
    this.driversByPublicKey.clear();
    this.isFrozen = false;
    this.activeAuthorityId = null;
    this.activeManifestHash = null;
    this.authorityPublicKeyPem = null;
  }

  /**
   * Computes the deterministic SHA-256 hash of a driver record.
   */
  public static computeDriverRecordHash(record: Omit<ProvisionedDriverRecord, 'recordHash'>): string {
    const canonicalPayload = [
      record.driverId,
      record.driverType,
      record.publicKeyPem,
      record.deviceManufacturer,
      record.deviceModel,
      record.deviceSerial,
      record.keyId,
      record.certificateId,
      record.validFrom,
      record.validUntil,
      record.status,
      record.deviceBinding.instrumentId,
      record.deviceBinding.serialNumber,
      record.deviceBinding.modelHash || ''
    ].join(':');

    return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Computes canonical hash over manifest fields (excluding hash and signature).
   */
  public static computeManifestPayloadHash(manifest: Omit<ProvisionedTrustManifest, 'manifestHash' | 'authoritySignature'>): string {
    const driverHashes = manifest.drivers.map(d => d.recordHash).join('|');
    const canonicalPayload = [
      manifest.manifestVersion,
      manifest.environment,
      manifest.authorityId,
      manifest.issuedAt,
      manifest.expiresAt,
      driverHashes
    ].join(':');

    return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Helper to sign manifest payloads with the provisioning authority's private key.
   */
  public static createSignedManifest(
    manifestData: Omit<ProvisionedTrustManifest, 'manifestHash' | 'authoritySignature'>,
    authorityPrivateKeyPem: string
  ): ProvisionedTrustManifest {
    const manifestHash = this.computeManifestPayloadHash(manifestData);
    const signer = createSign('SHA256');
    signer.update(manifestHash);
    const authoritySignature = signer.sign(authorityPrivateKeyPem, 'hex');

    return {
      ...manifestData,
      manifestHash,
      authoritySignature
    };
  }

  private static verifySignature(publicKeyPem: string, dataHex: string, signatureHex: string): boolean {
    try {
      const verifier = createVerify('SHA256');
      verifier.update(dataHex);
      return verifier.verify(publicKeyPem, signatureHex, 'hex');
    } catch {
      return false;
    }
  }
}
