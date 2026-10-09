# SECP CAD Kernel Evaluation Report
**Version:** 1.0
**Project:** SECP (Smart Engineering & CAD Platform)
**Status:** DRAFT / PENDING ARCHITECTURAL APPROVAL

## 1. Executive Summary
This report evaluates the technical feasibility and strategic alignment of integrating a professional-grade open-source CAD kernel into SECP. Currently, SECP relies on a metadata-mapped geometric abstraction which is insufficient for real-world engineering fidelity. After rigorous evaluation, **Open CASCADE Technology (OCCT)** emerges as the primary candidate for core B-Rep modeling and STEP interoperability.

## 2. Kernel Comparison Matrix

| Feature / Metric | Open CASCADE (OCCT) | CGAL | BRL-CAD |
| :--- | :--- | :--- | :--- |
| **B-Rep Modeling** | Excellent (Native) | Limited (Polyhedral) | CSG Focus |
| **NURBS / B-Spline** | Excellent | Advanced | Basic |
| **Boolean Ops** | High (Robust) | Mathematical (Slow) | Fast (Ray-trace) |
| **Fillet / Chamfer** | Industrial Grade | Non-trivial | Hard |
| **STEP AP242** | Native / Deep | Via Converters | Native CSG |
| **Topology Mgmt** | Full Hierarchy | Combinatorial | Tree-based |
| **Shape Healing** | Advanced | Basic | Manual |
| **WASM Feasibility** | Proven (OpenCascade.js) | Complex | Difficult |
| **Node.js Support** | Excellent (Native Addon) | Complex | CLI only |
| **Licensing** | LGPL 2.1 (Commercial Friendly) | GPL/LGPL (Restrictive) | LGPL/BSD |
| **Community** | Large / Industrial | Academic | Legacy / Mil |

## 3. Recommendation

### PRIMARY KERNEL: Open CASCADE Technology (OCCT)
**Rationale:** OCCT is the only open-source kernel that provides a full suite of industrial CAD tools (B-Rep, NURBS, STEP, Healing) within a single ecosystem. Its C++ architecture allows for high-performance native execution on the server and WebAssembly (WASM) execution in the browser.

### SECONDARY LIBRARIES:
- **Three.js:** For high-performance WebGL visualization.
- **Eigen:** For advanced linear algebra operations if needed outside OCCT.
- **TBB:** For multi-threaded geometric processing.

## 4. Architecture Strategy

### 4.1 Hybrid Execution Model
- **Browser Strategy:** Utilize `OpenCascade.js` (WASM) for interactive operations, local validation, and lightweight modeling.
- **Server Strategy:** Utilize `Native OCCT` (C++ Addon or Worker) for heavy Boolean operations, complex mesh generation, and mass-processing of STEP files.

### 4.2 Abstraction Boundary
We will implement the **SECP Geometry API**, a kernel-agnostic layer that wraps the underlying CAD kernel. This ensures that SECP can swap or supplement kernels without rewriting higher-level parametric features.

## 5. Risk Assessment

| Risk Type | Description | Mitigation |
| :--- | :--- | :--- |
| **Performance** | WASM overhead for large models. | Move heavy tasks to Server Workers via Native OCCT. |
| **WASM Binary Size** | OCCT WASM can be >30MB. | Lazy loading, dynamic chunking, and selective feature inclusion. |
| **Licensing** | LGPL compliance. | Keep OCCT as a dynamically linked/imported module; avoid monolithic static linking. |
| **Robustness** | Numerical instabilities in Boolean ops. | Implement rigorous Shape Healing and tolerance management. |

## 6. Migration Plan
1. **Phase 1 (PoC):** Implement `OcctKernelAdapter` for basic Box/Boolean operations.
2. **Phase 2 (Validation):** Replace `CadFidelityValidator` mocks with real OCCT-backed comparisons.
3. **Phase 3 (Feature Parity):** Move all existing primitive generation to OCCT.
4. **Phase 4 (Advanced):** Implement Fillets, Chamfers, and Advanced Shell operations.

## 7. First Proof-of-Concept (PoC) Specification
- Create a Box (100x100x100) using OCCT.
- Perform a Boolean Cut with a Cylinder.
- Apply a 5mm Fillet to the resulting edges.
- Export as STEP AP242.
- Re-import and verify Volume and Surface Area fidelity.
