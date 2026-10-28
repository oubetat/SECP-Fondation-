# Known Limitations & Explicit Boundary Scope

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V3-001  
**Phase**: V3 (Spatial Material Field Representation)  
**Governance Policy**: Fail-Closed, Evidence-Driven, Scope-Bounded

---

## 1. Supported Formulations in V3
Only the following formulations are qualified and verified to evaluate spatial material fields:
- **`Bar1DFormulation`** (1D linear bar/truss element): Spatial evaluation of Young's modulus $E$ at element midpoint.
- **`TET43DFormulation`** (4-node linear tetrahedral continuum element): Spatial evaluation of Young's modulus $E$ and Poisson's ratio $\nu$ at element centroid.

## 2. Unimplemented Formulations (Fail-Closed)
The following formulations do **not** support spatial material fields in V3 and will explicitly throw fail-closed errors if a `spatialFieldId` is supplied:
- **`TET4PlasticFormulation`**: Plasticity requires spatial variation of yield stress, hardening curves, and state variable storage across nonlinear equilibrium iterations. Status: `NOT_YET_IMPLEMENTED`.
- **`CST2DFormulation`**: 2D constant strain triangle. Status: `NOT_YET_IMPLEMENTED`.
- **`Q42DFormulation`**: 2D 4-node quadrilateral. Status: `NOT_YET_IMPLEMENTED`.
- **`T62DFormulation`**: 2D 6-node quadratic triangle. Status: `NOT_YET_IMPLEMENTED`.
- **`Beam2DFormulation`**: 2D Euler-Bernoulli beam element. Requires fiber cross-section integration to handle transverse and axial spatial material gradients. Status: `NOT_YET_IMPLEMENTED`.
- **`Frame2DFormulation`**: 2D Frame element. Status: `NOT_YET_IMPLEMENTED`.

## 3. Physical & Numerical Limitations
1. **Intra-Element Gradient Discretization**:
   - For `Bar1DFormulation` and `TET43DFormulation`, spatial properties are sampled at the centroid/midpoint. Linear gradients within an individual element are approximated via piecewise constant representative values. Numerical convergence with mesh refinement exhibits $O(h^2)$ behavior.
2. **CAD Geometry Synchronization**:
   - In V3, spatial fields evaluate against global Cartesian coordinates $(x,y,z)$. Direct topological B-Rep face/solid parameter evaluation $(u,v,w)$ and volumetric field trimming will be integrated in Phase V4 (Geometry-Material Integration).
3. **Absence of Physical Empirical Calibration**:
   - Field definitions distinguish `TARGET`, `PREDICTED`, and `MEASURED` value categories. Unless empirical CMM/CT-scan measurement datasets are loaded, field specifications represent computational models (`TARGET`/`PREDICTED`), not physical proof of manufactured artifacts.
