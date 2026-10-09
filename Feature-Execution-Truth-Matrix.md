# Feature Execution Truth Matrix (SECP Forensic Audit)

This document maps all currently exposed Feature-related UI tools in the SECP Industrial OS v2 platform to their actual backend execution paths, verifying whether a true parametric writing path exists from user action to canonical B-Rep solid boundary representation mutation.

---

## 1. Core Architectural Pipeline

For a feature to be classified as **VERIFIED / PROVEN (PASS)**, it must write directly to the `EngineeringDocument` (Single Source of Truth), propagate through the `DocumentEvaluator`, execute in the `BRepKernel` (or its designated engine), mutate the active solid's boundary representation, and emit evidence for automated gate verification. 

If any segment of this path is broken, isolated, simulated, or missing, the status is mathematically classified as **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN**.

```
    [User Action]
          │
          ▼
   [UI / Controller]
          │
          ▼
 [EngineeringDocument] (SOT) ────[Write Proved?]
          │                             │
          ▼ (Yes)                       ▼ (No)
  [DocumentEvaluator]          [Isolated Engine] (Memory/Mocks Only)
          │                             │
          ▼                             ▼
    [BRepKernel]                 [Local UI Renders]
          │                             │
          ▼                             ▼
  [B-Rep Solid Mutation]       [ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN]
          │
          ▼
 [Acceptance Gate Verification]
```

---

## 2. Feature Execution Matrix

| Feature Tab / Module | Source File & Entry Point | Action | Target / SOT | Canonical Document Write | Evaluator | Kernel | B-Rep Mutation | Gate / Test File Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PATCH-007 Feature** (Feature Tree) | `/src/engine/cad-kernel/ui-integration/SketchUIIntegration.ts` (Line 17) | `applyExtrudeAction(...)` | `EngineeringDocument` SOT | **YES** (`doc.features.push(...)`, Line 28) | `DocumentEvaluator` (`evaluate()`, Line 43) | `FeatureExecution.ts` (`FeatureExecutor.execute`, Line 40) | **YES** (Mutates solid faces, edges, vertices via `BooleanEngine`) | `HardAcceptanceGate158.ts` / `HardAcceptanceGate159.ts` | **REAL CANONICAL FEATURE (PASS / VERIFIED)** |
| **PATCH-320 RecognizedFeature** (Geometric Recognition) | `/src/engine/reverse_engineering/features/FeatureRecognitionEngine320.ts` (Line 45) | `segment(...)` / `detectPrimitives(...)` | `FeatureRecognitionSession320` | **NO** (Saves to local memory session; does not write to core `EngineeringDocument` features) | **NO** (No evaluation via `DocumentEvaluator`) | `GeometryFittingUtils320.ts` (Least-squares fitting, Line 79) | **NO** (Does not modify core B-Rep active solid) | `HardAcceptanceGate320.ts` (Verifies mathematical accuracy on static dataset) | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |
| **PATCH-324 ParametricFeature** (Parametric Tree) | `/src/components/ParametricFeatureWorkbenchPanel.tsx` | Local candidate analysis | UI local state | **NO** (No document edit) | **NO** | `SolidGeometryKernel.ts` (Isolated) | **NO** | None | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |
| **PATCH-255 ManufacturingFeature** (Manufacturing Semantics) | `/src/engine/features/ManufacturingSemantics.ts` (Line 22) | `tagFeature(...)` | `ManufacturingSemanticsManager` local map | **NO** (Writes to local key-value store, not the core `EngineeringDocument` SOT) | **NO** | None | **NO** | None | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |
| **PATCH-206 Direct Modeling** (Direct Modeling Engine) | `/src/engine/cad/direct/DirectModelingEngine.ts` (Line 30) | `executeOperation(...)` | Transactional State | **NO** (Operates on memory mocks (`brep_initial_hash_123`)) | **NO** | `DirectModelingEngine.ts` | **NO** (Does not write back to live scene solid) | `HardAcceptanceGate206.ts` (Runs transaction assertions on static mockup) | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |
| **PATCH-208 Pattern** (Pattern Engine) | `/src/engine/cad/pattern/PatternEngine.ts` (Line 16) | `createLinearPattern(...)` | Pattern local list | **NO** (Disconnected from active `EngineeringDocument`) | **NO** | `PatternEngine.ts` | **NO** (No solid modification) | `HardAcceptanceGate208.ts` (Evaluates grid/polar coordinate math in isolation) | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |
| **PATCH-209/210 Hybrid/Design Intent** (Stubs / Challenges) | `/src/components/HybridModelingInspector.tsx`, `/src/components/DesignIntentInspector.tsx`, `/src/components/ProductionCadInspector.tsx` | UI buttons / Zero-code challenges | UI-only simulation | **NO** | **NO** | None | **NO** | Static UI tests | **ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN** |

---

## 3. Detailed Forensic Evidence & Traces

### A. PATCH-007 Feature (Feature Tree / Extrude)
*   **Traced Path**: Clicking "Extrude" in the sketch workspace triggers `SketchUIIntegration.applyExtrudeAction`.
*   **Source Code (Write)**:
    ```typescript
    // In /src/engine/cad-kernel/ui-integration/SketchUIIntegration.ts:
    const newFeature: ExtrudeFeatureDefinition = {
        featureId,
        type: 'EXTRUDE',
        name: `Extrusion ${doc.features.length + 1}`,
        parameters: { ...params }
    };
    doc.features.push(newFeature); // SOT updated!
    ```
*   **Source Code (Evaluation & Kernel execution)**:
    ```typescript
    // In /src/engine/cad-kernel/document/DocumentEvaluator.ts:
    for (const feat of doc.features) {
        FeatureExecutor.execute(feat, context); // Triggers BRepKernel/BooleanEngine
    }
    ```
*   **Test Proof**: `HardAcceptanceGate158.ts` dynamically runs feature list construction, executes B-Rep extrusions, and verifies the generated 3D solid model.

### B. PATCH-320 RecognizedFeature (Geometric Recognition)
*   **Traced Path**: User runs Gate 320. The UI triggers `FeatureRecognitionEngine320.runRecognition()`.
*   **Source Code (Processing)**:
    ```typescript
    // In /src/engine/reverse_engineering/features/FeatureRecognitionEngine320.ts:
    public static segment(session: FeatureRecognitionSession320, mesh: HealedMeshDataset): void {
        // Populates session.segments, but does not modify EngineeringDocument.
    }
    ```
*   **Why It Fails SOT Write**: The resulting features reside in `FeatureRecognitionSession320` and are displayed in the workbench, but they are never committed to `EngineeringDocument.features` or parsed by the main evaluator to mutate the actual CAD B-Rep solid model.

### C. PATCH-206 Direct Modeling
*   **Traced Path**: Direct modeling inspector starts transaction offsets.
*   **Source Code**:
    ```typescript
    // In /src/engine/cad/direct/DirectModelingEngine.ts:
    public beginTransaction(brepHash: string, selection: SelectionEntity[], type: DirectModelingOperationType, parameters: any): DirectModelingTransaction {
        // Returns isolated transaction object.
    }
    ```
*   **Why It Fails SOT Write**: This class serves as an isolated mathematical sandbox for the transaction. The mutations do not write to `EngineeringDocument`, remaining invisible to the main viewport render.

### D. PATCH-208 Pattern
*   **Traced Path**: Pattern engine generates instances in local state.
*   **Source Code**:
    ```typescript
    // In /src/engine/cad/pattern/PatternEngine.ts:
    public createLinearPattern(name: string, sourceFeatures: string[], def: LinearPatternDefinition): PatternFeature {
        // Pushes to this.patterns list in local engine instance.
    }
    ```
*   **Why It Fails SOT Write**: `PatternEngine` acts as an isolated solver. No link exists to serialize these pattern features back to the `EngineeringDocument` SOT, nor is there a viewport rebuilder mapping these instances to B-Rep face duplications on the active solid model.

---

## 4. Architectural Verification Verdict

*   **Verified Pipeline Count**: **1 of 7** (Only `PATCH-007` possesses a verified, end-to-end writing path to the canonical B-Rep solid).
*   **Unverified Pipeline Count**: **6 of 7** (Classified as `ARCHITECTURALLY DECLARED / EXECUTION NOT PROVEN`).
*   **Conclusion**: The system possesses a robust canonical CAD core for basic features (Extrude), but advanced feature modules (Recognition, Direct Modeling, Patterning, and Semantics) operate as isolated algorithms. They are verified in sandbox test cases, but are **NOT** end-to-end integrated into the single source of truth (`EngineeringDocument`) pipeline.
