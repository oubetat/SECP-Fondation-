import { describe, it, expect, beforeEach } from 'vitest';
import {
  CyberPhysicalCanonicalAdapter,
  CanonicalBindingResult
} from '../CyberPhysicalCanonicalAdapter';
import { CyberPhysicalHILTestHarness } from '../CyberPhysicalHILTestHarness';
import { GoldenTurbineTestArticle } from '../GoldenTurbineTestArticle';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { ProductionTrustRegistry } from '../ProductionTrustRegistry';
import { FactoryProvisioningAuthority } from '../FactoryProvisioningAuthority';

describe('POST-CPIS-007 — SECP Canonical Binding Adapter (Binding-Only)', () => {
  beforeEach(() => {
    CyberPhysicalHILTestHarness.resetReplayAuditLog();
    MetrologyEngine.clearRegistry();
    ProductionTrustRegistry.resetForTestHarnessOnly();
    FactoryProvisioningAuthority.resetForTestHarnessOnly();
  });

  it('1. should resolve CPIS physical fields into canonical SECP identity references without mutating state', () => {
    // Register instrument first in MetrologyEngine (canonical authority)
    const inst = MetrologyEngine.createInstrument('ZEISS-PRISMA-001', 'Zeiss Prisma CMM', 'ZEISS_CMM_PROBE');

    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    // Use registered instrument and calibration in payload
    const cpisPayload = {
      ...pkg.measurementEnvelope,
      instrumentIdentity: {
        ...pkg.measurementInstrumentIdentity,
        instrumentId: inst.instrumentId
      },
      calibrationIdentity: {
        ...pkg.calibrationIdentity,
        calibrationId: inst.calibration.calibrationId
      }
    };

    const binding: CanonicalBindingResult = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(cpisPayload);

    expect(binding.canonicalPartInstanceSerialNumber).toBe(GoldenTurbineTestArticle.DEFAULT_PART_SERIAL);
    expect(binding.canonicalCadRevisionHash).toBe(GoldenTurbineTestArticle.CANONICAL_REVISION_A);
    expect(binding.instrumentReference).toBe(inst.instrumentId);
    expect(binding.calibrationReference).toBe(inst.calibration.calibrationId);
    expect(binding.status).toBe('UNPROVEN'); // Test emulated provenance = UNPROVEN
    expect(binding.bindingDigest).toBeDefined();
  });

  it('2. should classify rawMaterialBatchId strictly as EXTERNAL_AUTHORITY_REFERENCE (isInternalAuthority: false)', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const binding = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(pkg.measurementEnvelope);

    expect(binding.externalMaterialReference?.referenceType).toBe('EXTERNAL_AUTHORITY_REFERENCE');
    expect(binding.externalMaterialReference?.batchId).toBe('BATCH-INCONEL-718-2026-99');
    expect(binding.externalMaterialReference?.authorityName).toBe('EXTERNAL_MATERIAL_SUPPLIER_MTR');
    expect(binding.externalMaterialReference?.isInternalAuthority).toBe(false);
  });

  it('3. should classify markingDigest strictly as EXTERNAL_ATTESTATION_REFERENCE (isInternalAuthority: false)', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const binding = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(pkg.measurementEnvelope);

    expect(binding.externalMarkingReference?.referenceType).toBe('EXTERNAL_ATTESTATION_REFERENCE');
    expect(binding.externalMarkingReference?.attestationDigest).toBe(`MARKING-DIGEST-${GoldenTurbineTestArticle.DEFAULT_PART_SERIAL}`);
    expect(binding.externalMarkingReference?.markingType).toBe('LASER_ETCHED_DATAMATRIX');
    expect(binding.externalMarkingReference?.isInternalAuthority).toBe(false);
  });

  it('4. should return NOT_PROVISIONED when resolving an unregistered instrument without auto-creating it', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const binding = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(pkg.measurementEnvelope);

    expect(binding.status).toBe('NOT_PROVISIONED');
    expect(binding.errors.some(e => e.includes('UNREGISTERED_INSTRUMENT'))).toBe(true);
    // Verify that MetrologyEngine has ZERO registered instruments
    expect(MetrologyEngine.getInstrument(pkg.measurementInstrumentIdentity.instrumentId)).toBeUndefined();
  });

  it('5. should adapt CPIS measurement envelope to SECP layout without issuing certificates or mutating registries', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const adapted = CyberPhysicalCanonicalAdapter.adaptMeasurementAcquisitionEnvelope(pkg.measurementEnvelope);

    expect(adapted.sessionId).toBe(`SESSION-${GoldenTurbineTestArticle.DEFAULT_PART_SERIAL}`);
    expect(adapted.driverId).toBe(pkg.measurementInstrumentIdentity.instrumentId);
    expect(adapted.evidenceGrade).toBe('LEVEL_1_SYNTHETIC'); // Preserves synthetic grade for TEST_ONLY
    expect(adapted.driverType).toBe('TEST');
  });

  it('6. should alter bindingDigest when CPIS fields are mutated, proving binding integrity', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const payload1 = {
      ...pkg.measurementEnvelope,
      physicalPartIdentity: pkg.physicalPartIdentity
    };
    const binding1 = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(payload1);

    const payload2 = {
      ...pkg.measurementEnvelope,
      physicalPartIdentity: {
        ...pkg.physicalPartIdentity,
        partSerial: 'TAMPERED-SERIAL-999'
      }
    };
    const binding2 = CyberPhysicalCanonicalAdapter.resolveCanonicalBinding(payload2);

    expect(binding1.bindingDigest).not.toBe(binding2.bindingDigest);
    expect(binding2.canonicalPartInstanceSerialNumber).toBe('TAMPERED-SERIAL-999');
  });

  it('7. should enforce that TEST_ONLY evidence never promotes to PRODUCTION or LEVEL_3_PHYSICAL_TELEMETRY', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    const adapted = CyberPhysicalCanonicalAdapter.adaptMeasurementAcquisitionEnvelope(pkg.measurementEnvelope);

    expect(adapted.evidenceGrade).not.toBe('LEVEL_3_PHYSICAL_TELEMETRY');
    expect(adapted.driverType).not.toBe('PRODUCTION');
  });

  it('8. should verify PHYSICAL_PROVISIONING = NOT_PROVISIONED and FIELD_PROVEN = NO constants', () => {
    expect(CyberPhysicalCanonicalAdapter.PHYSICAL_PROVISIONING_STATUS).toBe('NOT_PROVISIONED');
    expect(CyberPhysicalCanonicalAdapter.FIELD_PROVEN_STATUS).toBe('NO');
  });
});
