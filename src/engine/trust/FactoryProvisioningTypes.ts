/**
 * SECP Industrial OS v2 — Authoritative Trust Domain
 * Factory Provisioning & Real Device Enrollment Types (POST-TRUTH-CHAIN-004)
 */

import { DriverDeviceType, ProvisionedDriverRecord } from './ProductionTrustTypes';

export type DeviceLifecycleState = 
  | 'PROVISIONED' 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'REVOKED' 
  | 'DECOMMISSIONED';

export type SignatureAlgorithm = 'ECDSA-SECP256K1' | 'ED25519';

export type RevocationReason = 
  | 'PRIVATE_KEY_COMPROMISE' 
  | 'PHYSICAL_THEFT' 
  | 'HARDWARE_FAULT' 
  | 'DECOMMISSIONED' 
  | 'CALIBRATION_FAILURE' 
  | 'ADMINISTRATIVE';

export interface FactoryDeviceProvisioningManifest {
  readonly deviceId: string;
  readonly deviceSerial: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly deviceType: DriverDeviceType;
  readonly hardwarePublicKey: string;
  readonly signatureAlgorithm: SignatureAlgorithm;
  readonly productionDriverId: string;
  readonly driverVersion: string;
  readonly calibrationIdentity: string;
  readonly calibrationCertificateHash: string;
  readonly factoryAuthorityId: string;
  readonly provisioningCertificateId: string;
  readonly provisioningTimestamp: string;
  readonly manifestVersion: string;
  readonly manifestHash: string;
  readonly factorySignature: string;
  readonly status: DeviceLifecycleState;
}

export interface DeviceProvisioningCertificate {
  readonly certificateId: string;
  readonly deviceId: string;
  readonly deviceSerial: string;
  readonly hardwarePublicKey: string;
  readonly productionDriverId: string;
  readonly calibrationIdentity: string;
  readonly calibrationCertificateHash: string;
  readonly factoryAuthorityId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly status: DeviceLifecycleState;
  readonly certificateHash: string;
  readonly authoritySignature: string;
}

export interface FactoryHandshakeChallenge {
  readonly challengeId: string;
  readonly deviceId: string;
  readonly nonce: string; // 32-byte hex cryptographically random
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly serverAuthorityId: string;
}

export interface FactoryHandshakeResponse {
  readonly challengeId: string;
  readonly deviceId: string;
  readonly deviceSerial: string;
  readonly driverId: string;
  readonly driverVersion: string;
  readonly timestamp: string;
  readonly deviceSignature: string;
}

export interface FactoryHandshakeResult {
  readonly success: boolean;
  readonly deviceId: string;
  readonly enrolledAt?: string;
  readonly provisioningCertificate?: DeviceProvisioningCertificate;
  readonly driverRecord?: ProvisionedDriverRecord;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface DeviceRevocationRecord {
  readonly revocationId: string;
  readonly deviceId: string;
  readonly deviceSerial: string;
  readonly reason: RevocationReason;
  readonly revokedAt: string;
  readonly authorityId: string;
  readonly authoritySignature: string;
}

export interface DeviceReplacementRequest {
  readonly retiredDeviceId: string;
  readonly retiredDeviceSerial: string;
  readonly newDeviceManifest: FactoryDeviceProvisioningManifest;
  readonly replacementReason: string;
  readonly transferCalibration: boolean;
}
