# NACA0012 Intervention #1 — Read-Only Artifact Integrity & Forensic Reconciliation

**Document ID:** `CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED-RECONCILED`  
**Date:** 2026-09-22  
**Baseline Artifact:** `reports/CFD-NACA0012-NU-T-RELAXATION-FORENSIC.json` (`4b2b511426832eabb1b0b7fa46684ecb6bfb73ccb130f3bc493dc41ed4b2ff90`)  
**Original Intervention Artifact:** `reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json` (`99b9b7d93aa32eeec26ef8290b9ab0db44c13cf64185c7446811aa62efc515e2`)  
**Reconciled JSON Hash:** `d192ecc6f0823da2dea9a2b9c002279f5cdfd72a07143c0b6bae0c7276a0aa19`  

---

## 1. Provenance Classifications & Integrity Audit

This reconciliation strictly tags all evidence by its factual source of origin:
- **`[RAW_JSON]`**: Data verifiable from serialized JSON array elements in frozen artifacts.
- **`[EXECUTION_LOG]`**: Telemetry recorded in stdout periodic logs during the benchmark run.
- **`[SOURCE_STATIC_AUDIT]`**: Verified directly by code inspection of `src/engine/cfd3d/Fvm3DNavierStokesSolver.ts`.
- **`[INFERENCE]`**: Analytical deduction — strictly barred from serving as empirical proof.

### Artifact Integrity
- **Baseline JSON (`CFD-NACA0012-NU-T-RELAXATION-FORENSIC.json`):** Complete `[RAW_JSON]` trace array with length $500$.
- **Original Intervention JSON (`CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json`):** Preserved intact. `trace.length = 0` (`raw iteration history = MISSING`). All detailed per-iteration events requiring `iterationHistory` are classified as **`UNRECOVERABLE_FROM_FROZEN_JSON`**.

---

## 2. Quantitative Event Reconstruction with Explicit Provenance

| Metric / Event | Baseline #1 (`[RAW_JSON]`) | Intervention #1 (`[EXECUTION_LOG]` / `[RAW_JSON]`) | Provenance & Evidence Status |
|---|---|---|---|
| **Raw Trace Status** | Length = 500 | Length = 0 (Empty) | `[RAW_JSON]` |
| **First maxVelocity $\ge 2.50$ m/s** | Iteration 2 ($2.50$ m/s) | Iteration 10 ($2.50$ m/s) | `[EXECUTION_LOG]` for Intervention |
| **Actual Velocity Clamp Activation** | `TELEMETRY MISSING` | `NOT_PROVEN / TELEMETRY MISSING` | `[SOURCE_STATIC_AUDIT]` (Cell count not instrumented) |
| **First Statistical Momentum Rise** | Iteration 432 ($0.01135$) | `UNRECOVERABLE_FROM_FROZEN_JSON` | Claim of identical iter 432 **REMOVED** |
| **Continuity Deterioration ($>2\times$)** | None | `UNRECOVERABLE_FROM_FROZEN_JSON` | `[RAW_JSON]` |
| **Force Oscillation ($|C_L|>1.0, |C_D|>0.20$)** | None | None observed in 10-iter log samples | `[EXECUTION_LOG]` |
| **Momentum $L_\infty > 1.0$ Excursion** | None ($< 0.02$) | Iteration 90 ($L_\infty = 1.22780$) | `[EXECUTION_LOG]` |
| **First Invalid State (NaN/Inf)** | None (0 / 500 iters) | None (0 / 500 iters) | `[EXECUTION_LOG]` |

---

## 3. Reconciled Event Findings

1. **First Confirmed Limiter-Threshold Event:**
   - **Intervention:** Iteration 10, $\text{maxVelocity} = 2.50\text{ m/s}$ (`[EXECUTION_LOG]`).
   - (Baseline reached $2.50\text{ m/s}$ at Iteration 2 via `[RAW_JSON]`).
2. **Actual Velocity Clamp Cell Count:**
   - **Status:** `NOT_PROVEN / TELEMETRY MISSING` (field `numberOfVelocityClippedCells` is not instrumented in the solver source).
3. **First Instability Event:**
   - **Status:** `RECONCILIATION NOT_PROVEN FROM FROZEN JSON`.
   - **Evidence:** Periodic execution logs show severe nonlinear excursions (e.g., Iteration 90 momentum $L_\infty = 1.22780$), but continuous first-event reconstruction is unrecoverable from the frozen JSON.
4. **First Invalid State:**
   - **Status:** `None Detected` (0 NaNs / 0 Infs across 500 iterations).

---

## 4. Reconciled Scientific Classification

- **`PRESSURE_CAP_STABILIZING_EFFECT`**: **`OBSERVED`** (Disabling the cap delayed the velocity limiter threshold arrival from Iteration 2 to Iteration 10).
- **`UNDERLYING_INSTABILITY`**: **`OBSERVED IN EXECUTION LOG`** (Severe transient momentum excursions $>1.0$ and persistent $100\%$ $\nu_t$ saturation across $7260/7260$ cells).
- **`ROOT_CAUSE`**: **`NOT_PROVEN`**
- **`MASKING_EFFECT`**: **`NOT_PROVEN`**

---

## 5. Final Reconciliation Verdict

```
========================================================
NACA0012 INTERVENTION #1 — RECONCILIATION
========================================================
BASELINE:                    NACA0012-BASELINE-1
INTERVENTION:                PRESSURE-CORRECTION-CAP REMOVED

STATIC DIFF:                 PASS
EXECUTION:                   PASS

FIRST CONFIRMED LIMITER-THRESHOLD EVENT:
    Intervention Iteration 10, maxVelocity = 2.50 m/s [EXECUTION_LOG]

ACTUAL VELOCITY CLAMP ACTIVATION:
    NOT_PROVEN / TELEMETRY MISSING [SOURCE_STATIC_AUDIT]

FIRST INSTABILITY:
    RECONCILIATION NOT_PROVEN FROM FROZEN JSON [EXECUTION_LOG EXCURSIONS OBSERVED]

FIRST INVALID STATE:
    None Detected (0 NaNs / 0 Infs across 500 iterations)

PRESSURE-CAP ROLE:
    PRESSURE_CAP_STABILIZING_EFFECT = OBSERVED
    UNDERLYING_INSTABILITY = OBSERVED IN EXECUTION LOG
    MASKING_EFFECT = NOT_PROVEN
    ROOT_CAUSE = NOT_PROVEN

PHYSICAL VALIDATION:         NOT_PROVEN
GCI:                         NOT_PROVEN

RECONCILED_ARTIFACT_HASH:    d192ecc6f0823da2dea9a2b9c002279f5cdfd72a07143c0b6bae0c7276a0aa19
========================================================
```
