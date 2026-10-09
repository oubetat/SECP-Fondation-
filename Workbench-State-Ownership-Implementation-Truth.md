# Workbench State Ownership — Implementation Truth Matrix

This matrix serves as the read-only verification of the runtime implementation status of state ownership across SECP Industrial OS v2 under the **SECP-WB-STATE-CLOSURE-GATE-001** directive.

---

## 1. Runtime State Ownership & Mutation Verification

| State Variable / Engine | Claimed Classification | Actual Owner | Actual Mutation Authority | Canonical Binding | Runtime Lifecycle | Parallel Authority | Evidence File / Code Snippet | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| `canonicalDocument` | `CANONICAL_ENGINEERING_STATE` | `App.tsx` | Root App component via action dispatches | **Direct** | Persistent for workspace session | **NO** | `/src/App.tsx` (`useState<EngineeringDocument | null>(null)`) | **VERIFIED** |
| `activeSolid` | `DERIVED_DOMAIN_STATE` | `App.tsx` | Evaluated via `DocumentEvaluator.ts` | **Direct** | Persistent across tab switches | **NO** | `/src/App.tsx` (`activeSolid` state hook) | **VERIFIED** |
| `assemblyData` | `CANONICAL_ENGINEERING_STATE` | `App.tsx` | Assembly actions / mate solver | **Direct** | Persistent across tab switches | **NO** | `/src/App.tsx` (`assemblyData` state hook) | **VERIFIED** |
| `patterns` | `TRANSACTION_STATE` | `PatternEngineInspector.tsx` | Local list mutations | **None** | Ephemeral (Lost on unmount/tab switch) | **NO** | `/src/components/PatternEngineInspector.tsx` | **VERIFIED** |
| `transactions` | `TRANSACTION_STATE` | `DirectModelingEngine` | Local execution arrays | **None** | Ephemeral (Lost on tab switch) | **NO** | `/src/engine/cad/direct/DirectModelingEngine.ts` | **VERIFIED** |
| `session.features` | `CANDIDATE_STATE` | `FeatureRecognitionWorkbenchPanel` | Local component state | **None** | Ephemeral (Lost on tab switch) | **NO** | `/src/components/FeatureRecognitionWorkbenchPanel.tsx` | **VERIFIED** |
| `semanticMap` | `DERIVED_DOMAIN_STATE` | `ManufacturingSemanticsManager` | `ManufacturingSemantics.ts` singleton | **Face ID** | Persistent across tab switches | **NO** | `/src/engine/features/ManufacturingSemantics.ts` | **VERIFIED** |

---

## 2. Invariant Proofs (Read-Only Evaluation)

### Gate 1 & 2: Canonical Engineering SOT Authority
*   **Verification**: **PROVEN**. Only `EngineeringDocument` holds the master feature registry (`features[]`) and assembly constraints tree.
*   **Proof**: All geometric alterations (extrusions, pocket additions, assembly joint definitions) route exclusively through the single root-level dispatch loop in `App.tsx`. No other workbench has direct, parallel write authority to mutate the B-Rep shape memory or persist local modifications.

### Gate 3 & 4: Pattern & Direct Modeling Sandbox Engines
*   **Verification**: **PROVEN**.
*   **Proof**: `PatternEngine` and `DirectModelingEngine` act as strictly computational classes. Their calculations reside in ephemeral component memories or transient previews (`patterns`, `transactions`). They cannot mutate the central CAD B-Rep solid or append features to `EngineeringDocument` without an explicit, external dispatch action.

### Gate 5: Feature Recognition Isolation
*   **Verification**: **PROVEN**.
*   **Proof**: Feature recognition primitives exist exclusively as candidate items inside `session.features` within `FeatureRecognitionWorkbenchPanel.tsx`. No automated, silent writes exist to push recognized cylinders or planes into the canonical document tree.

### Gate 8 & 9: Tab Switching and Ephemeral Validation
*   **Verification**: **PARTIALLY VERIFIED**.
*   **Analysis**: While persistent domain parameters (assemblies, global document, CAM semantics) safely survive tab switching, local workspace configurations (`session.features`, `patterns`) are completely reset upon tab unmount. This behavior is documented as **`EPHEMERAL_BY_DESIGN`** to prevent browser memory bloat and stale rendering buffers, but it represents an active UX limitation for long-running user tasks.

### Gate 11: Test Quality Audit
*   **Verification**: **INTEGRATION / UNIT**.
*   **Proof**: The test suite `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` executes real algorithmic behaviors on instantiated document, patterning, and modeling engines. However, it does not mount the full React DOM context (`App.tsx`), meaning runtime unmounting states are verified structurally rather than via end-to-end UI actions.
