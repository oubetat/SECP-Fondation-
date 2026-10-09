# NACA0012 — Evidence Serialization Gap Closure Report

**Document ID:** `CFD-NACA0012-EVIDENCE-SERIALIZATION-CLOSURE`  
**Date:** 2026-09-23  
**Status:** `PROVEN (EVIDENCE PIPELINE ONLY)`  
**Closure JSON SHA-256:** `8715e851c5993fbf7d0ffecbfa0fcf5dd32a159f7ed45468e06b2cd69fd88772`  

---

## 1. Executive Summary & Verdict

========================================================  
**NACA0012 — EVIDENCE SERIALIZATION CLOSURE**  
========================================================  

**SERIALIZATION GAP:** `FOUND`  
**LOSS POINT:** `solutionResult.history (undefined) vs solutionResult.iterationHistory (present) at runner serialization interface`  

**IMPLEMENTATION:**  
- `src/engine/cfd3d/evidence/CfdEvidenceSerializer.ts`  
- `src/engine/cfd3d/evidence/__tests__/CfdEvidenceSerialization.test.ts`  
- `run_intervention_pressure_cap.ts`  
- `vitest.config.ts`  

**CFD NUMERICAL LOGIC CHANGED:** `NO`  
**BENCHMARK PHYSICS CHANGED:** `NO`  
**CONVERGENCE CRITERIA CHANGED:** `NO`  
**EVIDENCE CAPTURE CHANGED:** `YES`  
**EVIDENCE SERIALIZATION CHANGED:** `YES`  

**EVIDENCE CONTRACT:** `PROVEN`  
**HISTORY PRESERVATION TEST:** `PASS`  
**EMPTY-TRACE INTEGRITY TEST:** `PASS`  
**TELEMETRY PROVENANCE TEST:** `PASS`  
**ORIGINAL ARTIFACT IMMUTABILITY:** `PASS`  

**REMAINING TELEMETRY GAPS:**  
- `actual velocity clamp cell count (numberOfVelocityClippedCells = MISSING)`  
- `first invalid cell coordinate (firstInvalidCell = MISSING)`  

**NACA0012 PHYSICAL VALIDATION:** `NOT_PROVEN`  
**NACA0012 CONVERGENCE:** `NOT_PROVEN`  
**ROOT CAUSE:** `NOT_PROVEN`  
**GCI:** `NOT_PROVEN`  
========================================================  

---

## 2. Phase 1 — Forensic Root-Cause of Serialization Gap

The inspection of the complete data path:
```
Solver Iteration Loop -> iterationHistory.push() -> CfdSolution3D.iterationHistory -> Runner/Serializer -> JSON Artifact
```
revealed the exact structural loss point:

- **PRODUCER:** `Fvm3DNavierStokesSolver.solve` (`src/engine/cfd3d/Fvm3DNavierStokesSolver.ts`, line 1882)
- **CONTAINER:** `CfdSolution3D.iterationHistory` (`src/engine/cfd3d/Fvm3DTypes.ts`, line 371)
- **CONSUMER:** `run_intervention_pressure_cap.ts` (line 137)
- **EXPECTED FIELD:** `solutionResult.iterationHistory`
- **ACTUAL FIELD READ:** `solutionResult.history` (which evaluated to `undefined`)
- **LOSS MECHANISM:** `(solutionResult?.history || []).map(...)` evaluated to an empty array `[]` and silently wrote `trace: []` without raising an evidence integrity error.

---

## 3. Phase 2 & 3 — Canonical Evidence Contract & Minimal Fix

1. Created canonical serialization engine `CfdEvidenceSerializer`:
   - Enforces single canonical field `iterationHistory`.
   - Gate 1: Rejects silent empty trace if `totalIterationsExecuted > 0 && iterationHistory.length === 0` with `EVIDENCE_SERIALIZATION_FAILURE`.
   - Gate 2: Rejects length mismatch between `totalIterations` and `iterationHistory.length`.
   - Gate 3: Enforces monotonic iteration order ($i < i+1$).
   - Preserves exact double-precision floating point numbers without truncation or rounding.
2. Updated runner scripts to read `solutionResult.iterationHistory` and enforce fail-fast verification.

---

## 4. Phase 4 — Telemetry Integrity Audit

| Field | Category | Provenance Status |
|---|---|---|
| `rawPPrime` | Pressure | `DYNAMIC_CORRECT` |
| `pressureCap` | Pressure | `DYNAMIC_CORRECT` |
| `appliedPPrime` | Pressure | `DYNAMIC_CORRECT` |
| `pressureCapActivated` | Pressure | `DYNAMIC_CORRECT` |
| `rawVelocityMax` | Velocity | `DYNAMIC_CORRECT` |
| `velocityCap` | Velocity | `DYNAMIC_CORRECT` |
| `postCapVelocityMax` | Velocity | `DYNAMIC_CORRECT` |
| `numberOfVelocityClippedCells` | Velocity | **`MISSING`** (Truthfully flagged) |
| `kResidual` / `omegaResidual` | Turbulence | `DYNAMIC_CORRECT` |
| `deltaK` / `deltaOmega` / `deltaNuT` | Turbulence | `DYNAMIC_CORRECT` |
| `numberOfNutClippedCells` | Turbulence | `DYNAMIC_CORRECT` (7260/7260) |
| `nanDetected` / `infDetected` | Validity | `DYNAMIC_CORRECT` |
| `firstInvalidIteration` | Validity | `DYNAMIC_CORRECT` |
| `firstInvalidCell` | Validity | **`MISSING`** |
| `cl` / `cd` / `cm` | Forces | `DYNAMIC_CORRECT` |

---

## 5. Phase 5 & 7 — Forensic Test Verification Results

All 7 forensic unit tests pass under `vitest`:
1. **TEST 1 — HISTORY PRESERVATION:** `PASS` (5/5 synthetic records preserved).
2. **TEST 2 — ITERATION ORDER:** `PASS` (Strict monotonicity verified; out-of-order sequence rejected).
3. **TEST 3 — NUMERIC FIDELITY:** `PASS` (Floating-point values preserved without rounding).
4. **TEST 4 — NO SILENT EMPTY TRACE:** `PASS` (Throws `EVIDENCE_SERIALIZATION_FAILURE` on empty history).
5. **TEST 5 — TRACE/ITERATION CONSISTENCY:** `PASS` (Rejects length discrepancies).
6. **TEST 6 — TELEMETRY PROVENANCE:** `PASS` (Missing fields preserved as `MISSING` / `NOT_AVAILABLE`).
7. **TEST 7 — ORIGINAL ARTIFACT IMMUTABILITY:** `PASS` (Original frozen artifact SHA-256 confirmed unchanged at `99b9b7d93aa32eeec26ef8290b9ab0db44c13cf64185c7446811aa62efc515e2`).

---

## 6. Original Artifact Immutability Attestation

- **Path:** `reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json`
- **Expected SHA-256:** `99b9b7d93aa32eeec26ef8290b9ab0db44c13cf64185c7446811aa62efc515e2`
- **Actual Post-Implementation SHA-256:** `99b9b7d93aa32eeec26ef8290b9ab0db44c13cf64185c7446811aa62efc515e2`
- **Result:** `PASS (BYTE-IDENTICAL IMMUTABLE)`
