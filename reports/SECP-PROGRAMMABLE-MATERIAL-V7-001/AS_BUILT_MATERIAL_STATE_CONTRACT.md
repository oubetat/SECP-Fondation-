# As-Built Material State Data Contract

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V7-001  
**Phase**: V7 — Actual / As-Built Material State Reconstruction & Verification  
**Status**: ACTIVE CONTRACT  

---

## 1. Objective & Scope

This contract defines the strict schema and behavioral specifications for ingesting, validating, spatially registering, reconstructing, and comparing **As-Built Physical Material States** (`AsBuiltMaterialState`) within the SECP Platform.

---

## 2. Core Governance Principles

1. **V7-ARCH-01: Strict State Isolation**: Intended Material Fields (`SpatialMaterialField`), Predicted Process Simulations, and Actual As-Built Measurements (`AsBuiltMaterialState`) MUST remain strictly isolated objects.
2. **V7-ARCH-02: Non-Falsification & Provenance Flagging**: Synthetic test data MUST be explicitly tagged with `dataOrigin: 'SYNTHETIC_TEST_DATA'`.
3. **V7-ARCH-03: Measurement Uncertainty & Resolution**: Every physical measurement record MUST capture unit, sensor resolution, accuracy, calibration status, and measurement uncertainty.
4. **V7-ARCH-04: Spatial Coverage & Unmeasured Regions**: The engine MUST track bounding boxes, coverage ratios, and identify unmeasured spatial domains. Unmeasured regions MUST NEVER be assumed compliant.
5. **V7-ARCH-05: Revision-Bound Evidence Invalidation**: As-Built states are immutably tied to specific `engineeringRevisionId` and `geometryRevisionId`. Any revision change invalidates prior evidence.
6. **V7-ARCH-06: Fail-Closed Gatekeeping**: Verification outputs MUST strictly evaluate to `PASS`, `FAIL`, `INDETERMINATE`, or `BLOCKED`.

---

## 3. Data Interface Definitions

### 3.1 `AsBuiltMaterialDataset`
Represents the raw imported measurement dataset before or after coordinate alignment.

```typescript
export type DataOrigin =
  | 'PHYSICAL_MEASUREMENT'
  | 'SYNTHETIC_TEST_DATA'
  | 'SIMULATION_OUTPUT'
  | 'INFERRED_FROM_MEASUREMENTS'
  | 'IMPORTED_UNVERIFIED';

export interface RawMeasurementPoint {
  pointId: string;
  x: number; // In sensor local or part global coordinate frame
  y: number;
  z: number;
  propertyId: 'E' | 'nu' | 'density' | 'porosity' | 'yieldStrength';
  value: number;
  unit: 'Pa' | 'MPa' | 'GPa' | 'kg/m3' | 'g/cm3' | 'dimensionless';
  uncertainty?: number; // Absolute uncertainty in property units
  qualityStatus?: 'VALIDATED' | 'REJECTED' | 'UNVERIFIED' | 'OUT_OF_BOUNDS' | 'CONFLICTING';
}

export interface AsBuiltMaterialDataset {
  datasetId: string;
  partInstanceId: string;
  engineeringRevisionId: string;
  geometryRevisionId: string;
  measurementMethodId: string;
  dataOrigin: DataOrigin;
  sensorMetadata: {
    deviceName: string;
    resolution: number;
    accuracy: number;
    calibrationDate?: string;
  };
  coordinateFrameId?: string;
  rawPoints: RawMeasurementPoint[];
  createdAt: string;
}
```

### 3.2 `AsBuiltMaterialState`
Represents the spatially registered and reconstructed continuous/discrete actual material field.

```typescript
export interface ReconstructedFieldPoint {
  x: number;
  y: number;
  z: number;
  reconstructedProperties: Record<string, { value: number; uncertainty: number; isInterpolated: boolean }>;
  isMeasured: boolean;
  qualityStatus: 'VALIDATED' | 'OUT_OF_BOUNDS' | 'UNMEASURED';
}

export interface AsBuiltMaterialState {
  asBuiltStateId: string;
  datasetId: string;
  partInstanceId: string;
  engineeringRevisionId: string;
  geometryRevisionId: string;
  intendedFieldId?: string;
  reconstructionMethod: 'POINTWISE' | 'IDW_INTERPOLATION' | 'VOXEL_GRID';
  reconstructedPoints: ReconstructedFieldPoint[];
  coverageRatio: number; // 0.0 to 1.0
  unmeasuredVolumeRatio: number; // 0.0 to 1.0
  registrationError: { maxError: number; rmsError: number };
  stateHash: string;
  createdAt: string;
}
```

---

## 4. Acceptance Criteria & Gate Logic

* **PASS**: Measurements cover $\ge 80\%$ of bounding domain, spatial registration error $< 1.0\text{ mm}$, and all property deltas are within declared tolerance.
* **FAIL**: Property delta exceeds tolerance threshold beyond measurement uncertainty.
* **INDETERMINATE**: Measurement uncertainty overlaps the tolerance boundary.
* **BLOCKED**: Invalid dataset, missing geometry revision, unit conversion mismatch, or negative property values.
