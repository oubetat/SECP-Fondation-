# Existing Execution Contract Analysis: SECP-PROGRAMMABLE-MATERIAL-003

## 1. Overview
This document traces the exact call path from high-level model definition to global solver execution in the SECP FEM core, identifying where material properties are resolved, consumed, and managed.

## 2. Call-Path Trace

### A. Material Identity Resolution
- **File:** `src/engine/fem/core/FEMTypes.ts`
- **Mechanism:** `FEMElement` references `materialId` (string). `FEMModel` contains a `Map<string, FEMMaterial>`.
- **Finding:** Identity is strictly static and global per element.

### B. Material Property Read
- **File:** `src/engine/fem/core/TET4PlasticFormulation.ts` (and other element formulations)
- **Mechanism:** During `computeMatrices` or `computeNonlinearMatrices`, the element retrieves `model.materials.get(element.materialId)`.
- **Finding:** Properties $E, \nu, \sigma_{y0}, H$ are read once per element or assumed constant.

### C. Integration-Point Coordinates Availability
- **File:** Element formulations (`TET43DFormulation.ts`, `TET4PlasticFormulation.ts`, etc.)
- **Mechanism:** Node coordinates $(x, y, z)$ are available in the element scope. Shape function derivatives and Gauss point evaluation permit computing physical coordinates $(x_g, y_g, z_g)$ for any integration point.
- **Finding:** Coordinates are already calculable within element formulations but are not currently forwarded to material update routines.

### D. Constitutive State Creation & Update
- **File:** `MaterialStateManager.ts`, `J2Plasticity3D.ts`
- **Mechanism:** `MaterialStateManager` initializes integration point states (`IntegrationPointState`). `J2Plasticity3D.update()` evaluates trial stress and return mapping.
- **Finding:** States are stored per element integration point, making integration-point-level property variation fully compatible with state management.

### E. Constitutive Tangent & Stress Consumption
- **File:** Element formulations (`TET4PlasticFormulation.ts`)
- **Mechanism:** Stress and algorithmic tangent $C_{alg}$ are returned to compute internal forces ($F_{int} = B^T \sigma V$) and tangent stiffness ($K_t = B^T C_{alg} B V$).

### F. Global Assembly
- **File:** `GlobalAssemblyEngine.ts`
- **Mechanism:** Iterates over elements, invokes `computeNonlinearMatrices`, and accumulates into `Kt` (SparseMatrix) and `Fint` (Float64Array).

### G. Solver Execution
- **File:** `NonlinearEquilibriumSolver.ts`
- **Mechanism:** Manages Newton-Raphson iterations, calls `GlobalAssemblyEngine.assembleNonlinear`, solves linear partitions via `SparsePCGSolver`, checks residuals, and commits/rollbacks material states via `MaterialStateManager`.

### H. Revision Invalidation
- **File:** SECP Digital Thread / Provenance Engines
- **Mechanism:** Track model digests and dependency hashes. Any geometry or material modification invalidates dependent solver results.
