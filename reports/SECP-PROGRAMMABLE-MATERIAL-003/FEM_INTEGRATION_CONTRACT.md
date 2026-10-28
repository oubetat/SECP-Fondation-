# FEM Integration Contract: SECP-PROGRAMMABLE-MATERIAL-003

## 1. Scope
This document specifies the minimum contract and data flow required to evaluate a revision-bound `SpatialMaterialField` at individual element integration points during FEM assembly.

## 2. Integration Point Data Requirements
For each integration point $gp$ within element $e$, the following parameters must be resolved:
1. **Physical Coordinates:** $(x_{gp}, y_{gp}, z_{gp})$ computed via shape function interpolation from element nodes.
2. **Field Evaluation:** Query `SpatialMaterialField.evaluate({x, y, z})` to obtain local properties $(E_{gp}, \nu_{gp}, \sigma_{y0,gp}, H_{gp})$.
3. **State Binding:** Bind the evaluated properties to the integration point's `IntegrationPointState` managed by `MaterialStateManager`.
4. **Constitutive Update:** Pass the local properties and incremental strain to the constitutive update routine (`J2Plasticity3D.update(strainInc, state, localProperties)`).

## 3. Authoritative Data Flow
```
[SpatialMaterialField (Revision-Bound)]
             │
             ▼
[GlobalAssemblyEngine / TET4PlasticFormulation]
             │ (computes Gauss point coords x,y,z)
             ▼
[Spatial Field Evaluator / Adapter]
             │ (returns local E, nu, sigma_y, H)
             ▼
[J2Plasticity3D.update(..., localProperties)]
             │ (returns stress, C_alg, updated state)
             ▼
[Element Stiffness & Internal Forces (Ke, Fe)]
             │
             ▼
[Global Assembly (SparseMatrix Kt, Fint)]
```

## 4. Architectural Option Recommended
**Option B (Element-Level Material Map Resolution with Constitutive Extension)** is selected because:
- It requires no modifications to the global solver loop (`NonlinearEquilibriumSolver`).
- It avoids creating a standalone global material field registry.
- It encapsulates spatial evaluation directly inside element formulations where integration point coordinates are already computed.
