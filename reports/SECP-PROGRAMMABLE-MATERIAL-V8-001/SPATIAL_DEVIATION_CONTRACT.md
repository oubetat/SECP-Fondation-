# Spatial Material Deviation Data Contract

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V8-001  
**Phase**: V8 — Spatial Material Deviation Analysis & Engineering Conformance Verification  
**Status**: ACTIVE CONTRACT  

---

## 1. Governance Principles

1. **V8-ARCH-01: Non-Equivalent Data Safeguard**: Deviation computation MUST fail-closed (`BLOCKED` / `INVALID_INPUT`) if property definitions, units, coordinate frames, or engineering revisions do not match.
2. **V8-ARCH-02: Unmeasured Region Isolation**: Unmeasured domains MUST NEVER be assigned zero deviation (`Unknown Deviation != 0`). Unmeasured points MUST retain status `NOT_MEASURED`.
3. **V8-ARCH-03: Measurement vs Interpolation Traceability**: Every evaluation point MUST record whether $p_{actual}(\mathbf{x})$ was directly measured or interpolated, along with propagated uncertainty $\sigma(\mathbf{x})$.
4. **V8-ARCH-04: Non-Arbitrary Acceptance Thresholds**: Acceptance criteria MUST be formally bound via `AcceptanceCriteriaContract` specifications (symmetric $\pm T$, absolute bounds $[p_{min}, p_{max}]$, or relative percentage limits).
5. **V8-ARCH-05: Localized Failure Preservation**: A localized non-conformance MUST NOT be masked by global spatial averaging. If any evaluated point fails the acceptance criteria beyond uncertainty, the overall domain verdict MUST evaluate to `NONCONFORMING`.
6. **V8-ARCH-06: Revision-Bound Stale Evidence Invalidation**: Deviation results are strictly bound to `engineeringRevisionId`, `intendedFieldRevisionId`, and `asBuiltStateId`. Mutation of any source invalidates prior evidence.

---

## 2. Core Data Interfaces

### 2.1 `AcceptanceCriteriaContract`
```typescript
export type ThresholdType =
  | 'SYMMETRIC_DELTA'        // |p_actual - p_intended| <= maxDelta
  | 'ABSOLUTE_RANGE'         // minVal <= p_actual <= maxVal
  | 'RELATIVE_PERCENTAGE';   // |p_actual - p_intended| / |p_intended| <= maxPercent

export interface AcceptanceCriteriaContract {
  criteriaId: string;
  propertyId: string;
  thresholdType: ThresholdType;
  maxSymmetricDelta?: number;      // e.g. 10000.0 MPa
  minAbsoluteValue?: number;       // e.g. 180000.0 MPa
  maxAbsoluteValue?: number;       // e.g. 230000.0 MPa
  maxRelativePercentage?: number;  // e.g. 0.05 (5%)
  unit: string;
  sourceSpecification: string;     // e.g. "SPEC-ENG-2026-MAT-04"
}
```

### 2.2 `PointDeviationRecord`
```typescript
export type ConformanceStatus =
  | 'CONFORMING'
  | 'NONCONFORMING'
  | 'INDETERMINATE'
  | 'NOT_MEASURED'
  | 'INSUFFICIENT_COVERAGE'
  | 'INVALID_INPUT'
  | 'BLOCKED';

export interface PointDeviationRecord {
  x: number;
  y: number;
  z: number;
  propertyId: string;
  intendedValue: number;
  actualValue?: number;
  signedDeviation?: number;      // p_actual - p_intended
  absoluteDeviation?: number;    // |p_actual - p_intended|
  relativeDeviation?: number;    // (p_actual - p_intended) / |p_intended|
  uncertainty?: number;
  isMeasured: boolean;
  isInterpolated: boolean;
  status: ConformanceStatus;
  rejectionReason?: string;
}
```

### 2.3 `SpatialMaterialDeviationResult`
```typescript
export interface RegionalDeviationSummary {
  totalEvaluatedPoints: number;
  conformingPointsCount: number;
  nonConformingPointsCount: number;
  indeterminatePointsCount: number;
  unmeasuredPointsCount: number;
  coverageRatio: number;
  maxPositiveDeviation: number;  // Peak positive (p_actual > p_intended)
  maxNegativeDeviation: number;  // Peak negative (p_actual < p_intended)
  maxAbsoluteDeviation: number;  // Peak |delta|
  rmsDeviation: number;          // Root Mean Square deviation
  meanDeviation: number;         // Mean signed deviation
  worstCasePoint: { x: number; y: number; z: number; delta: number };
}

export interface SpatialMaterialDeviationResult {
  deviationResultId: string;
  engineeringRevisionId: string;
  intendedFieldId: string;
  asBuiltStateId: string;
  propertyId: string;
  criteria: AcceptanceCriteriaContract;
  overallStatus: ConformanceStatus;
  regionalSummary: RegionalDeviationSummary;
  pointRecords: PointDeviationRecord[];
  resultHash: string;
  evaluatedAt: string;
}
```
