# SECP Unified Design Tool Contract Registry
**Version:** 2026.09.05-CONTRACT-002  
**Status:** PASS — Core Registry Compiled & Audited  
**Objective:** Establish a single source of contractual truth linking each front-end Engineering Tool to its underlying Canonical Engineering Action, Document Evaluator, and Geometry Kernel.

---

## A. Complete Tool Inventory

We have inventoried all modeling and engineering domains across the SECP workspace, classifying each tool into its appropriate contract category.

```
                  [SECP DESIGN TOOL DOMAINS]
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
  [Sketch & Constraints]   [Solid & Surfaces]   [Assembly & Mated AED]
  - SKETCH_LINE            - FEATURE_EXTRUDE    - ASSEMBLY_MATE_COINCIDENT
  - SKETCH_CIRCLE          - FEATURE_FILLET     - ASSEMBLY_MATE_CONCENTRIC
  - CONSTRAINT_COINCIDENT  - SURFACE_EXTRUDE    - KINEMATIC_COUPLINGS
```

### 1. Sketch Domain
* **SKETCH_LINE:** Draws 2D line entities. (Status: `Canonical / Verified`)
* **SKETCH_CIRCLE:** Draws 2D circle entities. (Status: `Canonical / Verified`)
* **SKETCH_RECTANGLE:** Draws center or corner 2D rectangles. (Status: `UI Drawing Only / Unmapped`)
* **SKETCH_ARC:** Draws three-point and center-point arcs. (Status: `UI Drawing Only / Unmapped`)
* **SKETCH_TRIM:** Power trims overlapping vectors. (Status: `UI Drawing Only / Unmapped`)
* **SKETCH_MIRROR:** Mirrors profiles across mirror lines. (Status: `UI Drawing Only / Unmapped`)

### 2. Constraints & Dimensions Domain
* **CONSTRAINT_COINCIDENT:** Constraints sketch vertices/entities to merge coordinate parameters. (Status: `Canonical / Verified`)
* **CONSTRAINT_CONCENTRIC:** Constrains circular curves to share center points. (Status: `Canonical / Verified`)
* **CONSTRAINT_FIXED:** Anchors an entity in Cartesian coordinate space. (Status: `Canonical / Verified`)
* **DIMENSION_DISTANCE:** Drives line entity lengths using numerical parameters. (Status: `Canonical / Verified`)
* **DIMENSION_RADIUS:** Drives circle entity radii. (Status: `Canonical / Verified`)

### 3. Feature Modeling Domain
* **FEATURE_EXTRUDE:** Extrudes 2D profiles into solid topological 3D bodies. (Status: `Canonical / Verified`)
* **FEATURE_EXTRUDE_CUT:** Subtracts a profile extrusion from existing 3D solids. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_REVOLVE:** Revolves a profile around a parametric axis. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_SWEEP:** Sweeps a profile along a defined path curve. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_LOFT:** Blends multiple planar profiles into a single body. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_FILLET:** Rounds B-Rep edges using constant/variable radius variables. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_CHAMFER:** Bevels sharp B-Rep corners. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_HOLE:** Injects standardized counterbore/countersink holes. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_PATTERN:** Linearly or circularly duplicates 3D bodies. (Status: `UI Presentation Only / Mocked`)
* **FEATURE_MIRROR:** Mirrors 3D bodies across planar references. (Status: `UI Presentation Only / Mocked`)
* **BOOLEAN_UNION:** Welds distinct solid bodies into a single solid. (Status: `UI Presentation Only / Mocked`)
* **DIRECT_MODELING:** Moves, offsets, or replaces B-Rep faces. (Status: `UI Presentation Only / Mocked`)

### 4. Assembly & Kinematics Domain
* **ASSEMBLY_MATE_COINCIDENT:** Binds occurrences with face-to-face or edge-to-edge mates. (Status: `Canonical / Verified`)
* **ASSEMBLY_MATE_CONCENTRIC:** Aligns cylindrical axes of 3D occurrences. (Status: `Canonical / Verified`)
* **ASSEMBLY_MATE_PARALLEL:** Forces coordinate vectors of parts to remain parallel. (Status: `Canonical / Verified`)

### 5. Advanced & Specialty Domains
* **REFERENCE_GEOMETRY:** Constructs planes, axes, and points. (Status: `UI Presentation Only / Mocked`)
* **DRAWING:** Projects 3D solids into orthogonal/section detail sheets. (Status: `UI Presentation Only / Mocked`)
* **PMI / GD&T:** Attaches datum tags and mechanical tolerance frames. (Status: `UI Presentation Only / Mocked`)
* **SURFACE:** Extrudes, knits, trims, or lofts 3D sheets. (Status: `UI Presentation Only / Mocked`)
* **SHEET_METAL:** Folds and edge-flanges flat thin-walled geometries. (Status: `UI Presentation Only / Mocked`)
* **WELDMENTS:** Structures structural profiles and trims joints. (Status: `UI Presentation Only / Mocked`)
* **MOLD:** Determines parting lines, surfaces, and core/cavity splits. (Status: `UI Presentation Only / Mocked`)

---

## B. Contract Matrix

This matrix establishes the verified structural mapping of key tools.

| Tool ID | Feature Type | Geometry Type | Canonical Action | Evaluator | Kernel | Persistence | Validation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SKETCH_LINE** | `SKETCH` | 2D Sketch Curve | `mutateAddFlatEntities` | `DocumentEvaluator` | `BRepKernel` | `CANONICAL` | `PRODUCTION READY` | `Verified` |
| **SKETCH_CIRCLE** | `SKETCH` | 2D Sketch Curve | `mutateAddFlatEntities` | `DocumentEvaluator` | `BRepKernel` | `CANONICAL` | `PRODUCTION READY` | `Verified` |
| **CONSTRAINT_COINCIDENT**| `CONSTRAINT`| Topology constraint| `mutateAddFlatConstraint`| `DocumentEvaluator` | `GCS Solver` | `CANONICAL` | `PRODUCTION READY` | `Verified` |
| **FEATURE_EXTRUDE** | `EXTRUDE` | Topological Solid | `applyExtrudeAction` | `DocumentEvaluator` | `BRepKernel` | `CANONICAL` | `PRODUCTION READY` | `Verified` |
| **ASSEMBLY_MATE_COINCIDENT**| `MATE` | Assembly Transform | `AssemblyIntentMutator.apply`| `RecursiveAssemblyEvaluator`| `MateSolver`| `CANONICAL` | `PRODUCTION READY` | `Verified` |
| **FEATURE_FILLET** | `MISSING` | B-Rep Face | `BYPASS` | `NOT CONNECTED` | `EXISTS_NOT_CONNECTED`| `UI-ONLY` | `NOT TESTED` | `Bypassed` |
| **MOLD_TOOLING_SPLIT** | `MISSING` | Split Surfaces | `BYPASS` | `NOT CONNECTED` | `EXISTS_NOT_CONNECTED`| `UI-ONLY` | `NOT TESTED` | `Bypassed` |

---

## C. Broken Contract Report

Where does the engineering pipeline halt? This report lists the precise breakpoints for unmapped/bypassed tools.

```
[UI Trigger Click] ──► [Local React UI Handler] ──► [Breakpoint 1: Action Bypass]
                                                        │
                                                        ▼
                                             (No Document Mutation)
```

### 1. FEATURE_FILLET / FEATURE_CHAMFER Breakpoint
* **Breakpoint Name:** Action Bypass.
* **Analysis:** Selecting fillet edges in `SketchEditorPanel` triggers a local React state addition. No `FilletFeatureNode` is appended to `canonicalDocument.features`.
* **Execution Boundary:** Halts inside `SketchEditorPanel.tsx`. No call reaches `DocumentEvaluator.evaluate()`.

### 2. MOLD_TOOLING_SPLIT / MOLD_PARTING_LINE Breakpoint
* **Breakpoint Name:** SOT Bypass.
* **Analysis:** Pressing Mold Tooling Split injects a mock tree row into the sidebar `designTree`. This action uses a randomized evidence generator (`EPC-MLD-XXXX`) and operates purely as a visual template with no representation in `EngineeringDocument`.
* **Execution Boundary:** Halts at local component level.

### 3. Downstream Analysis (FEA / CFD / CAM) Breakpoints
* **Breakpoint Name:** Computation Desynchronization.
* **Analysis:** Modifying parametric values (like extrude height) properly triggers `BRepKernel` regeneration and computes a new `EngineeringHashChain` signature. However, the simulation dashboards (Navier-Stokes solvers, finite element matrices) are driven by independent browser timers and do not evaluate the new meshes from `canonicalDocument.derived`.
* **Execution Boundary:** Halts at the entry boundary of `NavierStokesWorkspace.tsx` and `NonlinearSolverWorkspace.tsx`.

---

## D. Duplicate & Parallel Contract Report

We identified components where parallel state engines run independently of the core `EngineeringDocument` SOT.

### 1. Assembly Kinematics (AED vs AssemblyCore)
* **Conflict Identification:**
  * **Canonical Path:** `EngineeringDocument.assembly` processed through `RecursiveAssemblyEvaluator.ts` and `AssemblyMateSolver.ts` which calculate joint placements based on rigorous mathematical constraints.
  * **Parallel Path:** `/src/engine/assembly/AssemblyCore.ts` maintains its own classes (`PartInstance`, `AssemblyComponent`, `AssemblyConstraint`) to simulate parts and constraints locally inside `AssemblyWorkspace.tsx`.
* **Causal Risk:** High risk of drift. Moving parts in the workspace viewport updates local `AssemblyCore` placement matrices, which can desynchronize with the canonical constraints in `EngineeringDocument` unless explicitly reconciled.

### 2. Sketch Profiles (SketchEngine vs CanonicalSketch)
* **Conflict Identification:**
  * **Canonical Path:** `CanonicalSketchContract.ts` and `CanonicalSketch` structs holding monotonic revision counters and math definitions.
  * **Parallel Path:** `/src/engine/geometry/SketchEngine.ts` holding client-side canvas points, dragging coordinates, and grid offsets.
* **Causal Risk:** None. The parallel path acts as an isolated scratchpad buffer. Once drawing is completed, the coordinate data is transformed via `CanonicalSketchAdapter.ts` to populate the canonical sketch, thereby aligning with SOT rules.

---

## E. Roadmap Mapping

We map our inventoried capabilities against the formal development roadmap (`PATCH-324` through `PATCH-370`), honoring historical identifiers.

* **PATCH-324 (Geometry Kernel Integrators):**
  * *Capability:* B-Rep kernel and solid creation primitives.
  * *SOT Path:* Connected to `BRepKernel.ts`. Fully verified by `PATCH-035-SOT-Control.test.ts`.
* **PATCH-326 (Canonical Sketch Integration):**
  * *Capability:* Interactive sketches, lifecycle transactions, and monotonic sketch revision tracking.
  * *SOT Path:* Connected via `CanonicalSketchContract.ts`. Verified by `PATCH-326-CanonicalRuntimeIntegration.test.ts`.
* **PATCH-327 (Assembly Joint Cohesion):**
  * *Capability:* Coincident, Concentric assembly mate evaluations.
  * *SOT Path:* Resolved via `AssemblyMateSolver.ts`. Verified by `PATCH-327-Forensic-Report.md` and `PATCH-327` tests.
* **PATCH-340 to PATCH-350 (Advanced Solids and Surfaces):**
  * *Capability:* Revolve, Loft, Fillet, Mold-splitting CAD operations.
  * *SOT Path:* Currently *Unmapped / Bypassed* in the frontend UI layers. Back-end kernels are available but bypassed by UI shortcuts.
* **PATCH-360 to PATCH-370 (Analysis Workspaces Integration):**
  * *Capability:* Boundary condition solving, mesh computations, Navier-Stokes iterations.
  * *SOT Path:* Mesh compilation inside `DocumentEvaluator` is implemented, but active solvers are bypassed by UI timer-based presentation loops.
