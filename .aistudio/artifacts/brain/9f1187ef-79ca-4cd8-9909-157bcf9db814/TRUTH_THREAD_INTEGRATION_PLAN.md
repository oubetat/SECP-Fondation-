# SECP Engineering Truth Thread Integration Plan

## 1. Objective
Establish a non-repudiable lineage between CAD Geometry, Finite Element Meshes, and CFD Simulation results. Ensure that any mutation in geometry automatically invalidates downstream "truth" artifacts.

## 2. Structural Linkage (Provenance)

### A. Mesh -> B-Rep Binding
- **Artifact**: `MeshSet` (defined in `src/engine/physics/mesh/MeshTypes.ts`)
- **Action**: Update the mesh generation logic to explicitly populate `modelId` with the `B-Rep UUID` and `revision` with the `GeometryRevisionId`.
- **Validation**: `MeshValidator` will check that `modelId` matches the current active CAD entity.

### B. CFD -> Mesh Binding
- **Artifact**: `CfdFlowResult` (defined in `src/engine/cfdEngine.ts`)
- **Action**: Extend `CfdFlowResult` to include `meshId` and `meshRevision`.
- **Validation**: The solver will verify the Mesh Hash before execution.

## 3. Invalidation Logic (Stale Truth Detection)

- **Engine**: `UniversalDigitalThreadEngine` (in `src/engine/verification/UniversalDigitalThreadEngine.ts`)
- **Mechanism**: Use `evaluateThread` to detect `STALE` status when `upstreamNode.revision !== dep.expectedRevision`.
- **Implementation**:
    - CAD Upgrade triggers `propagateChange`.
    - Downstream Mesh and CFD nodes are flagged as `STALE`.
    - UI displays warning: "Simulation Results Stale - Geometry has changed."

## 4. Separation of Concerns
- **`PROVENANCE_VERIFIED`**: The data chain is intact and points to the correct source revisions.
- **`NUMERICAL_QUALIFIED`**: The solver actually converged (e.g., Force Stability Passed).
- **Rule**: A `STALE` thread can NEVER be `NUMERICAL_QUALIFIED`.

## 5. Verification Steps
1. Execute `src/test/test_unified_truth_path.ts` (Already Passed ✅).
2. Integrate `UniversalDigitalThreadEngine` into the main application state (SOT-001).
3. Add automated guardrails to `CfdEngine` to prevent running on invalid/stale meshes.
