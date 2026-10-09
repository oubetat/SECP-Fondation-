# SECP-3D-RENDERING-CONTRACT-AUDIT-001
## Forensic Audit: Canonical Engineering Truth to 3D Pixels Pipeline

---

### 1. Executive Summary

This read-only audit establishes the exact runtime authority and transformation sequence from the **Canonical Engineering Document** (`EngineeringDocument`) down to the hardware pixels rendered by WebGL/Three.js across SECP Industrial OS v2.

The audit was conducted strictly in read-only mode, without introducing temporary adapters, stores, or modifying production code.

---

### 2. Complete Step-by-Step Pipeline: `EngineeringDocument` → Pixels

```
EngineeringDocument (Single Source of Truth)
   │ [doc.parameters, doc.sketches, doc.features, doc.assembly, doc.revision]
   ▼
1. DocumentEvaluator.evaluate(doc, options)
   │ File: /src/engine/cad-kernel/document/DocumentEvaluator.ts (lines 79–232)
   │ Authority: CANONICAL EVALUATOR
   │ Step 1.1: Solves parameter DAG (evaluateParameters)
   │ Step 1.2: Replays FeatureHistory (Parametric Feature Tree -> BRepSolid)
   │ Step 1.3: doc.evaluatedShape = evaluatedSolid (Solid B-Rep)
   ▼
2. BRepKernel.tessellate(evaluatedSolid) / BRepTessellator.tessellate(solid)
   │ File: /src/engine/cad-kernel/tessellation/BRepTessellator.ts (lines 56–270)
   │ Authority: DERIVED ARTIFACT CONVERTER (Deterministic)
   │ Step 2.1: Iterates outerLoop oriented edges and calculates surface normals
   │ Step 2.2: Generates vertices (meters), normals, and triangle indices
   │ Step 2.3: Populates topologyMap (faceTriangleMap, edgeVertexMap, vertexIndexMap)
   │ Step 2.4: Calculates cryptographic SHA-256 brepHash and meshHash
   │ Step 2.5: Assigns result to doc.derived.mesh (MeshGeometryData)
   ▼
3. React State Bridge (App.tsx)
   │ File: /src/App.tsx (lines 1644–1646, 1657–1659, 1685–1687)
   │ Authority: APPLICATION SHELL
   │ Step 3.1: setCanonicalDocument(doc)
   │ Step 3.2: applyCanonicalEvaluation(evalResult) -> setActiveSolid(doc.evaluatedShape)
   │ Step 3.3: Passes activeSolid as React prop to <CadViewport3D>
   ▼
4. Three.js BufferGeometry Construction
   │ File: /src/components/CadViewport3D.tsx (lines 505–525)
   │ Authority: VIEWPORT TRANSLATION LAYER
   │ Step 4.1: geom = new THREE.BufferGeometry()
   │ Step 4.2: Scales vertices from meters to mm (scaledVertices = activeSolid.mesh.vertices.map(v => v * 1000))
   │ Step 4.3: geom.setAttribute('position', new THREE.Float32BufferAttribute(scaledVertices, 3))
   │ Step 4.4: geom.setAttribute('normal', new THREE.Float32BufferAttribute(activeSolid.mesh.normals, 3))
   │ Step 4.5: geom.setIndex(activeSolid.mesh.indices)
   ▼
5. Three.js Mesh & Scene Graph Insertion
   │ File: /src/components/CadViewport3D.tsx (lines 553–563)
   │ Authority: THREE.JS SCENE GRAPH
   │ Step 5.1: mesh = new THREE.Mesh(geom, mat)
   │ Step 5.2: mesh.userData = { name: activeSolid.name, id: activeSolid.id }
   │ Step 5.3: mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), ...))
   │ Step 5.4: meshesGroupRef.current.add(mesh) -> scene.add(meshesGroupRef.current)
   ▼
6. OrbitControls & Kinematic Ticker
   │ File: /src/components/CadViewport3D.tsx (lines 240–334)
   │ Authority: LOCAL INTERACTION CONTROLLER
   │ Step 6.1: controls.update() (Damping factor 0.05)
   │ Step 6.2: requestAnimationFrame(animate)
   ▼
7. WebGL Renderer Draw Call & Hardware Pixels
   │ File: /src/components/CadViewport3D.tsx (line 333)
   │ Authority: HARDWARE GPU WEBGL CONTEXT
   │ Step 7.1: renderer.render(scene, camera)
   │ Step 7.2: WebGL pipeline rasterizes triangles into HTML5 <canvas> pixels
```

---

### 3. Detailed Audit Findings per Criterion

#### Criterion 1: `CadViewport3D.tsx` Geometry Analysis
* **Where does `activeSolid.mesh` come from?**
  * It is produced by `DocumentEvaluator.evaluate()` calling `BRepTessellator.tessellate()`, stored in `doc.derived.mesh` and attached to `doc.evaluatedShape.mesh`.
* **Is `DocumentEvaluator` the actual source?**
  * **YES**, for evaluated parametric solids (`EXTRUDE`, `REVOLVE`, etc.).
  * **NO**, for default project templates (`V6_ENGINE`, `BALL_VALVE`), which invoke procedural Three.js factories (`buildRealisticV6Engine`, `buildSolidWorksBallValve`) in `CadIndustrialModels.ts`.
* **Where does Triangulation happen?**
  * In `/src/engine/cad-kernel/tessellation/BRepTessellator.ts` (lines 149–162) via polygon triangulation on face vertex loops.
* **Where does conversion to Three.js happen?**
  * In `/src/components/CadViewport3D.tsx` (lines 505–525) inside the `useEffect` hook.
* **Is there Caching?**
  * **NO**. There is no LRU/hash cache for Three.js geometries. The entire `THREE.BufferGeometry` and `THREE.Mesh` are re-allocated, scaled by 1000, and re-added to the scene on every React render where `activeSolid` changes.
* **Does it depend on `canonicalDocument.revision`?**
  * Indirectly via React prop change (`activeSolid`), but `CadViewport3D` does not check or store `canonicalDocument.revision`.
* **Is Geometry Generation Deterministic?**
  * **YES**. `BRepTessellator` produces deterministic vertex buffers and computes reproducible cryptographic SHA-256 hashes (`brepHash`, `meshHash`).

---

#### Criterion 2: Topology Identity & Selection Mapping
* **Is there a true Raycast Hit → Topology Identity → Canonical B-Rep path?**
  * **NO (DISCONNECTED in Active UI)**:
    1. In `CadViewport3D.tsx` (lines 626–638), `raycaster.intersectObjects` returns a hit, but the code only reads top-level `clickedMesh.userData.name` or `clickedMesh.userData.id`. It completely ignores `hit.faceIndex` and does not look up `topologyMap.faceTriangleMap`.
    2. In `Professional3DViewportPanel.tsx` (lines 362–374), `EngineeringHitTester277` inspects `obj.userData.id` and maps `THREE.Mesh` to `'FACE'` and `THREE.Line` to `'EDGE'`, but binds strictly to hardcoded strings (`PART-P001`, `FACE-F182`) on demo meshes.
    3. In `TopologyPickingEngine.ts`, a theoretical translation engine exists with `resolveCanonicalReference()`, but **it is never instantiated or called in any active UI component** (it is only invoked in `TopologyPickingEngine.test.ts`).
* **Conclusion**: Selection in production remains at the coarse Three.js object level; sub-shape topology picking (individual face/edge/vertex selection) is **NOT integrated into the active UI**.

---

#### Criterion 3: Transform Authority
* **Canonical Engineering Transform**:
  * Stored in `EngineeringDocument.assembly.instances[i].placementTransform = { position, rotation }`.
* **Derived Exploded Transform**:
  * Evaluated on-the-fly by `AssemblyEngine.getExplodedPositions(components, explodedFactor)` and `ExplodedViewEngine.applyExplodeDisplacements()`.
* **Three.js Local Transform**:
  * In `CadViewport3D.tsx`: Real-time kinematics (`piston.position.set(xp, yp, z)`, `crankshaft.rotation.z = angleRef.current`) are directly mutated inside the `requestAnimationFrame` loop, completely bypassing `EngineeringDocument`.
  * In `Professional3DViewportPanel.tsx`: `EngineeringGizmoSystem` mutates local Three.js transform matrices without writing back to `EngineeringDocument`.
* **Conclusion**: Transform authority is split. Static placements derive from the document/evaluator, but animated kinematics and interactive gizmos mutate local Three.js transforms without canonical write-back.

---

#### Criterion 4: Full Inventory of 3D Renderers and WebGL Usage

| Component / File | Render Tech | Usage | Classification |
| :--- | :--- | :--- | :--- |
| `/src/components/CadViewport3D.tsx` | Three.js WebGL | Primary workspace viewport for CAD, parametric solids, assemblies | **DERIVED 3D RENDERER** (when `activeSolid.mesh` present) / **PARALLEL MOCK** (when V6 engine active) |
| `/src/components/Professional3DViewportPanel.tsx` | Three.js WebGL | Prototype viewport on `PATCH-276` with Gizmo, GD&T, PMI, Sectioning | **PARALLEL GEOMETRY / MOCK** (Isolated prototype with hardcoded demo shapes) |
| `/src/components/AssemblyWorkspace.tsx` | 2D CSS Projections + SVG | Exploded views, clash markers, clearance dimension lines | **2D / SVG VISUALIZATION OVERLAY** (No 3D WebGL renderer) |
| `/src/components/cam/ThreeAxisCamWorkspace.tsx` | HTML5 2D Canvas | 2.5D toolpath rendering from G-code coordinates | **2D VISUALIZATION** |
| `/src/components/assembly/FEMMeshWorkspace.tsx` | HTML5 2D Canvas | 2D FEM triangular mesh display | **2D VISUALIZATION** |
| `/src/components/assembly/KinematicSolverWorkspace.tsx` | HTML5 2D Canvas | 2D 4-bar linkage vector plot | **2D VISUALIZATION** |
| `/src/components/GearEngineeringWorkspace.tsx` | HTML5 2D Canvas | 2D involute gear tooth profile | **2D VISUALIZATION** |
| `/src/components/SpringEngineeringWorkspace.tsx` | HTML5 2D Canvas | 2D spring coil stress diagram | **2D VISUALIZATION** |
| `/src/components/ShaftEngineeringWorkspace.tsx` | HTML5 2D Canvas | 2D shaft shear/moment diagram | **2D VISUALIZATION** |
| `/src/components/NoiseFilteringWorkbenchPanel.tsx` | HTML5 2D Canvas | 2D point cloud scatter plot | **2D VISUALIZATION** |

---

#### Criterion 5: Duplicate Geometry Conversion Paths
The codebase contains **two** primary geometry conversion mechanisms:
1. **Canonical Path (`BRepTessellator.ts`)**: Authoritative converter transforming B-Rep `Solid` into `MeshGeometryData` with `faceTriangleMap` and SHA-256 hashes.
2. **Procedural Mock Factories (`CadIndustrialModels.ts`)**: Generates procedural Three.js meshes (`CylinderGeometry`, `BoxGeometry`, `LatheGeometry`) directly for V6 Engine, Gooseneck Faucet, and Ball Valve, bypassing the B-Rep kernel.
3. **Hardcoded Viewport Setup (`Professional3DViewportPanel.tsx:308–355`)**: Direct instantiation of `THREE.BoxGeometry` and `THREE.CylinderGeometry` for demo block and sleeves.

---

#### Criterion 6: `Professional3DViewportPanel` Analysis
* **Can it theoretically become a Consumer of the Canonical Pipeline?**
  * **YES**. The panel implements high-level controllers for Selection (`PATCH-277`), Gizmos (`PATCH-278`), Sections (`PATCH-279`), Measurements (`PATCH-280`), PMI (`PATCH-281`), Drawings (`PATCH-282`), Dimensions (`PATCH-283`), and GD&T (`PATCH-284`).
  * However, its Three.js scene building logic in `useEffect` (lines 304–360) is currently hardcoded to static mock meshes (`new THREE.BoxGeometry(160, 100, 180)`).
* **Current Status**: **ISOLATED ARCHITECTURAL PROTOTYPE (PARALLEL SOT / MOCK)**.

---

#### Criterion 7: Assembly Viewport Verification
* `AssemblyWorkspace.tsx` **does not have a 3D renderer**.
* It renders 2D SVG vector lines (`<line x1="..." y1="..." />`) and absolute CSS percentage badges (`style={{ left: `${xA}%`, top: `${yA}%` }}`).
* True 3D visualization of assemblies occurs solely inside `CadViewport3D.tsx` when `assemblyComponents` are passed to it.

---

#### Criterion 8: Revision / Lifecycle Binding Status
* **Status**: **`PARTIAL`**.
* *Evidence*: When an operation modifies `canonicalDocument`, `DocumentEvaluator.evaluate(doc)` increments `doc.revision` and produces `doc.evaluatedShape`. React state in `App.tsx` triggers a re-render of `CadViewport3D` via `activeSolid`.
* *Gap*: There is no explicit subscription or caching keyed to `(documentId, revision)`. If the revision updates without a reference change to `activeSolid`, the viewport will not re-render. There is no formal `STALE` / `INVALIDATED` lifecycle signal in the viewport.

---

### 4. Final Architecture Matrix

| Renderer | Source | Conversion Authority | Canonical? | Revision-Bound? | Topology-Linked? | Transform Authority | Classification |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`CadViewport3D`** (Parametric Mesh) | `activeSolid.mesh` via `DocumentEvaluator` | `BRepTessellator.ts` → Three.js `BufferGeometry` | **YES** | **PARTIAL** (React prop) | **NO** (Mesh-level only) | Evaluator DAG / React Props | **DERIVED 3D RENDERER** |
| **`CadViewport3D`** (Engine/Valve Demo) | `CadIndustrialModels.ts` | Procedural Three.js factories | **NO** | **ABSENT** | **NO** | RAF Loop Kinematics | **PARALLEL MOCK REALITY** |
| **`Professional3DViewportPanel`** | Hardcoded primitives in `useEffect` | Inline Three.js constructors | **NO** | **ABSENT** | **NO** (Mock strings) | Local Gizmo System | **PARALLEL GEOMETRY / MOCK** |
| **`AssemblyWorkspace`** | `canonicalDocument.assembly` | Math projection to 2D CSS / SVG | **YES** | **PARTIAL** | Mate Refs | `ExplodedViewEngine` | **2D / SVG VISUALIZATION OVERLAY** |
| **Specialized 2D Canvases** (CAM, FEA, Gears) | Local mathematical equations | HTML5 2D Canvas Drawing Context | **NO** | **ABSENT** | **NO** | Canvas Matrix 2D | **2D VISUALIZATION** |

---

### 5. Final Verdict

# **`VERIFIED`**

*(The forensic audit has proven from source code the exact end-to-end rendering pipeline, confirming that a valid canonical conversion foundation exists in `DocumentEvaluator` + `BRepTessellator`, while identifying the exact gaps in topology linking, revision caching, and parallel prototype viewports).*
