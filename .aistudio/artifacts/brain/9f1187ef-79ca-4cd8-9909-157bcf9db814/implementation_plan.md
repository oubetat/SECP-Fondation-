# SECP CFD Verifier Scope Refactor & Gate 6 Physical Plausibility

Refactor the SECP independent CFD verification engine to resolve `FINDING-CFD-VERIFIER-001`, transitioning misleading `VERIFIED_PHYSICAL_CONSERVATION` certificates to `VERIFIED_NUMERICAL_CONSISTENCY`, and introducing a dedicated physical plausibility verification gate (Gate 6).

### User Review & Critical Decisions

> [!IMPORTANT]
> The audit conclusively established that `SECP082IndependentCFDVerifier` verifies internal numerical conservation (mass defect, boundary flux, arithmetic flux balance) and mutation/forgery detection, but was historically blind to macroscopic physical plausibility (such as unconverged solutions or $C_L$ deviations of ~10×).

- **Verdict Evolution**: Rename the default positive outcome to `VERIFIED_NUMERICAL_CONSISTENCY` while retaining a deprecated alias `VERIFIED_PHYSICAL_CONSERVATION` for backward compatibility across legacy tests.
- **Gate 6 Scope**: Introduce `gate6PhysicalPlausibility` evaluating convergence integrity (`solution.converged === true`), aerodynamic sign/bound consistency ($C_d > 0$, sign($C_L$) $\equiv$ sign($\alpha$), realistic lift slope order-of-magnitude), and velocity/pressure envelope sanity.
- **Dual-Tier Audit Result**: The verifier will now report both `numericalConsistencyPassed` (Gates 1–5) and `physicalPlausibilityPassed` (Gate 6), with `passed` requiring both when aerodynamic targets/benchmarks are evaluated.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades `SECP082IndependentCFDVerifier` from a blind numerical auditor into a rigorous, two-tier verification engine. The engine explicitly differentiates between:
  1. **Tier 1 (Numerical Consistency)**: Boundary flux compliance (Gate 1), internal flux reconstruction (Gate 2), global mass conservation (Gate 3), continuity residual consistency (Gate 4), and mutation/tamper resistance (Gate 5).
  2. **Tier 2 (Physical & Aerodynamic Plausibility)**: Solver convergence claim verification, bounded pressure and velocity extremal bounds, and aerodynamic lift/drag coefficient plausibility (Gate 6).
- **Target Persona**: Aerospace and CFD simulation engineers relying on SECP verification logs for safety-critical aerodynamic sign-offs.
- **Key Value**: Prevents false-positive "Verified Physical" stamps on unphysical or unconverged simulations, ensuring mathematical transparency and unassailable verification integrity.

---

### 2. User Experience & Architecture Diagram

```
                 ┌────────────────────────────────────────────────────────┐
                 │                   CFD Solution 3D                      │
                 │   (Mesh, Fields: u,v,w,p, k,omega, Residuals, Cl, Cd)  │
                 └──────────────────────────┬─────────────────────────────┘
                                            │
                                            ▼
                 ┌────────────────────────────────────────────────────────┐
                 │             SECP082IndependentCFDVerifier              │
                 └──────────────────────────┬─────────────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼                                               ▼
     ┌─────────────────────────────┐                 ┌─────────────────────────────┐
     │  TIER 1: Numerical Audits   │                 │   TIER 2: Physical Audits   │
     │                             │                 │                             │
     │ • Gate 1: Boundary Flux     │                 │ • Gate 6: Physical          │
     │ • Gate 2: Face Reconstruction│                 │   Plausibility              │
     │ • Gate 3: Mass Conservation │                 │   - Solver converged?       │
     │ • Gate 4: Residual Match    │                 │   - Cl sign & magnitude     │
     │ • Gate 5: Anti-Forgery      │                 │   - Cd > 0 & bounded        │
     └──────────────┬──────────────┘                 └──────────────┬──────────────┘
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                 ┌────────────────────────────────────────────────────────┐
                 │               IndependentCfdAuditResult                │
                 │                                                        │
                 │  • verdict: VERIFIED_NUMERICAL_CONSISTENCY             │
                 │  • physicalPlausibilityPassed: boolean                 │
                 │  • gate6PhysicalPlausibility: boolean                  │
                 │  • independentVerdict: Detailed Enum                   │
                 └────────────────────────────────────────────────────────┘
```

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Renaming vs. Deprecation Alias**
  - *Chosen Approach*: Update `independentVerdict` to prefer `'VERIFIED_NUMERICAL_CONSISTENCY'`, while accepting `'VERIFIED_PHYSICAL_CONSERVATION'` as a compatibility alias.
  - *Why*: Prevents breaking existing client apps and regressions while immediately eliminating technical falsehoods in reports and certificates.
  - *Alternatives Considered*: Immediate hard breaking rename (rejected as it would break consumers before migration).

- **Decision 2: Gate 6 Dynamic Envelope vs. Hardcoded Airfoil Constants**
  - *Chosen Approach*: Gate 6 verifies fundamental physics (non-negative drag, sign correspondence between AoA and lift, reasonable thin-airfoil lift curve slope $dC_L/d\alpha \in [0.03, 0.15]$ per degree when AoA is non-zero, and convergence requirement when forces are extracted).
  - *Why*: Works across NACA0012, flat plate, and general 3D aerodynamic bodies without brittle hardcoding.

---

### 4. Technical Implementation Steps

1. **Type Definitions (`src/engine/cfd3d/SECP082IndependentCFDVerifier.ts`)**:
   - Extend `IndependentCfdAuditResult` with `gate6PhysicalPlausibility: boolean`, `physicalPlausibilityPassed: boolean`, and `numericalConsistencyPassed: boolean`.
   - Update `independentVerdict` union to include `'VERIFIED_NUMERICAL_CONSISTENCY'`, `'PHYSICAL_UNPLAUSIBILITY_DETECTED'`, and `'UNCONVERGED_SOLUTION'`.
2. **Implementation of Gate 6**:
   - Verify `solution.converged === true` if the run was completed under iterative termination.
   - Extract and validate $C_L$ and $C_d$: verify $C_d > 0$, $|C_L| \le 3.5$, and for positive AoA verify $C_L > 0$ with slope within order-of-magnitude aerodynamic theory ($2\pi$ slope $\approx 0.11/\text{deg}$).
   - Set `gate6PhysicalPlausibility` based on these criteria.
3. **Verification & Regression Testing**:
   - Update unit test suite in `src/engine/cfd3d/__tests__/SECP082IndependentCFDVerifier.test.ts` to assert Gate 6 failure on the unconverged Phase 3 solution and Gate 6 pass on true converged physical solutions.
   - Run compilation and test validation to ensure 0 build regressions.
