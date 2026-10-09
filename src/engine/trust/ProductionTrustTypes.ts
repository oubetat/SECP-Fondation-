/**
 * SECP Industrial OS v2 — Authoritative Trust Domain
 * Production Trust & Hardware-Anchored Driver Manifest Types
 */

export type TrustEnvironment = 'PRODUCTION' | 'TEST';

export type DriverDeviceType = 
  | 'PRODUCTION_PHYSICAL_CMM'
  | 'LASER_TRACKER'
  | 'OPTICAL_COMPARATOR'
  | 'CALIBRATED_SENSOR'
  | 'ZEISS_CMM_PROBE'
  | 'DIGITAL_MICROMETER';

export interface DeviceBinding {
  readonly instrumentId: string;
  readonly modelHash?: string;
  readonly serialNumber: string;
}

export interface ProvisionedDriverRecord {
  readonly driverId: string;
  readonly driverType: DriverDeviceType;
  readonly publicKeyPem: string;
  readonly algorithm?: 'ECDSA-SECP256K1' | 'ED25519';
  readonly deviceManufacturer: string;
  readonly deviceModel: string;
  readonly deviceSerial: string;
  readonly keyId: string;
  readonly certificateId: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly deviceBinding: DeviceBinding;
  readonly recordHash: string;
}

export interface ProvisionedTrustManifest {
  readonly manifestVersion: string;
  readonly environment: TrustEnvironment;
  readonly authorityId: string;
  readonly algorithm?: 'ECDSA-SECP256K1' | 'ED25519';
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly drivers: readonly ProvisionedDriverRecord[];
  readonly manifestHash: string;
  readonly authoritySignature: string;
}

export interface TrustManifestVerificationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly loadedDriversCount: number;
  readonly authorityId: string;
  readonly environment: TrustEnvironment;
}
