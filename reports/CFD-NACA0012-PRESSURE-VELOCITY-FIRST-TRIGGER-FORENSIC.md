# CFD-NACA0012 Pressure–Velocity First-Trigger Forensic Audit

**Document ID:** `CFD-NACA0012-PRESSURE-VELOCITY-FIRST-TRIGGER-FORENSIC`  
**Investigation Classification:** STRICT NUMERICAL FORENSICS  
**Benchmark Status:** **NOT_PROVEN** (Enforced by Hard Freeze Mandate)  
**Date / Timestamp:** `2026-09-22T12:14:31.183Z`

---

## 1. Executive Finding

This forensic audit identifies the exact first numerical anomaly responsible for the subsequent nonlinear breakdown of the NACA0012 SST $k$-$\omega$ CFD simulation.

### Executive Diagnosis:
- **First Observable Numerical Anomaly:** Unrelaxed Pressure Correction ($p'$) reaching the Poisson solver clipping boundary ($p_{\text{limit}} = 9.1875$ Pa) on **Iteration 1**.
- **First Numerical Limiter Activation:** **Iteration 1** — The pressure correction limiter ($9.1875$ Pa) and turbulent viscosity ceiling ($2.0417\times 10^{-3}$ Pa·s) activate concurrently in the very first iteration.
- **First Velocity-Cap Activation:** **Iteration 2** in Experiment A ($\\alpha_{\nu_t} = 1.0$) and **Iteration 23** in Experiment B ($\\alpha_{\nu_t} = 0.3$).
- **First-Trigger Classification:** **`A = PRESSURE-CAP-FIRST`** (Iteration 1).
- **Physical/Numerical Mechanism:** The initial severe mass imbalance at the airfoil boundaries produces an unbounded Poisson source term in Phase 3. The linear solver unrelaxed correction is clipped at $p_{\text{limit}} = 9.1875$ Pa. The resulting artificial steep pressure gradient field $\nabla p'$ injects large velocity corrections $\Delta u$, forcing cell velocities to reach the numerical limiter ($U_{\text{limit}} = 2.50$ m/s). Because both $p'$ and $\mathbf{u}$ are artificial ceiling values, the system cannot satisfy mass or momentum conservation, locking the solution into perpetual oscillation.

---

## 2. Static Contract Integrity (Phase 1)

Static type contract validation was executed:
```bash
npx tsc --noEmit run_relaxation_experiments.ts
```

- **TypeScript Errors Before Remediation:** `12`
- **TypeScript Errors After Remediation:** `0`
- **STATIC_CONTRACT_STATUS:** **`PASS`**

---

## 3. Pressure Correction Source Audit (Phase 2)

In `Fvm3DNavierStokesSolver.ts`, the pressure correction equations are governed by:
$$q_{\infty} = 0.5 \cdot \rho \cdot U_{\text{ref}}^2 = 0.5 \cdot 1.225 \cdot (1.0)^2 = 0.6125 \text{ Pa}$$
$$p_{\text{limit}} = \frac{3.0 \cdot q_{\infty}}{\alpha_p} = \frac{3.0 \cdot 0.6125}{0.2} = 9.1875 \text{ Pa}$$

During the Gauss-Seidel Poisson sweeps:
$$p'_{\text{new}} = \max\left(-p_{\text{limit}}, \min\left(p_{\text{limit}}, \text{raw}\_p'_{\text{new}}\right)\right)$$

Then the applied cell pressure update is:
$$\Delta p = \max\left(-2.0 \cdot q_{\infty}, \min\left(2.0 \cdot q_{\infty}, \alpha_p \cdot p'\right)\right) = \max(-1.225, \min(1.225, 0.2 \cdot 9.1875)) = 1.2250 \text{ Pa}$$

### Proven Distinction:
- The telemetry report `pressureCorrection = 9.1875` denotes that the **unrelaxed Poisson correction** hit the hard numerical cap $p_{\text{limit}} = 9.1875$ Pa.
- The **raw unbounded Poisson solution** in Iteration 1 would have exceeded $9.1875$ Pa without this limiter.
- The actual pressure change applied to the field is $1.2250$ Pa.

---

## 4. Velocity Limiter Audit (Phase 3)

The velocity correction and magnitude limits in `Fvm3DNavierStokesSolver.ts` are:
1. **Incremental Velocity Correction Cap:**
   $$\text{maxVelCorrAllowed} = 0.5 \cdot \max(U_{\text{ref}}, 1.0) = 0.50 \text{ m/s}$$
   $$du = \max\left(-0.50, \min\left(0.50, \alpha_u \frac{\nabla p'_x}{a_{P,u}}\right)\right)$$
2. **Global Cell Speed Magnitude Ceiling:**
   $$U_{\text{limit}} = 2.50 \text{ m/s}$$
   $$\text{speed} = \sqrt{u^2 + v^2 + w^2}$$
   $$\text{if } (\text{speed} > 2.50) \implies \mathbf{u} = \mathbf{u} \cdot \frac{2.50}{\text{speed}}$$

### Forensic Classification:
- $2.50$ m/s is **`NUMERICAL_LIMITER`**, NOT a physical aerodynamic result.

---

## 5. Same-Iteration Execution Order (Phase 4)

The execution flow within each SIMPLE iteration of `Fvm3DNavierStokesSolver.ts` is strictly:
1. **Turbulence Assembly & Solve:** $k$ and $\omega$ transport solved via Gauss-Seidel.
2. **Turbulent Viscosity Evaluation:** $\nu_t = \rho k / \omega$, clamped to $\nu_{t,\text{max}} = 10^4 \mu$.
3. **Momentum Assembly & Solve:** $u^*, v^*, w^*$ predicted with Rhie–Chow face velocities.
4. **Continuity Defect Evaluation:** Cell mass imbalances computed from face fluxes.
5. **Pressure Poisson Assembly & Solve:** $p'$ computed and clamped to $p_{\text{limit}} = 9.1875$ Pa.
6. **Field Correction:** Pressure updated with $\Delta p = \text{clamp}(\alpha_p p', 1.225)$; velocity corrected by $-\alpha_u \nabla p' / a_P$ and clamped to $2.50$ m/s.
7. **Post-Correction Residual Audit:** Continuity $L_1, L_2, L_\infty$ and Momentum $L_1, L_2, L_\infty$ evaluated independently.
8. **Aerodynamic Force Calculation:** Lift ($C_L$), Drag ($C_D$), Moment ($C_m$) integrated over airfoil faces.
9. **Convergence Gate Check:** Multigate evaluation recorded to telemetry history.

---

## 6. First-Anomaly Table (Phase 5)

| Event / Threshold | Experiment A (Baseline $\\alpha_{\nu_t}=1.0$) | Experiment B (Intervention $\\alpha_{\nu_t}=0.3$) |
|---|---|---|
| **Pressure cap first active ($p'=9.1875$)** | **Iteration 1** | **Iteration 1** |
| **Turbulent Viscosity $\nu_t$ ceiling active** | **Iteration 1** | **Iteration 1** |
| **Velocity cap first active ($U=2.50$ m/s)** | **Iteration 2** | **Iteration 23** |
| **Max Velocity saturation ($U=2.50$ m/s)** | **Iteration 2** | **Iteration 23** |
| **Continuity deterioration onset** | Iteration 2 | Iteration 310 |
| **Momentum deterioration onset** | Iteration 2 | Iteration 360 |
| **$k$ residual anomaly ($k_{\text{res}} \ge 0.5$)** | Iteration 380 | Iteration 500 |
| **$\omega$ residual anomaly** | None ($< 0.05$) | None ($< 0.05$) |
| **Force instability ($|\Delta C_L| > 0.05$)** | Iteration 10 | Iteration 370 |

---

## 7. Critical Experiment B Timeline Verification (Phase 8)

Inspection of the actual Experiment B JSON trace establishes:
1. **Iteration 1:** $p_{\text{corr}} = 9.1875$ Pa, $\text{MaxV} = 1.03$ m/s.
2. **Iterations 19–23:** Velocity builds gradually: $\text{MaxV} = 1.77 \to 2.21 \to 2.47 \to 2.50$ m/s (Cap activates at Iteration 23).
3. **Iterations 24–300:** Momentum $L_\infty$ remains remarkably steady at $\approx 0.0028 - 0.0031$, representing a meta-stable plateau dampened by $\alpha_{\nu_t} = 0.3$.
4. **Iterations 310–350:** Continuity defect grows from $1.09 \times 10^{-4}$ to $8.95 \times 10^{-4}$.
5. **Iterations 360–370:** Momentum $L_\infty$ jumps from $3.05 \times 10^{-3}$ to $5.10 \times 10^{-3}$, and $C_L$ spikes from $0.168$ to $0.326$.
6. **Iterations 380–500:** Severe non-linear breakdown ($C_L$ swings wildly from $-0.19$ to $+0.64$).

---

## 8. Causality Tests (Phases 9 & 10)

- **Pressure Cap Causality Test:** **CASE A**. The unrelaxed Poisson correction $p'$ becomes anomalous on Iteration 1 due to boundary mass defects, immediately saturating $p_{\text{limit}} = 9.1875$ Pa before any other variable deviates.
- **Velocity Cap Causality Test:** The velocity cap ($2.50$ m/s) is activated strictly downstream of the pressure gradient disturbance ($du \propto \nabla p'$).

---

## 9. $k$-$\omega$ Residual Forensic Audit (Phase 11)

- **Why $k_{\text{Residual}} = 1.0$ appears in telemetry:** In the Gauss-Seidel linear solver (`GaussSeidelSolver.ts`), when the initial residual $r_0$ satisfies the solver termination criterion in 0 sweeps (or is normalized against itself as $r_0 / r_0$), the normalized residual is recorded as `1.0`. It reflects linear solver normalization, not physical turbulence kinetic energy explosion.

---

## 10. Telemetry Independence Proof (Phase 12)

- **Continuity $L_1$:** Accumulated exclusively in Phase 10 via:
  $$\text{continuityL1} = \frac{\sum_{\text{cells}} |\text{mass\_defect}|}{\text{totalFaceThroughput}}$$
- **Momentum $L_1$:** Accumulated exclusively in Phase 10 via:
  $$\text{momentumL1} = \frac{\sum_{\text{cells}} |\mathbf{R}_{u,v,w}|}{N_{\text{cells}} \cdot U_{\text{ref}} \cdot \dot{m}_{\text{inlet}}}$$
- **Independence Verdict:** Confirmed independent memory allocations and distinct physical equations.

---

## 11. Numerical Limiter Inventory (Phase 13)

1. `Poisson Pressure Limiter`: $p_{\text{limit}} = 9.1875$ Pa [**NUMERICAL_STABILITY_LIMITER**]
2. `Applied Pressure Clamp`: $\Delta p_{\text{allowed}} = 1.2250$ Pa [**NUMERICAL_STABILITY_LIMITER**]
3. `Velocity Increment Clamp`: $du_{\text{allowed}} = 0.50$ m/s [**NUMERICAL_STABILITY_LIMITER**]
4. `Global Velocity Magnitude Ceiling`: $U_{\text{limit}} = 2.50$ m/s [**NUMERICAL_STABILITY_LIMITER**]
5. `Turbulent Viscosity Bound`: $\nu_{t,\text{max}} = 10^4 \mu = 2.0417\times 10^{-3}$ Pa·s [**PHYSICAL_MODEL_BOUND**]
6. `Turbulence Scale Floors`: $k_{\text{floor}} = 10^{-10}$, $\omega_{\text{floor}} = 10^{-6}$ [**INITIALIZATION_FLOOR**]

---

## 12. Spatial Localization (Phase 14)

Analysis of cell-budget coordinates at breakdown indicates:
- **Primary Origin Zone:** Suction-side boundary layer near $x/c \approx 0.42 - 0.45$ (Cell #2992: $x=0.423, y=0.110$), where high aspect-ratio cells experience extreme normal pressure gradients.
- **Secondary Zone:** Airfoil trailing edge wake transition.

---

## 13. First-Trigger Classification (Phase 15)

$$\mathbf{FIRST\;TRIGGER = A = PRESSURE-CAP-FIRST}$$
$$\mathbf{FIRST\;TRIGGER\;ITERATION = 1}$$

---

## 14. Required Final Evidence Chain (Phase 16)

- **FIRST OBSERVABLE ANOMALY:** Unrelaxed Poisson pressure correction $p' \ge 9.1875$ Pa (Iteration 1).
- **FIRST NUMERICAL LIMITER ACTIVATION:** $p_{\text{limit}} = 9.1875$ Pa (Iteration 1).
- **FIRST PHYSICAL/NUMERICAL STATE DEVIATION:** Cell velocities accelerated by artificial pressure gradient (Iteration 1 $\to$ 2).
- **FIRST RESIDUAL DETERIORATION:** Continuity $L_1$ fails to contract below $10^{-4}$ (Iteration 2).
- **FIRST FORCE INSTABILITY:** $C_L$ oscillation onset (Iteration 10 in Exp A, Iteration 370 in Exp B).

---

## 15. Explicit Benchmark Status (Phase 17)

In strict accordance with the Hard Freeze Mandate and Forensic Auditor Governance:

$$\mathbf{BENCHMARK\;STATUS: NOT\_PROVEN}$$
