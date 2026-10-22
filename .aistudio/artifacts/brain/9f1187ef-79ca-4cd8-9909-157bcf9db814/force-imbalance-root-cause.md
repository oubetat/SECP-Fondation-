# FSI Root Cause Analysis: 25% Force Imbalance

## 1. Tracking the Force Path
1.  **Fluid Force Calculation (`TwoWayFSICouplingEngine.ts`):** 
    - The engine iterates over `fluidMesh.faces` with `boundaryType === 'WALL'`.
    - `normalForceN` is calculated as `p * face.area * face.normal`.
    - Pressure `p` is hardcoded to `101325` Pa.
2.  **Load Mapping (`FSIInterfaceMapper.ts`):**
    - The mapper maps `fluidBoundaryForces` to `structuralLoads`.
    - Currently, it simply clones the `normalForceN` vectors.
3.  **Structural Reaction Calculation (`FSIConservationAudit.ts`):**
    - `solidReactionSum` is calculated as `Math.abs(d.dy) * stiffness` where `stiffness = E * 1e-7`.
4.  **Imbalance Calculation (`FSIConservationAudit.ts`):**
    - `imbalance = Math.abs(fluidForceSum - solidReactionSum) / fluidForceSum * 100`.

## 2. Identified Root Cause
The 25% imbalance is mathematically forced by the arbitrary interaction between the static pressure approximation (`101325`) and the hardcoded structural stiffness scaling factor (`E * 1e-7`). 
The `FSIConservationAudit` calculates the "solid reaction" based on an assumed structural response, not the *actual* reaction force from a structural solver. This creates a mismatch between the *applied fluid force* and the *assumed structural resistance*.

## 3. Data Audit Findings
- **Force Fluid:** Derived from face geometry and pressure.
- **Force Solid:** Derived from displacement and arbitrary stiffness factor.
- **Mismatch:** The "Force Solid" is not an actual reaction force from a structural mechanics solver; it's a proxy calculation that does not satisfy the conservation of momentum in this coupled system.

## 4. Conclusion
The 25% imbalance is a **numerical artifact** caused by the inconsistent coupling between the fluid traction integration and the simplified structural proxy model. It is not necessarily a physical failure but an indicator that the current `Stiffness` model is incompatible with the `Fluid Traction` integration.
