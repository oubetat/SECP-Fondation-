# SECP CFD — CROSS-GRID FORENSIC COMPARISON

**Case Reference:** SECP-CFD-BENCHMARK-NACA0012-001  
**Audit Date:** 2026-09-22  
**Verdict:** NOT_PROVEN (Convergence Failure)  

---

## 1. Executive Summary of Provenance Failures

| Grid | Iterations | $C_L$ (Initial) | $C_L$ (Continuation) | $\Delta C_L$ | Stability Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fine** | 25 | 0.0082 | 0.1069 | +1200% | **UNSTABLE** |
| **Medium** | 26 | 0.0867 | [TBD] | [TBD] | **UNSTABLE** |
| **Coarse** | 27 | 0.0287 | [TBD] | [TBD] | **UNSTABLE** |

**Root Cause Found:** The solver exits prematurely. The "CONVERGED" flag was a false positive. The massive delta in $C_L$ after a mere 25-iteration continuation proves the solutions were transient states, not converged equilibria.

---

## 2. Numerical Convergence Forensics

| Metric | Measured (Fine) | Threshold | Status |
| :--- | :--- | :--- | :--- |
| **Continuity Residual** | 1.69e-5 | 1e-3 | PASS |
| **Momentum Residual** | 1.31e-2 | 1.5e-2 | PASS |
| **Pressure Correction** | **6.125 Pa** | **1.0 Pa** | **FAIL** |
| **Velocity Correction** | **0.0325** | **0.015** | **FAIL** |

**Observation:** The solver gate (Step 14) failed to block on Pressure Correction. This allowed the solver to report convergence while the pressure field was still undergoing major redistribution.

---

## 3. Boundary Flow Invariant Audit

| Metric | Inflow (kg/s) | Outflow (Raw) | Outflow (Scaled) | Imbalance (%) |
| :--- | :--- | :--- | :--- | :--- |
| **Fine Grid** | 4.825 | 5.187 | 4.825 | 7.5% (Raw) |

**Conclusion:** A 7.5% raw mass imbalance is unacceptable for a converged FVM solution. The `outletScaling` (Step 13) hides this defect from the global integral but the local continuity errors are driving the $C_L$ instability.

---

## 4. Final Forensic Verdict

> **VERDICT: NOT_PROVEN**
>
> The non-monotonicity is a symptom of **under-convergence**. Every grid reported a "PASS" verdict based on a defective convergence gate that ignored the magnitude of the pressure correction. The multi-grid comparison is invalid because no grid had reached a steady state.

**Next Required Engineering Action:** 
1. Re-run benchmark with `maxIterations = 500`.
2. Implement blocking `pressureCorrection` gate in `Fvm3DNavierStokesSolver.ts`.
3. Disable `outletScaling` until raw imbalance is < 0.1%.
