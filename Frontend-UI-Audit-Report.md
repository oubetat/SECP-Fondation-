# SECP Frontend UI Tool Inventory & Capability Trace Audit

## 1. Complete Frontend Tab Inventory
The central registry for all UI Tabs/Workbenches is `src/App.tsx`. 

*   **Sketch Editor (PATCH-034):** `SketchEditorPanel.tsx`. Tools: Line, Circle, Rect, Polygon, Trim, Mirror, Pattern, Extrude, Revolve, Split Line, Delete Face, Surfaces, Sheet Metal, Mold, Zebra, Curvature.
*   **Assembly (PATCH-038):** `AssemblyWorkspace.tsx`. Tools: Insert, Fix, Solve, Coincident, Concentric, Interference Detection, 3D Manipulation.
*   **Parametric Tree (PATCH-324):** `ParametricFeatureWorkbenchPanel.tsx`, `FeatureTreePanel.tsx`. Shows history nodes.
*   **Technical Drawing:** `TechnicalDrawingPanel.tsx`.
*   **Generative Design:** `GenerativeDesignPanel.tsx`.
*   **G-Code Verification:** `GCodeVerificationPanel.tsx`.
*   **Interactive Engineering:** `InteractiveEngineeringWorkbench.tsx`.
*   **Design Intent Inspector:** `DesignIntentInspector.tsx`.
*   *(And 40+ other dashboard panels which are primarily HTML stubs or statistical dashboards)*

## 2. Complete Tool Inventory & Traceability (Sections 2 & 3)

| Tool Name | UI Location | Traceability Path | Maturity |
| :--- | :--- | :--- | :--- |
| **Line / Circle / Rect** | Sketch Tab | Button $\rightarrow$ `onPointerDown` $\rightarrow$ `mutateAddFlatEntities` $\rightarrow$ `updateCanonicalSketchInDocument` $\rightarrow$ `DocumentEvaluator` $\rightarrow$ B-Rep | **L4** |
| **Trim** | Sketch Tab | Button $\rightarrow$ `mutateDeleteFlatEntity` $\rightarrow$ Canonical Document $\rightarrow$ Kernel | **L4** |
| **Mirror (2D)** | Sketch Tab | Button $\rightarrow$ Local React Math (`x = 400 - (p.x - 400)`) $\rightarrow$ Flat Entity Insertion. (Kernel receives Lines, not a Mirror Intent) | **L1 / L2-Partial** |
| **Circular Pattern (2D)** | Sketch Tab | Button $\rightarrow$ Local React Math (Sine/Cosine loop) $\rightarrow$ Flat Entity Insertion. (Kernel receives Lines, not a Pattern Intent) | **L1 / L2-Partial** |
| **Extruded Boss** | Features Tab | Button $\rightarrow$ `trigger3DExtrude` $\rightarrow$ `applyExtrudeAction` $\rightarrow$ `DocumentEvaluator` $\rightarrow$ B-Rep Solid | **L4** |
| **Revolved Boss** | Features Tab | Button $\rightarrow$ `trigger3DRevolve` $\rightarrow$ Calls `onExtrude` callback instead of Revolve $\rightarrow$ Fake UI Notification | **L1 (Fake)** |
| **Split Line** | Features Tab | Button $\rightarrow$ Modal $\rightarrow$ `handleExecuteSplitLine` $\rightarrow$ Adds hardcoded `{name: 'Split Line1'}` to local array. | **L0 (Stub)** |
| **Delete Face** | Features Tab | Button $\rightarrow$ Modal $\rightarrow$ `handleExecuteDeleteFace` $\rightarrow$ Fake array push. | **L0 (Stub)** |
| **Surfaces (15 tools)** | Surfaces Tab | Button $\rightarrow$ Modal $\rightarrow$ `handleExecuteSurfaceTool` $\rightarrow$ Fake array push. | **L0 (Stub)** |
| **Mold Tools** | Mold Tab | Button $\rightarrow$ Modal $\rightarrow$ `handleExecuteMoldTool` $\rightarrow$ Fake array push. | **L0 (Stub)** |
| **Zebra Striping** | Evaluate Tab | Button $\rightarrow$ Toggles CSS `repeating-linear-gradient` overlay on 2D canvas. No B-Rep evaluation. | **L0 (Fake)** |
| **Curvature Combs** | Evaluate Tab | Button $\rightarrow$ Toggles state boolean. No visual rendering or kernel call exists. | **L0 (Stub)** |
| **Assembly Mates** | Assembly Tab | Button $\rightarrow$ `constraintService.createConstraint` $\rightarrow$ Mutates `AssemblyCore.ts` (Parallel state, bypassing Canonical Document). | **L1 (Parallel)** |
| **Generative Design** | Generative Tab | Button $\rightarrow$ `runGenerativeOptimization` $\rightarrow$ `Math.random()` simulation $\rightarrow$ Returns numbers. No geometry. | **L1 (Math-Only)** |

## 3. Tool Maturity Matrix L0–L5

*   **L5 (Production Ready):** None. (Requires complete persistence, undo/redo, deterministic regeneration linked to cloud).
*   **L4 (Kernel Verified):** Sketch Basic Entities (Line, Circle, Arc), Sketch Trim, Extrude Boss.
*   **L3 (Engineering Implementation):** Assembly Kinematic Solvers (Joints/Springs in their isolated sandboxes, but disconnected from Canonical UI).
*   **L2 (Canonical Intent):** None specifically.
*   **L1 (Interface Implemented):** Mirror (2D), Pattern (2D), Assembly Constraints.
*   **L0 (UI Only / Stub):** Sweep, Loft, Fillet, Chamfer, Shell, Split Line, Delete Face, Surfaces, Mold, Sheet Metal, Zebra Striping, Generative Design.

## 4. UI-only / Stub / Fake / Partial Tools

**A. The "Fake Tree" Pattern:**
Many tools (Split Line, Delete Face, Surfaces, Mold) use a modal that resolves by pushing a hardcoded string to a local React state array (`designTree`), followed by a `notify()` popup claiming success. The `EngineeringDocument` and B-Rep kernel are entirely bypassed.

**B. The "CSS Visualization" Fake:**
Zebra Striping (used for analyzing curvature continuity of 3D NURBS surfaces) is implemented as a CSS `repeating-linear-gradient` overlaid on a 2D SVG canvas. It is purely cosmetic and performs zero engineering calculation.

**C. The "Random Math" Fake:**
Generative Design uses a Monte Carlo `Math.random()` loop to generate fake candidates (mass, safety factor, score) without producing any actual topology or B-Rep.

## 5. Duplicate & Parallel Implementations

**CRITICAL FINDING: Parallel Source of Truth (SOT)**
The Assembly UI (`AssemblyWorkspace.tsx`) uses a completely isolated data model (`AssemblyCore.ts`, `ComponentInsertionService.ts`) instead of the canonical `EngineeringDocument` (`CADDocument.ts`). 
*   **Impact:** When a user creates an assembly mate in the UI, the constraint is solved in the local sandbox. The primary CAD Kernel is entirely unaware of the assembly. Booleans, multi-body features, or downstream drawings cannot reference this assembly because it does not exist in the canonical document.

## 6. Frontend vs PATCH-324->370 Coverage

| PATCH | Tool Category | UI Exists? | Intent | Feature | Kernel (B-Rep) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 324 | Parametric Tree | YES | NO | NO | NO | L0 (Uses hardcoded nodes) |
| 325 | Sketch Basic | YES | YES | YES | YES | L4 |
| 326 | Sketch Advanced | NO | NO | NO | NO | MISSING |
| 327 | Advanced Const. | NO | NO | NO | NO | MISSING |
| 332 | Extrude / Cut | YES | YES | YES | YES | L4 |
| 333 | Revolve | YES | NO | NO | NO | L1 (Fake Trigger) |
| 334 | Sweep | NO | NO | NO | NO | MISSING |
| 335 | Loft | NO | NO | NO | NO | MISSING |
| 336 | Hole Wizard | NO | NO | NO | NO | MISSING |
| 337 | Fillet / Chamfer | NO | NO | NO | NO | MISSING |
| 341-346| Surfaces | YES (Button) | NO | NO | NO | L0 (Stub Modal) |
| 351-354| Sheet Metal | YES (Button) | NO | NO | NO | L0 (Empty Tab) |
| 361-364| Assembly Tools | YES | NO | NO | NO | L1 (Parallel State) |
| 365-370| Drawings | YES | NO | NO | NO | L0 (Empty Panel) |

## 7. Missing UI Tools & Missing Engineering Backends

*   **Missing UI Tools:** Fillet, Chamfer, Sweep, Loft, Shell, Draft, Hole Wizard, 3D Sketching, Reference Geometry (Planes, Axes). These are the absolute core of any mechanical CAD system and they do not have UI buttons.
*   **Missing Engineering Backends:** Split Line, Delete Face, Mold Tools, Surface Lofts, Sheet Metal, Generative Design, Zebra Striping. These have UI elements but zero backend capability.

## 8. Feature Tree / Selection / References / Undo / Redo / Persistence Gaps

*   **Feature Tree:** `FeatureTreePanel.tsx` is an L0 stub. It hardcodes `ExtrudeFeature_01` and `FilletFeature_02`. It does not parse the `EngineeringDocument` history.
*   **Selection:** Sketch selection works (clicks bounding boxes), but **3D Face/Edge selection is missing**. Without Face/Edge selection, tools like Fillet, Chamfer, or Hole Wizard are impossible to implement because they cannot acquire TopoDS references.
*   **Undo/Redo:** `AssemblyWorkspace.tsx` implements local array slicing for undo/redo, but it only undoes local UI state. The canonical `CADDocument` lacks a generic Undo/Redo stack.
*   **Persistence:** Tools save locally, but loading complex parametric intent (e.g. recovering the extrude parameters from a saved JSON) relies on exact hash matching which frequently breaks during hot reloads.

## 9. Critical Architectural Findings

**1. "UI Success Without Engineering Mutation"**
This is the most pervasive issue in the frontend. The application extensively utilizes `notify("Success!")` popups paired with fake string pushes to local React arrays (`designTree`) to simulate the completion of highly complex geometric operations (Split Line, Core/Cavity Mold Split, Generative Design). 

**2. The Mathematical Bypass (Mirror/Pattern)**
Instead of passing a `MIRRORED` or `CIRCULAR_PATTERN` intent to the Kernel, the UI mathematically transforms the 2D points on the client and passes the *result* to the Kernel. If the source entity is updated, the patterned instances will NOT update because the Kernel has no parametric relationship (Intent) connecting them.

**3. Total Isolation of Assembly SOT**
The entire Assembly UI is a visual mock that runs its own isolated math solver (`AssemblyCore.ts`) completely detached from the B-Rep Kernel and the Canonical `EngineeringDocument`.

## Final Conclusion

**"What can an SECP user actually do today through the UI?"**
A user can sketch 2D Lines, Circles, and Rectangles, trim them, and extrude them into a solid block. 

**"What appears to exist but is not engineered?"**
Everything else. Revolve, Sweep, Surfaces, Sheet Metal, Mold Tools, Patterning (Parametric), Assembly Constraints, Generative Design, and Zebra Striping are UI illusions, CSS tricks, or isolated parallel states that do not mutate the Canonical Engineering Geometry.
