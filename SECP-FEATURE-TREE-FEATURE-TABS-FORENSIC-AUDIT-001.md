# SECP — FEATURE TREE / FEATURE TABS / FEATURE STATE FORENSIC AUDIT
**AUDIT ID:** `SECP-FEATURE-TREE-FEATURE-TABS-FORENSIC-AUDIT-001`  
**DATE:** September 6, 2026  
**MODE:** STRICT READ-ONLY FORENSIC AUDIT  
**AUDIT TARGET:** SECP CAD/CAM/CAE Industrial OS — Feature Trees, Feature Workbenches, Feature Inspectors, Parametric History, and State Containers

---

## 1. EXECUTIVE SUMMARY & VERDICT

### 1.1 Overall Architecture Verdict: 🟡 PARTIALLY CLOSED (Canonical SOT Verified / Capability Delta Audit Required)
The forensic investigation confirms that **`EngineeringDocument` is the sole authoritative Single Source of Truth (SOT) for CAD/Assembly Feature History in the SECP Architecture**.

- **G1 — EngineeringDocument as SOT:** 🟢 **CLOSED / PROVEN** for core canonical pipeline.
- **G2 — FeatureTreePanel as Canonical Projection:** 🟢 **CLOSED / PROVEN**.
- **G3 — Feature Mutation & Revision Lineage:** 🟢 **CLOSED / PROVEN** for canonical UI actions.
- **G4 — Sandboxes & Domain Engine Isolation:** 🟡 **PARTIALLY PROVEN** (Specialized engines require formal capability-boundary certification).
- **G5 — Capability Delta & Non-Duplication:** 🔴 **NOT YET CLOSED** (Transferred to dedicated audit `SECP-FEATURE-TAB-CAPABILITY-TRUTH-AUDIT-002`).

**Calibration Note:** Tab Count ≠ Engineering Capability Count. Sandboxes, stubs, and specialized generators must not be conflated with production canonical modeling capabilities.

---

## 2. COMPLETE INVENTORY OF ALL FEATURE TREES & FEATURE SURFACES

| Surface / Component | File Location | UI Tab / Patch | Visual Technology | Primary Data Source | Authority Classification | Mutation Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Feature Tree & History Panel** | `src/components/FeatureTreePanel.tsx` | `PATCH-007`, `PATCH-034` | React + Lucide Icons + Tailwind | `CanonicalDocumentUIAdapter.getDerivedFeatureHistory(doc)` | `CANONICAL PROJECTION` | `CanonicalDocumentUIAdapter.executeSuppressFeature` / `executeDeleteFeature` |
| **Properties & Parameter Inspector** | `src/components/PropertiesPanel.tsx` | `PATCH-007`, `PATCH-324` | React + Motion + Tailwind | `canonicalDocument.features.find(...)` | `CANONICAL INSPECTOR` | `CanonicalDocumentUIAdapter.executeUpdateFeatureParameter` |
| **Sketcher & Design History Tree** | `src/components/SketchEditorPanel.tsx` | `PATCH-034` | React + HTML5 Canvas + `<FeatureTreePanel />` | `CanonicalDocumentUIAdapter.getDerivedDesignTree(doc)` | `CANONICAL PROJECTION & MUTATOR` | `CanonicalDocumentUIAdapter.executeSketchAction` / `executeExtrudeAction` |
| **Parametric Feature Workbench** | `src/components/ParametricFeatureWorkbenchPanel.tsx` | `PATCH-324`, `PATCH-325` | React + HardAcceptanceGate324/325 | `canonicalDocument.features` (fallback `localTree`) | `CANONICAL ADAPTER & MUTATOR` | Direct immutable doc update + `DocumentEvaluator.evaluate()` |
| **Assembly Engine & Constraint Tree** | `src/components/AssemblyEnginePanel.tsx` | `PATCH-008`, `PATCH-043` | React + AssemblyCore + Gate043 | `canonicalDocument.assembly.instances` & `mates` | `CANONICAL PROJECTION & INTENT MUTATOR` | `onAssemblyIntent` -> `CanonicalDocumentUIAdapter.executeAssemblyAction` |
| **Assembly Workspace & Occurrences** | `src/components/AssemblyWorkspace.tsx` | `PATCH-211`–`PATCH-214` | React + ComponentInsertionService + Gates | `canonicalDocument.assembly.instances` & `mates` | `CANONICAL PROJECTION` | `onCanonicalUpdate(doc)` |
| **Direct Modeling Inspector** | `src/components/DirectModelingInspector.tsx` | `PATCH-206` | React + DirectModelingEngine | Local `new DirectModelingEngine()` | `SANDBOX / PROTOTYPE` | Local transaction log (No SOT conflict) |
| **Hybrid Modeling Inspector** | `src/components/HybridModelingInspector.tsx` | `PATCH-207` | React UI Card | Static stub text | `UI STATE / STUB` | None (Read-only static) |
| **Pattern Engine Inspector** | `src/components/PatternEngineInspector.tsx` | `PATCH-208` | React + PatternEngine | Local `new PatternEngine()` | `SANDBOX / PROTOTYPE` | Local pattern list (No SOT conflict) |
| **Feature Recognition Workbench** | `src/components/FeatureRecognitionWorkbenchPanel.tsx` | `PATCH-320` | React + FeatureRecognitionEngine320 | `FeatureRecognitionSession` | `DOMAIN ANALYSIS ENGINE` | Segment/Classify scan mesh (Upstream to RE) |
| **NURBS / Surface / B-Rep Reconstruction** | `src/components/*ReconstructionWorkbenchPanel.tsx` | `PATCH-321`–`PATCH-323` | React + Reconstruction Engines | Local reconstruction sessions | `DOMAIN RECONSTRUCTION PIPELINE` | Point-cloud fitting pipeline stages |
| **Machinery Workspaces (Shaft, Gear, Spring)** | `src/components/*EngineeringWorkspace.tsx` | `PATCH-222`–`PATCH-224` | React + Shaft/Gear/Spring Generators | Local `currentShaft.featureTree`, etc. | `DOMAIN GENERATOR` | Parametric component DAG synthesis |
| **Natural Language CAD Copilot** | `src/components/NaturalLanguageCADWorkbenchPanel.tsx` | `PATCH-024` | React + NaturalLanguageCADService | `NaturalLanguageCADService.getKernel().getFeatureTree()` | `AI STAGING TREE` | `approveAndCommitDesign()` staging pattern |
| **CAM Manufacturing Feature Workspace** | `src/components/cam/ManufacturingFeatureWorkspace.tsx` | `PATCH-255`, `PATCH-263` | React + ManufacturingFeatureEngine | Evaluated B-Rep solid -> Manufacturing features | `DERIVED CAM PROJECTION` | Manual feature classification overrides |
| **Legacy FeatureTreeEngine / Manager** | `src/engine/featureTree.ts`, `FeatureTreeManager.ts` | Legacy Core, `PATCH-035` | TypeScript Engine Class | Static initial DAG | `LEGACY COMPATIBILITY ARTIFACT` | Inert JSON export schema |

---

## 3. DEEP DIVE: CANONICAL FEATURE PIPELINE FORENSIC PROOF

### 3.1 `FeatureTreePanel.tsx` (The Primary Canonical Feature Tree)
```typescript
// Evidence from src/components/FeatureTreePanel.tsx
export function FeatureTreePanel({ canonicalDocument, selectedFeatureId, onSelectFeature, onToggleSuppression, onDeleteFeature }: FeatureTreePanelProps) {
  // Pure derivation from Canonical Document
  const features = useMemo(() => {
    if (!canonicalDocument) return [];
    return CanonicalDocumentUIAdapter.getDerivedFeatureHistory(canonicalDocument);
  }, [canonicalDocument]);
```
- **Evidence of SOT Derivation:** The tree is computed via `useMemo` strictly from `canonicalDocument`.
- **Evidence of Deterministic Lineage:** Every feature rendered displays an `evidenceHash` derived from `f.definitionHash`, verifying cryptographic provenance.
- **Evidence of Immutable Mutation:** In `App.tsx`, toggle suppression and delete actions execute via:
  ```typescript
  const { result, evaluation } = CanonicalDocumentUIAdapter.executeSuppressFeature(canonicalDocument, id);
  if (result.success && evaluation) {
    applyCanonicalEvaluation(evaluation);
  }
  ```
  This creates an immutable copy of `EngineeringDocument`, increments `doc.revision`, executes `DocumentEvaluator.evaluate()`, updates `doc.derived.mesh`, and updates the top-level application state.

### 3.2 `PropertiesPanel.tsx` (Parametric Value Editing)
- **Draft Separation:** Employs `draftValues` state to isolate active text typing in input fields from the true canonical document.
- **Commit Guard:** When a user confirms/commits a parameter change (`handleParamCommit`), it calls:
  ```typescript
  const { result, evaluation } = CanonicalDocumentUIAdapter.executeUpdateFeatureParameter(
    canonicalDocument, featureId, paramId, newValue
  );
  if (result.success && evaluation) {
    onCanonicalUpdate(evaluation.document);
  }
  ```
- **No Stale Drift:** Once committed, the draft is cleared, and the component immediately re-renders the new evaluated state from `canonicalDocument`.

### 3.3 `SketchEditorPanel.tsx` (SolidWorks-Style Design History)
- Derives design tree from `CanonicalDocumentUIAdapter.getDerivedDesignTree(canonicalDocument)`.
- Mounts `<FeatureTreePanel />` directly inside its sidebar.
- Dispatches sketch and extrude actions directly through `CanonicalDocumentUIAdapter.executeSketchAction` / `executeExtrudeAction`.

### 3.4 `ParametricFeatureWorkbenchPanel.tsx` (Scan-to-CAD Reverse Engineering)
- **Priority Resolution:**
  ```typescript
  if (canonicalDocument?.features && canonicalDocument.features.length > 0) {
    return {
      id: canonicalDocument.documentId,
      features: canonicalDocument.features.map(...),
      version: Number(canonicalDocument.revision)
    };
  }
  return localTree;
  ```
- **Mutation Path:** When a parameter is edited in `handleParameterChange`, if `canonicalDocument` exists, it increments `revision`, evaluates via `DocumentEvaluator.evaluate()`, and invokes `onCanonicalUpdate(evalResult.document)`.

---

## 4. ASSEMBLY TREE & OCCURRENCE FORENSIC PROOF

### 4.1 `AssemblyEnginePanel.tsx` (PATCH-008 / PATCH-043)
- Derived directly from `canonicalDocument.assembly.instances` and `canonicalDocument.assembly.mates` (synchronized via `useEffect`).
- Mutations are dispatched via `onAssemblyIntent(action)` where `action: AssemblyIntentAction`.
- In `App.tsx`, `handleAssemblyIntent` passes the action to `CanonicalDocumentUIAdapter.executeAssemblyAction(canonicalDocument, action, resolver)`.
- `AssemblyIntentMutator.apply()` applies the mate/instance mutation to `EngineeringDocument`, increments `revision`, and runs `DocumentEvaluator.evaluate()`.

### 4.2 `AssemblyWorkspace.tsx` (PATCH-211 to PATCH-214)
- Derives occurrence instances via `instances = useMemo(() => canonicalDocument?.assembly?.instances || [], [canonicalDocument])`.
- Derives constraints via `constraints = useMemo(() => canonicalDocument?.assembly?.mates || canonicalDocument?.assembly?.constraints || [], [canonicalDocument])`.
- Fully integrated into canonical state updates via `onCanonicalUpdate={setCanonicalDocument}`.

---

## 5. ANALYSIS OF SPECIALIZED & DOMAIN SURFACES

### 5.1 Direct Modeling & Pattern Engine (`PATCH-206`, `PATCH-208`)
- Both `DirectModelingInspector` and `PatternEngineInspector` are isolated algorithmic validation harnesses.
- They instantiate their respective engines locally (`useState(() => new DirectModelingEngine())`, `useState(() => new PatternEngine())`).
- They do not mutate or overwrite `canonicalDocument`. They serve as sandbox test benches.

### 5.2 AI Copilot (`NaturalLanguageCADWorkbenchPanel` / `PATCH-024`)
- Implements a classic **Staging / Propose-and-Commit** architecture.
- Prompts generate candidate feature trees in the local AI kernel. Users can tweak parameters in the live preview.
- Clicking "Approve & Commit" calls `approveAndCommitDesign()` to emit an official engineering release artifact.

### 5.3 CAM Manufacturing Features (`ManufacturingFeatureWorkspace` / `PATCH-255`)
- CAM features (pockets, holes, slots, milling setups) are **derived manufacturing interpretations** computed from the evaluated B-Rep solid geometry.
- They do not alter CAD design intent; they augment the design with tooling and CNC manufacturing operations.

---

## 6. VERIFICATION GATE EVIDENCE MATRIX

| Verification Target | Gate / Validator | Status | Evidence Description |
| :--- | :--- | :--- | :--- |
| **Feature Derivation Integrity** | `CanonicalDocumentUIAdapter.getDerivedFeatureHistory` | 🟢 PASS | Maps `EngineeringDocument.features` to UI view models with definition hashes |
| **Feature Suppression Mutation** | `CanonicalDocumentUIAdapter.executeSuppressFeature` | 🟢 PASS | Produces new document revision + evaluates topology |
| **Feature Parameter Mutation** | `CanonicalDocumentUIAdapter.executeUpdateFeatureParameter` | 🟢 PASS | Updates parameter map + increments revision + re-evaluates |
| **Feature Deletion Mutation** | `CanonicalDocumentUIAdapter.executeDeleteFeature` | 🟢 PASS | Removes feature + cascades re-evaluation |
| **Assembly Occurrence Tree** | `CanonicalDocumentUIAdapter.executeAssemblyAction` | 🟢 PASS | Applies `AssemblyIntentAction` through `AssemblyIntentMutator` |
| **Scan-to-CAD Reverse Engineering** | `HardAcceptanceGate324` & `HardAcceptanceGate325` | 🟢 PASS | Validates feature candidate extraction and B-Rep rebuild |
| **Manufacturing Feature Recognition** | `HardAcceptanceGate255` | 🟢 PASS | Validates machining feature graph synthesis and classification |
| **Assembly Solver Integrity** | `HardAcceptanceGate043` & `HardAcceptanceGate216` | 🟢 PASS | Validates constraint DOF resolution and interference checks |

---

## 7. FINAL FORENSIC CONCLUSION
 
 1. **Number of Distinct Feature Tree Interfaces:** 15 distinct components analyzed across CAD, CAM, Reverse Engineering, Machinery Design, and Assembly.
 2. **Authority & Single Source of Truth:** `EngineeringDocument` is the sole, authoritative source of truth for all CAD and Assembly features in the canonical pipeline.
 3. **Derived vs. Parallel SOT:** Zero uncontrolled parallel SOTs exist in active CAD modeling paths. Specialized engines remain sandboxes, staging trees, or downstream interpreters.
 4. **Mutations & Revisions:** All canonical feature mutations result in immutable document copies with incremented revisions and synchronous evaluations of derived meshes.
 5. **Verdict:** **🟡 PARTIALLY CLOSED (Canonical SOT Proven; Capability Delta Audit G5 Transferred to SECP-FEATURE-TAB-CAPABILITY-TRUTH-AUDIT-002).**
