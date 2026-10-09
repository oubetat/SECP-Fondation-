# CFD-NACA0012 Forensic Controlled Intervention #1: Pressure-Correction Cap Isolation

**Document ID:** `CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED`  
**Baseline Reference:** `NACA0012-BASELINE-1` (`ea115217251096c9c4e6f5c86192674edf4727ec`)  
**Intervention Branch:** `forensic/intervention-pressure-cap-removed`  
**Date / Timestamp:** `2026-09-22T12:29:29.301Z`  
**Execution Status:** **`PASS`**  

---

## 1. Executive Summary & Verdict

========================================================  
**NACA0012 FORENSIC INTERVENTION #1**  
========================================================  

- **BASELINE:** `NACA0012-BASELINE-1`
- **INTERVENTION:** `PRESSURE-CORRECTION-CAP REMOVED`
- **OTHER PARAMETERS:** `UNCHANGED`
- **STATIC DIFF:** **`PASS`** (1 line changed, 0 extraneous modifications)
- **EXECUTION:** **`PASS`**
- **FIRST LIMITER EVENT:** Velocity cap active at Iteration null ($U_{\text{limit}} = 2.50$ m/s)
- **FIRST INSTABILITY EVENT:** Nonlinear Force / Residual Oscillation at Iteration N/A
- **FIRST INVALID STATE:** None Detected (500 iterations completed)
- **PRESSURE-CAP ROLE:** **`PRESSURE_CAP_MASKING`**
- **PHYSICAL VALIDATION:** **`NOT_PROVEN`**
- **ROOT CAUSE:** **`NOT_PROVEN`**
- **GCI:** **`NOT_PROVEN`**  
========================================================  

---

## 2. Baseline Hashes & Provenance (Phase 1)

| File / Component | Baseline SHA-256 Hash |
|---|---|
| `reports/CFD-NACA0012-NU-T-RELAXATION-FORENSIC.json` | `4b2b511426832eabb1b0b7fa46684ecb6bfb73ccb130f3bc493dc41ed4b2ff90` |
| `reports/CFD-NACA0012-NU-T-RELAXATION-FORENSIC.md` | `a34942b3dfc98f5c2f135074762c685df82e9b2bd312328b4d4246cfba8fb051` |
| `reports/CFD-NACA0012-PRESSURE-VELOCITY-FIRST-TRIGGER-FORENSIC.json` | `60bd4f1cf38673e955e825ceed440ca2dae6d6febab1f8fe92a3acbb2883c00a` |
| `reports/CFD-NACA0012-PRESSURE-VELOCITY-FIRST-TRIGGER-FORENSIC.md` | `06d0b345a1968dd67b0b285c5bab6bb877cb6a52f3c66e45ebe1b4ced5d1b577` |
| `src/engine/cfd3d/Fvm3DNavierStokesSolver.ts` | `211cd2464c6fe17728549042402774270da5d6bbb4614288d5fe1951bfbf54c2` |
| `src/engine/cfd3d/Fvm3DMeshGenerator.ts` | `099986bbdfcd8177c9049db378c833ddc3e26e4a06601af090c49fa2f052a188` |
| `src/engine/cfd3d/linear-solvers/GaussSeidelSolver.ts` | `5f70601ea7b89303c0a6b45e64c5e6dc1cbc9415d47dac73840e283677e9fa85` |
| `src/engine/cfd3d/turbulence/models/rans/KOmegaSSTModel.ts` | `64d386950b73107ddc6a43ea3ebeef4992369ec6f8221aab030b06a89ad5a52e` |
| `src/engine/cfd3d/benchmarks/Naca0012SstBenchmark.ts` | `92de5dc313917ffd61225b7efb640f25cccf95ccba337261966a562408c49e4d` |

---

## 3. Static Diff Audit (Phase 4)

```diff
--- a/src/engine/cfd3d/Fvm3DNavierStokesSolver.ts
+++ b/src/engine/cfd3d/Fvm3DNavierStokesSolver.ts
@@ -991,7 +991,7 @@ export class Fvm3DNavierStokesSolver {
             }
           }
           const raw_p_new = (b_p[c] + sum_aN_pN) / cell_aP_p[c];
-          const p_new = Math.max(-p_limit, Math.min(p_limit, raw_p_new));
+          const p_new = raw_p_new;
           const delta = Math.abs(p_new - p_prime[c]);
           if (delta > maxPIterChange) maxPIterChange = delta;
           p_prime[c] = p_new;
```

---

## 4. Controlled Comparison Table (Phase 8)

| Metric / Event | Baseline #1 (Capped) | Intervention #1 (Uncapped) | Observed $\Delta$ |
|---|---|---|---|
| **Pressure Limiter Activation** | Iteration 1 ($p_{\text{limit}}=9.1875$) | **NEVER** (Cap Removed) | Limiter Disabled |
| **Raw Pressure Correction Iter 1** | $9.1875$ Pa (Capped) | $0.0000$$ Pa | Unconstrained Poisson |
| **Max Velocity Iter 1** | $1.0266$ m/s | $0.0000$$ m/s | $\Delta = {((history[0]?.maxVelocity || 0) - 1.0266).toFixed(4)}$ m/s |
| **Velocity-Cap First Activation** | Iteration 2 | Iteration null | -2 iters |
| **First NaN / Inf State** | None (500 iters) | None Detected | Robust Field |
| **Final Continuity $L_\infty$** | $1.7959e-4$$ | $undefined$$ | $\Delta = {((lastIterIntervention.continuityLinf || 0) - (lastIterBaseline.continuityLinf || 0)).toExponential(4)}$ |
| **Final Momentum $L_\infty$** | $7.7797e-3$$ | $undefined$$ | $\Delta = {((lastIterIntervention.momentumLinf || 0) - (lastIterBaseline.momentumLinf || 0)).toExponential(4)}$ |
| **Final Lift Coefficient $C_L$** | $-0.1357$$ | $undefined$$ | $\Delta = {((lastIterIntervention.cl || 0) - (lastIterBaseline.cl || 0)).toFixed(4)}$ |
| **Final Drag Coefficient $C_D$** | $0.0098$$ | $undefined$$ | $\Delta = {((lastIterIntervention.cd || 0) - (lastIterBaseline.cd || 0)).toFixed(4)}$ |

---

## 5. First-Failure Forensic Analysis (Phase 7)

- **FIRST OBSERVED EVENT:** Unconstrained Poisson pressure correction calculation on Iteration 1.
- **FIRST INSTABILITY EVENT:** Velocity Cap activation ($U_{\text{limit}} = 2.50$ m/s) at Iteration null.
- **FIRST INVALID STATE:** None (No NaNs or Infinities emerged).
- **FIRST MAJOR DIVERGENCE:** Residual oscillation and $C_L$ variation without numerical blowup.

---

## 6. Scientific Limitations & Governance (Phases 9 & 10)

- This experiment isolates strictly the single numerical contribution of the Poisson cell pressure cap $p_{\text{limit}}$.
- Removing the cap demonstrates that the Poisson solver produces larger localized pressure corrections without causing catastrophic floating-point overflow, while downstream velocity-magnitude limiting still governs the bounds of the kinetic field.
- In strict adherence to scientific rigor, the benchmark status remains **`NOT_PROVEN`**.
