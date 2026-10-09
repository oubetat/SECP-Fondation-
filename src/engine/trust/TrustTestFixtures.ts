import { generateKeyPairSync } from 'crypto';
import { ProductionTrustRegistry } from './ProductionTrustRegistry';
import { ProvisionedDriverRecord, ProvisionedTrustManifest } from './ProductionTrustTypes';
import { FactoryDeviceProvisioningManifest } from './FactoryProvisioningTypes';
import { FactoryProvisioningAuthority } from './FactoryProvisioningAuthority';

/**
 * TrustTestFixtures
 * 
 * Cryptographic key generator and manifest builder for test isolation.
 */
export class TrustTestFixtures {
  /**
   * Generates a pair of EC keys (secp256k1) for test provisioning authority or drivers.
   */
  public static generateEcKeyPair(): { publicKeyPem: string; privateKeyPem: string } {
    const { publicKey, privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return {
      publicKeyPem: publicKey,
      privateKeyPem: privateKey
    };
  }

  /**
   * Creates a valid, signed FactoryDeviceProvisioningManifest for testing.
   */
  public static createFactoryManifest(
    params: {
      deviceId: string;
      hardwarePublicKey: string;
      authorityKeyPair?: { publicKeyPem?: string; privateKeyPem?: string; publicKey?: string; privateKey?: string };
      deviceSerial?: string;
      productionDriverId?: string;
      driverVersion?: string;
      calibrationIdentity?: string;
      status?: 'PROVISIONED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'DECOMMISSIONED';
      [key: string]: any;
    }
  ): FactoryDeviceProvisioningManifest {
    const targetAuthorityKeys = params.authorityKeyPair || this.generateRsaKeyPair();
    const privateKeyPem = (targetAuthorityKeys as any).privateKeyPem || (targetAuthorityKeys as any).privateKey;

    const { authorityKeyPair, ...restParams } = params;
    const now = new Date();
    const serial = restParams.deviceSerial || `SER-${restParams.deviceId}-99`;
    const driverId = restParams.productionDriverId || `DRIVER-${restParams.deviceId}`;

    const manifestData: any = {
      manifestVersion: '1.0.0',
      factoryAuthorityId: FactoryProvisioningAuthority.CANONICAL_FACTORY_AUTHORITY_ID,
      deviceId: restParams.deviceId,
      deviceSerial: serial,
      manufacturer: 'ZEISS',
      model: 'PRISMO_NAVIGATOR_V2',
      deviceType: 'PRODUCTION_PHYSICAL_CMM',
      hardwarePublicKey: restParams.hardwarePublicKey,
      signatureAlgorithm: 'ECDSA-SECP256K1',
      productionDriverId: driverId,
      driverVersion: restParams.driverVersion || '2.4.0-PROD',
      calibrationIdentity: restParams.calibrationIdentity || `CAL-${restParams.deviceId}-2026`,
      calibrationCertificateHash: 'CERT_HASH_CAL_ZEISS_001_VALID',
      provisioningCertificateId: `CERT-INIT-${restParams.deviceId}`,
      provisioningTimestamp: now.toISOString(),
      status: restParams.status || 'PROVISIONED',
      ...restParams
    };

    return FactoryProvisioningAuthority.createSignedManifest(manifestData, privateKeyPem);
  }

  /**
   * Creates a single valid driver record for tests.
   */
  public static createDriverRecord(params: {
    driverId: string;
    publicKeyPem: string;
    deviceSerial?: string;
    instrumentId?: string;
    validFrom?: string;
    validUntil?: string;
    status?: 'ACTIVE' | 'REVOKED';
    algorithm?: 'ECDSA-SECP256K1' | 'ED25519' | string;
    [key: string]: any;
  }): ProvisionedDriverRecord {
    const serial = params.deviceSerial || `SER-${params.driverId}-001`;
    const instId = params.instrumentId || `INST-${params.driverId}`;
    const now = new Date();
    const vFrom = params.validFrom || new Date(now.getTime() - 3600000).toISOString();
    const vUntil = params.validUntil || new Date(now.getTime() + 86400000 * 365).toISOString();

    const recordData: any = {
      driverId: params.driverId,
      driverType: 'PRODUCTION_PHYSICAL_CMM',
      publicKeyPem: params.publicKeyPem,
      deviceManufacturer: 'ZEISS',
      deviceModel: 'PRISMO_NAVIGATOR',
      deviceSerial: serial,
      keyId: `KEY-${params.driverId}`,
      certificateId: `CERT-DRIVER-${params.driverId}`,
      validFrom: vFrom,
      validUntil: vUntil,
      status: params.status || 'ACTIVE',
      deviceBinding: {
        instrumentId: instId,
        serialNumber: serial,
        modelHash: 'HASH_ZEISS_PRISMO_001'
      },
      ...params
    };

    const recordHash = ProductionTrustRegistry.computeDriverRecordHash(recordData);

    return {
      ...recordData,
      recordHash
    };
  }

  /**
   * Builds and signs a complete production trust manifest for testing.
   */
  public static createSignedTestManifest(
    drivers: ProvisionedDriverRecord[],
    authorityKeyPair: { publicKeyPem: string; privateKeyPem: string },
    overrides?: Partial<ProvisionedTrustManifest> & Record<string, any>
  ): ProvisionedTrustManifest {
    const now = new Date();
    const manifestData: any = {
      manifestVersion: overrides?.manifestVersion || '1.0.0',
      environment: overrides?.environment || 'PRODUCTION',
      authorityId: overrides?.authorityId || 'SECP-ROOT-PROVISIONING-AUTHORITY',
      issuedAt: overrides?.issuedAt || new Date(now.getTime() - 3600000).toISOString(),
      expiresAt: overrides?.expiresAt || new Date(now.getTime() + 86400000 * 365).toISOString(),
      drivers: overrides?.drivers || drivers,
      ...(overrides || {})
    };

    return ProductionTrustRegistry.createSignedManifest(manifestData, authorityKeyPair.privateKeyPem);
  }
}
