# SECP-PHYSICS-EXPANSION-005A: Thermo-Mechanical Coupling Classification

**Document ID:** SECP-TM-COUPLING-CLASSIFICATION-005A  
**Auditor:** Independent Engineering Truth Auditor  
**Primary Classification:** `sequential one-way thermal-to-mechanical coupling` (Standard Thermal Stress Path) and `iterative partitioned coupling` (Full Multiphysics Loop)

---

## 1. Executive Summary

A comprehensive architectural code audit was conducted on the SECP thermo-mechanical physics implementation across:
- `src/engine/physics/electromagnetics/UnifiedThermoElectroMechanicalSolver3D.ts`
- `src/engine/physics/electromagnetics/BidirectionalElectrothermalSolver3D.ts`
- `src/engine/fem/core/TET4LargeDeformationPlasticFormulation.ts`
- `src/engine/fem/core/NonlinearEquilibriumSolver.ts`
- `src/engine/physics/thermal/IndependentThermoMechanicalAuditor005.ts`

The codebase implements **two distinct coupling operational modes**:

1. **Standard Thermal Stress Execution Path**: Classified as `sequential one-way thermal-to-mechanical coupling`. A temperature field $T(\mathbf{x})$ is obtained (from thermal solver or prescribed BCs) and converted directly into element thermal load vectors $\mathbf{f}_{th}^e = \int_{\Omega_e} \mathbf{B}^T \mathbf{C} \boldsymbol{\varepsilon}_{th} dV$. The equilibrium equation $\mathbf{K} \mathbf{u} = \mathbf{F}_{ext} + \mathbf{F}_{th}$ is solved for displacement $\mathbf{u}$, from which elastic strain $\boldsymbol{\varepsilon}_e = \boldsymbol{\varepsilon} - \boldsymbol{\varepsilon}_{th}$ and stress $\boldsymbol{\sigma} = \mathbf{C} : \boldsymbol{\varepsilon}_e$ are computed.

2. **Multiphysics Iterative Loop**: Implemented in `UnifiedThermoElectroMechanicalSolver3D.ts`, classified as `iterative partitioned coupling` (Picard iteration with geometric mesh deformation feedback). Electrical potentials, Joule heating temperatures, and mechanical displacements are solved sequentially in an iterative loop until $\Delta u$ and $\Delta T$ fall below convergence tolerances.

---

## 2. Detailed Formulation & Call-Path Breakdown

### 2.1 Thermal Expansion Tensor
- Thermal strain is purely volumetric in isotropic materials:
  $$\boldsymbol{\varepsilon}_{th} = \alpha (T - T_{\text{ref}}) \mathbf{I}$$
- Implemented in `TET4LargeDeformationPlasticFormulation.ts` with additive decomposition $\boldsymbol{\varepsilon} = \boldsymbol{\varepsilon}_e + \boldsymbol{\varepsilon}_{th}$.

### 2.2 Temperature-Dependent Material Properties
- Elastic Modulus $E(T) = E_0 (1 - \beta (T - T_{\text{ref}}))$ and Thermal Expansion Coefficient $\alpha(T)$ are evaluated at integration points or element centroids.

### 2.3 Stiffness Matrix & Force Vector Assembly
- Global stiffness $\mathbf{K} = \sum_e \int_{\Omega_e} \mathbf{B}^T \mathbf{C} \mathbf{B} dV$.
- Equivalent thermal force vector $\mathbf{F}_{th} = \sum_e \int_{\Omega_e} \mathbf{B}^T \mathbf{C} \boldsymbol{\varepsilon}_{th} dV$.
- Essential (Dirichlet) boundary conditions modify system matrices cleanly before calling sparse PCG / Cholesky direct solvers.

### 2.4 Back-Coupling Semantics
- In standard 1-way thermal stress analysis, mechanical deformation does not alter thermal conductivity (no back-coupling).
- In `UnifiedThermoElectroMechanicalSolver3D.ts`, deformed nodal coordinates $\mathbf{x} + \mathbf{u}$ are passed to the next iteration's electro-thermal solver step, providing geometric feedback.

---

## 3. Scaffolding vs Production Distinction

- **Production Solvers**: `UnifiedThermoElectroMechanicalSolver3D.ts` and `NonlinearEquilibriumSolver.ts` are genuine production physics solvers capable of handling 3D continuum meshes.
- **Qualification Scaffolding**: `IndependentThermoMechanicalAuditor005.ts` provides closed-form analytical oracles and auditor checks used in automated test suites (`ThermoMechanicalQualification005.test.ts`) and campaign scripts.
