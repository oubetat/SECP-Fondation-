# SECP — POST-CPIS-003: PRE-MIGRATION INVENTORY & CANONICAL IDENTITY PROOF GATE

**Document Identifier**: SECP-POST-CPIS-003-PRE-MIGRATION-INVENTORY  
**Timestamp**: 2026-09-24T05:36:00Z  
**Audit Purpose**: Forensic inventory, canonical source mapping, semantic equivalence proof, and readiness verdict for POST-CPIS-003.  

---

## 1. Working Tree Change Audit

| Audit Category | Result | Details |
| :--- | :--- | :--- |
| **FILES_MODIFIED** | `[]` | No production or engine files modified during this audit turn |
| **FILES_CREATED** | `["reports/forensics/SECP-POST-CPIS-003-PRE-MIGRATION-INVENTORY.md"]` | This forensic inventory report |
| **FILES_DELETED** | `[]` | No files deleted |
| **PRODUCTION_FILES_CHANGED** | `NO` | Zero production execution or authority files changed |
| **TEST_FILES_CHANGED** | `NO` | Zero test or test fixture files changed |
| **REPORT_FILES_CHANGED** | `NO` | Pre-existing forensic reports unchanged |

---

## 2. Complete CPIS Field Inventory

Source File: `/src/engine/trust/CyberPhysicalContracts.ts`

### Enums & Scalar Types
1. **`CyberPhysicalVerificationStatus`**: `'PROVEN' | 'UNPROVEN' | 'NOT_PROVISIONED' | 'REJECTED' | 'EXPIRED' | 'REPLAYED' | 'TAMPERED'`
2. **`CyberPhysicalProvenance`**: `'PRODUCTION_PHYSICAL' | 'TEST_EMULATED'`

### Complete Interface Field Inventory

#### 1. `EnvelopeHeader`
- `identity`: `string`
- `revision`: `string`
- `timestamp`: `string`
- `parentArtifact`: `string`
- `contentHash`: `string`
- `signature`: `string`
- `authority`: `string`
- `provenance`: `CyberPhysicalProvenance`
- `verificationStatus`: `CyberPhysicalVerificationStatus`
- `testOnlyFlag`: `boolean`

#### 2. `MachineIdentity` (extends `EnvelopeHeader`)
- Header fields (`identity`, `revision`, `timestamp`, `parentArtifact`, `contentHash`, `signature`, `authority`, `provenance`, `verificationStatus`, `testOnlyFlag`)
- `machineId`: `string`
- `manufacturer`: `string`
- `model`: `string`
- `serialNumber`: `string`
- `kinematicConfiguration`: `'3-AXIS' | '5-AXIS-CONTINUOUS' | 'MILL-TURN'`
- `controllerType`: `string`
- `enrollmentTimestamp`: `string`
- `securityHardwareId`: `string`

#### 3. `MachineCapability` (extends `EnvelopeHeader`)
- Header fields
- `capabilityId`: `string`
- `machineId`: `string`
- `maxAxisLimits`: `{ xMm: number; yMm: number; zMm: number; aDeg?: number; cDeg?: number }`
- `spindleMaxRpm`: `number`
- `positionalAccuracyMm`: `number`
- `repeatabilityMm`: `number`
- `supportedGCodeDialects`: `readonly string[]`
- `coolingCapabilities`: `readonly string[]`

#### 4. `ManufacturingExecutionEnvelope` (extends `EnvelopeHeader`)
- Header fields
- `executionId`: `string`
- `machineIdentity`: `MachineIdentity`
- `verifiedGCodeHash`: `string`
- `verifiedToolpathHash`: `string`
- `cncControllerStatus`: `'EXECUTED_SUCCESSFULLY' | 'ABORTED' | 'FAULT'`
- `spindleHoursTotal`: `number`
- `executionStartTime`: `string`
- `executionEndTime`: `string`
- `telemetryFeedDigest`: `string`
- `operatorId`: `string`

#### 5. `PhysicalPartIdentity` (extends `EnvelopeHeader`)
- Header fields
- `partSerial`: `string`
- `canonicalCadRevision`: `string`
- `bRepHash`: `string`
- `rawMaterialBatchId`: `string`
- `physicalMarkingType`: `'LASER_ETCHED_DATAMATRIX' | 'ENGRAVED' | 'RFID'`
- `markingDigest`: `string`

#### 6. `MeasurementInstrumentIdentity` (extends `EnvelopeHeader`)
- Header fields
- `instrumentId`: `string`
- `instrumentType`: `'CMM_TACTILE' | 'LASER_SCANNER' | 'OPTICAL_COMPARATOR'`
- `model`: `string`
- `serialNumber`: `string`
- `probeType`: `string`
- `calibrationCertificateId`: `string`

#### 7. `CalibrationIdentity` (extends `EnvelopeHeader`)
- Header fields
- `calibrationId`: `string`
- `instrumentId`: `string`
- `calibrationAuthority`: `string`
- `calibratedAt`: `string`
- `expiresAt`: `string`
- `uncertaintyBudgetMicrons`: `number`
- `standardReferenceUsed`: `string`

#### 8. `FeatureMeasurementRecord`
- `featureId`: `string`
- `featureName`: `string`
- `nominalValueMm`: `number`
- `measuredValueMm`: `number`
- `toleranceUpperMm`: `number`
- `toleranceLowerMm`: `number`
- `deviationMm`: `number`
- `passed`: `boolean`

#### 9. `MeasurementAcquisitionEnvelope` (extends `EnvelopeHeader`)
- Header fields
- `acquisitionId`: `string`
- `instrumentIdentity`: `MeasurementInstrumentIdentity`
- `calibrationIdentity`: `CalibrationIdentity`
- `physicalPartIdentity`: `PhysicalPartIdentity`
- `featureMeasurements`: `readonly FeatureMeasurementRecord[]`
- `rawCloudDigest`: `string`
- `acquiredAt`: `string`

#### 10. `CertificationAuthority` (extends `EnvelopeHeader`)
- Header fields
- `authorityId`: `string`
- `authorityName`: `string`
- `accreditationStandard`: `'ISO_17025' | 'AS9100' | 'NADCAP'`
- `publicKeyPem`: `string`
- `validUntil`: `string`

#### 11. `ProductionReleaseEnvelope` (extends `EnvelopeHeader`)
- Header fields
- `releaseId`: `string`
- `physicalPartIdentity`: `PhysicalPartIdentity`
- `manufacturingEnvelope`: `ManufacturingExecutionEnvelope`
- `measurementEnvelope`: `MeasurementAcquisitionEnvelope`
- `certificationAuthorityId`: `string`
- `qualityGateSignature`: `string`
- `releaseStatus`: `CyberPhysicalVerificationStatus`

#### 12. `PhysicalProof` (extends `EnvelopeHeader`)
- Header fields
- `proofId`: `string`
- `digitalTruthRevision`: `string`
- `physicalSerial`: `string`
- `chainDigest`: `string`
- `cyberPhysicalVerdict`: `'PASS' | 'PARTIAL' | 'REJECTED' | 'NOT_PROVISIONED'`
- `failReason`?: `string`

---

## 3. Canonical Source Mapping

| CPIS Field | Canonical Field | File | Producer | Consumer | Persistence | Cryptographic Binding | Authority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `partSerial` | `partInstanceSerialNumber` | `MetrologyTypes.ts` | `MetrologyEngine` / `ManufacturedPartInstance` | `QualityGate`, `MetrologyEngine` | Session / Firestore | Signed in `QualityVerificationCertificate` | `MetrologyEngine` |
| `canonicalCadRevision` | `cadRevisionHash` | `MetrologyTypes.ts` | `CadKernel` | `QualityGate`, `MetrologyEngine` | `CadKernel` | Signed in `QualityVerificationCertificate` | `CadKernel` |
| `bRepHash` | `bRepHash` | `BRepTopologyEngine.ts` | `BRepTopologyEngine` | `QualityGate` | `BRepTopologyEngine` | Hash in `QualityVerificationCertificate` | `BRepTopologyEngine` |
| `rawMaterialBatchId` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` |
| `markingDigest` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` |
| `MachineIdentity.machineId` | `UNRESOLVED` (CNC vs Inspection Driver) | `FactoryProvisioningTypes.ts` | `FactoryProvisioningAuthority` | `QualityGate` | `ProductionTrustRegistry` | `FactoryDeviceProvisioningManifest` | `FactoryProvisioningAuthority` |
| `InstrumentIdentity.instrumentId` | `InstrumentDefinition.instrumentId` / `deviceBinding.instrumentId` | `MetrologyTypes.ts` & `ProductionTrustTypes.ts` | `FactoryProvisioningAuthority` / `MetrologyEngine` | `MetrologyEngine`, `QualityGate` | `ProductionTrustRegistry` | `ProvisionedDriverRecord` | `FactoryProvisioningAuthority` |
| `CalibrationIdentity.calibrationId` | `CalibrationRecord.calibrationId` | `MetrologyTypes.ts` | `FactoryProvisioningAuthority` | `MetrologyEngine` | `InstrumentDefinition` | `DeviceProvisioningCertificate` | `FactoryProvisioningAuthority` |
| `MeasurementAcquisitionEnvelope.acquisitionId` | `AuthenticatedAcquisitionEnvelope.acquisitionId` | `MetrologyTypes.ts` | `MetrologyEngine` | `QualityGate` | `MetrologyEngine` | ECDSA / Ed25519 Driver Signature & Nonce | Hardware Driver Key |
| `CertificationAuthority.authorityId` | `ProvisionedTrustManifest.authorityId` / `factoryAuthorityId` | `ProductionTrustTypes.ts` | `FactoryProvisioningAuthority` | `QualityGate` | `ProductionTrustRegistry` | Root CA Manifest Signature | `FactoryProvisioningAuthority` |
| `ProductionReleaseEnvelope.releaseId` | `QualityVerificationCertificate.certificateId` | `MetrologyTypes.ts` | `QualityGate` | `ReleaseDecisionEngine` | Certificate Store | `provenanceHash` & `evaluationHash` | `QualityGate` |
| `PhysicalProof.proofId` | `UNRESOLVED` (Attestation summary vs Certificate) | `AttestationTypes.ts` | `AttestationSigner` | `QualityGate` | Attestation Ledger | Attestation Signature | `AttestationSigner` |

---

## 4. Semantic Equivalence Analysis

### A. Identity Semantics
- **`partSerial` $\leftrightarrow$ `partInstanceSerialNumber`**: Equivalent. Both reference the physical manufactured turbine component instance serial number.
- **`canonicalCadRevision` $\leftrightarrow$ `cadRevisionHash`**: Equivalent. Both reference the SHA-256 hash of the canonical CAD feature tree / geometry state.
- **`MachineIdentity` $\leftrightarrow$ `DriverDeviceBinding`**: **NOT EQUIVALENT**. `MachineIdentity` specifies a multi-axis CNC machine tool, whereas `DriverDeviceBinding` binds an inspection instrument (CMM / Laser Scanner) to a cryptographic hardware driver key.
- **`MeasurementAcquisitionEnvelope` $\leftrightarrow$ `AuthenticatedAcquisitionEnvelope`**: **SEMANTICALLY BOUND**. `AuthenticatedAcquisitionEnvelope` is the authoritative runtime data structure containing nonces and cryptographic signatures. `MeasurementAcquisitionEnvelope` is a transport wrapper.

### B. Lifecycle Semantics
- Canonical identities survive mutation, revision, and supersession through explicit hash chains in `MetrologyEngine` and `QualityGate`. CPIS envelopes currently recreate independent timestamps and revision identifiers, introducing potential lifecycle divergence if modified separately.

### C. Authority Semantics
- `QualityGate` and `MetrologyEngine` possess exclusive authority to create `QualityVerificationCertificate` instances. CPIS `ProductionReleaseEnvelope` must NOT function as an independent issuer.

### D. Cryptographic Semantics
- Canonical acquisition signed bytes: `SHA-256(acquisitionId + sessionId + driverId + instrumentId + calibrationId + acquiredAt + nonce + points)`.
- CPIS wrapper signed bytes: `contentHash` on `EnvelopeHeader`.
- Proof: CPIS `contentHash` must be computed over the exact canonical payload to prevent hash mismatch.

### E. Persistence Semantics
- Canonical store after restart: `FirestoreStorageEngine` / `MetrologyEngine` in-memory authoritative store. CPIS has no independent persistent storage engine.

### F. Consumer Semantics
- `QualityGate.authorizeRelease` exclusively consumes `QualityVerificationCertificate` and `AuthenticatedAcquisitionEnvelope`. CPIS envelopes are currently consumed ONLY by test harnesses.

---

## 5. Identity Ownership Matrix

| Field / Concept | Canonical Owner | CPIS Role | Permitted CPIS Action |
| :--- | :--- | :--- | :--- |
| Part Serial | `MetrologyEngine` | Reference | Read-only binding |
| CAD Revision | `CadKernel` | Reference | Read-only binding |
| Driver / Hardware Key | `ProductionTrustRegistry` | Reference | Read-only verification |
| Calibration ID | `FactoryProvisioningAuthority` | Reference | Read-only binding |
| Acquisition Session | `MetrologyEngine` | Transport Wrapper | Read-only projection |
| Quality Certificate | `QualityGate` | Attestation View | Read-only projection |

---

## 6. Cryptographic Binding Matrix

```
[Hardware Driver Key] 
   │ (Signs AuthenticatedAcquisitionEnvelope with Nonce)
   ▼
[MetrologyEngine / AuthenticatedAcquisitionEnvelope]
   │ (Computes rawMeasurementHash)
   ▼
[QualityGate / QualityVerificationCertificate]
   │ (Signs Certificate with provenanceHash + evaluationHash)
   ▼
[CPIS PhysicalProof Projection] (ATTESTATION_REFERENCE ONLY)
```

---

## 7. Persistence Authority Matrix

| Entity | Primary Store | Authoritative Recovery Source | CPIS Storage |
| :--- | :--- | :--- | :--- |
| Drivers & Devices | `ProductionTrustRegistry` | `ProvisionedTrustManifest` | NONE |
| Calibration Records | `FactoryProvisioningAuthority` | `DeviceProvisioningCertificate` | NONE |
| Measurement Sessions | `MetrologyEngine` | `AuthenticatedAcquisitionEnvelope` | NONE |
| Quality Certificates | `MetrologyEngine` / `QualityGate` | `QualityVerificationCertificate` | NONE |

---

## 8. Consumer Trust Matrix

```
Production Release Consumer Path:
QualityGate.authorizeRelease()
   ├── Consumes: QualityVerificationCertificate (Authoritative Store)
   ├── Consumes: AuthenticatedAcquisitionEnvelope (Hardware Key Signed)
   └── Rejects: CPIS ProductionReleaseEnvelope (Parallel Model - FAIL CLOSED)
```

---

## 9. PhysicalProof Classification

- **Question**: Is `PhysicalProof` equivalent to `QualityVerificationCertificate`?
- **Forensic Determination**: **NO**. `PhysicalProof` is an **`ATTESTATION_REFERENCE`**, not a certificate authority.
- **Classification**:
  ```
  PHYSICAL_PROOF = ATTESTATION_REFERENCE
  ```
- **Constraint**: `PhysicalProof` MUST NOT issue, modify, or supersede `QualityVerificationCertificate`.

---

## 10. Acquisition Envelope Reconciliation

- **Comparison**: `MeasurementAcquisitionEnvelope` (CPIS) vs `AuthenticatedAcquisitionEnvelope` (Canonical Metrology).
- **Key Differences**:
  1. `AuthenticatedAcquisitionEnvelope` contains cryptographic `nonce` and direct `driverId` hardware key binding.
  2. `MeasurementAcquisitionEnvelope` contains additional metadata (`physicalPartIdentity`, `calibrationIdentity`) wrapped in an `EnvelopeHeader`.
- **Reconciliation Rule**: `AuthenticatedAcquisitionEnvelope` remains the single canonical acquisition record. CPIS `MeasurementAcquisitionEnvelope` MUST be generated as a read-only projection of `AuthenticatedAcquisitionEnvelope`.

---

## 11. Machine Identity Reconciliation

- **Domain Separation**:
  - `CNC Machine Identity`: Kinematics, controller type, axis limits, workspace envelope.
  - `Inspection Driver Identity`: Hardware key, CMM probe type, serial number, driver version.
- **Forensic Verdict**: These are **DISTINCT IDENTITY DOMAIN ENTITIES**. They MUST NOT be merged or flattened into a single type.

---

## 12. Certificate Authority Reconciliation

- **Certificate Issuers**: `MULTIPLE` (`DesignCertificateEngine`, `ManufacturingCertificateEngine`, `SimulationCertificateEngine`, `MetrologyEngine`).
- **Physical Release Authority**: `SINGLE` (`QualityGate`).
- **Alternate Physical Release CA**: `NONE`.
- **Conclusion**: Multiple domain certificate engines are legitimate for engineering sub-domains, but ONLY `QualityGate` possesses physical release authority.

---

## 13. QualityGate Baseline

The following baseline protections in `QualityGate.authorizeRelease` remain untouched and enforced:
- Alternate certificate rejection (`FAIL-CLOSED`)
- Unregistered certificate rejection (`FAIL-CLOSED`)
- Empty telemetry rejection (`FAIL-CLOSED`)
- Revision mismatch rejection (`FAIL-CLOSED`)
- Caller-field tampering rejection (`FAIL-CLOSED`)
- Replay rejection (`FAIL-CLOSED`)
- `TEST_ONLY` rejection (`FAIL-CLOSED`)

---

## 14. TEST_ONLY Isolation Baseline

- `TEST_ONLY`, `SIMULATED`, `MOCK`, `EMULATED`, `UNPROVEN`, `NOT_PROVISIONED`, `REPLAYED`, `TAMPERED`, `EXPIRED` status flags cannot reach `PRODUCTION` or `FIELD_PROVEN` through environment variables, type casts, fallbacks, or adapter logic.

---

## 15. Unresolved Mappings

The following fields lack active canonical backing stores in the production release path:
1. `rawMaterialBatchId` (in `PhysicalPartIdentity`): No material batch registry in current release chain.
2. `markingDigest` (in `PhysicalPartIdentity`): No laser marking scanner driver provisioned.
3. `MachineIdentity` (CNC Machine vs Inspection Device): No canonical CNC Machine Registry exists in the current trust manifest (only inspection driver devices exist in `ProductionTrustRegistry`).

---

## 16. Migration Risks

1. **Risk of Force-Flattening Identities**: Attempting to treat CNC Machines and Metrology Drivers as the same entity would corrupt the domain model.
2. **Risk of Double-Issuance**: Allowing CPIS to generate `ProductionReleaseEnvelope` instances independently would re-introduce `PARALLEL_AUTHORITY`.
3. **Risk of Signature Mismatch**: Computing CPIS `contentHash` differently than `AuthenticatedAcquisitionEnvelope.signature` would cause cryptographic verification failures.

---

## 17. Proposed Binding Architecture

```
[Canonical Domain Engines]
  ├── CadKernel (cadRevisionHash)
  ├── FactoryProvisioningAuthority (deviceBinding, driverId)
  └── MetrologyEngine (partInstanceSerialNumber, AuthenticatedAcquisitionEnvelope, QualityVerificationCertificate)
        │
        ▼ (Adapter Projection Layer - Read Only)
[CPIS Projection Adapter]
  ├── PhysicalPartIdentity
  ├── MeasurementInstrumentIdentity
  └── MeasurementAcquisitionEnvelope
        │
        ▼
[QualityGate Single Release Authority]
```

---

## 18. Implementation Readiness Verdict

Because three identity fields (`rawMaterialBatchId`, `markingDigest`, and CNC `MachineIdentity` vs `MachineRegistry`) remain unresolved without an active canonical production backing store, POST-CPIS-003 cannot proceed to production code modification without creating synthetic or unproven mappings.

**Final Verdict**: **`BLOCKED_CANONICAL_MAPPING`**

---
