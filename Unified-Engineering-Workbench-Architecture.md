# Unified Engineering Workbench Architecture
## SECP Industrial OS v2 — Architectural Implementation Directive

This document defines the formal, unified, multi-workbench architecture for SECP as an **Engineering Operating System (EOS)**. It establishes a strict boundary between the single, authoritative **Canonical Engineering Truth** and the specialized, domain-specific **Derived Workbenches**.

---

## 1. Architectural Philosophy: The EOS Paradigm

The fundamental thesis of the SECP Industrial OS is:
> **One Engineering Truth → Multiple Domain Workbenches → Controlled Derived State**

SECP is not a suite of loosely coupled, independent CAD/CAM/CAE/PLM utilities that communicate via brittle import/export operations. It is a unified platform where a single, master data model—the `EngineeringDocument`—serves as the absolute, immutable Single Source of Truth (SOT).

Every domain-specific panel (Design, CAM, Reverse Engineering, FEA Simulation) is a **Projection / View Controller** over this central document. Changing a tab or workbench must **never** duplicate geometry, create parallel histories, or instantiate competing mathematical realities.

```
                             SECP ENGINEERING OS
                                      │
                             EngineeringDocument
                                  SINGLE SOT
                                      │
       ┌───────────┬───────────┬──────┴────┬───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼           ▼
    Design        CAM      Rev. Eng.   Simulation   Assembly    Drawing
       │           │           │           │           │           │
       └───────────┴───────────┼───────────┴───────────┴───────────┘
                               ▼
                        Engineering Truth
```

---

## 2. Canonical vs. Derived Boundary Invariant

To maintain mathematical consistency across all domains, we establish a strict boundary between **Canonical State** and **Derived Domain State**:

### A. The Canonical Invariant (What Must NEVER Be Duplicated)
The following properties belong exclusively to the `EngineeringDocument` SOT. A workbench is strictly forbidden from creating private, un-synchronized, or local copies of:
1.  **B-Rep Solid Geometry**: The mathematical boundaries (Faces, Edges, Vertices) resolved by the kernel.
2.  **Feature History Tree**: The ordered list of parametric operations (`sketches`, `features[]`, `parameters`).
3.  **Topology Map & Lineage**: The registry tracking stable, persistent identifiers for faces and edges.
4.  **Constraints & Parameters**: Global and local design variables.
5.  **Document Revision & Identity**: The cryptographic hash, revision number, and identity of the document.

### B. Derived Domain State (What a Workbench May Own)
A workbench may instantiate and manipulate domain-specific state, provided it maintains an explicit relationship back to the source document and its revision:
*   **Design Workbench**: Active sketch editors, geometric previews, and feature-candidate creation states.
*   **Manufacturing / CAM Workbench**: CNC Toolpath coordinates, machine kinematic setups, stock models, fixture models, and post-processed G-code.
*   **Reverse Engineering Workbench**: Captured point clouds, meshed triangulation datasets, segmentation maps, and recognized primitive candidates.
*   **Simulation / CAE Workbench**: FEA meshed nodes, boundary conditions (force vectors, fixed constraints), and linear/non-linear solver stress states.

---

## 3. The Canonical Write Pipeline

To prevent "fake success" states (where a button updates local UI state but fails to write back to the SOT), every engineering transaction must follow this strict, non-negotiable write pipeline:

```
    [User Action in Workbench]
                │
                ▼
      [Workbench Command]
                │
                ▼
    [Canonical UI Adapter / Intent]
                │
                ▼
     [EngineeringDocument (SOT)]  <── Revision N+1 incremented
                │
                ▼
       [DocumentEvaluator]
                │
                ▼
        [Geometry Kernel]         <── B-Rep solid regenerated
                │
                ▼
      [Topology Map / Lineage]    <── Persistent IDs re-resolved
                │
                ▼
      [Automated Gate/Verify]     <── Hard acceptance verification
                │
                ▼
      [Derived Domain State]      <── Projections marked STALE/REGENERATED
```

No workbench may bypass the `DocumentEvaluator` or modify the 3D viewport's B-Rep representation directly without going through the `EngineeringDocument` serialization path.

---

## 4. Revision Awareness & Invalidation Model

All derived domain-specific states must carry a strict **Revision Binding**. When the canonical `EngineeringDocument` advances to a new revision $R+1$, all derived states referencing revision $R$ are instantly flagged as `STALE / INVALIDATED` and must undergo controlled regeneration.

### Conceptual Dependency Schema:
```typescript
interface DerivedDomainState<T> {
  id: string;
  sourceDocumentId: string;
  sourceRevision: number;           // Must match the EngineeringDocument's current revision
  sourceTopologyReferences: string[]; // List of persistent face/edge IDs this state depends on
  state: 'VALID' | 'STALE' | 'REQUIRES_REGENERATION';
  data: T;                          // E.g., Toolpaths, stress results, or projected lines
}
```

### The Design-to-CAM Dependency Example:
1.  **Revision 12**: The user designs a plate with a hole diameter of 20 mm. The CAM Workbench generates a toolpath bound to the persistent ID of that hole's inner cylindrical face (`FACE_101`).
    *   `sourceRevision` = 12
    *   `sourceTopologyReferences` = `["FACE_101"]`
    *   `state` = `'VALID'`
2.  **Revision 13**: The user modifies the hole diameter to 25 mm. The `EngineeringDocument` is updated and incremented to revision 13.
3.  **Invalidation Detection**: The CAM Workbench detects a revision mismatch (`13 !== 12`). The toolpath's state is instantly set to `'STALE'`.
4.  **Regeneration**: The CAM solver queries the `TopologyReferenceResolver` to find the new geometry of `FACE_101` in revision 13, recomputes the toolpath, and transitions the state back to `'VALID'` under revision 13.

---

## 5. Reverse Engineering Solidification Flow

A common anti-pattern in CAD suites is to automatically inject recognized primitives into the design tree, causing infinite regeneration loops. In SECP, the Reverse Engineering Workbench follows a strict, controlled **Commit / Solidify Flow**:

```
    [Point Cloud Dataset]
              │
              ▼
    [RANSAC / PCA Fitting]
              │
              ▼
   [Primitive Recognition]        <── Treated ONLY as candidate (ReverseEngineeringSession)
              │
              ▼
   [Acceptance Verification]      <── Gate 320 checks math residual tolerance (RMSE)
              │
              ▼
    [Explicit User Commit]        <── User clicks "Solidify / Commit to Design"
              │
              ▼
    [Canonical Feature Tree]      <── Sketch + Parametric Feature nodes written to SOT
              │
              ▼
     [Design Workbench]           <── Features become editable design history
```

---

## 6. Workbench Classification & State Audit

A forensic audit of SECP's current workbench implementations reveals varying degrees of integration with the single source of truth:

| Workbench / Tab | Current State | State SOT Location | Verification Method | Integration Verdict & Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Design / Feature** | `CANONICAL` | `EngineeringDocument` | `HardAcceptanceGate158` / `159` | **Fully Unified**. Real parametric writing path executing in the core `BRepKernel`. |
| **Manufacturing / CAM** | `DERIVED_DOMAIN_STATE` & `ADAPTER_REQUIRED` | Local UI state | Manual panel inspection | **Isolated Projection**. Needs an active adapter to serialize G-code parameters and bind toolpaths to `EngineeringDocument` revisions. |
| **Reverse Engineering** | `PARALLEL_ENGINEERING_STATE` & `ADAPTER_REQUIRED` | `FeatureRecognitionSession320` | `HardAcceptanceGate320` | **Mathematical Sandbox**. Mesh fitting is proven, but a "Commit / Solidify" pipeline to write feature nodes to the SOT is missing. |
| **Simulation / CAE** | `DERIVED_DOMAIN_STATE` | Local solve memory | Validation mesh tests | **Isolated Projection**. Runs mesh calculations on active solid, but lacks automated SOT-bound invalidation when geometry changes. |
| **Assembly** | `CANONICAL` & `DERIVED_DOMAIN_STATE` | `assembly` schema in SOT | `HierarchicalAssemblyConstraints` tests | **Partially Unified**. Assembly structure is in the SOT, but mates lack active B-Rep face lineage binding. |
| **Drawing** | `CANONICAL_READ_ONLY` & `DERIVED_DOMAIN_STATE` | Projected line maps | Local drawings renderer | **Reads SOT**. Correctly projects 2D lines from B-Rep solid, but annotations are not persistently bound to SOT topology IDs. |
| **Inspection** | `DERIVED_DOMAIN_STATE` | Deviation models | None | **Isolated UI**. Compares nominal CAD with scan data but lacks revision-tracking integration. |
| **PLM / Provenance** | `CANONICAL` | SOT Metasystem | `SECP082EvidenceFreeze` tests | **Fully Unified**. Cryptographically signs SOT revision changes and signs off on gate verdicts. |
| **Direct Modeling** | `PARALLEL_ENGINEERING_STATE` | Transaction memory | `HardAcceptanceGate206` | **Isolated Engine**. Modifies mock structures in memory, completely disconnected from the canonical `EngineeringDocument` pipeline. |
| **Pattern Engine** | `PARALLEL_ENGINEERING_STATE` | `PatternEngine` instances | `HardAcceptanceGate208` | **Isolated Engine**. Calculates polar/linear coordinates in memory but never writes pattern feature nodes to the SOT. |
| **Surface (NURBS)** | `PARALLEL_ENGINEERING_STATE` & `ADAPTER_REQUIRED` | Isolated control maps | Local viewport tests | **Isolated UI**. Modifies local spline controllers, missing an adapter to compile NURBS boundaries back to the SOT. |

---

## 7. Migration Risks & Unresolved Gaps

To transition SECP from its current mixed state into a pristine, fully integrated Engineering Operating System, the following key gaps must be bridged:

1.  **The Direct Modeling Bridge (Gap 206)**: Update `DirectModelingEngine.ts` to serialize transaction records (e.g., `DirectModelingFeature`) directly into `EngineeringDocument.features` instead of operating on temporary B-Rep hashes.
2.  **The Pattern Feature Serializer (Gap 208)**: Refactor `PatternEngine.ts` to write `LinearPatternFeature` and `CircularPatternFeature` definitions directly into the canonical document. The `DocumentEvaluator` must be upgraded to replicate features inside the `BRepKernel` during model regeneration.
3.  **The Solidify Commit Adapter (Gap 320)**: Implement a translation adapter in `FeatureRecognitionWorkbenchPanel.tsx` that maps PCA-fitted planes and cylinders into CSG primitive feature definitions and sketch entities, pushing them onto the canonical document.
4.  **Persistent Toponaming Propagation (Gap 009)**: Solidify the signature-based matching in `TopologyReferenceResolver.ts` to track edge and face splits/merges during model recomputes, ensuring downstream workbenches (like CAM and FEA) do not lose their geometry references when a sketch is altered.
