# Engineering Workbench Truth Matrix

This matrix classifies every exposed domain workbench and modeling engine in SECP Industrial OS v2. It evaluates their relationship with the **EngineeringDocument** Single Source of Truth (SOT) and whether they are mathematically bound to its revision and topology references.

---

## 1. Truth Matrix

| Workbench / Engine | Reads Canonical | Writes Canonical | Derived State | Revision Binding | Topology Binding | Verified |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| **Design / Feature Workbench (PATCH-007)** | **YES** | **YES** | CAD solid viewport previews, sketches, extrusions | **YES** | **YES** | **PASS** |
| **Manufacturing / CAM Workbench** | **YES** | **NO** | CNC toolpaths, setup configurations, post G-code | **NO** | **PARTIAL** | **FAIL** |
| **Reverse Engineering Workbench (PATCH-320)** | **NO** | **NO** | Segmented meshes, fitted cylinder/plane primitives | **NO** | **NO** | **FAIL** |
| **Simulation / CAE Workbench** | **YES** | **NO** | Stress strain FEA mesh displacement tensors, CFD | **NO** | **NO** | **FAIL** |
| **Assembly Workbench (PATCH-039B)** | **YES** | **YES** | Mate constraints, component instance matrices | **YES** | **YES** | **PASS** |
| **Drawing Workbench** | **YES** | **NO** | 2D orthographic orthoprojections, dimensions | **YES** | **PARTIAL** | **FAIL** |
| **Inspection / Metrology Workbench** | **YES** | **NO** | Deviation distance maps, tolerancing flags | **NO** | **NO** | **FAIL** |
| **PLM / Provenance Workbench (PATCH-082)** | **YES** | **YES** | Cryptographic audit trails, verification signatures | **YES** | **NO** | **PASS** |
| **Direct Modeling Engine (PATCH-206)** | **NO** | **NO** | Transaction history on static B-Rep mockups | **NO** | **NO** | **FAIL** |
| **Pattern Engine (PATCH-208)** | **NO** | **NO** | Coordinate grids, suppression lists, polar instances | **NO** | **NO** | **FAIL** |
| **Surface Workbench (NURBS)** | **YES** | **NO** | Spline meshes, boundary curve vectors | **NO** | **NO** | **FAIL** |

---

## 2. Key to Columns

1.  **Reads Canonical**: Indicates whether the workbench reads geometry, features, parameters, or metadata directly from the master `EngineeringDocument` SOT.
2.  **Writes Canonical**: Indicates whether the workbench has a verified, active write path that commits changes directly back to the master `EngineeringDocument` and triggers a full model recompute via `DocumentEvaluator.ts`.
3.  **Derived State**: The specialized dataset generated and managed locally by the workbench context (e.g., toolpath G-code or stress maps).
4.  **Revision Binding**: Indicates whether the workbench's derived state is cryptographically or numerically bound to the document's active `revision`. If the document's revision advances, the state must instantly detect a mismatch, flag itself as `STALE`, and demand regeneration.
5.  **Topology Binding**: Indicates whether the workbench references boundary geometry entities (Faces, Edges, Vertices) using persistent, stable identifiers (such as `persistentId` and `TopologyReference`) rather than transient indexes or display coordinate approximations.
6.  **Verified (PASS / FAIL)**: 
    *   **PASS**: The workbench has been proven via repository evidence to operate as a true, integrated projection over the `EngineeringDocument` SOT, with real-time write/read pipelines and active gate validation.
    *   **FAIL**: The workbench is currently an **isolated simulation engine** or a **UI-only stub** that operates on parallel engineering realities, lacks active revision-bound invalidation, or fails to write back to the core document.

---

## 3. Detailed Forensic Notes by Workbench

### A. Reverse Engineering Workbench (PATCH-320)
*   **Reads Canonical**: **NO**. The workbench loads a local `HealedMeshDataset` directly from uploaded files rather than querying the active `EngineeringDocument`.
*   **Writes Canonical**: **NO**. Clicking "Commit" or "Run Recognition" segments the mesh in `FeatureRecognitionEngine320.ts` and saves the primitives locally in `session.features`, but it does not write these back into the canonical `EngineeringDocument.features[]` tree.
*   **Topology Binding**: **NO**. It operates purely on raw tri-mesh indexing and point-clouds.

### B. Direct Modeling Engine (PATCH-206)
*   **Reads Canonical**: **NO**. It is a sandbox engine designed to prove push/pull mathematics. It accepts an initial static mock B-Rep hash (`brep_initial_hash_123`) rather than the active solid.
*   **Writes Canonical**: **NO**. Its transactions are processed and stored locally within `DirectModelingEngine.ts` but never committed as a `DIRECT_MODEL_OFFSET` node to the parent document.

### C. Pattern Engine (PATCH-208)
*   **Reads Canonical**: **NO**. It operates on local mock feature strings (e.g., `['source_feature_01']`) inside its private state arrays.
*   **Writes Canonical**: **NO**. Patterns are simulated and verified mathematically in `HardAcceptanceGate208.ts`, but no serializable pattern feature exists in the SOT.

### D. Manufacturing / CAM Workbench (PATCH-255)
*   **Reads Canonical**: **YES**. It queries the current physical volume properties and dimensions of the active solid to determine workpiece bounds.
*   **Writes Canonical**: **NO**. It writes metadata (materials, surface finishes) to a private semantic map in `ManufacturingSemantics.ts`, but does not save these records into the master `EngineeringDocument` features or parameters list.
