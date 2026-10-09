/**
 * SECP Industrial OS v2 — Authoritative Cyber-Physical Canonical Adapter (POST-CPIS-007)
 * 
 * BINDING-ONLY ADAPTER LAYER
 * 
 * Core Architectural Rule:
 * "The Binding Adapter may prove that two references refer to the same canonical object.
 *  It may not create, certify, provision, authorize, or release that object."
 * 
 * Responsibilities:
 * 1. Resolves CPIS payload references against existing SECP Canonical Authorities (Read-Only).
 * 2. Maps rawMaterialBatchId to EXTERNAL_AUTHORITY_REFERENCE (isInternalAuthority: false).
 * 3. Maps markingDigest to EXTERNAL_ATTESTATION_REFERENCE (isInternalAuthority: false).
 * 4. Computes deterministic bindingDigest for reference binding integrity.
 * 5. Returns CanonicalBindingResult with status: 'VERIFIED' | 'UNPROVEN' | 'NOT_PROVISIONED' | 'REJECTED'.
 * 
 * Strict Prohibitions (ENFORCED):
 * - NO creation of new canonical identities or registries.
 * - NO mutation of ProductionTrustRegistry, FactoryProvisioningAuthority, or MetrologyEngine.
 * - NO instantiation of QualityVerificationCertificate or certificates.
 * - NO invocation of QualityGate.authorizeRelease or release evaluation logic.
 * - NO promotion of TEST_ONLY / UNPROVEN to PRODUCTION / PROVEN.
 */

import { createHash } from 'crypto';
import {
  MachineIdentity,
  PhysicalPartIdentity,
  MeasurementInstrumentIdentity,
  CalibrationIdentity,
  MeasurementAcquisitionEnvelope,
  FeatureMeasurementRecord
} from './CyberPhysicalContracts';
import { ProductionTrustRegistry } from './ProductionTrustRegistry';
import { FactoryProvisioningAuthority } from './FactoryProvisioningAuthority';
import { MetrologyEngine } from '../quality-metrology/MetrologyEngine';
import { AuthenticatedAcquisitionEnvelope } from '../quality-metrology/MetrologyTypes';

export interface ExternalAuthorityReference {
  readonly referenceType: 'EXTERNAL_AUTHORITY_REFERENCE';
  readonly batchId: string;
  readonly authorityName: string;
  readonly checksumOrHash: string;
  readonly isInternalAuthority: false; // Strictly non-authoritative inside SECP
}

export interface ExternalAttestationReference {
  readonly referenceType: 'EXTERNAL_ATTESTATION_REFERENCE';
  readonly attestationDigest: string;
  readonly markingType: string;
  readonly isInternalAuthority: false; // Strictly non-authoritative inside SECP
}

export interface DriverDeviceBindingResolution {
  readonly machineId: string;
  readonly serialNumber: string;
  readonly isBoundToAuthoritativeRegistry: boolean;
  readonly bindingSource: 'PRODUCTION_TRUST_REGISTRY' | 'FACTORY_PROVISIONING_AUTHORITY' | 'UNBOUND';
}

export type CanonicalBindingStatus = 'VERIFIED' | 'UNPROVEN' | 'NOT_PROVISIONED' | 'REJECTED';

export interface CanonicalBindingResult {
  readonly canonicalPartInstanceSerialNumber?: string;
  readonly canonicalCadRevisionHash?: string;
  readonly machineExecutionReference?: DriverDeviceBindingResolution;
  readonly instrumentReference?: string;
  readonly calibrationReference?: string;
  readonly externalMaterialReference?: ExternalAuthorityReference;
  readonly externalMarkingReference?: ExternalAttestationReference;
  readonly bindingDigest: string;
  readonly status: CanonicalBindingStatus;
  readonly errors: readonly string[];
}

export class CyberPhysicalCanonicalAdapter {
  public static readonly PHYSICAL_PROVISIONING_STATUS = 'NOT_PROVISIONED';
  public static readonly FIELD_PROVEN_STATUS = 'NO';

  /**
   * Resolves CPIS references against SECP Canonical Authorities (STRICTLY READ-ONLY).
   */
  public static resolveCanonicalBinding(
    payload: PhysicalPartIdentity | MeasurementAcquisitionEnvelope | any
  ): CanonicalBindingResult {
    const errors: string[] = [];
    let isNotProvisioned = false;
    let isUnproven = false;

    // Extract CPIS sub-components depending on payload structure
    let partIdentity: PhysicalPartIdentity | undefined;
    let machineIdentity: MachineIdentity | undefined;
    let instrumentIdentity: MeasurementInstrumentIdentity | undefined;
    let calibrationIdentity: CalibrationIdentity | undefined;

    if (payload && typeof payload === 'object') {
      if ('physicalPartIdentity' in payload) {
        partIdentity = payload.physicalPartIdentity;
      } else if ('partSerial' in payload) {
        partIdentity = payload as PhysicalPartIdentity;
      }

      if ('instrumentIdentity' in payload) {
        instrumentIdentity = payload.instrumentIdentity;
      }

      if ('calibrationIdentity' in payload) {
        calibrationIdentity = payload.calibrationIdentity;
      }

      if ('manufacturingEnvelope' in payload && payload.manufacturingEnvelope) {
        machineIdentity = payload.manufacturingEnvelope.machineIdentity;
      }

      if (payload.provenance === 'TEST_EMULATED' || payload.testOnlyFlag) {
        isUnproven = true;
      }
    }

    // 1. Resolve Part Serial Reference
    const partInstanceSerialNumber = partIdentity?.partSerial || payload?.partSerial || undefined;
    if (!partInstanceSerialNumber) {
      errors.push('MISSING_PART_SERIAL: CPIS payload lacks partSerial reference.');
    }

    // 2. Resolve CAD Revision Reference
    const cadRevisionHash = partIdentity?.canonicalCadRevision || payload?.revision || payload?.canonicalCadRevision || undefined;
    if (!cadRevisionHash) {
      errors.push('MISSING_CAD_REVISION: CPIS payload lacks canonicalCadRevision reference.');
    }

    // 3. Resolve Machine Execution Reference against Registries (READ-ONLY LOOKUP)
    const machineId = machineIdentity?.machineId || 'UNKNOWN_MACHINE';
    const machineSerial = machineIdentity?.serialNumber || 'UNKNOWN_SERIAL';

    let isBoundToRegistry = false;
    let bindingSource: 'PRODUCTION_TRUST_REGISTRY' | 'FACTORY_PROVISIONING_AUTHORITY' | 'UNBOUND' = 'UNBOUND';

    if (machineSerial !== 'UNKNOWN_SERIAL') {
      const provisionedDriver = ProductionTrustRegistry.lookupBySerial(machineSerial);
      if (provisionedDriver) {
        isBoundToRegistry = true;
        bindingSource = 'PRODUCTION_TRUST_REGISTRY';
      } else {
        const factoryDevice = FactoryProvisioningAuthority.getDeviceBySerial(machineSerial);
        if (factoryDevice) {
          isBoundToRegistry = true;
          bindingSource = 'FACTORY_PROVISIONING_AUTHORITY';
        }
      }
    }

    const machineExecutionReference: DriverDeviceBindingResolution = {
      machineId,
      serialNumber: machineSerial,
      isBoundToAuthoritativeRegistry: isBoundToRegistry,
      bindingSource
    };

    // 4. Resolve Instrument Reference in MetrologyEngine (READ-ONLY LOOKUP)
    const instrumentId = instrumentIdentity?.instrumentId || payload?.instrumentId || undefined;
    let instrumentReference: string | undefined = undefined;

    if (instrumentId) {
      const registeredInstrument = MetrologyEngine.getInstrument(instrumentId);
      if (registeredInstrument) {
        instrumentReference = registeredInstrument.instrumentId;
      } else {
        // DO NOT REGISTER INSTRUMENT. Mark as NOT_PROVISIONED if unknown
        isNotProvisioned = true;
        errors.push(`UNREGISTERED_INSTRUMENT: Instrument ${instrumentId} is not provisioned in MetrologyEngine.`);
      }
    } else {
      errors.push('MISSING_INSTRUMENT_ID: CPIS payload lacks instrumentId reference.');
    }

    // 5. Resolve Calibration Reference
    const calibrationId = calibrationIdentity?.calibrationId || payload?.calibrationId || undefined;
    let calibrationReference: string | undefined = undefined;

    if (calibrationId) {
      if (instrumentReference) {
        const inst = MetrologyEngine.getInstrument(instrumentReference);
        if (inst && inst.calibration && inst.calibration.calibrationId === calibrationId) {
          calibrationReference = calibrationId;
        } else {
          errors.push(`CALIBRATION_MISMATCH: Calibration ${calibrationId} does not match instrument calibration record.`);
        }
      } else {
        calibrationReference = calibrationId;
      }
    } else {
      errors.push('MISSING_CALIBRATION_ID: CPIS payload lacks calibrationId reference.');
    }

    // 6. Bind External Material Reference (STRICTLY NON-AUTHORITATIVE)
    const batchId = partIdentity?.rawMaterialBatchId || payload?.rawMaterialBatchId || 'UNSPECIFIED_BATCH';
    const externalMaterialReference: ExternalAuthorityReference = {
      referenceType: 'EXTERNAL_AUTHORITY_REFERENCE',
      batchId,
      authorityName: 'EXTERNAL_MATERIAL_SUPPLIER_MTR',
      checksumOrHash: createHash('sha256').update(`SECP-EXTERNAL-MTR:${batchId}`).digest('hex').toUpperCase(),
      isInternalAuthority: false
    };

    // 7. Bind External Marking Attestation (STRICTLY NON-AUTHORITATIVE)
    const digest = partIdentity?.markingDigest || payload?.markingDigest || 'UNSPECIFIED_DIGEST';
    const markingType = partIdentity?.physicalMarkingType || 'LASER_ETCHED_DATAMATRIX';
    const externalMarkingReference: ExternalAttestationReference = {
      referenceType: 'EXTERNAL_ATTESTATION_REFERENCE',
      attestationDigest: digest,
      markingType,
      isInternalAuthority: false
    };

    // 8. Determine Binding Status
    let status: CanonicalBindingStatus = 'VERIFIED';

    if (errors.length > 0) {
      if (isNotProvisioned) {
        status = 'NOT_PROVISIONED';
      } else {
        status = 'REJECTED';
      }
    } else if (isUnproven) {
      status = 'UNPROVEN';
    }

    // 9. Compute Deterministic Binding Digest (BINDING INTEGRITY ONLY)
    const bindingPayloadString = [
      partInstanceSerialNumber || '',
      cadRevisionHash || '',
      machineExecutionReference.serialNumber,
      instrumentReference || '',
      calibrationReference || '',
      externalMaterialReference.checksumOrHash,
      externalMarkingReference.attestationDigest,
      status
    ].join(':');

    const bindingDigest = createHash('sha256')
      .update(`SECP-BINDING-DIGEST:${bindingPayloadString}`)
      .digest('hex')
      .toUpperCase();

    return {
      canonicalPartInstanceSerialNumber: partInstanceSerialNumber,
      canonicalCadRevisionHash: cadRevisionHash,
      machineExecutionReference,
      instrumentReference,
      calibrationReference,
      externalMaterialReference,
      externalMarkingReference,
      bindingDigest,
      status,
      errors
    };
  }

  /**
   * Adapts CPIS MeasurementAcquisitionEnvelope to SECP AuthenticatedAcquisitionEnvelope layout (READ-ONLY TYPE ALIGNMENT).
   * Does NOT register instruments, issue certificates, or submit to MetrologyEngine.
   */
  public static adaptMeasurementAcquisitionEnvelope(
    cpisEnvelope: MeasurementAcquisitionEnvelope
  ): AuthenticatedAcquisitionEnvelope {
    const binding = this.resolveCanonicalBinding(cpisEnvelope);

    const sessionId = `SESSION-${binding.canonicalPartInstanceSerialNumber || 'UNBOUND'}`;
    const driverId = cpisEnvelope.instrumentIdentity?.instrumentId || 'UNKNOWN_DRIVER';
    const instrumentId = cpisEnvelope.instrumentIdentity?.instrumentId || 'UNKNOWN_INSTRUMENT';

    const points = (cpisEnvelope.featureMeasurements || []).map((fm: FeatureMeasurementRecord, idx: number) => {
      const dev = fm.deviationMm;
      return {
        pointId: `pt-cpis-${fm.featureId}-${idx + 1}`,
        nominalCoordinates: { x: fm.nominalValueMm, y: 0, z: 0 },
        measuredCoordinates: { x: fm.measuredValueMm, y: 0, z: 0 },
        deviationMm: Math.abs(dev),
        acquisitionSignature: cpisEnvelope.signature
      };
    });

    const rawMeasurementHash = createHash('sha256')
      .update(`${cpisEnvelope.acquisitionId}:${cpisEnvelope.contentHash}:${cpisEnvelope.rawCloudDigest}`)
      .digest('hex')
      .toUpperCase();

    // Preserve evidence grade: TEST_ONLY / UNPROVEN remains LEVEL_1_SYNTHETIC
    const isProdPhysical = cpisEnvelope.provenance === 'PRODUCTION_PHYSICAL' && !cpisEnvelope.testOnlyFlag && binding.status === 'VERIFIED';

    return {
      sessionId,
      driverId,
      instrumentId,
      calibrationId: cpisEnvelope.calibrationIdentity?.calibrationId || 'UNKNOWN_CALIBRATION',
      acquisitionId: cpisEnvelope.acquisitionId,
      acquiredAt: cpisEnvelope.acquiredAt,
      points,
      rawMeasurementHash,
      signature: cpisEnvelope.signature,
      evidenceGrade: isProdPhysical ? 'LEVEL_3_PHYSICAL_TELEMETRY' : 'LEVEL_1_SYNTHETIC',
      driverType: isProdPhysical ? 'PRODUCTION' : 'TEST'
    };
  }
}
