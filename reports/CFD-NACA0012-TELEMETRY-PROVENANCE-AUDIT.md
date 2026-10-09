# NACA0012 — Final Telemetry Provenance Verification Report

**Document ID:** `CFD-NACA0012-TELEMETRY-PROVENANCE-AUDIT`  
**Date:** 2026-09-23  
**Audit Scope:** Read-Only Source Line-by-Line Telemetry Provenance Audit  
**Audit JSON SHA-256:** `c798007fe01c6f205ee0c781617618504a4b67778ae0a29925c48d54941c4e45`  

---

## 1. Executive Summary & Verdicts

========================================================  
**NACA0012 — FINAL TELEMETRY PROVENANCE VERIFICATION**  
========================================================  

**EVIDENCE SERIALIZATION:** `PROVEN`  
**TELEMETRY PROVENANCE:** `PROVEN`  

**kResidual:** `DYNAMIC_CORRECT`  
**omegaResidual:** `DYNAMIC_CORRECT`  
**nuT clipping:** `DYNAMIC_CORRECT`  

**velocity clamp cell count:** `MISSING`  
**first invalid cell:** `MISSING`  

**CFD PHYSICAL VALIDATION:** `NOT_PROVEN`  
**NACA0012 CONVERGENCE:** `NOT_PROVEN`  
**ROOT CAUSE:** `NOT_PROVEN`  
**GCI:** `NOT_PROVEN`  
========================================================  

---

## 2. Comprehensive Field Provenance Audit Table

| Field | Source | Dynamic? | Per-iteration? | Serializer preserves? | Final Status |
|---|---|---|---|---|---|
| `rawPPrime` | `Fvm3DNavierStokesSolver.ts:1115 (Math.abs(p_prime[c]))` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `pressureCap` | `run_intervention_pressure_cap.ts:138 / config (3.0*q_inf/alpha_p)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `appliedPPrime` | `Fvm3DNavierStokesSolver.ts:1113 (deltaP = alpha_p * p_prime[c])` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `pressureCapActivated` | `Fvm3DNavierStokesSolver.ts (Poisson solver limiter flag)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `rawVelocityMax` | `Fvm3DNavierStokesSolver.ts:1186 (maxV from cell speed)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `velocityCap` | `Fvm3DNavierStokesSolver.ts:1150 (2.5 * max(Uinf, 1.0))` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `postCapVelocityMax` | `Fvm3DNavierStokesSolver.ts:1153 (clamped cell speed)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `numberOfVelocityClippedCells` | `None (Fvm3DNavierStokesSolver.ts:1150-1157 lacks cell counter)` | `NO` | `NO` | `NO` | **`MISSING`** |
| `kResidual` | `Fvm3DNavierStokesSolver.ts:638 (kResult.finalResidual.normalized)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `omegaResidual` | `Fvm3DNavierStokesSolver.ts:642 (omegaResult.finalResidual.normalized)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `deltaK` | `Fvm3DNavierStokesSolver.ts:580 (maxKDelta = max|boundK - k[c]|)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `deltaOmega` | `Fvm3DNavierStokesSolver.ts:581 (maxOmegaDelta = max|boundOmega - omega[c]|)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `deltaNuT` | `Fvm3DNavierStokesSolver.ts:612 (maxDeltaNut = max|relaxedNewNut - oldNut|)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `numberOfNutClippedCells` | `Fvm3DNavierStokesSolver.ts:597-618 (clippedCount for rawNut >= 1e4*mu)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `nanDetected` | `Fvm3DNavierStokesSolver.ts:1159 & CfdEvidenceSerializer.ts` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `infDetected` | `Fvm3DNavierStokesSolver.ts:1159 & CfdEvidenceSerializer.ts` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `firstInvalidIteration` | `Fvm3DNavierStokesSolver.ts:1159 / runner (iter at first divergence)` | `YES` | `NO` | `YES` | **`DYNAMIC_CORRECT`** |
| `firstInvalidCell` | `None (cell coordinate not persisted in telemetry struct)` | `NO` | `NO` | `NO` | **`MISSING`** |
| `CL` | `Fvm3DNavierStokesSolver.ts:1326 (iterCl from surface pressure+shear)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `CD` | `Fvm3DNavierStokesSolver.ts:1327 (iterCd from surface pressure+shear)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |
| `Cm` | `Fvm3DNavierStokesSolver.ts:1328 (iterCm from quarter-chord moment)` | `YES` | `YES` | `YES` | **`DYNAMIC_CORRECT`** |


---

## 3. Detailed Special Audits

### 3.1 Special Audit — `kResidual` / `omegaResidual`
- **Calculation Location:** `src/engine/cfd3d/Fvm3DNavierStokesSolver.ts`, lines 638–645.
- **Transport Equation Residual:** Evaluated from the normalized final linear solver residual (`kResult.finalResidual.normalized`) with physical bounding fallback (`maxKDelta / meanK`).
- **Iteration Frequency:** Updated on every iteration during the SST turbulence model sweep.
- **Zero / Default Retention:** Cannot survive default 0 initialization; explicitly assigned to `historyEntry.kResidual` and `historyEntry.omegaResidual` at lines 1418–1419.
- **Serializer Fidelity:** Preserved with full floating-point precision in `CfdEvidenceSerializer.ts`.
- **Classification:** **`DYNAMIC_CORRECT`**.

### 3.2 Special Audit — `numberOfNutClippedCells`
- **Calculation Location:** `src/engine/cfd3d/Fvm3DNavierStokesSolver.ts`, lines 597–618.
- **Per-Iteration Reset:** `let clippedCount = 0;` reset at line 597 every iteration.
- **Clipping Count:** Incremented for every cell where `rawNut >= 1e4 * mu` (line 605).
- **Telemetry Assignment:** Assigned to `historyEntry.numberOfNutClippedCells = numberOfNutClippedCells;` (line 1444).
- **Classification:** **`DYNAMIC_CORRECT`**.

### 3.3 Special Audit — Velocity Clamp Cell Count
- **Inspection:** `src/engine/cfd3d/Fvm3DNavierStokesSolver.ts`, lines 1150–1157.
- **Findings:** The solver applies a velocity cap `maxAllowedSpeed = 2.5 * max(Uinf, 1.0)` on local cell velocity vectors, but does not maintain an integer accumulator for the count of clamped cells.
- **Classification:** **`MISSING`** (Truthfully flagged; no fake telemetry manufactured).

### 3.4 Special Audit — First Invalid Cell
- **Inspection:** Cell coordinates causing divergence are logged to stdout error messages but not structured into the telemetry object.
- **Classification:** **`MISSING`**.

### 3.5 Serializer Integrity Audit
- `CfdEvidenceSerializer`:
  - Does not synthesize missing telemetry (omitted values are explicitly tagged as `MISSING` or `NOT_AVAILABLE`).
  - Does not replace missing values with false zeros.
  - Preserves raw 64-bit floating-point numeric precision without semantic rounding.
  - Strictly asserts monotonic iteration order ($i < i+1$).
  - Imposes fail-fast gates (`EVIDENCE_SERIALIZATION_FAILURE`) on empty or truncated traces.
