/**
 * SECP Industrial OS v2 — Authoritative Trust Domain
 * FactoryProvisioningAuthority — Factory Hardware Provisioning & Handshake Authority (POST-TRUTH-CHAIN-004)
 * 
 * Cryptographically verifies hardware identity, signs canonical provisioning manifests,
 * executes the First Factory Handshake protocol with zero-trust challenge/nonce verification,
 * enforces device lifecycle state transitions, and guarantees strict separation of powers between:
 *   1. Factory Provisioning Authority (Device identity, hardware public key, calibration)
 *   2. Production Trust Authority (Authorizes production drivers into immutable registry)
 *   3. Metrology Authority (Evaluates tolerances, raw telemetry hash, issues quality certificates)
 *   4. QualityGate (Consumes authoritative evidence for release decisions)
 */

import { createHash, createSign, createVerify, randomBytes } from 'crypto';
import {
  DeviceLifecycleState,
  DeviceProvisioningCertificate,
  DeviceReplacementRequest,
  DeviceRevocationRecord,
  FactoryDeviceProvisioningManifest,
  FactoryHandshakeChallenge,
  FactoryHandshakeResponse,
  FactoryHandshakeResult,
  RevocationReason
} from './FactoryProvisioningTypes';
import { ProvisionedDriverRecord } from './ProductionTrustTypes';
import { ProductionTrustRegistry } from './ProductionTrustRegistry';

export class FactoryProvisioningAuthority {
  public static readonly CANONICAL_FACTORY_AUTHORITY_ID = 'SECP-FACTORY-PROVISIONING-AUTHORITY';

  // State maps
  private static readonly enrolledDevices = new Map<string, FactoryDeviceProvisioningManifest>();
  private static readonly devicesBySerial = new Map<string, FactoryDeviceProvisioningManifest>();
  private static readonly devicesByPublicKey = new Map<string, FactoryDeviceProvisioningManifest>();
  private static readonly provisioningCertificates = new Map<string, DeviceProvisioningCertificate>();
  private static readonly revocationRecords = new Map<string, DeviceRevocationRecord>();
  private static readonly activeChallenges = new Map<string, FactoryHandshakeChallenge>();
  private static readonly usedNonces = new Set<string>();

  // Factory Authority Public Key
  private static factoryAuthorityPublicKeyPem: string | null = null;

  /**
   * Initializes the Factory Provisioning Authority with its trusted public key.
   */
  public static setAuthorityPublicKey(publicKeyPem: string): void {
    this.factoryAuthorityPublicKeyPem = publicKeyPem;
  }

  /**
   * Computes the deterministic SHA-256 canonical hash of a factory provisioning manifest.
   */
  public static computeManifestHash(
    manifest: Omit<FactoryDeviceProvisioningManifest, 'manifestHash' | 'factorySignature'>
  ): string {
    const canonicalPayload = [
      manifest.manifestVersion,
      manifest.factoryAuthorityId,
      manifest.deviceId,
      manifest.deviceSerial,
      manifest.manufacturer,
      manifest.model,
      manifest.deviceType,
      manifest.hardwarePublicKey,
      manifest.signatureAlgorithm,
      manifest.productionDriverId,
      manifest.driverVersion,
      manifest.calibrationIdentity,
      manifest.calibrationCertificateHash,
      manifest.provisioningCertificateId,
      manifest.provisioningTimestamp,
      manifest.status
    ].join(':');

    return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Helper to sign a factory provisioning manifest with the factory authority private key.
   */
  public static createSignedManifest(
    manifestData: Omit<FactoryDeviceProvisioningManifest, 'manifestHash' | 'factorySignature'>,
    authorityPrivateKeyPem: string
  ): FactoryDeviceProvisioningManifest {
    const manifestHash = this.computeManifestHash(manifestData);
    const signer = createSign('SHA256');
    signer.update(manifestHash);
    const factorySignature = signer.sign(authorityPrivateKeyPem, 'hex');

    return {
      ...manifestData,
      manifestHash,
      factorySignature
    };
  }

  /**
   * Validates and registers a new factory device provisioning manifest.
   */
  public static registerDeviceManifest(manifest: FactoryDeviceProvisioningManifest): void {
    if (!manifest) {
      throw new Error('PROVISIONING_BREACH: MANIFEST_NULL_OR_UNDEFINED');
    }

    // 1. Schema Version Check
    if (manifest.manifestVersion !== '1.0.0') {
      throw new Error(`PROVISIONING_BREACH: UNSUPPORTED_MANIFEST_VERSION: ${manifest.manifestVersion}`);
    }

    // 2. Factory Authority ID Check
    if (manifest.factoryAuthorityId !== this.CANONICAL_FACTORY_AUTHORITY_ID) {
      throw new Error(`PROVISIONING_BREACH: UNRECOGNIZED_FACTORY_AUTHORITY: ${manifest.factoryAuthorityId}`);
    }

    // 3. Required Fields Completeness Check
    if (
      !manifest.deviceId ||
      !manifest.deviceSerial ||
      !manifest.manufacturer ||
      !manifest.model ||
      !manifest.deviceType ||
      !manifest.hardwarePublicKey ||
      !manifest.signatureAlgorithm ||
      !manifest.productionDriverId ||
      !manifest.driverVersion ||
      !manifest.calibrationIdentity ||
      !manifest.calibrationCertificateHash ||
      !manifest.provisioningCertificateId ||
      !manifest.provisioningTimestamp ||
      !manifest.status
    ) {
      throw new Error('PROVISIONING_BREACH: MISSING_REQUIRED_MANIFEST_FIELDS');
    }

    // 4. Signature Algorithm Check
    if (manifest.signatureAlgorithm !== 'ECDSA-SECP256K1' && manifest.signatureAlgorithm !== 'ED25519') {
      throw new Error(`PROVISIONING_BREACH: UNSUPPORTED_SIGNATURE_ALGORITHM: ${manifest.signatureAlgorithm}`);
    }

    // 5. Duplicate Identity Checks
    if (this.enrolledDevices.has(manifest.deviceId)) {
      throw new Error(`PROVISIONING_BREACH: DUPLICATE_DEVICE_ID: Device ${manifest.deviceId} is already enrolled.`);
    }

    if (this.devicesBySerial.has(manifest.deviceSerial)) {
      throw new Error(`PROVISIONING_BREACH: DUPLICATE_DEVICE_SERIAL: Serial ${manifest.deviceSerial} is already enrolled.`);
    }

    if (this.devicesByPublicKey.has(manifest.hardwarePublicKey)) {
      throw new Error(`PROVISIONING_BREACH: DUPLICATE_PUBLIC_KEY: Public key already bound to another enrolled device.`);
    }

    // 6. Manifest Payload Hash Verification
    const expectedHash = this.computeManifestHash(manifest);
    if (manifest.manifestHash !== expectedHash) {
      throw new Error(`PROVISIONING_BREACH: MANIFEST_HASH_MISMATCH: Expected ${expectedHash}, got ${manifest.manifestHash}`);
    }

    // 7. Authority Signature Verification
    if (!this.factoryAuthorityPublicKeyPem) {
      throw new Error('PROVISIONING_BREACH: NO_FACTORY_AUTHORITY_PUBLIC_KEY: Authority key not configured.');
    }

    const isSigValid = this.verifySignature(
      this.factoryAuthorityPublicKeyPem,
      manifest.manifestHash,
      manifest.factorySignature
    );
    if (!isSigValid) {
      throw new Error('PROVISIONING_BREACH: INVALID_FACTORY_AUTHORITY_SIGNATURE');
    }

    // 8. Register Device Manifest
    Object.freeze(manifest);
    this.enrolledDevices.set(manifest.deviceId, manifest);
    this.devicesBySerial.set(manifest.deviceSerial, manifest);
    this.devicesByPublicKey.set(manifest.hardwarePublicKey, manifest);
  }

  /**
   * FIRST FACTORY HANDSHAKE — STEP 1: Issue Cryptographic Challenge
   * Generates a 32-byte cryptographically secure random nonce.
   */
  public static issueHandshakeChallenge(deviceId: string): FactoryHandshakeChallenge {
    const device = this.enrolledDevices.get(deviceId);
    if (!device) {
      throw new Error(`PROVISIONING_BREACH: UNENROLLED_DEVICE: Device ${deviceId} not found.`);
    }

    if (device.status === 'REVOKED' || device.status === 'DECOMMISSIONED') {
      throw new Error(`PROVISIONING_BREACH: DEVICE_REVOKED_OR_DECOMMISSIONED: Device status is ${device.status}`);
    }

    const now = new Date();
    const challengeId = `CHAL-${deviceId}-${randomBytes(8).toString('hex').toUpperCase()}`;
    const nonce = randomBytes(32).toString('hex');

    const challenge: FactoryHandshakeChallenge = {
      challengeId,
      deviceId,
      nonce,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60000).toISOString(), // 60 seconds TTL
      serverAuthorityId: this.CANONICAL_FACTORY_AUTHORITY_ID
    };

    this.activeChallenges.set(challengeId, challenge);
    return challenge;
  }

  /**
   * FIRST FACTORY HANDSHAKE — STEP 2: Verify Challenge Response and Authorize Production Enrollment
   */
  public static completeHandshake(
    response: FactoryHandshakeResponse,
    authorityPrivateKeyPem: string
  ): FactoryHandshakeResult {
    if (!response || !response.challengeId) {
      throw new Error('PROVISIONING_BREACH: INVALID_HANDSHAKE_RESPONSE');
    }

    // 1. Challenge Validity & Anti-Replay Check
    const challenge = this.activeChallenges.get(response.challengeId);
    if (!challenge) {
      throw new Error(`PROVISIONING_BREACH: CHALLENGE_NOT_FOUND_OR_EXPIRED: Challenge ${response.challengeId} not active.`);
    }

    if (this.usedNonces.has(challenge.nonce)) {
      throw new Error(`PROVENANCE_BREACH: REPLAY_ATTACK: Handshake challenge nonce ${challenge.nonce} has already been consumed.`);
    }

    const now = new Date();
    if (now.getTime() > new Date(challenge.expiresAt).getTime()) {
      this.activeChallenges.delete(response.challengeId);
      throw new Error(`PROVISIONING_BREACH: CHALLENGE_EXPIRED: Challenge expired at ${challenge.expiresAt}`);
    }

    // 2. Timestamp Clock Skew Checks (Max ±30s)
    const responseTime = new Date(response.timestamp).getTime();
    if (isNaN(responseTime)) {
      throw new Error('PROVISIONING_BREACH: INVALID_TIMESTAMP_FORMAT');
    }

    if (responseTime < now.getTime() - 30000) {
      throw new Error('PROVISIONING_BREACH: STALE_TIMESTAMP: Handshake response timestamp is too far in the past.');
    }

    if (responseTime > now.getTime() + 30000) {
      throw new Error('PROVISIONING_BREACH: FUTURE_TIMESTAMP: Handshake response timestamp is too far in the future.');
    }

    // 3. Device Enrollment Verification
    const device = this.enrolledDevices.get(response.deviceId);
    if (!device) {
      throw new Error(`PROVISIONING_BREACH: UNENROLLED_DEVICE: Device ${response.deviceId} is not registered.`);
    }

    // 4. Lifecycle State Check
    if (device.status === 'REVOKED') {
      throw new Error(`PROVISIONING_BREACH: DEVICE_REVOKED: Device ${device.deviceId} is revoked.`);
    }
    if (device.status === 'DECOMMISSIONED') {
      throw new Error(`PROVISIONING_BREACH: DEVICE_DECOMMISSIONED: Device ${device.deviceId} is decommissioned.`);
    }
    if (device.status === 'SUSPENDED') {
      throw new Error(`PROVISIONING_BREACH: DEVICE_SUSPENDED: Device ${device.deviceId} is suspended.`);
    }

    // 5. Strict Device Identity Binding
    if (response.deviceSerial !== device.deviceSerial) {
      throw new Error(`PROVISIONING_BREACH: IDENTITY_MISMATCH: Serial ${response.deviceSerial} does not match enrolled serial ${device.deviceSerial}`);
    }

    if (response.driverId !== device.productionDriverId) {
      throw new Error(`PROVISIONING_BREACH: DRIVER_MISMATCH: Driver ID ${response.driverId} does not match enrolled driver ${device.productionDriverId}`);
    }

    if (response.driverVersion !== device.driverVersion) {
      throw new Error(`PROVISIONING_BREACH: DRIVER_VERSION_MISMATCH: Driver version ${response.driverVersion} does not match enrolled version ${device.driverVersion}`);
    }

    // 6. Cryptographic Hardware Signature Verification
    const payloadToVerify = [
      response.challengeId,
      challenge.nonce,
      response.deviceId,
      response.deviceSerial,
      response.driverId,
      response.driverVersion,
      response.timestamp
    ].join(':');

    const isSigValid = this.verifySignature(
      device.hardwarePublicKey,
      payloadToVerify,
      response.deviceSignature
    );

    if (!isSigValid) {
      throw new Error('PROVISIONING_BREACH: HARDWARE_SIGNATURE_VERIFICATION_FAILED: Signature does not match enrolled hardware public key.');
    }

    // 7. Consume Challenge & Nonce (Prevent Replay)
    this.usedNonces.add(challenge.nonce);
    this.activeChallenges.delete(response.challengeId);

    // 8. Update Device Lifecycle State to ACTIVE
    const activeManifest: FactoryDeviceProvisioningManifest = {
      ...device,
      status: 'ACTIVE'
    };
    Object.freeze(activeManifest);
    this.enrolledDevices.set(device.deviceId, activeManifest);
    this.devicesBySerial.set(device.deviceSerial, activeManifest);

    // 9. Issue Canonical Device Provisioning Certificate
    const certId = `CERT-PROV-${device.deviceId}-${Date.now()}`;
    const certPayload = [
      certId,
      device.deviceId,
      device.deviceSerial,
      device.hardwarePublicKey,
      device.productionDriverId,
      device.calibrationIdentity,
      device.calibrationCertificateHash,
      this.CANONICAL_FACTORY_AUTHORITY_ID,
      now.toISOString(),
      'ACTIVE'
    ].join(':');

    const certHash = createHash('sha256').update(certPayload, 'utf8').digest('hex').toUpperCase();
    const certSigner = createSign('SHA256');
    certSigner.update(certHash);
    const certSignature = certSigner.sign(authorityPrivateKeyPem, 'hex');

    const provisioningCertificate: DeviceProvisioningCertificate = {
      certificateId: certId,
      deviceId: device.deviceId,
      deviceSerial: device.deviceSerial,
      hardwarePublicKey: device.hardwarePublicKey,
      productionDriverId: device.productionDriverId,
      calibrationIdentity: device.calibrationIdentity,
      calibrationCertificateHash: device.calibrationCertificateHash,
      factoryAuthorityId: this.CANONICAL_FACTORY_AUTHORITY_ID,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 86400000 * 365).toISOString(),
      status: 'ACTIVE',
      certificateHash: certHash,
      authoritySignature: certSignature
    };

    Object.freeze(provisioningCertificate);
    this.provisioningCertificates.set(certId, provisioningCertificate);

    // 10. Construct Bound ProvisionedDriverRecord for ProductionTrustRegistry
    const driverRecordData: Omit<ProvisionedDriverRecord, 'recordHash'> = {
      driverId: device.productionDriverId,
      driverType: device.deviceType,
      publicKeyPem: device.hardwarePublicKey,
      deviceManufacturer: device.manufacturer,
      deviceModel: device.model,
      deviceSerial: device.deviceSerial,
      keyId: `KEY-${device.deviceId}`,
      certificateId: certId,
      validFrom: now.toISOString(),
      validUntil: provisioningCertificate.expiresAt,
      status: 'ACTIVE',
      deviceBinding: {
        instrumentId: device.deviceId,
        serialNumber: device.deviceSerial,
        modelHash: createHash('sha256').update(`${device.manufacturer}:${device.model}`).digest('hex').toUpperCase()
      }
    };

    const recordHash = ProductionTrustRegistry.computeDriverRecordHash(driverRecordData);
    const driverRecord: ProvisionedDriverRecord = {
      ...driverRecordData,
      recordHash
    };
    Object.freeze(driverRecord);

    return {
      success: true,
      deviceId: device.deviceId,
      enrolledAt: now.toISOString(),
      provisioningCertificate,
      driverRecord
    };
  }

  /**
   * Enforces Device Lifecycle State Transitions.
   */
  public static updateLifecycleState(deviceId: string, newState: DeviceLifecycleState): void {
    const device = this.enrolledDevices.get(deviceId);
    if (!device) {
      throw new Error(`PROVISIONING_BREACH: UNENROLLED_DEVICE: Device ${deviceId} not found.`);
    }

    const currentState = device.status;

    // Disallow transitions from terminal states
    if (currentState === 'REVOKED') {
      throw new Error(`PROVISIONING_BREACH: INVALID_LIFECYCLE_TRANSITION: Cannot transition from terminal state REVOKED to ${newState}`);
    }

    if (currentState === 'DECOMMISSIONED') {
      throw new Error(`PROVISIONING_BREACH: INVALID_LIFECYCLE_TRANSITION: Cannot transition from terminal state DECOMMISSIONED to ${newState}`);
    }

    const updatedDevice: FactoryDeviceProvisioningManifest = {
      ...device,
      status: newState
    };
    Object.freeze(updatedDevice);
    this.enrolledDevices.set(deviceId, updatedDevice);
    this.devicesBySerial.set(device.deviceSerial, updatedDevice);
  }

  /**
   * Revokes a device identity and records cryptographic revocation.
   */
  public static revokeDevice(
    deviceId: string,
    reason: RevocationReason,
    authorityPrivateKeyPem: string
  ): DeviceRevocationRecord {
    const device = this.enrolledDevices.get(deviceId);
    if (!device) {
      throw new Error(`PROVISIONING_BREACH: UNENROLLED_DEVICE: Cannot revoke unenrolled device ${deviceId}`);
    }

    const now = new Date();
    const revocationId = `REV-${deviceId}-${Date.now()}`;
    const payload = `${revocationId}:${deviceId}:${device.deviceSerial}:${reason}:${now.toISOString()}:${this.CANONICAL_FACTORY_AUTHORITY_ID}`;
    const signer = createSign('SHA256');
    signer.update(payload);
    const authoritySignature = signer.sign(authorityPrivateKeyPem, 'hex');

    const record: DeviceRevocationRecord = {
      revocationId,
      deviceId,
      deviceSerial: device.deviceSerial,
      reason,
      revokedAt: now.toISOString(),
      authorityId: this.CANONICAL_FACTORY_AUTHORITY_ID,
      authoritySignature
    };

    Object.freeze(record);
    this.revocationRecords.set(deviceId, record);

    // Update status to REVOKED
    const revokedDevice: FactoryDeviceProvisioningManifest = {
      ...device,
      status: 'REVOKED'
    };
    Object.freeze(revokedDevice);
    this.enrolledDevices.set(deviceId, revokedDevice);
    this.devicesBySerial.set(device.deviceSerial, revokedDevice);

    return record;
  }

  /**
   * Performs Device Replacement ensuring identity cannot be inherited.
   */
  public static replaceDevice(
    request: DeviceReplacementRequest,
    authorityPrivateKeyPem: string
  ): { retiredRecord: DeviceRevocationRecord; newDeviceManifest: FactoryDeviceProvisioningManifest } {
    const retiredDevice = this.enrolledDevices.get(request.retiredDeviceId);
    if (!retiredDevice) {
      throw new Error(`PROVISIONING_BREACH: RETIRED_DEVICE_NOT_FOUND: Device ${request.retiredDeviceId} does not exist.`);
    }

    // Verify retired device serial matches
    if (retiredDevice.deviceSerial !== request.retiredDeviceSerial) {
      throw new Error('PROVISIONING_BREACH: RETIRED_DEVICE_SERIAL_MISMATCH');
    }

    // Verify new device is genuinely distinct (cannot reuse serial or public key)
    if (request.newDeviceManifest.deviceSerial === retiredDevice.deviceSerial) {
      throw new Error('PROVISIONING_BREACH: DEVICE_REPLACEMENT_SERIAL_COLLISION: Replacement device cannot reuse retired device serial number.');
    }

    if (request.newDeviceManifest.hardwarePublicKey === retiredDevice.hardwarePublicKey) {
      throw new Error('PROVISIONING_BREACH: DEVICE_REPLACEMENT_KEY_COLLISION: Replacement device cannot reuse retired device hardware key.');
    }

    // Invalidate/revoke retired device
    const retiredRecord = this.revokeDevice(request.retiredDeviceId, 'HARDWARE_FAULT', authorityPrivateKeyPem);

    // Register new device manifest
    this.registerDeviceManifest(request.newDeviceManifest);

    return {
      retiredRecord,
      newDeviceManifest: request.newDeviceManifest
    };
  }

  /**
   * Verifies Operational Status for Metrology Engine and QualityGate consumption.
   */
  public static verifyDeviceOperationalStatus(deviceId: string, driverId: string): boolean {
    const device = this.enrolledDevices.get(deviceId);
    if (!device) {
      throw new Error(`PROVENANCE_BREACH: DEVICE_NOT_ENROLLED: Device ${deviceId} is not enrolled in Factory Provisioning Authority.`);
    }

    if (device.status !== 'ACTIVE') {
      throw new Error(`PROVENANCE_BREACH: DEVICE_NOT_OPERATIONAL: Device ${deviceId} lifecycle status is ${device.status}`);
    }

    if (device.productionDriverId !== driverId) {
      throw new Error(`PROVENANCE_BREACH: DRIVER_DEVICE_MISMATCH: Device ${deviceId} is bound to driver ${device.productionDriverId}, but got ${driverId}`);
    }

    return true;
  }

  /**
   * OFFLINE FACTORY ENROLLMENT EVALUATION
   * Reports architectural status per Section 17 of POST-TRUTH-CHAIN-004.
   */
  public static attemptOfflineEnrollment(manifest: FactoryDeviceProvisioningManifest): {
    supported: boolean;
    status: 'NOT_IMPLEMENTED';
    reason: string;
    architecturalRequirements: readonly string[];
  } {
    return {
      supported: false,
      status: 'NOT_IMPLEMENTED',
      reason: 'SECP zero-trust protocol requires live cryptographic handshake challenge-response. Fully disconnected/offline device enrollment is NOT_IMPLEMENTED to prevent unverified hardware key masquerading.',
      architecturalRequirements: [
        'Cached Authority Public Key for offline manifest validation',
        'Local HSM/Secure Element challenge nonce generator',
        'Cryptographically signed synchronization log for post-connect reconciliation',
        'Post-connection replay attack prevention buffer'
      ]
    };
  }

  /**
   * Lookup helpers
   */
  public static getDevice(deviceId: string): FactoryDeviceProvisioningManifest | undefined {
    return this.enrolledDevices.get(deviceId);
  }

  public static getDeviceBySerial(serial: string): FactoryDeviceProvisioningManifest | undefined {
    return this.devicesBySerial.get(serial);
  }

  public static getProvisioningCertificate(certificateId: string): DeviceProvisioningCertificate | undefined {
    return this.provisioningCertificates.get(certificateId);
  }

  public static getRevocationRecord(deviceId: string): DeviceRevocationRecord | undefined {
    return this.revocationRecords.get(deviceId);
  }

  /**
   * Test harness reset
   */
  public static resetForTestHarnessOnly(): void {
    this.enrolledDevices.clear();
    this.devicesBySerial.clear();
    this.devicesByPublicKey.clear();
    this.provisioningCertificates.clear();
    this.revocationRecords.clear();
    this.activeChallenges.clear();
    this.usedNonces.clear();
    this.factoryAuthorityPublicKeyPem = null;
  }

  private static verifySignature(publicKeyPem: string, data: string, signatureHex: string): boolean {
    try {
      const verifier = createVerify('SHA256');
      verifier.update(data);
      return verifier.verify(publicKeyPem, signatureHex, 'hex');
    } catch {
      return false;
    }
  }
}
