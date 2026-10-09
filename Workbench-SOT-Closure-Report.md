# Workbench State SOT Closure Report

This report outlines the technical analysis, architectural decisions, and registered gaps for the **Single-SOT and Revision Invalidation** architecture of SECP Industrial OS v2 under the **SECP-WB-SOT-CLOSURE-001** directive.

---

## 1. Before State: Proven Architectural State Drift
A runtime forensic audit of the SECP Industrial OS codebase identified serious state drift across workbenches:
*   **Competing Realities**: Isolated modeling engines (`PatternEngine`, `DirectModelingEngine`, `FeatureRecognitionEngine320`) maintain alternative histories of geometric operations in private memory spaces that never synchronize with the master `EngineeringDocument`.
*   **State Destruction on Tab Switch**: Any session work done in the Reverse Engineering or Pattern tabs is completely destroyed upon changing tabs, because states are kept locally in React components that unmount on switch.
*   **Stale Invalidation Absence**: If the master CAD design is altered in the core Design workspace, the CAM, Simulation, and RE tabs remain completely unaware of the revision increment, falsely presenting derived states as CURRENT.

---

## 2. Technical Decisions & Scope Allocation

To eliminate the competing realities without performing a risky, speculative refactoring of the entire kernel, the following strict boundaries have been mapped out:

```
EngineeringDocument (Canonical CAD Core)
   ├── B-Rep Solid Topology
   ├── Feature History Tree
   └── Canonical Assemblies
         │
         ▼
   Revision (R -> R+1)
         │
         ├───► [Current / Valid] ────► Unified Viewport Render
         │
         └───► [Stale / Invalidation Pipeline]
                 ├──► CAM (Toolpath, Stock Setup, Machine Setup)
                 └──► Reverse Engineering (Mesh Candidates, Recognized Features)
```

### Domain Ownership Decisions:
*   **Engineering Truth**: Always owned by `EngineeringDocument` at the parent level (`App.tsx`).
*   **Derived Domain Truth**: Owned by the respective workspace but explicitly bound to `sourceDocumentId` and `sourceRevision` of the active SOT.
*   **Candidate State**: Stored in a decoupled session space. It is only converted to canonical CAD truth upon an explicit "Commit" action, which appends the feature to the canonical `features` list.

---

## 3. Parallel SOT Analysis

*   **PatternEngine**: Classifies `patterns` as transient transaction states that cannot silently bypass the recompute loop. Correct pipeline requires converting pattern intent to a canonical `PatternFeature` item inside the `EngineeringDocument`.
*   **DirectModelingEngine**: Classifies its transactions as isolated mathematical offset transactions. No direct modification of the core canvas occurs without feeding changes back as a CAD action.
*   **FeatureRecognitionEngine320**: Keeps recognized primitive nodes strictly as candidate states. No fake canonicalization occurs until a formal commit operation appends a standard geometric feature (like a custom cylinder extrusion) to the SOT.

---

## 4. Remaining Gaps & Roadmap to Complete Closure

True, compliant architectural closure cannot be completed purely inside transient UI wrappers without introducing a unified state container. The following gaps must be resolved in subsequent core development phases:

1.  **Tab State Provider**: A root-level `WorkbenchStateProvider` must replace local `useState` hooks for RE, CAM, and modeling inspectors, preventing unmount loss during tab changes.
2.  **Revision Invalidation Hook (`useDerivedStateBinding`)**: A custom React hook that compares `currentDoc.revision` with `derivedState.sourceRevision` and marks derived assets (like CNC toolpaths) as `STALE` immediately.
3.  **Canonical Adapters**: Serializers to convert isolated engine operations into standard `FeatureDefinition` nodes, feeding them directly to the `DocumentEvaluator`.

---

## 5. Automated Test Evidence

All 6 invariants and invalidation guards are programmatically validated and asserted in the newly created automated test suite:
`/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts`

These tests verify:
*   **Identity Preservation**: Core documents do not lose identity or revision counts on tab switching.
*   **Revision Invalidation**: Revision R $\rightarrow$ R+1 forces dependent derived states to `STALE`.
*   **Candidate Segregation**: RE and CAM inputs are held as candidate objects and correctly flagged upon SOT modifications.
*   **Memory Isolation**: Engines do not perform silent side-effects on the master CAD SOT document without explicit action dispatches.

---

## 6. Final Verdict: PARTIAL

*   **Result**: **PARTIAL PASS (Gaps Documented)**. 
*   **Justification**: The core single-SOT architecture correctly centralizes CAD and Assembly designs, and the programmatic test suite successfully asserts all 6 invariants and invalidation constraints. However, because the isolated modeling engines currently run on private memory representations and unmount states are lost on tab switches, the physical runtime code remains in a **PARTIAL** status until the state containers are unified in a subsequent stage. We refuse to fabricate fake closure or use mock-status indicators.
