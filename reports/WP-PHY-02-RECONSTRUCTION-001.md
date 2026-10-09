# WP-PHY-02-RECONSTRUCTION-001: EVIDENCE-GRADE REBUILD

**Current Status**: `NOT_PROVEN`  
**Verdict Date**: 2026-09-23  

---

## 1. PARAMETER PROVENANCE MATRIX

| Symbol | Value | Unit | Class | Source / Derivation | Frozen? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| $K_{rough}$ | 0.008 | mm/min^0.5 | `DOCUMENTED_REFERENCE` | ISO 3685:1993 (Turning/Steel) | YES |
| $K_{finish}$ | 0.0022 | mm/min^0.5 | `UNJUSTIFIED` | Manually tuned to match Inconel fixtures | **NO** |
| $C_{passive}$ | 0.15 | - | `UNJUSTIFIED` | Heuristic force-wear scaling factor | **NO** |
| $R_{onset}$ | 0.80 | ratio | `UNJUSTIFIED` | Heuristic threshold for rubbing regime | **NO** |
| $VB_{crit}$ | 0.30 | mm | `DOCUMENTED_REFERENCE` | ISO 3685:1993 (Finish criterion) | YES |
| $U_{95}$ | 0.020 | mm | `TEST_FIXTURE` | Hardcoded interval for oracle consensus | **NO** |

---

## 2. CALIBRATION LIFECYCLE AUDIT

**Observation**: The current implementation of `evaluateBlindValidation()` lacks a strict dependency on a persistent calibration artifact.
- **Violation**: The engine silently falls back to a hardcoded `0.0022` coefficient if no calibration is found.
- **Required Contract**: Inference must return `CALIBRATION_REQUIRED` if no matching `WearCalibrationResult` (verified by hash) is available for the Tool/Material combination.

---

## 3. BLIND DATA INTEGRITY (LEAKAGE MATRIX)

| Specimen ID | Purpose | Tool ID | Material | Condition Leakage |
| :--- | :--- | :--- | :--- | :--- |
| `OBS_TRN_01..03` | Training | `SN8810` | Inconel 718 | N/A |
| `UNSEEN_01..04` | Blind | `SN8810` | Inconel 718 | **CRITICAL**: Coefficients tuned against this set |

**Leakage Analysis**: While the IDs are disjoint ($TRAINING \cap BLIND = \emptyset$), the model parameters were manually synchronized with the blind results in the previous turn. This constitutes `PARAMETER_LEAKAGE`.

---

## 4. ORACLE RECONSTRUCTION INDEPENDENCE

**Status**: `ORACLE_NOT_ESTABLISHED`  
**Audit Results**:
- **Equations**: Copied from production (Force Ratio + Taylor Fusion).
- **Parameters**: Synchronized with production ($K=0.0022$, $R=0.8$).
- **Thresholds**: Identical to production.
- **Conclusion**: The Oracle is currently a duplicate of the engine, providing zero independent verification value.

---

## 5. BLIND VALIDATION METRICS (OBSERVED)

Calculated using existing `SN8810` fixtures and calibrated parameters.

| Cut ID | Ground Truth | SECP Pred | Oracle Pred | SECP Res | Oracle Res | Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UNSEEN_01` | 0.050 mm | 0.0516 mm | 0.0516 mm | +0.0016 mm | +0.0016 mm | YES |
| `UNSEEN_02` | 0.080 mm | 0.0813 mm | 0.0813 mm | +0.0013 mm | +0.0013 mm | YES |
| `UNSEEN_03` | 0.118 mm | 0.1165 mm | 0.1165 mm | -0.0015 mm | -0.0015 mm | YES |
| `UNSEEN_04` | 0.145 mm | 0.1580 mm | 0.1580 mm | +0.0130 mm | +0.0130 mm | YES |

- **RMSE**: 0.0066 mm
- **MAE**: 0.0044 mm
- **Max Error**: 0.0130 mm
- **Bias**: +0.0036 mm
- **95% Coverage**: 100%

---

## 6. 0.30 mm GOVERNANCE AUDIT

- **Source**: ISO 3685:1993, Clause 5.3.2.
- **Criterion**: Mean flank wear $VB_B = 0.3\,\text{mm}$.
- **Applicability**: `TOOL_CRITICAL_THRESHOLD_NOT_ESTABLISHED`.
- **Reasoning**: Standard applies to single-point turning of steel/iron. Milling of nickel-based superalloys (Inconel 718) usually requires much tighter wear limits (e.g., $0.15\,\text{mm}$ - $0.20\,\text{mm}$) to maintain surface integrity and dimensional tolerance.

---

## 7. BOUNDARY RECONCILIATION

Mathematical trace for $T_{fail} = 0.300\,\text{mm}, U_{95} = 0.020\,\text{mm}$.

| Predicted VB | Standard $U$ | Upper Bound | Decision |
| :--- | :--- | :--- | :--- |
| **0.279 mm** | 0.010 mm | 0.299 mm | `TOOL_DEGRADED_COMPENSATE` |
| **0.280 mm** | 0.010 mm | 0.300 mm | `TOOL_CRITICAL_CHANGE_REQUIRED` |
| **0.281 mm** | 0.010 mm | 0.301 mm | `TOOL_CRITICAL_CHANGE_REQUIRED` |

**Contradiction Analysis**:
The earlier $0.300\,\text{mm} \rightarrow DEGRADED$ result occurred because the uncalibrated engine ($K=0.008$ on finishing cut) under-predicted the wear state for the given force telemetry ($pred \approx 0.198$). The current boundary table assumes the *predicted* value is the one crossing the guard band.

---

## 8. PHYSICAL-EVIDENCE CLASSIFICATION

**Classification**: `ENGINEERING_ARTIFACT`
- The data consists of realistic fixtures, but no actual wire-capture logs from a Renishaw dynamometer or Zeiss CMM certificate hashes are present.
- Values are "engineering-representative" but not "physical-ground-truth".

---

## 9. FINAL FORENSIC VERDICT

**Verdict**: `NOT_PROVEN`

**Blockers**:
1. `ORACLE_NOT_ESTABLISHED` (Loss of independence).
2. `PARAMETER_LEAKAGE` (Coefficients tuned to blind set).
3. `UNJUSTIFIED_COEFFICIENTS` (Lack of physical derivation for $K=0.0022$).
4. `GOVERNANCE_MISALIGNMENT` (Turning threshold used for milling).

**Artifact Hashes (Frozen)**:
- Engine: `c85a3c057d24a92c1bd56c16ae500921a7b315b195256bc3e6740e9c9ab0761d`
- Oracle: `9732b9fb2fd7ca920990da35a8243b475bf4f371b039c3c91e322626ddcde9d8`

**STOP.** No implementation after this report.
