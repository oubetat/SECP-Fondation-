# Data Path Audit Report: SECP-PROGRAMMABLE-MATERIAL-002

## 1. Objective
Trace the flow of material data from definition to the numerical solver to determine if "Spatial Material Mapping" is natively supported or requires implementation.

## 2. Source Code Audit Results

### 2.1 Material Representation
- **File:** `/src/engine/fem/core/FEMTypes.ts`
- **Finding:** `FEMMaterial` is a static interface (Lines 19-24).
```typescript
export interface FEMMaterial {
  materialId: string;
  E: number; // Young's modulus
  nu: number; // Poisson's ratio
  density?: number;
}
```
- **Constraint:** There is no field for a spatial function $f(x,y,z)$ or a reference to a spatial property map.

### 2.2 Element-to-Material Binding
- **File:** `/src/engine/fem/core/FEMTypes.ts`
- **Finding:** `FEMElement` references exactly one `materialId` (Line 38).
- **Constraint:** Properties are assumed homogeneous within the element scope.

### 2.3 Solver Data Flow
- **File:** `/src/engine/fem/core/NonlinearEquilibriumSolver.ts`
- **Finding:** The `solve` method accepts a single `ConstitutiveModel` in `options` (Line 30).
- **Audit Trace:**
  1. `solve()` calls `assemblyEngine.assembleNonlinear(...)`.
  2. `assembleNonlinear()` passes the single `materialModel` to `formulation.computeNonlinearMatrices`.
- **Constraint:** The architecture currently forces a global constitutive law across all participating nonlinear elements.

### 2.4 Constitutive Interface (Critical Blocker)
- **File:** `/src/engine/fem/core/ConstitutiveModel.ts`
- **Finding:** The `update` method signature (Line 11-14) **does not include spatial coordinates**.
```typescript
export interface ConstitutiveModel {
  update(
    strainIncrement: number[],
    previousState: IntegrationPointState
  ): ConstitutiveResult;
}
```
- **Constraint:** Even if the solver provided coordinates, the material model cannot use them to vary $E$ or $\sigma_y$ without changing this interface contract.

### 2.5 Element Formulation (Mapping Blocker)
- **File:** `/src/engine/fem/core/TET4PlasticFormulation.ts`
- **Finding:** `computeNonlinearMatrices` computes strain at the centroid but calls `materialModel.update` without context of the centroid's $(x,y,z)$ (Lines 141-143).

## 3. Data Flow Gap Summary
The following sequence for Programmable Materials is currently **BLOCKED**:

1. **Spatial Material Field:** [MISSING] - No representation in `FEMModel` or `FEMMaterial`.
2. **Coordinate Mapping:** [MISSING] - `GlobalAssemblyEngine` does not pass Gauss point coordinates to the material model.
3. **Constitutive Response:** [STATIC] - `J2Plasticity3D` uses fixed constructor parameters $(E, \nu, \sigma_{y0}, H)$ for all updates.

## 4. Verdict
**IMPLEMENTATION_GAP_CONFIRMED**

The current SECP architecture **cannot** simulate spatially varying materials. A "Grading Engine" is required to:
1. Extend `FEMMaterial` or `FEMElement` to accept a Spatial Field reference.
2. Modify `ConstitutiveModel.update` to accept an optional `location: {x, y, z}`.
3. Update `GlobalAssemblyEngine` to resolve and pass the physical location of each integration point during assembly.
