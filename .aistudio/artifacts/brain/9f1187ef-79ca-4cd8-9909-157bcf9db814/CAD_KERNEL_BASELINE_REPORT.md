# CAD Kernel Forensic Audit Baseline Report

**Mission:** Phase 0 — CAD Kernel Capability Discovery & Gap Assessment
**Status:** BASELINE_ESTABLISHED_WITH_VERIFIED_GAPS
**Date:** 2026-10-29

## 1. Executive Summary

The SECP CAD Kernel is a layered TypeScript-based architecture featuring a custom B-Rep solid modeler and a robust parametric feature history engine. While the core topological structures and polyhedral operations are highly robust and production-integrated, several advanced geometric capabilities (NURBS Booleans, exact analytic intersections, and industry-standard exchange) are either partially implemented or mocked. Notably, a planned integration with Open CASCADE (OCCT) via WASM exists as an adapter but the underlying engine is currently missing from the environment, leading to a high-fidelity mockup fallback.

## 2. Kernel Architecture Discovery

### 2.1 Component Stack
- **UI Layer:** `ParametricModelingPanel.tsx`
- **Orchestration Layer:** `ParametricModelingEngine.ts` (Transactional edits)
- **Recomputation Layer:** `ParametricRegenerationEngine.ts` (DAG sort, incremental invalidation)
- **History Layer:** `FeatureHistory.ts` & `BRepNamingGraph.ts` (Persistent topological naming)
- **Kernel Layer:** `BRepKernel.ts` (The primary TypeScript B-Rep implementation)
- **Topology & Geometry:** Rigid ISO-compliant B-Rep structures (Shell -> Face -> Loop -> Edge -> Vertex)
- **Validation:** `BRepValidator.ts` (Topological and Euler Characteristic verification)

### 2.2 Key Implementation Facts
- **B-Rep Basis:** Polygonal B-Rep (polyhedral) is the primary verified representation.
- **NURBS:** Evaluation logic for curves and surfaces is genuine (basis functions), but integration into the Boolean engine is missing.
- **Parametric Authority:** The kernel is the authority for geometric truth; meshes are derived via `BRepTessellator`.
- **Open CASCADE:** Integration is currently **MOCKED**. The `OcctKernelAdapter` falls back to `createBrowserMockOcInstance` because the `opencascade.js` package is not physically present in `node_modules`.

## 3. Capability Audit Results

| Domain | Status | Observations |
| :--- | :--- | :--- |
| **Geometric Foundations** | IMPLEMENTED | Robust points, vectors, and planes. Unit-aware (mm/m). |
| **B-Rep Topology** | IMPLEMENTED | Verified implementation of shells, faces, and manifold adjacency. |
| **Boolean Operations** | PARTIALLY_IMPLEMENTED | Exact for planar solids. Partial/Mocked for curved analytical surfaces. |
| **Parametric History** | IMPLEMENTED | Dependency-aware recomputation with transactional rollback and stable naming. |
| **NURBS Geometry** | TEST_ONLY | Evaluation algorithms exist but are not used in production modeling ops. |
| **Interoperability** | MOCKED | STEP export is a JSON stringify stub. IGES parser is partial. |
| **Spatial Analysis** | PARTIALLY_IMPLEMENTED | AABB-based assembly interference. No exact B-Rep narrow phase. |

## 4. Verified Critical Gaps

1.  **Missing Production Kernel (OCCT):** The adapter exists, but the engine is absent. Advanced modeling (fillets, chamfers on complex edges, exact Booleans) is effectively mocked.
2.  **Exchange Fidelity:** Industry-standard STEP/IGES support is missing a real translator. Losses occur on round-trip due to JSON-only stubs.
3.  **Analytic Robustness:** Booleans between curved surfaces (Cylinder-Sphere, etc.) fail or return discretized polygon approximations.
4.  **Spatial Acceleration:** Large assemblies suffer from O(N^2) pairwise AABB checks without BVH/Octree acceleration.

## 5. Recommendation Roadmap

1.  **Authorization:** Authorize the physical installation of `opencascade.js` or equivalent WASM kernel to move from MOCKED to IMPLEMENTED for advanced ops.
2.  **Consolidation:** Move NURBS evaluation from `src/engine/cad-kernel/nurbs` into the primary modeling call paths.
3.  **Hardening:** Replace STEP JSON-stubs with a real Part 21 generator linked to the B-Rep topology.
