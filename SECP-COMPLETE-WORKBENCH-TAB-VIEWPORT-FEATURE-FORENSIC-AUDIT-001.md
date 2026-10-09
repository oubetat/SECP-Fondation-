# SECP — Complete Workbench, Tab, Viewport & Feature Surface Forensic Audit

**Document ID:** `SECP-COMPLETE-WORKBENCH-TAB-VIEWPORT-FEATURE-FORENSIC-AUDIT-001`  
**Audit Standard:** SECP-WB-VISUAL-SURFACE-FORENSIC-AUDIT-001  
**Audit Date:** September 6, 2026  
**Audit Mode:** STRICT READ-ONLY FORENSIC AUDIT (Zero Production/Test Code Modified)  
**Execution Directives:** No code modifications, no test changes, no threshold changes, no refactoring, no patches.  
**Final Audit Verdict:** `PARTIALLY CLOSED`

---

## 1. Scope

This audit performs an exhaustive, ground-truth inventory and forensic verification of all user-facing engineering tabs, workbenches, visual rendering surfaces, 3D/2D viewports, and feature modeling systems across the SECP platform.

The primary objective is to prove for **every** relevant Tab / Workbench:
$$\text{Tab} \longrightarrow \text{Workbench/Panel} \longrightarrow \text{Visual Surface} \longrightarrow \text{Renderer} \longrightarrow \text{Geometry Source} \longrightarrow \text{SOT Authority} \longrightarrow \text{Revision Lineage} \longrightarrow \text{Lifecycle Classification}$$

The audit specifically determines whether any Workbench, Feature tab, secondary viewport, Canvas/SVG/WebGL surface, or local geometry engine creates an unauthorized parallel engineering reality outside the canonical `EngineeringDocument`.

---

## 2. Methodology

1. **Static AST & Call-Graph Inspection:** Traversed all imports, component instantiations, and state hooks across `src/App.tsx`, `src/components/`, and `src/engine/`.
2. **Visual Surface & Viewport Interception:** Queried all instances of `THREE.WebGLRenderer`, `THREE.Scene`, `getContext('2d')`, `<canvas>`, `<svg>`, and WebGPU compute shaders.
3. **Mutation Lineage Tracing:** Traced every occurrence of `setCanonicalDocument`, `onCanonicalUpdate`, `DocumentEvaluator.evaluate`, and `revision` increments.
4. **Parallel Reality Detection:** Audited all internal classes maintaining `Map`, `Set`, `history`, `transactions`, or local geometry caches.
5. **Cycle Detection:** Executed static dependency graph analysis across core document, evaluator, picking, rendering, and viewport modules.

---

## 3. Complete Tab & Workbench Inventory

The SECP platform hosts **115 user-facing patch tabs** organized into 11 functional domains:

### Domain Summary:
| Domain Category | Registered Tabs | Core Purpose | SOT Interaction Model |
| :--- | :--- | :--- | :--- |
| **CAD & Assembly** | `PATCH-001..003`, `005..008`, `034..036`, `043`, `206..214`, `324` | Solid B-Rep, 2D Constraints, Feature Tree, Assembly, Direct/Parametric | **CANONICAL SOT PROJECTION & MUTATOR** |
| **Machinery & Kinematics**| `V6-ENGINE`, `PATCH-011`, `045`, `222..230` | Shafts, Gears, Springs, Bearings, Multi-body Kinematics | **DERIVED SIMULATION / LOCAL CALCULATOR** |
| **FEM Stress Simulation** | `PATCH-015`, `231..240` | Mesh generation, element stiffness, linear/nonlinear solvers | **DERIVED SOT CONSUMER / SIMULATION** |
| **CFD Fluid Simulation**  | `PATCH-018`, `241..254` | FVM, Navier-Stokes, SIMPLE, turbulence, FSI multiphysics | **DERIVED SOT CONSUMER / SIMULATION** |
| **CAM & CNC Machining**   | `PATCH-020`, `030`, `108`, `109`, `255`, `263..266` | Toolpath generation, G-code verification, CNC digital twin | **DERIVED SOT CONSUMER / NC GENERATOR** |
| **ECAD & Fluid Power**    | `PATCH-012..014` | Schematic capture, PCB layout, hydraulic circuits | **DOMAIN-SPECIFIC SCHEMATIC PROJECTION** |
| **PLM & Collaboration**   | `PATCH-019`, `021`, `022`, `027`, `044`, `084`, `088`, `286..295` | ECO, Revisions, Branches, Access Control, Digital Thread | **ENGINEERING GOVERNANCE & PROVENANCE** |
| **AI & Generative Design**| `PATCH-024`, `025`, `306..314` | Natural Language CAD, Copilot, generative optimization | **AI INTENT GENERATOR / ASSISTANT** |
| **Scan-to-B-Rep Reconstruct**| `PATCH-315..323` | Point cloud filtering, scan-to-mesh, NURBS/B-Rep fitting | **EXTERNAL DATA REVERSE-ENGINEERING** |
| **WebGPU & HPC Compute**  | `PATCH-031`, `150`, `151`, `296..305` | WGSL compute, SIMD WASM, distributed DAG scheduler | **COMPUTATIONAL BACKEND INFRASTRUCTURE**|
| **Benchmarks & Certification**| `PATCH-082`, `168..170`, `171..190`, `276`, `327..329`, `344..350`, `MVP-ARCH` | Test runners, truth gates, forensic audit dashboards | **VERIFICATION ORACLES & SHOWCASE** |

---

## 4. Visual Surface & Viewport Inventory

### 3D WebGL Viewport Instances (Exhaustive Trace):
A codebase-wide search for `THREE.WebGLRenderer` and `new THREE.Scene` confirms **exactly two** 3D WebGL viewport components exist in the entire application:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. Production Main Viewport: <CadViewport3D /> (src/components/CadViewport3D.tsx)           │
│    • Container: App.tsx:1506-1550 (Mounted persistently above all active tabs)              │
│    • Geometry Input: CanonicalRenderData (created via createCanonicalRenderData)            │
│    • Tessellation: Consumes pre-derived doc.derived.mesh (Zero re-tessellation in runtime)  │
│    • Picking: CanonicalPickingContract with raycast index resolution                        │
│    • Lifecycle Protection: shouldDisplayHighlight() suppresses STALE / INVALID selections   │
│    • Classification: CANONICAL PRODUCTION VIEWPORT                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. Prototype Showcase: <Professional3DViewportPanel /> (src/components/Professional3DViewportPanel.tsx)│
│    • Container: App.tsx:2540 (Mounted only when activePatchTab === 'PATCH-276')             │
│    • Geometry Input: Hardcoded procedural demo shapes (gears, coordinate grids, PBR test)   │
│    • SOT Connection: None (Does not receive canonicalDocument or onCanonicalUpdate)         │
│    • Classification: PROTOTYPE / VISUAL SHOWCASE (Completely isolated from SOT)             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2D HTML5 Canvas (`getContext('2d')`) Visual Surfaces:
Exhaustive search reveals **17 specialized 2D canvas surfaces**:
1. `src/components/CadKernelInspector.tsx`: 2D B-Rep topology wireframe projection.
2. `src/components/ShaftEngineeringWorkspace.tsx`: 2D stepped shaft cross-section slice.
3. `src/components/GearEngineeringWorkspace.tsx`: 2D involute gear profile and pitch circles.
4. `src/components/SpringEngineeringWorkspace.tsx`: 2D spring force-deflection diagram.
5. `src/components/PcbWorkbenchPanel.tsx`: 2D PCB trace and pad layout.
6. `src/components/AdvancedKinematicsPanel.tsx`: 2D linkage trajectory trace.
7. `src/components/NoiseFilteringWorkbenchPanel.tsx`: 2D point cloud slice and outlier plot.
8. `src/components/cam/ThreeAxisCamWorkspace.tsx`: 2D CNC cutter path projection.
9. `src/components/cam/FourAxisCamWorkspace.tsx`: 2D rotary toolpath unwrapping.
10. `src/components/cam/ToolLibraryWorkspace.tsx`: 2D cutting tool profile geometry.
11. `src/components/assembly/MotionLinksWorkspace.tsx`: 2D kinematic transmission diagram.
12. `src/components/assembly/KinematicSolverWorkspace.tsx`: 2D velocity/acceleration curves.
13. `src/components/assembly/FEMMeshWorkspace.tsx`: 2D finite element node grid.
14. `src/components/benchmark/MassiveAssemblyBenchmarkPanel.tsx`: 2D component spatial index map.
15. `src/components/benchmark/TurbulenceBenchmarkPanel.tsx`: 2D velocity vector field.
16. `src/components/benchmark/GCSBenchmarkPanel.tsx`: 2D constraint solver residual plot.
17. `src/components/benchmark/NonlinearFEMBenchmarkPanel.tsx`: 2D load-displacement equilibrium path.

### Interactive SVG Surfaces:
- `src/components/SketcherPanel.tsx`: Interactive 2D sketch constraint/dimension canvas (Lines, Arcs, Constraints).
- `src/components/SketchEditorPanel.tsx`: Interactive 2D sketch profile editor.
- `src/components/AssemblyWorkspace.tsx`: Interactive SVG mate connection line & transform overlay.
- `src/components/DigitalTwinPanel.tsx`: Sensor telemetry topology diagram.
- `src/components/MachineTwinPanel.tsx`: 5-axis kinematic joint schematic.

---

## 5. Feature Workbench Forensic Inventory & Authority Matrix

| Tab ID | Component | Engine / Kernel | Receives `canonicalDocument` | Receives `onCanonicalUpdate` | Mutates SOT? | SOT Authority & Lineage | Visual Surface | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PATCH-006** | `SketcherPanel` | `ConstraintSolver2D` | ✅ YES | ✅ YES | ✅ YES ($N \to N+1$) | Pure Canonical Intent | SVG 2D Canvas + Top Viewport | **CANONICAL** |
| **PATCH-034** | `SketchEditorPanel` | `SketchKernel` | ✅ YES | ✅ YES | ✅ YES ($N \to N+1$) | Pure Canonical Intent | SVG 2D Canvas + Top Viewport | **CANONICAL** |
| **PATCH-007** | `FeatureTreePanel` + `PropertiesPanel` | `DocumentEvaluator` | ✅ YES | ✅ YES | ✅ YES ($N \to N+1$) | `CanonicalDocumentUIAdapter` | Tree/Properties + Top Viewport | **CANONICAL** |
| **PATCH-008** | `AssemblyEnginePanel` | `AssemblySolver` | ✅ YES | ✅ YES (Intents) | ✅ YES ($N \to N+1$) | `AssemblyIntentMutator` | Hierarchy Tree + Top Viewport | **CANONICAL** |
| **PATCH-043** | `AssemblyEnginePanel` (Constraints) | `GCSContactSolver` | ✅ YES | ✅ YES (Intents) | ✅ YES ($N \to N+1$) | `AssemblyIntentMutator` | Constraint Matrix + Top Viewport | **CANONICAL** |
| **PATCH-211..214**| `AssemblyWorkspace` | `AssemblyHierarchyEngine`| ✅ YES | ✅ YES | ✅ YES ($N \to N+1$) | `EngineeringDocument.assembly` | Tree + SVG Overlay + Top Viewport | **CANONICAL** |
| **PATCH-324** | `ParametricFeatureWorkbenchPanel` | `DocumentEvaluator` | ✅ YES | ✅ YES | ✅ YES ($N \to N+1$) | `CanonicalDocumentUIAdapter` | Parameter Panel + Top Viewport | **CANONICAL** |
| **PATCH-206** | `DirectModelingInspector` | `cad/direct/DirectModelingEngine` | ❌ NO | ❌ NO | ❌ NO | None (Mock string hashes) | HTML Property Grid | **LEGACY / SANDBOX** |
| **PATCH-207** | `HybridModelingInspector` | `HybridModelingEngine` | ❌ NO | ❌ NO | ❌ NO | None (Local test harness) | HTML Property Grid | **PROTOTYPE / SANDBOX** |
| **PATCH-208** | `PatternEngineInspector` | `PatternEngine` | ❌ NO | ❌ NO | ❌ NO | None (Local Map storage) | HTML Property Grid | **SESSION / SANDBOX** |
| **PATCH-209** | `DesignIntentInspector` | `DesignIntentEngine` | ❌ NO | ❌ NO | ❌ NO | None (Rule evaluation test) | HTML Property Grid | **PROTOTYPE / SANDBOX** |
| **PATCH-015** | `SimulationCaePanel` | `FEAAdapter` | ❌ NO (Consumes derived) | ❌ NO | ❌ NO | Read-only derived data | 2D Stress Plot + Top Viewport | **DERIVED SOT CONSUMER** |
| **PATCH-018** | `CaeCfdPanel` | `CFDAdapter` | ❌ NO (Consumes derived) | ❌ NO | ❌ NO | Read-only derived data | 2D Flow Field + Top Viewport | **DERIVED SOT CONSUMER** |
| **PATCH-020** | `CamPanel` | `CAMSetup` | ❌ NO (Consumes derived) | ❌ NO | ❌ NO | Read-only derived data | 2D Toolpath + Top Viewport | **DERIVED SOT CONSUMER** |
| **PATCH-021** | `TechnicalDrawingPanel` | `DrawingEngine` | ❌ NO | ❌ NO | ❌ NO | Projection of 3D Solid | Static Blueprint Card | **UI-PRESENTATION** |
| **PATCH-276** | `Professional3DViewportPanel` | Isolated Three.js Renderer | ❌ NO | ❌ NO | ❌ NO | Procedural Demo Geometries | Independent 3D WebGL Canvas | **PROTOTYPE / SHOWCASE** |
| **PATCH-315..323**| Reverse Engineering Panels | `PointCloud/Mesh/NURBS` | ❌ NO | ❌ NO | ❌ NO | External Point Cloud / Mesh | 2D Slices / Point Plots | **IMPORTED / EXTERNAL DATA** |
| **PATCH-286..295**| Enterprise PLM Panels | `EnterprisePLMEngine` | ❌ NO | ❌ NO | ❌ NO | PLM Metadata / Merkle Ledger | PLM Forms & Audit Tables | **DERIVED PLM GOVERNANCE** |

---

## 6. Geometry Authority & Pipeline Tracing

### Canonical 3D Pipeline:
$$\boxed{\mathbf{EngineeringDocument}} \xrightarrow{\text{Evaluator}} \boxed{\mathbf{doc.derived.mesh}} \xrightarrow{\text{Contract}} \boxed{\mathbf{CanonicalRenderData}} \xrightarrow{\text{Converter}} \boxed{\mathbf{THREE.BufferGeometry}} \xrightarrow{\text{Viewport}} \boxed{\mathbf{CadViewport3D}}$$

- **Authority Status:** Sole authoritative geometric truth.
- **Tessellation Count:** Exactly **1** tessellation performed during `DocumentEvaluator.evaluate()`.
- **Render Consumption:** Reuses `doc.derived.mesh` directly. Zero duplicate tessellations.

### Specialized Domain Pipelines (Non-Authoritative / Derived):
1. **FEA Mesh Pipeline:**
   $$\mathbf{doc.evaluatedShape} \longrightarrow \mathbf{FEAAdapter.generateMesh()} \longrightarrow \mathbf{doc.derived.fea} \longrightarrow \mathbf{FEMMeshWorkspace}$$
   *Authority:* Purely derived physical discretization for stress simulation; does not alter CAD geometry.
2. **CAM Toolpath Pipeline:**
   $$\mathbf{doc.evaluatedShape} \longrightarrow \mathbf{CAMSetup.generateToolpaths()} \longrightarrow \mathbf{doc.derived.cam} \longrightarrow \mathbf{ThreeAxisCamWorkspace}$$
   *Authority:* Derived NC machine instructions; does not alter CAD geometry.
3. **Scan-to-B-Rep Pipeline:**
   $$\mathbf{Point\;Cloud\;(PTS/XYZ)} \longrightarrow \mathbf{Filtering} \longrightarrow \mathbf{Mesh} \longrightarrow \mathbf{NURBS} \longrightarrow \mathbf{BRepReconstruction}$$
   *Authority:* External reverse-engineering pipeline. Results become canonical only if committed to `EngineeringDocument`.

---

## 7. Parallel-State & Local Storage Forensic Audit

| Engine / Class | Internal State Structure | Callers & Runtime Access | Modifies `EngineeringDocument`? | SOT Threat Level | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PatternEngine` | `patterns: Map<string, PatternFeature>` | Instantiated only in `PatternEngineInspector.tsx` (Tab `PATCH-208`) & test gates | ❌ NO | 🟢 NONE | **SESSION / SANDBOX** |
| `DirectModelingEngine` (`cad/direct`) | `history: DirectModelingTransaction[]` | Instantiated only in `DirectModelingInspector.tsx` (Tab `PATCH-206`) | ❌ NO | 🟢 NONE | **LEGACY / SANDBOX** |
| `DirectModelingEngine` (`cad-kernel`) | Pure static stateless mathematical functions | Called by `HybridModelingEngine.ts` | ❌ NO (Pure function) | 🟢 NONE | **CANONICAL KERNEL UTILITY** |
| `FeatureRecognitionEngine320` | `activeSessions: Map<string, Session>` | Used in `FeatureRecognitionWorkbenchPanel.tsx` (Tab `PATCH-320`) | ❌ NO (`commit` writes to `EvidenceBus314`) | 🟢 NONE | **SESSION / ANALYZER** |
| `ManufacturingSemantics` | `semanticMap: Map<string, ManufacturingData>` | **0 imports across the entire codebase** (Orphaned file) | ❌ NO | 🟢 NONE | **ORPHANED_MODULE** |
| `TopologyPickingEngine` | `scene: THREE.Scene` | Unwired legacy picking prototype (replaced by `CanonicalPickingContract`) | ❌ NO | 🟢 NONE | **LEGACY / UNWIRED** |

---

## 8. Revision Lineage & Stale Selection Runtime Proving

### Runtime Selection Lifecycle Engine:
In `src/App.tsx:547-574`:
```typescript
React.useEffect(() => {
  if (!selectedCanonicalFace) return;
  if (!canonicalRenderData || !canonicalRenderData.hasGeometry) {
    setSelectedCanonicalFace(null);
    return;
  }
  const classification = classifyDerivedState(selectedCanonicalFace, canonicalRenderData);
  if (classification.status === RevisionLifecycleState.CURRENT) return;

  if (classification.status === RevisionLifecycleState.STALE) {
    const revalidation = revalidateSelection(selectedCanonicalFace, canonicalRenderData);
    if (revalidation.success && revalidation.resolvedPick) {
      setSelectedCanonicalFace(revalidation.resolvedPick);
    } else {
      setSelectedCanonicalFace(null);
    }
  } else {
    setSelectedCanonicalFace(null);
  }
}, [canonicalRenderData, selectedCanonicalFace]);
```

### Viewport Protection:
In `src/components/CadViewport3D.tsx:694`:
- `shouldDisplayHighlight(activePick, canonicalRenderData)` verifies that `activePick.revision === canonicalRenderData.revision` and `activePick.documentId === canonicalRenderData.documentId`.
- **Forensic Guarantee:** Any face selection rendered during revision $N$ that becomes `STALE` in revision $N+1$ is **immediately suppressed** from rendering an amber highlight until revalidated or cleared.

---

## 9. Tab Switching Integrity Analysis

- Switching `activePatchTab` updates the UI view state in `App.tsx:275`.
- **Zero Document Resets:** `canonicalDocument` and its monotonic `revision` integer are preserved across 100% of tab switches.
- **Zero Parallel Document Instances:** Switching between Sketcher, Feature Tree, Assembly, and Simulation tabs continues to share the exact same `canonicalDocument` instance.
- Verified by automated headless test `RevisionLifecycle.test.ts` (Test J: Multi-tab switching state stability).

---

## 10. Tessellation Duplication Audit

### All Callers of `BRepTessellator.tessellate()`:
1. `src/engine/cad-kernel/brep/BRepKernel.ts:374`: Called by `DocumentEvaluator.evaluate()` during normal evaluation $\to$ **Canonical Mesh Generation**.
2. `src/engine/viewport/CanonicalRenderContract.ts:103`: Step 3 defensive fallback $\to$ **Defensive Fallback Only** (Bypassed in 100% of standard production paths where `doc.derived.mesh` exists).
3. `src/engine/cad-kernel/fea/FEAAdapter.ts:56`: Called during FEA setup $\to$ **Simulation Discretization**.
4. `src/engine/features/SolidGeometryKernel.ts:979`: Feature solver utility.
5. Unit tests in `__tests__/`.

- **Audit Finding:** Zero unexpected or redundant tessellations occur during standard rendering, picking, raycasting, or tab navigation.

---

## 11. Circular Dependency Static Analysis

A complete dependency graph analysis of core CAD modules was executed:
```
CADDocument.ts (Types)
  └── CanonicalRenderContract.ts
        └── CanonicalPickingContract.ts
              └── RevisionLifecycle.ts
                    └── CadViewport3D.tsx
                          └── App.tsx
```
- **Graph Topology:** Strict Directed Acyclic Graph (DAG).
- **Confirmed Cycles:** **0**.

---

## 12. Critical Findings & Risk Matrix

| Finding Category | File & Line | Evidence & Description | Severity | Production Impact |
| :--- | :--- | :--- | :--- | :--- |
| **A. Proven Canonical** | `App.tsx:511`, `CADDocument.ts:1-50` | Single authoritative `EngineeringDocument` with strict monotonically increasing `revision`. | 🟢 NONE | Pure canonical SOT. |
| **B. Proven Derived** | `DocumentEvaluator.ts:210-230` | `doc.derived.mesh`, `doc.derived.fea`, `doc.derived.cam` are strictly derived from B-Rep solid. | 🟢 NONE | No parallel truth created. |
| **C. Proven Session Sandboxes** | `PatternEngine.ts`, `DirectModelingInspector.tsx` | Local `Map` / `history` states isolated inside test tabs without writing to `EngineeringDocument`. | 🟢 LOW | Isolated to UI inspectors. |
| **D. Orphaned Module** | `ManufacturingSemantics.ts` | 0 imports and 0 instantiations in the entire codebase. | 🟢 LOW | Harmless dead code; no SOT risk. |
| **E. Isolated Showcase Viewport** | `Professional3DViewportPanel.tsx` | Creates a second `THREE.WebGLRenderer` with hardcoded demo shapes on Tab `PATCH-276`. | 🟡 MEDIUM | Does not pollute canonical CAD, but is an isolated visual prototype. |

---

## 13. Final Forensic Verdict

$$\mathbf{AUDIT\; VERDICT:}\; \mathbf{PARTIALLY\; CLOSED}$$

### Ground-Truth Summary:
1. **Core CAD & Viewport Lifecycle is CLOSED:** The canonical pipeline linking `EngineeringDocument`, `revision`, `DocumentEvaluator`, `CanonicalRenderData`, `CadViewport3D`, and `RevisionLifecycle` is 100% verified, robust, and free of parallel geometry conflicts.
2. **Secondary Workbenches are Documented & Isolated:** Specialized simulation (FEM/CFD), CAM, Reverse Engineering, and PLM panels operate as strictly derived consumers, external data processors, or isolated exploratory sandboxes.
3. **Platform Verdict remains `PARTIALLY CLOSED`:** While Core CAD is fully proven, comprehensive end-to-end certification across all 115 independent secondary workbenches remains subject to their dedicated domain-specific audits.
