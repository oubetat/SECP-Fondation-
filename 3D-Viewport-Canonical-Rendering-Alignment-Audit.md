# SECP-3D-VIEWPORT-CANONICAL-AUDIT-001
## 3D Viewport — Canonical Rendering Alignment Forensic Audit Report

---

### 1. Executive Summary & Target vs. Actual Pipeline

This read-only audit examines the runtime alignment between the **Canonical Engineering Truth** (`EngineeringDocument`), the evaluation pipeline (`DocumentEvaluator`), and all 3D/2D visualization viewports across the SECP repository.

#### Target Canonical Architecture:
```
                EngineeringDocument (Single Source of Truth)
                            │
                            ▼
                     DocumentEvaluator
                            │
                            ▼
                 Canonical B-Rep / Geometry
                            │
                            ▼
                   Derived Render State (Revision-Bound)
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
    Main 3D Viewport             Specialized Domain Viewports
    (CadViewport3D)              (Assembly, CAM, Reverse Eng, CAE)
```

#### Actual Code Implementation Reality:
* **The Main Viewport (`CadViewport3D`)** acts as a **Derived Renderer** when an evaluated solid with mesh buffers exists, but degrades into a **Parallel Procedural Reality** when switched to default template models (V6 Engine, Ball Valve, Faucet).
* **The Advanced Viewport (`Professional3DViewportPanel`)** is an **Architectural Island / Mock Reality (Parallel SOT)** that constructs hardcoded Three.js geometries and runs independent selection, gizmo, PMI, and GD&T state engines without reading `canonicalDocument`.
* **Domain Workbenches (CAM, FEA, CFD, Gears, Springs)** rely on **Specialized 2D Canvas Visualizers** that compute geometry directly from localized equations, bypassing the central B-Rep kernel.
* **Direct Modeling & Feature Recognition Workbenches** maintain **Parallel Feature & Transaction Realities** that do not sync back to `EngineeringDocument`.

---

### 2. Comprehensive Tab & Workbench Alignment Audit

| Workbench / Tab | Component / Viewport Used | Render Engine | Geometry Source | EngineeringDocument Source | Topology & Selection Source | Transform & Feature Source | Alignment Classification | Code Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Main CAD Studio** (`V6-ENGINE`, `PATCH-004`) | `CadViewport3D.tsx` | Three.js WebGL | Evaluated mesh or procedural V6 engine (`buildRealisticV6Engine`) | Indirect via `App.tsx` state | Top-level entity `userData.id`; Raycaster selection | Animated crank angle / static matrix | **B — DERIVED** (Mesh) / **D — PARALLEL** (Engine) | `src/components/CadViewport3D.tsx:503-560` |
| **Design: Parametric & Sketcher** (`PATCH-005`, `PATCH-006`, `PATCH-034`) | `CadViewport3D.tsx` | Three.js WebGL | `canonicalDocument.features` evaluated to `activeSolid.mesh` | `canonicalDocument` passed to `CanonicalDocumentUIAdapter` | B-Rep face/edge hashes | Evaluator feature DAG | **B — DERIVED RENDERER** (True Canonical Pipeline) | `src/App.tsx:1644-1673` |
| **Design: Direct Modeling** (`PATCH-206`) | `DirectModelingInspector.tsx` (UI) + Main Viewport | DOM Text Log | In-memory private `DirectModelingEngine` instance | **NONE** (Local `useState`) | Local mock face ID (`face_top_1`) | Local transaction stack (`tx.newBRepHash`) | **D — PARALLEL GEOMETRY REALITY** | `src/components/DirectModelingInspector.tsx:7-23` |
| **Design: Pattern Engine** (`PATCH-208`) | `PatternEngineInspector.tsx` (UI) + Main Viewport | DOM Controls | In-memory private `PatternEngine` instance | **NONE** (Local `useState`) | Pattern feature IDs | Local pattern array | **D — PARALLEL GEOMETRY REALITY** | `src/components/PatternEngineInspector.tsx:8-36` |
| **Assembly: Core & Mates** (`PATCH-008`, `PATCH-211`–`PATCH-214`) | `AssemblyWorkspace.tsx` + `CadViewport3D.tsx` | 2D SVG/DOM Projections + Three.js Boxes | `canonicalDocument.assembly.instances` & part dimensions | Direct `canonicalDocument` prop | Mate `GeometryReference` IDs | `ExplodedViewEngine` & `placementTransform` | **B — DERIVED RENDERER** / **C — SPECIALIZED** | `src/components/AssemblyWorkspace.tsx:974-1043` |
| **Assembly: Machine Elements** (`PATCH-222`–`PATCH-226`) | `GearEngineeringWorkspace.tsx`, `SpringEngineeringWorkspace.tsx`, etc. | HTML5 2D Canvas | Local analytical math equations (involute, helix formulas) | **NONE** | Local vertex arrays | Local canvas pan/zoom | **C — SPECIALIZED VISUALIZATION** | `src/components/GearEngineeringWorkspace.tsx:1074` |
| **Assembly: Kinematics & Solvers** (`PATCH-227`–`PATCH-230`) | `KinematicSolverWorkspace.tsx`, `MotionLinksWorkspace.tsx` | HTML5 2D Canvas | 2D linkage vector solver | **NONE** | Joint constraint references | Solver angular offsets | **C — SPECIALIZED VISUALIZATION** | `src/components/assembly/KinematicSolverWorkspace.tsx:564` |
| **CAM: 3-Axis & 4-Axis** (`PATCH-020`, `PATCH-255`–`PATCH-265`) | `ThreeAxisCamWorkspace.tsx`, `FourAxisCamWorkspace.tsx` | HTML5 2D Canvas | G-code interpolated toolpath waypoints | **NONE** | Local toolpath step indices | Cutter tool offset | **C — SPECIALIZED VISUALIZATION** | `src/components/cam/ThreeAxisCamWorkspace.tsx:603` |
| **CAM: Toolpath Simulation & G-Code** (`PATCH-108`, `PATCH-109`) | `ToolpathSimulationPanel.tsx`, `GCodeVerificationPanel.tsx` | Framer Motion DOM / SVG | Local voxel contract model (`RemovalRepresentation.VOXEL`) | **NONE** (Hardcoded `HERMLE_C32` mock model) | Mock object IDs (`STOCK_01`, `WP_01`) | Kinematic machine axis feeds | **MOCK / SPECIALIZED VISUALIZATION** | `src/components/ToolpathSimulationPanel.tsx:42-100` |
| **Reverse Engineering: Scan to Mesh** (`PATCH-316`–`PATCH-319`) | `NoiseFilteringWorkbenchPanel.tsx`, `ScanToMeshWorkbenchPanel.tsx` | HTML5 2D Canvas + DOM | In-memory point cloud scatter buffer | **NONE** | Spatial bounding boxes | Filter matrices | **C — SPECIALIZED VISUALIZATION** | `src/components/NoiseFilteringWorkbenchPanel.tsx:309` |
| **Reverse Engineering: Feature Recognition** (`PATCH-320`) | `FeatureRecognitionWorkbenchPanel.tsx` | DOM Inspection Tree | In-memory `FeatureRecognitionSession` on dummy mesh | **NONE** (`MESH-319-HEALED` mock) | Recognized cylinder/plane primitive IDs | Segment normal vectors | **D — PARALLEL GEOMETRY REALITY** | `src/components/FeatureRecognitionWorkbenchPanel.tsx:29-59` |
| **Simulation: FEA & CFD** (`PATCH-015`, `PATCH-018`, `PATCH-231`–`PATCH-254`) | `FEMMeshWorkspace.tsx`, `CfdMeshWorkspace.tsx`, etc. | HTML5 2D Canvas | Triangular/quad element node arrays | **NONE** | Element topology node index | Solver displacement fields | **C — SPECIALIZED VISUALIZATION** | `src/components/assembly/FEMMeshWorkspace.tsx:1014` |
| **Inspection: Advanced 3D Viewport** (`PATCH-276`) | `Professional3DViewportPanel.tsx` | Three.js WebGL (Independent Instance) | Hardcoded Box & Cylinder Three.js primitives | **NONE** (0 props received) | Hardcoded strings (`PART-P001`, `FACE-F182`) | Independent `EngineeringGizmoSystem` | **D — PARALLEL GEOMETRY REALITY / MOCK** | `src/components/Professional3DViewportPanel.tsx:304-360` |
| **Drawing & PMI** (`PATCH-021`, `PATCH-281`–`PATCH-284`) | `TechnicalDrawingPanel.tsx`, `Professional3DViewportPanel.tsx` | 2D SVG Sheet / Three.js Overlays | Local `EngineeringDrawingSystem` projection lines | **NONE** | Hardcoded datum references | Orthographic view scale & offset | **C — SPECIALIZED VISUALIZATION** | `src/components/Professional3DViewportPanel.tsx:102-120` |

---

### 3. Detailed Forensic Invariant Classification

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLASSIFICATION BREAKDOWN                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Category A: Canonical Renderer                                                   │
│   → Currently 0 viewports directly render the raw B-Rep without an adapter.       │
│                                                                                  │
│ Category B: Derived Renderer (Canonical Pipeline)                                │
│   → CadViewport3D (when activeSolid.mesh is evaluated from EngineeringDocument) │
│   → AssemblyWorkspace (when instances derive from canonicalDocument.assembly)    │
│                                                                                  │
│ Category C: Specialized Visualization (Domain Visualizers)                       │
│   → CAM toolpath canvases, FEA mesh canvases, Gear/Spring 2D analytical profilers│
│                                                                                  │
│ Category D: Parallel Geometry Reality (Architectural Violations)                 │
│   → Professional3DViewportPanel (Hardcoded mock geometry + unlinked systems)     │
│   → DirectModelingInspector (Unlinked transaction engine)                         │
│   → PatternEngineInspector (Unlinked pattern engine)                             │
│   → FeatureRecognitionWorkbenchPanel (Unlinked session on dummy mesh)             │
│   → CadViewport3D Demo Modes (V6 Engine & Ball Valve hardcoded models)           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Key Architectural Flaws Identified

1. **Parallel Rendering Engines**: Two distinct Three.js WebGL rendering contexts run in parallel (`CadViewport3D` and `Professional3DViewportPanel`) without shared resource pooling, common scene graphs, or unified geometry shaders.
2. **Topology Disconnect**: `Professional3DViewportPanel` implements advanced picking and GD&T features (`PATCH-277`–`PATCH-284`), but binds them to static dummy strings (`FACE-F182`) instead of dynamic topology hashes generated by `BRepHasher` from `canonicalDocument`.
3. **Domain Visualizer Fragmentation**: CAM and Simulation workbenches bypass the 3D WebGL viewport entirely, rendering separate 2D canvas representations from local math variables instead of projecting overlays onto the canonical 3D solid.
4. **Cast & Contract Masking**: Multiple workbenches utilize `(doc.evaluatedShape as any)` or `(activeSolid as any)` to bypass TypeScript type-safety between the kernel B-Rep and Three.js buffer attributes.

---

### 5. Final Audit Verdict

# **`VERIFIED`**

*(The forensic alignment audit was executed in strict read-only mode, without altering production code or creating temporary adapters, fully documenting the relationship between EngineeringDocument and every visualization viewport in the repository).*
