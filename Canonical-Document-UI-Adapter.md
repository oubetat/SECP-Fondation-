# SECP Canonical Document UI Adapter
**Version:** 2026.09.05-ADAPTER-004  
**Status:** PASS — Canonical UI Architecture Enforced  
**Objective:** Unify all front-end read/write actions into a transactional mediator that isolates components from direct engineering state mutation and enforces `EngineeringDocument` as the Single Source of Truth (SOT).

---

## 1. Canonical Adapter Architecture

The `CanonicalDocumentUIAdapter` class sits between the User Interface layer and the Core CAD Kernel, mediating all user actions into transactional execution payloads.

```
       [UI COMPONENTS & WORKBENCHES]
                     │
                     ▼
       [CanonicalDocumentUIAdapter]
                     │
         (Query Truth Gate Status)
                     │
                     ├────────► (Rejected) ──► [Abrupt Abort / Diagnostic]
                     │
                     ▼ (Passed)
        [Intent / Action Dispatch]
                     │
                     ▼
         [EngineeringDocument (SOT)]
                     │
                     ▼
          [DocumentEvaluator]
                     │
                     ▼
         [BRepKernel / Geometry]
                     │
                     ▼
             [Evidence Ledger]
                     │
                     ▼
         [Derived UI Viewport Mesh]
```

---

## 2. All UI Write Paths

1. **2D Sketch Drawing Vector Path:**
   * *UI Trigger:* Draw segment on sketch canvas (`SketchEditorPanel.tsx`).
   * *Adapter Method:* `CanonicalDocumentUIAdapter.executeSketchAction()`.
   * *SOT Target:* `EngineeringDocument.sketches` updated via `updateCanonicalSketchInDocument()`.
2. **3D Solid Extrusion Feature Path:**
   * *UI Trigger:* Click Extrude button inside features panel.
   * *Adapter Method:* `CanonicalDocumentUIAdapter.executeExtrudeAction()`.
   * *SOT Target:* `EngineeringDocument.features` history node appended.
3. **Assembly Joint Constraint Path:**
   * *UI Trigger:* Click Coincident Mate in mate inspector workspace (`AssemblyWorkspace.tsx`).
   * *Adapter Method:* `CanonicalDocumentUIAdapter.executeAssemblyAction()`.
   * *SOT Target:* `EngineeringDocument.assembly` mate indices updated.

---

## 3. All UI Read Paths

1. **3D Viewport Rendering Path:**
   * *Component:* `CadViewport3D` / WebGL context.
   * *Read Source:* `canonicalDocument.evaluatedShape` (fully processed mesh buffers).
2. **Design Feature Tree Panel Path:**
   * *Component:* `SketchEditorPanel.tsx` sidebar list.
   * *Read Source:* `canonicalDocument.features` and `canonicalDocument.sketches` projection loops.
3. **Parametric Driving Variables Path:**
   * *Component:* `UnitEnginePanel.tsx` or `CaeStressPanel.tsx`.
   * *Read Source:* `canonicalDocument.parameters` list.

---

## 4. All Local Engineering States

The audit isolated two localized states representing UI caches:
1. **Design Tree Rendering Array:**
   * *Variable:* `designTree` / `setDesignTree` inside `SketchEditorPanel.tsx` (lines 211-223).
   * *Domain:* Features tree listing.
2. **Active Mesh Entity Cache:**
   * *Variable:* `activeSolid` / `setActiveSolid` inside `App.tsx` (lines 498-500).
   * *Domain:* Three.js viewport representation of the solid topology.

---

## 5. All Parallel Sources of Truth

1. **Assembly Core Models:**
   * *Engine:* `/src/engine/assembly/AssemblyCore.ts` (lines 1-519) managing its own placement transformations.
   * *Status:* Connected via `AssemblyIntentMutator.apply` adapter.
2. **2D Drawing Scratchpad Canvas:**
   * *Engine:* `/src/engine/geometry/SketchEngine.ts` holding temp line coords.
   * *Status:* Resolved to SOT via `CanonicalSketchAdapter.ts` upon click mouse-up triggers.

---

## 6. All Legacy Engine Boundaries

* **SketchEngine (2D Math Utilities):**
  * *Location:* `/src/engine/geometry/SketchEngine.ts`
  * *Integration:* Wrapped by `CanonicalSketchAdapter.ts` which acts as the boundary mapping legacy raw point parameters into the standard `CanonicalSketch` specifications.

---

## 7. All Canonical Paths (Wired to SOT)

The following pipeline paths are fully connected, canonical, and execute true math kernel mutations:
* **SKETCH_LINE Drawing Pipeline:** UI Canvas → `mutateAddFlatEntities` → `DocumentEvaluator` → SHA-256 evidence.
* **SKETCH_CIRCLE Drawing Pipeline:** UI Canvas → `mutateAddFlatEntities` → `DocumentEvaluator` → SHA-256 evidence.
* **CONSTRAINT_COINCIDENT Solver Pipeline:** Joint click → `mutateAddFlatConstraint` → `GCS Solver` → validation logs.
* **FEATURE_EXTRUDE Solid Pipeline:** Panel click → `applyExtrudeAction` → `BRepKernel.extrudePolygon` → `BRepHasher` aggregate hashes.
* **ASSEMBLY_MATE_COINCIDENT Mate Pipeline:** Mate select → `AssemblyIntentMutator.apply` → `RecursiveAssemblyEvaluator` → transform placements.

---

## 8. All Non-Canonical Paths (Bypassed)

The following pipelines are bypassed and halt execution at local UI components, creating fake statuses:
* **FEATURE_FILLET Rounding Pipeline:** Clicking edges halts in local component states, appending fake UI-only design trees using random hashes (`EPC-SPL-XXXX`).
* **MOLD_TOOLING_SPLIT Mold Pipeline:** Adding parting lines modifies only local UI listings, bypassed from actual kernel mold calculators.
* **CFD Navier-Stokes Solvers Pipeline:** Mesh data is parsed, but iterations and residual curves are driven by simple client-side browser intervals (`setTimeout`) and random variance.

---

## 9. Tools Requiring SOT Adapters
The following tools must have their components rewritten to consume the `CanonicalDocumentUIAdapter` in future phases instead of bypassing:
* **FEATURE_FILLET & FEATURE_CHAMFER** (Should dispatch `executeFilletAction` to modify document features).
* **FEATURE_REVOLVE & FEATURE_SWEEP** (Should dispatch `executeRevolveAction`).
* **MOLD_TOOLING_SPLIT & MOLD_PARTING_LINE** (Should dispatch `executeMoldAction`).

---

## 10. Tools That Are Canonical
The following tools are verified, production-ready, and run fully closed-loop under `CanonicalDocumentUIAdapter`:
* `SKETCH_LINE` (Verified in `PATCH-326`)
* `SKETCH_CIRCLE` (Verified in `PATCH-326`)
* `CONSTRAINT_COINCIDENT` (Verified in `PATCH-039B`)
* `FEATURE_EXTRUDE` (Verified in `PATCH-035`)
* `ASSEMBLY_MATE_COINCIDENT` (Verified in `PATCH-040`)

---

## 11. Tools That Are Still UI-Only / Mock / Stub
The following tools do not reach the CAD kernel from UI inputs and represent visual layouts:
* `SURFACE_EXTRUDE` / `SURFACE_KNIT` (NOT_SUPPORTED)
* `SHEET_METAL_FOLD` (NOT_SUPPORTED)
* `PMI_DATUM` (UNAVAILABLE)
* `WELDMENT_MEMBER` (NOT_SUPPORTED)
* `DIRECT_MOVE_FACE` (UNAVAILABLE)

---

## 12. Evidence for Classifications

Auditable repository evidence references confirming these structural classifications:
* **B-Rep Mutation Proof:** `BRepHasher.ts` (computes cryptographic hashes of solid edges, vertex coordinates, and boundary loops).
* **Viewport Cache Independence:** `PATCH-035-SOT-Control.test.ts` (asserts modifying viewport caches direct-mutations fail to taint SOT).
* **Sketch Monotonic Revisions:** `PATCH-326-CanonicalRuntimeIntegration.test.ts` (proves one drawing transaction increments sketch revision precisely by one).
* **Kinematics Transform Verification:** `PATCH-040-KinematicStateAndEvidence.test.ts` (confirms occurrence placements are calculated from constraint graphs, bypassing mock representations).
