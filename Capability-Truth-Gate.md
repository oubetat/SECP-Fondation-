# SECP Capability Truth Gate
**Version:** 2026.09.05-TRUTH-003  
**Status:** PASS — Capability Truth Gate Enforced  
**Objective:** Erect a mathematical boundary layer between front-end representation and back-end execution, ensuring the user interface strictly reports engineering reality rather than manufacturing fake successes.

---

## A. Capability State Model

The SECP Truth Gate defines a strict, 6-level hierarchical capability state classification. Each level represents a higher tier of engineering proof:

```
                  [TRUTH PRECEDENCE PYRAMID]
                              
                              ▲
                             / \
                            /   \     [Level 5: VERIFIED] (Full evidence)
                           /     \    [Level 4: CONNECTED] (SOT connected)
                          /       \   [Level 3: IMPLEMENTED] (Code exists)
                         /         \  [Level 2: AVAILABLE] (Known in registry)
                        /           \ [Level 1: UNAVAILABLE] (Disconnected)
                       /_____________\ [Level 0: NOT_SUPPORTED] (No kernel)
```

1. **NOT_SUPPORTED:**
   * *Definition:* The capability is completely absent from the geometric kernel and cannot be evaluated.
   * *UI Output:* `"Not supported by the current engineering backend."`
2. **UNAVAILABLE:**
   * *Definition:* The capability is known in the registry or UI, but its connected evaluator path or action handler is currently disconnected.
   * *UI Output:* `"Currently unavailable — kernel evaluator not connected."`
3. **AVAILABLE:**
   * *Definition:* The capability is registered and a backend feature exists, but the user interface has not yet been hooked up to it.
   * *UI Output:* `"Available — backend capability defined."`
4. **IMPLEMENTED:**
   * *Definition:* A physical implementation exists in the backend engineering pipelines and has repo-level verification, but it is not connected to the main active SOT writing paths.
   * *UI Output:* `"Implemented — not yet connected to the canonical UI path."`
5. **CONNECTED:**
   * *Definition:* The tool is fully wired to the canonical pipeline (`User → Intent → EngineeringDocument → Evaluator → Kernel`). It writes actual changes to the document and initiates mesh generation, but formal regression/test verification is pending.
   * *UI Output:* `"Connected — verification pending."`
6. **VERIFIED:**
   * *Definition:* The tool is fully wired, executes successfully, and possesses verified mathematical/topological test evidence (B-Rep face changes, geometric hashes) confirmed by active test suites.
   * *UI Output:* `"Verified"` (accompanied by cryptographically signed evidence indicators).

---

## B. Truth Resolver Mechanism

The resolver is implemented in `/src/engine/cad-kernel/registry/CapabilityTruthGate.ts` as `CapabilityTruthGate.resolve(toolId)`.

```
  [UI Tool Selection]
           │
           ▼
  [Fetch Tool Contract] ──► (No Contract) ──► [NOT_SUPPORTED]
           │
           ▼
  [Check Feature / Kernel] ──► (Missing / Bypassed) ──► [UNAVAILABLE]
           │
           ▼
  [Check Canonical Path] ──► (React State Only) ──► [UNAVAILABLE]
           │
           ▼
  [Check Evidence & Tests] ──► (No Test File) ──► [CONNECTED]
           │
           ▼
     [VERIFIED State]
```

---

## C. UI Integration Rules

To comply with the SECP architectural rules, frontend components are **STRICTLY FORBIDDEN** from defining or showing successes internally.

1. **Rule of Separation:**
   * UI components must only manage rendering states (e.g., `isOpen`, `isLoading`). They must **never** host an internal `isVerified` or `isSuccessful` state.
2. **Dynamic Querying:**
   * Instead of hardcoding `status = "Success"`, buttons and status text rows must dynamically query `CapabilityTruthGate.resolve(toolId)` and render the exact, truthful message returned.
3. **Execution Guards:**
   * Before executing a design tool, the front-end must check `CapabilityTruthGate.verifyExecution()`. If a tool is `UNAVAILABLE` or `NOT_SUPPORTED`, click handlers must abort and output the direct diagnostic message.

---

## D. Tool Truth Matrix

Evaluating the actual, audited status of SECP tools as enforced by the Truth Gate:

| Tool ID | UI Exists | Backend | Canonical Path | Kernel | Verification | Resolved Truth State |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **SKETCH_LINE** | ✓ | ✓ | ✓ | ✓ | ✓ | **VERIFIED** |
| **SKETCH_CIRCLE** | ✓ | ✓ | ✓ | ✓ | ✓ | **VERIFIED** |
| **CONSTRAINT_COINCIDENT**| ✓ | ✓ | ✓ | ✓ | ✓ | **VERIFIED** |
| **FEATURE_EXTRUDE** | ✓ | ✓ | ✓ | ✓ | ✓ | **VERIFIED** |
| **ASSEMBLY_MATE_COINCIDENT**| ✓ | ✓ | ✓ | ✓ | ✓ | **VERIFIED** |
| **FEATURE_FILLET** | ✓ | ✓ | ✗ | ✗ | ✗ | **UNAVAILABLE** |
| **MOLD_TOOLING_SPLIT** | ✓ | ✗ | ✗ | ✗ | ✗ | **UNAVAILABLE** |
| **SURFACE_TRIM** | ✓ | ✗ | ✗ | ✗ | ✗ | **NOT_SUPPORTED** |
| **SHEET_METAL_FOLD** | ✓ | ✗ | ✗ | ✗ | ✗ | **NOT_SUPPORTED** |

---

## E. False Success Audit (Banned Patterns Locator)

A repository-wide audit has identified locations where front-end components manufacture simulated success indications using hardcoded states, timers, or random variables.

### 1. Hardcoded Evidence Timelines
* **File:** `/src/components/SketchEditorPanel.tsx` (lines 655, 674, 691)
* **Code pattern:**  
  `evidenceHash: "EPC-SPL-" + Math.random().toString(36).substr(2, 6).toUpperCase()`
* **Diagnostic:** Manufactures dummy evidence strings in the design list instead of sourcing SHA-256 blocks from `EngineeringHashChain`.

### 2. CFD Navier-Stokes Simulation Progress
* **File:** `/src/components/cfd/TurbulenceWorkspace.tsx` (lines 62-67)
* **Code pattern:**  
  `setTimeout(() => { setProgress(prev => Math.min(prev + Math.random() * 15, 100)); }, 800);`
* **Diagnostic:** Uses `setTimeout` and `Math.random()` to generate a visual convergence loop, independent of the loaded geometry's volume or boundary conditions.

### 3. Kinematic Solver Solver Status
* **File:** `/src/components/assembly/NonlinearSolverWorkspace.tsx`
* **Code pattern:**  
  `setSolverVerdict("CONVERGED")` via client-side delay wrappers.
* **Diagnostic:** Triggers a "Converged" message upon completion of a timer, bypassing the core mathematical matrices of `AssemblyMateSolver.ts`.

---

## F. Evidence Mapping (VERIFIED Status Anchors)

The `VERIFIED` statuses of the tools in our truth matrix are anchored directly to real, executable test files inside `/src/verification/`:

* **SKETCH_LINE & SKETCH_CIRCLE:**
  * *Evidence Anchor:* `/src/verification/patch326/__tests__/PATCH-326-CanonicalRuntimeIntegration.test.ts` (Validates canonical sketches, points creation, and monotonic revision increments).
* **FEATURE_EXTRUDE:**
  * *Evidence Anchor:* `/src/verification/patch035/__tests__/PATCH-035-SOT-Control.test.ts` (Ensures SOT remains unbroken during 3D solid evaluations and prevents direct mutations of viewport caches).
* **ASSEMBLY_MATE_COINCIDENT:**
  * *Evidence Anchor:* `/src/verification/patch040/__tests__/PATCH-040-KinematicStateAndEvidence.test.ts` (Validates coordinate placement transformations and kinematic constraint resolution).
* **CONSTRAINT_COINCIDENT:**
  * *Evidence Anchor:* `/src/verification/patch039b/__tests__/PATCH-039B-HierarchicalAssemblyConstraints.test.ts` (Validates hierarchical multi-document constraints solvers).
