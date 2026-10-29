# SECP-PHYSICS-EXPANSION-005B: Coupling Execution Classification

**Document ID:** SECP-COUPLING-EXECUTION-CLASSIFICATION-005B  
**Auditor:** Independent Engineering Truth Auditor  
**Primary Classification:** `PRODUCTION_SEQUENTIAL_ONE_WAY` (Standard Thermal Stress Execution) and `PRODUCTION_ITERATIVE_PARTITIONED` (Multiphysics Picard Loop in Unified Solver)

---

## 1. Verified Execution Path Classifications

A rigorous runtime causality audit was performed on the SECP thermo-mechanical physics engine by executing real production solver instances (`UnifiedThermoElectroMechanicalSolver3D.ts`, `NonlinearEquilibriumSolver.ts`, `TET4LargeDeformationPlasticFormulation.ts`).

Each execution path is formally classified as follows:

1. **Standard Thermo-Elastic Load Integration Path**:
   - **Classification:** `PRODUCTION_SEQUENTIAL_ONE_WAY`
   - **Justification:** The temperature field $T(\mathbf{x})$ is solved or prescribed, converted into thermal strain $\boldsymbol{\varepsilon}_{th} = \alpha (T - T_{\text{ref}}) \mathbf{I}$, and integrated into the global RHS load vector $\mathbf{F}_{th} = \sum_e \int_{\Omega_e} \mathbf{B}^T \mathbf{C} \boldsymbol{\varepsilon}_{th} dV$. Solving $\mathbf{K} \mathbf{u} = \mathbf{F}_{ext} + \mathbf{F}_{th}$ yields displacement $\mathbf{u}$ and elastic stress $\boldsymbol{\sigma} = \mathbf{C} : (\boldsymbol{\varepsilon} - \boldsymbol{\varepsilon}_{th})$.

2. **Unified Multiphysics Loop Path**:
   - **Classification:** `PRODUCTION_ITERATIVE_PARTITIONED`
   - **Justification:** `UnifiedThermoElectroMechanicalSolver3D.ts` executes a Picard iteration loop where deformed coordinates $\mathbf{x} + \mathbf{u}^{(k)}$ are passed to `BidirectionalElectrothermalSolver3D.ts`, updating element conductance matrices, solving for $T^{(k+1)}$, and updating mechanical loads. Causal intervention `INT-08` proved that perturbing $u$ directly alters downstream temperature $T^{(k+1)}$ in subsequent iterations.

3. **Analytical Oracle Benchmark Verification**:
   - **Classification:** `ANALYTICAL_BENCHMARK_ONLY`
   - **Justification:** Closed-form solutions (BM-1 through BM-6) serve as exact mathematical reference oracles evaluated in auditor routines (`IndependentThermoMechanicalAuditor005.ts`) for regression testing.

---

## 2. Summary Table of Execution Paths

| Execution Path | Source Location | Verified Classification | Causal Evidence |
| :--- | :--- | :--- | :--- |
| **Thermo-Elastic Load Assembly** | `TET4LargeDeformationPlasticFormulation.ts` | `PRODUCTION_SEQUENTIAL_ONE_WAY` | Interventions INT-01..04 |
| **Nonlinear FEM Equilibrium Solver** | `NonlinearEquilibriumSolver.ts` | `PRODUCTION_SEQUENTIAL_ONE_WAY` | Interventions INT-03..04 |
| **Unified Electro-Thermo-Mechanical Loop** | `UnifiedThermoElectroMechanicalSolver3D.ts` | `PRODUCTION_ITERATIVE_PARTITIONED` | Intervention INT-08 |
| **Closed-Form Oracles (BM-1 .. BM-6)** | `IndependentThermoMechanicalAuditor005.ts` | `ANALYTICAL_BENCHMARK_ONLY` | Recheck BM-1..6 |

---

## 3. Disallowed Classifications

- `PRODUCTION_MONOLITHIC`: Not claimed or present; SECP uses partitioned solvers with Picard coupling rather than a single coupled Jacobian matrix.
- `TEST_ONLY` / `REPORT_ONLY`: Applied strictly to test fixtures and campaign scripts, NOT to the production solver classes.
