import { describe, it, expect, beforeEach } from 'vitest';
import { FactoryProvisioningAuthority } from '../FactoryProvisioningAuthority';
import { TrustTestFixtures } from '../TrustTestFixtures';
import { FactoryDeviceProvisioningManifest, FactoryHandshakeResponse } from '../FactoryProvisioningTypes';
import { generateKeyPairSync, createSign } from 'crypto';

describe('FactoryProvisioningAuthority — Factory Hardware & Handshake Suite', () => {
  let authorityKeys: { publicKeyPem: string; privateKeyPem: string };
  let deviceKeys: { publicKeyPem: string; privateKeyPem: string };

  beforeEach(() => {
    FactoryProvisioningAuthority.resetForTestHarnessOnly();
    const rawAuth = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const rawDev = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

    authorityKeys = { publicKeyPem: rawAuth.publicKey, privateKeyPem: rawAuth.privateKey };
    deviceKeys = { publicKeyPem: rawDev.publicKey, privateKeyPem: rawDev.privateKey };

    FactoryProvisioningAuthority.setAuthorityPublicKey(authorityKeys.publicKeyPem);
  });

  describe('Section 1: Hardware Identity Manifest Registration', () => {
    it('successfully registers a valid, cryptographically signed factory manifest', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-CMM-101',
        deviceSerial: 'SER-ZEISS-001',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest);
      
      const enrolled = FactoryProvisioningAuthority.getDevice('DEV-CMM-101');
      expect(enrolled).toBeDefined();
      expect(enrolled?.deviceSerial).toBe('SER-ZEISS-001');
    });

    it('rejects registration if authority public key is not configured', () => {
      FactoryProvisioningAuthority.resetForTestHarnessOnly();
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-CMM-102',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(manifest)).toThrow('PROVISIONING_BREACH: NO_FACTORY_AUTHORITY_PUBLIC_KEY');
    });

    it('rejects manifest signed by untrusted authority key', () => {
      const rawRogue = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const rogueAuthorityKeys = { publicKeyPem: rawRogue.publicKey, privateKeyPem: rawRogue.privateKey };
      
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-CMM-102',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: rogueAuthorityKeys
      });

      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(manifest)).toThrow('PROVISIONING_BREACH: INVALID_FACTORY_AUTHORITY_SIGNATURE');
    });

    it('rejects manifest with mismatched payload hash', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-CMM-103',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      const tamperedManifest = { ...manifest, manufacturer: 'FORGED_MANUFACTURER' };
      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(tamperedManifest)).toThrow('PROVISIONING_BREACH: MANIFEST_HASH_MISMATCH');
    });

    it('rejects duplicate device ID registration', () => {
      const manifest1 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-DUPLICATE',
        deviceSerial: 'SER-001',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest1);

      const rawKeys2 = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const keys2 = { publicKeyPem: rawKeys2.publicKey, privateKeyPem: rawKeys2.privateKey };
      
      const manifest2 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-DUPLICATE',
        deviceSerial: 'SER-002',
        hardwarePublicKey: keys2.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(manifest2)).toThrow('PROVISIONING_BREACH: DUPLICATE_DEVICE_ID');
    });

    it('rejects duplicate device serial number registration', () => {
      const manifest1 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-001',
        deviceSerial: 'SER-SAME',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest1);

      const rawKeys2 = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const keys2 = { publicKeyPem: rawKeys2.publicKey, privateKeyPem: rawKeys2.privateKey };
      
      const manifest2 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-002',
        deviceSerial: 'SER-SAME',
        hardwarePublicKey: keys2.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(manifest2)).toThrow('PROVISIONING_BREACH: DUPLICATE_DEVICE_SERIAL');
    });

    it('rejects duplicate hardware public key registration', () => {
      const manifest1 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-001',
        deviceSerial: 'SER-001',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest1);

      const manifest2 = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-002',
        deviceSerial: 'SER-002',
        hardwarePublicKey: deviceKeys.publicKeyPem, // Reuse same key
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.registerDeviceManifest(manifest2)).toThrow('PROVISIONING_BREACH: DUPLICATE_PUBLIC_KEY');
    });
  });

  describe('Section 2: First Factory Handshake Challenge Protocol', () => {
    let manifest: FactoryDeviceProvisioningManifest;

    beforeEach(() => {
      manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        productionDriverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest);
    });

    it('issues a cryptographically secure 32-byte nonce challenge', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      expect(challenge.challengeId).toContain('CHAL-DEV-CMM-HANDSHAKE');
      expect(challenge.nonce).toMatch(/^[0-9A-FA-F]{64}$/i);
      expect(challenge.serverAuthorityId).toBe(FactoryProvisioningAuthority.CANONICAL_FACTORY_AUTHORITY_ID);
    });

    it('completes valid handshake and issues provisioning certificate + driver record', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const timestamp = new Date().toISOString();

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        timestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp,
        deviceSignature
      };

      const result = FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem);

      expect(result.success).toBe(true);
      expect(result.provisioningCertificate).toBeDefined();
      expect(result.driverRecord).toBeDefined();
      expect(result.driverRecord?.status).toBe('ACTIVE');

      const updatedDevice = FactoryProvisioningAuthority.getDevice('DEV-CMM-HANDSHAKE');
      expect(updatedDevice?.status).toBe('ACTIVE');
    });

    it('prevents replay attacks by rejecting reused challenge nonces', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const timestamp = new Date().toISOString();

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        timestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp,
        deviceSignature
      };

      // First handshake succeeds
      FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem);

      // Replay attempt fails
      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVISIONING_BREACH: CHALLENGE_NOT_FOUND_OR_EXPIRED');
    });

    it('rejects handshake even if challenge is valid if the nonce has been previously used', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      // Inject this challenge's nonce into usedNonces to simulate that it's already been used!
      (FactoryProvisioningAuthority as any).usedNonces.add(challenge.nonce);
      
      const timestamp = new Date().toISOString();
      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        timestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp,
        deviceSignature
      };

      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVENANCE_BREACH: REPLAY_ATTACK');
    });

    it('rejects handshake response signed by wrong private key', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const timestamp = new Date().toISOString();

      const rawRogue = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const rogueDeviceKeys = { publicKeyPem: rawRogue.publicKey, privateKeyPem: rawRogue.privateKey };

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        timestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const rogueSignature = signer.sign(rogueDeviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp,
        deviceSignature: rogueSignature
      };

      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVISIONING_BREACH: HARDWARE_SIGNATURE_VERIFICATION_FAILED');
    });

    it('rejects handshake response with stale timestamp (>30s past)', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const staleTimestamp = new Date(Date.now() - 35000).toISOString();

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        staleTimestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp: staleTimestamp,
        deviceSignature
      };

      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVISIONING_BREACH: STALE_TIMESTAMP');
    });

    it('rejects handshake response with future timestamp (>30s future)', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const futureTimestamp = new Date(Date.now() + 35000).toISOString();

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        futureTimestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-CMM-999',
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp: futureTimestamp,
        deviceSignature
      };

      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVISIONING_BREACH: FUTURE_TIMESTAMP');
    });

    it('rejects handshake response if device serial does not match enrolled serial', () => {
      const challenge = FactoryProvisioningAuthority.issueHandshakeChallenge('DEV-CMM-HANDSHAKE');
      const timestamp = new Date().toISOString();

      const payloadToSign = [
        challenge.challengeId,
        challenge.nonce,
        'DEV-CMM-HANDSHAKE',
        'SER-CMM-999',
        'DRIVER-ZEISS-CMM-01',
        '2.4.0',
        timestamp
      ].join(':');

      const signer = createSign('SHA256');
      signer.update(payloadToSign);
      const deviceSignature = signer.sign(deviceKeys.privateKeyPem, 'hex');

      const response: FactoryHandshakeResponse = {
        challengeId: challenge.challengeId,
        deviceId: 'DEV-CMM-HANDSHAKE',
        deviceSerial: 'SER-FORGED-SN', // MISMATCH
        driverId: 'DRIVER-ZEISS-CMM-01',
        driverVersion: '2.4.0',
        timestamp,
        deviceSignature
      };

      expect(() => FactoryProvisioningAuthority.completeHandshake(response, authorityKeys.privateKeyPem))
        .toThrow('PROVISIONING_BREACH: IDENTITY_MISMATCH');
    });
  });

  describe('Section 3: Device Lifecycle State & Revocation Protocol', () => {
    it('enforces lifecycle state transitions and records revocation cryptographically', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-REVOKE-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest);
      FactoryProvisioningAuthority.updateLifecycleState('DEV-REVOKE-01', 'ACTIVE');

      const revocationRecord = FactoryProvisioningAuthority.revokeDevice('DEV-REVOKE-01', 'PRIVATE_KEY_COMPROMISE', authorityKeys.privateKeyPem);

      expect(revocationRecord.deviceId).toBe('DEV-REVOKE-01');
      expect(revocationRecord.reason).toBe('PRIVATE_KEY_COMPROMISE');
      expect(FactoryProvisioningAuthority.getDevice('DEV-REVOKE-01')?.status).toBe('REVOKED');

      // Cannot transition from terminal state REVOKED
      expect(() => FactoryProvisioningAuthority.updateLifecycleState('DEV-REVOKE-01', 'ACTIVE'))
        .toThrow('PROVISIONING_BREACH: INVALID_LIFECYCLE_TRANSITION');
    });

    it('prevents state transitions from terminal state DECOMMISSIONED', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-DECOMM-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest);
      FactoryProvisioningAuthority.updateLifecycleState('DEV-DECOMM-01', 'DECOMMISSIONED');

      expect(() => FactoryProvisioningAuthority.updateLifecycleState('DEV-DECOMM-01', 'ACTIVE'))
        .toThrow('PROVISIONING_BREACH: INVALID_LIFECYCLE_TRANSITION: Cannot transition from terminal state DECOMMISSIONED');
    });
  });

  describe('Section 4: Device Replacement & Non-Inheritance Protocol', () => {
    it('executes device replacement while preventing serial and key inheritance', () => {
      const retiredManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-OLD-01',
        deviceSerial: 'SER-OLD-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(retiredManifest);

      const rawNewKeys1 = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const newDeviceKeys = { publicKeyPem: rawNewKeys1.publicKey, privateKeyPem: rawNewKeys1.privateKey };
      
      const newManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-NEW-02',
        deviceSerial: 'SER-NEW-02',
        hardwarePublicKey: newDeviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      const replacement = FactoryProvisioningAuthority.replaceDevice({
        retiredDeviceId: 'DEV-OLD-01',
        retiredDeviceSerial: 'SER-OLD-01',
        newDeviceManifest: newManifest,
        replacementReason: 'HARDWARE_FAULT',
        transferCalibration: false
      }, authorityKeys.privateKeyPem);

      expect(replacement.retiredRecord.deviceId).toBe('DEV-OLD-01');
      expect(FactoryProvisioningAuthority.getDevice('DEV-OLD-01')?.status).toBe('REVOKED');
      expect(FactoryProvisioningAuthority.getDevice('DEV-NEW-02')).toBeDefined();
    });

    it('rejects device replacement if new device reuses retired serial number', () => {
      const retiredManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-OLD-01',
        deviceSerial: 'SER-SAME-SERIAL',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(retiredManifest);

      const rawNewKeys2 = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      const newDeviceKeys = { publicKeyPem: rawNewKeys2.publicKey, privateKeyPem: rawNewKeys2.privateKey };
      
      const newManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-NEW-02',
        deviceSerial: 'SER-SAME-SERIAL', // REUSED SERIAL
        hardwarePublicKey: newDeviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.replaceDevice({
        retiredDeviceId: 'DEV-OLD-01',
        retiredDeviceSerial: 'SER-SAME-SERIAL',
        newDeviceManifest: newManifest,
        replacementReason: 'HARDWARE_FAULT',
        transferCalibration: false
      }, authorityKeys.privateKeyPem)).toThrow('PROVISIONING_BREACH: DEVICE_REPLACEMENT_SERIAL_COLLISION');
    });

    it('rejects device replacement if new device reuses retired hardware public key', () => {
      const retiredManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-OLD-01',
        deviceSerial: 'SER-OLD-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(retiredManifest);

      const newManifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-NEW-02',
        deviceSerial: 'SER-NEW-02',
        hardwarePublicKey: deviceKeys.publicKeyPem, // REUSED KEY
        authorityKeyPair: authorityKeys
      });

      expect(() => FactoryProvisioningAuthority.replaceDevice({
        retiredDeviceId: 'DEV-OLD-01',
        retiredDeviceSerial: 'SER-OLD-01',
        newDeviceManifest: newManifest,
        replacementReason: 'HARDWARE_FAULT',
        transferCalibration: false
      }, authorityKeys.privateKeyPem)).toThrow('PROVISIONING_BREACH: DEVICE_REPLACEMENT_KEY_COLLISION');
    });
  });

  describe('Section 5: Offline Enrollment Policy & Operational Status', () => {
    it('returns NOT_IMPLEMENTED status for offline enrollment attempts', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-OFFLINE-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      const result = FactoryProvisioningAuthority.attemptOfflineEnrollment(manifest);
      expect(result.supported).toBe(false);
      expect(result.status).toBe('NOT_IMPLEMENTED');
      expect(result.architecturalRequirements).toHaveLength(4);
    });

    it('verifies operational status accurately for active devices', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-OPERATIONAL-01',
        productionDriverId: 'DRIVER-ZEISS-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest);
      FactoryProvisioningAuthority.updateLifecycleState('DEV-OPERATIONAL-01', 'ACTIVE');

      expect(FactoryProvisioningAuthority.verifyDeviceOperationalStatus('DEV-OPERATIONAL-01', 'DRIVER-ZEISS-01')).toBe(true);
    });

    it('throws PROVENANCE_BREACH if device is not operational/active', () => {
      const manifest = TrustTestFixtures.createFactoryManifest({
        deviceId: 'DEV-INACTIVE-01',
        productionDriverId: 'DRIVER-ZEISS-01',
        hardwarePublicKey: deviceKeys.publicKeyPem,
        authorityKeyPair: authorityKeys
      });

      FactoryProvisioningAuthority.registerDeviceManifest(manifest); // Status PROVISIONED

      expect(() => FactoryProvisioningAuthority.verifyDeviceOperationalStatus('DEV-INACTIVE-01', 'DRIVER-ZEISS-01'))
        .toThrow('PROVENANCE_BREACH: DEVICE_NOT_OPERATIONAL');
    });
  });
});
