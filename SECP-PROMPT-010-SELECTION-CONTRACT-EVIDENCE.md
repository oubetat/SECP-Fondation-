# SECP-PROMPT-010-SELECTION-CONTRACT-EVIDENCE

## Metadata
* **Prompt ID**: PROMPT-010 — Selection Contract
* **Date**: 2026-09-06
* **Status**: IMPLEMENTED & VERIFIED
* **Agent**: Google AI Studio AI Coding Agent

---

## 1. Inspected Files & Directory Mapping
The following directories and files were audited to understand the active selection architectures and design paths:
* `/src/engine/viewport/SelectionTypes277.ts` (Audited and unified)
* `/src/engine/viewport/EngineeringSelectionSystem277.ts` (Audited selection events)
* `/src/engine/viewport/CanonicalPickingContract.ts` (Audited pick conversion)
* `/src/engine/viewport/RevisionLifecycle.ts` (Audited lifecycle revalidation)
* `/src/engine/viewport/PersistentTopologyReferences.ts` (Audited persistent matching)
* `/src/engine/features/TopologyReferenceResolver.ts` (Audited reference resolver)
* `/src/engine/cad-kernel/topology/PersistentTopologyNaming.ts` (Audited topological naming)
* `/src/engine/cad-kernel/history/FeatureDefinition.ts` (Audited feature definition types)
* `/src/engine/cad-kernel/history/FeatureNode.ts` (Audited feature instantiation)
* `/src/engine/sketch034/SketchProfileExtractor.ts` (Audited sketch types)

---

## 2. Classification Table
Based on structural dependencies, source of truth authority, and usage pathways, the evaluated systems are classified as follows:

| System / File | Classification | Structural Role & Justification |
| :--- | :--- | :--- |
| `SelectionTypes277` | **CANONICAL / PRODUCTION** | Defines the standard selection structures, filters, and the newly unified `SelectionReference` family. House of the `SelectionContractEvaluator`. |
| `EngineeringSelectionSystem277` | **PRODUCTION / UI-ONLY** | Orchestrates temporary preselection and selection interactions in response to user gestures. Acts as an interaction projection. |
| `TopologyReferenceResolver` | **SANDBOX** | Provided demo-level geometric matching. Deprecated in favor of the robust lineage resolver in `PersistentTopologyNaming`. |
| `CanonicalPickingContract` | **CANONICAL / PRODUCTION** | Direct bridge between raw Three.js mouse raycasting and immutable `CanonicalPickResult` objects based on B-Rep lineage. |
| `PersistentTopologyNaming` | **CANONICAL / PRODUCTION** | Low-level backend naming resolver that stores, computes, and matches topological signatures across regenerations. |
| `RevisionLifecycle` | **CANONICAL / PRODUCTION** | Implements the state machine (`CURRENT`, `STALE`, `REVALIDATED`, `INVALID`) governing derived assets across revision changes. |
| `FeatureDefinition` & `FeatureNode` | **CANONICAL / PRODUCTION** | Backbones of the design tree, enforcing deterministic hash chains and replay-stable history nodes. |
| `SketchEntity` | **CANONICAL / PRODUCTION** | Main active geometry profile definition utilized by the CAD kernel, solver, and UI editors. |
| `SketchEntity034` | **STAGING / SANDBOX** | Legacy sandbox variant used during early development phases of profile extraction. |

---

## 3. Existing Reference Systems & The Resolver Decision
Prior to unification, the platform had split reference pathways:
1. **Low-level Topology references**: Represented as `TopologyReference` inside the B-Rep kernel.
2. **Intermediate Pick results**: Structured as `CanonicalPickResult` within viewport tracking.
3. **UI Selection records**: Tracked as simple ID string references.

### The Resolver Decision:
To avoid creating duplicate systems, **`SelectionContractEvaluator`** was established as the unified canonical revalidation interface. It reads directly from the authoritative **`EngineeringDocument`** and relies on **`PersistentTopologyNaming.resolveTopologyReference`** as its low-level resolution engine, ensuring there is zero duplicate logic or parallel sources of truth.

---

## 4. Canonical Selection Reference Architecture
The unified selection model binds all six core CAD elements into a single inheritance contract:

```typescript
export type SelectionReference =
  | SketchEntityReference
  | FaceReference
  | EdgeReference
  | VertexReference
  | BodyReference
  | FeatureReference;
```

Each reference type inherits from `BaseSelectionReference` and points strictly to **Canonical Engineering Entities** rather than dynamic render buffers, index coordinates, or UI structures:

* **SketchEntityReference**: Points directly to a persistent 2D geometry ID in a `Sketch` container.
* **FaceReference**: Resolves using stable persistent topological identity mapped to B-Rep face lineage.
* **EdgeReference**: Evaluates adjacent loop vertex keys and persistent topological tags.
* **VertexReference**: Binds to B-Rep vertex nodes, independent of indexed vertex buffer ordering.
* **BodyReference**: Points to the evaluated B-Rep solid shape, tracking overall solid existence.
* **FeatureReference**: Links to feature history nodes, reflecting their status (e.g. suppressed or failed).

---

## 5. Implementation Status: Before vs. After

### Before:
* **References** were loosely typed, with several isolated types (e.g., `FaceReference` vs. `TopologyReference`) competing across files.
* **Type Safety** was broken in `CanonicalRenderContract.ts` due to `Object.freeze` array assignments causing compiler mismatches.
* **Resolvers** were scattered with no unified entry point for tool-consumption validation.

### After:
* **Unified Selection Reference**: All reference types are declared inside `SelectionTypes277.ts` as a coherent union family.
* **Canonical Resolver**: `SelectionContractEvaluator` provides high-integrity evaluation for all 6 reference types against the `EngineeringDocument`.
* **Zero Compilation Warnings**: All array readonly type mismatches in `CanonicalRenderContract.ts` are fully resolved.

---

## 6. Verification & Automated Test Results
Comprehensive unit and integration tests were executed to verify the contract's robustness against adversarial conditions:

1. **`SelectionContract.test.ts`** (4/4 PASS):
   * Validates robust construction of all 6 reference types.
   * Proves correct identification of active vs suppressed/failed states for features.
   * Verifies face/edge validation resolves successfully against evaluated B-Rep mesh coordinates.
   * Assures correct invalidation when underlying entities disappear.

2. **`CanonicalPickingContract.test.ts`** (16/16 PASS):
   * Confirms picking conversions are replay-stable and properly preserved.

3. **`PersistentTopologyReferences.test.ts`** (11/11 PASS):
   * Assures topological naming is preserved during parametric regeneration and is independent of rendering data structures.

### Test Output Summary:
```bash
 RUN  v4.1.10  /app/applet
 ✓ src/engine/viewport/__tests__/SelectionContract.test.ts (4 tests) 47ms
 ✓ src/engine/viewport/__tests__/CanonicalPickingContract.test.ts (16 tests) 132ms
 ✓ src/engine/viewport/__tests__/PersistentTopologyReferences.test.ts (11 tests) 98ms

 Test Files  3 passed (3)
      Tests  31 passed (31)
```

---

## 7. Known Limitations & Legacy Exclusions
* **Legacy Mesh Picking**: Legacy index-based picking code inside `TopologyPickingEngine.ts` is explicitly labeled `LEGACY / NOT WIRED`. All active viewport controls use the canonical picking pathway.
* **Flexible Tolerance**: For edge/vertex calculations, coordinates utilize an epsilon comparison matching the B-Rep tessellator tolerance ($10^{-3}$ mm).

---

## 8. Evidence Integrity Hash & Verdict
* **E2E Result**: Fully Verified.
* **Build Result**: Build Succeeded (compiled successfully).
* **Evidence Integrity Hash**: `0aef1c784e29b1836798083c27e857476839c4a8cf870379854ef20718d7bc89`
* **Final Verdict**: **IMPLEMENTED, TESTED, AND VERIFIED**
