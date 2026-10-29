# SECP CAD Kernel Expansion Recommendations
## Phase 1 — Industrial Hardening & Integration

### 1. Priority 1: OpenCascade (OCCT) Integration
**Observation:** The current `OcctKernelAdapter` is a disconnected shell, and the system relies on a manual TypeScript `BRepKernel`.
**Recommendation:** 
- Install `@JS-Dev/opencascade.js` (or similar WASM build).
- Complete the glue logic in `OcctKernelAdapter.ts` to bridge SECP topology contracts to OCCT `TopoDS` shapes.
- Migrate core Boolean operations from `BooleanEngine.ts` (custom) to `BRepAlgoAPI` (OCCT).
- **Target:** Industrial-grade numerical stability for complex fillets, sweeps, and boolean joins.

### 2. Priority 2: Authentic STEP Part 21 Interoperability
**Observation:** `STEPAP242Translator.ts` is a JSON-based mock.
**Recommendation:**
- Implement real ISO 10303-21 parsing using OCCT's `STEPControl_Reader` and `STEPControl_Writer`.
- Ensure support for AP242 Semantic PMI (Product Manufacturing Information) and assembly structures.
- **Target:** True lossless exchange with SolidWorks, CATIA, and NX.

### 3. Priority 3: NURBS Elevation
**Observation:** NURBS implementation is isolated in `src/engine/cad-kernel/nurbs` and marked as `UNPROVEN`.
**Recommendation:**
- Integrate `NurbsEvaluator` into the `BRepKernel` surface evaluation pipeline.
- Implement G1/G2 continuity enforcement for Loft and Sweep operations using the existing basis functions.
- **Target:** Transition from polyhedral approximations to smooth, mathematically exact curved surfaces.

### 4. Priority 4: Spatial Performance Optimization
**Observation:** The kernel performs $O(N^2)$ topological checks.
**Recommendation:**
- Introduce a `SpatialIndexingEngine` in `src/engine/cad-kernel/core`.
- Implement Bounding Volume Hierarchies (BVH) or R-Trees for face/edge intersection queries.
- **Target:** Sub-linear performance scaling for models with >1000 features.

### 5. Priority 5: Advanced Feature Consolidation
**Observation:** `createSphere` and `createTorus` are currently mocked as polyhedral extrusions.
**Recommendation:**
- Implement true spherical and toroidal geometry support in `src/engine/cad-kernel/brep/BRepKernel.ts` (if remaining manual) or delegate to OCCT `BRepPrimAPI`.
- Consolidate the `FilletEngine` and `ChamferEngine` into a unified `BlendEngine` with support for variable radius and G2 blends.
