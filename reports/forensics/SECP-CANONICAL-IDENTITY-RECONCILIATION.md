# SECP Canonical Identity Reconciliation
**Document ID**: SECP-CIR-2026-002  
**Audit Scope**: POST-CPIS-002 Identity Duplication & Reconciliation Audit  
**Date**: September 24, 2026  

---

## 1. Identity System Mapping

| Identity Field in `CyberPhysicalContracts.ts` | Existing Canonical Production Equivalent | Repository Source File | Reconciliation Status |
| :--- | :--- | :--- | :--- |
| `partSerial` | `partInstanceSerialNumber` | `/src/engine/quality-metrology/MetrologyTypes.ts` | **DUPLICATED** |
| `revision` / `canonicalCadRevision` | `cadRevisionHash` / `revisionId` | `/src/engine/revision/RevisionEngine.ts` | **DUPLICATED** |
| `machineId` / `MachineIdentity` | `DriverDeviceBinding` / `driverId` | `/src/engine/trust/ProductionTrustTypes.ts` | **DUPLICATED** |
| `instrumentId` / `MeasurementInstrumentIdentity` | `InstrumentDefinition.instrumentId` | `/src/engine/quality-metrology/MetrologyTypes.ts` | **DUPLICATED** |
| `calibrationId` / `CalibrationIdentity` | `CalibrationRecord.calibrationId` | `/src/engine/quality-metrology/MetrologyTypes.ts` | **DUPLICATED** |
| `acquisitionId` / `MeasurementAcquisitionEnvelope` | `AuthenticatedAcquisitionEnvelope.acquisitionId` | `/src/engine/quality-metrology/MetrologyTypes.ts` | **DUPLICATED** |
| `authorityId` / `CertificationAuthority` | `ProductionTrustRegistry.authorityId` | `/src/engine/trust/ProductionTrustRegistry.ts` | **DUPLICATED** |
| `proofId` / `PhysicalProof` | `QualityVerificationCertificate.certificateId` | `/src/engine/quality-metrology/MetrologyTypes.ts` | **DUPLICATED** |

---

## 2. Detection of Parallel Authority Models

1. **Two Independent Revision Identities**:
   - Production Canonical Revision: `cadRevisionHash` (SHA-256 of B-Rep geometry & parameter tree).
   - CPIS Duplicate: `canonicalCadRevision` string in `PhysicalPartIdentity`.
   - **Resolution**: CPIS `PhysicalPartIdentity` must reference `canonicalRevisionHash` directly rather than creating an independent revision string.

2. **Two Independent Part Serial Identities**:
   - Production Canonical Part Serial: `partInstanceSerialNumber` in `MeasurementSession`.
   - CPIS Duplicate: `partSerial` string in `PhysicalPartIdentity`.
   - **Resolution**: `PhysicalPartIdentity` must bind to `partInstanceSerialNumber`.

3. **Two Independent Machine & Instrument Identities**:
   - Production Canonical Machine/Driver: `ProvisionedDriverRecord` in `ProductionTrustRegistry.ts`.
   - CPIS Duplicate: `MachineIdentity` and `MeasurementInstrumentIdentity`.
   - **Resolution**: CPIS hardware contracts must reference `driverId` from `ProductionTrustRegistry`.

---

## 3. Reconciliation Classification

$$\mathbf{CANONICAL\_IDENTITY = DUPLICATED}$$
$$\mathbf{SOURCE\_OF\_TRUTH = ProductionTrustRegistry + MetrologyEngine + RevisionEngine}$$

CPIS should act as a **typed binding and serialization envelope** around existing canonical engineering identities rather than instantiating an independent parallel database of identities.
