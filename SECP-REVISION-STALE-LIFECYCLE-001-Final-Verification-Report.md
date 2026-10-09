# SECP-REVISION-STALE-LIFECYCLE-001: Canonical Viewport & Selection Lifecycle Final Verification Report

**Document ID:** `SECP-REVISION-STALE-LIFECYCLE-001`  
**Standard:** SECP-CORE-SOT-LIFECYCLE  
**Date:** September 6, 2026  
**Status:** COMPLETED & VERIFIED  
**Compiler Status:** `npm run build` PASS (Exit code 0)  
**Viewport Canonical Tests:** 28/28 PASS (100%)  
**History Regression Tests:** 31/31 PASS (100%)  
**Repository Test Results:** 2243 PASS / 297 FAIL (All failures classified: 0 patch regressions)

---

## 1. Executive Summary

Following the formal closure of `SECP-3D-TOPOLOGY-PICKING-CONTRACT-002`, the SECP CAD Kernel possessed an authoritative Canonical 3D Picking contract providing genuine face identities (`documentId`, `revision`, `brepHash`, `meshHash`, `canonicalEntityId`, and topology `lineage`). However, derived artifacts (render data, viewport selection, and highlight overlays) lacked an authoritative, formal lifecycle state machine defining their synchronization with mutations in the `EngineeringDocument`.

This patch (`SECP-REVISION-STALE-LIFECYCLE-001`) establishes a mathematically rigorous, read-only **Revision/STALE Lifecycle Engine** adhering strictly to the **Single Source of Truth (SOT) Principle**:
- **Single Source of Truth**: `EngineeringDocument` is the sole source of truth.
- **Zero Parallel Reality**: No local shadow documents, parallel engineering documents, or UI-owned geometry state.
- **Authoritative Provenance Classification**: Every derived artifact is deterministically evaluated into one of four immutable lifecycle states: `CURRENT`, `STALE`, `REVALIDATED`, or `INVALID`.
- **Topological Re-Resolution**: Cross-revision entity re-resolution is driven exclusively by persistent topological identities (`FeatureID:FACE:SemanticTag`), completely forbidding triangle or face index matching.
- **Visual Safety**: Stale or invalid selections are strictly prohibited from projecting amber highlight overlays onto new revisions.

---

## 2. Engineering Architecture & State Machine

```
               ┌──────────────────────────────┐
               │     EngineeringDocument      │  ◄── [SOLE SOURCE OF TRUTH]
               │   (documentId, revision)     │
               └──────────────┬───────────────┘
                              │
                      DocumentEvaluator
                              │
                              ▼
               ┌──────────────────────────────┐
               │     CanonicalRenderData      │  ◄── [DERIVED READ-ONLY ARTIFACT]
               │ (brepHash, meshHash, faces)  │
               └──────────────┬───────────────┘
                              │
       ┌──────────────────────┴──────────────────────┐
       ▼                                             ▼
┌──────────────┐                             ┌──────────────┐
│  Three.js    │                             │  Canonical   │
│ BufferGeom   │                             │  Selection   │
└──────────────┘                             └───────┬──────┘
                                                     │
                                         RevisionLifecycleState:
                                         • CURRENT
                                         • STALE
                                         • REVALIDATED
                                         • INVALID
```

### Transition State Machine

1. **Initial Pick / Synchronized State**:
   $$\text{docId}_A = \text{docId}_B \land \text{rev}_A = \text{rev}_B \land \text{hash}_A = \text{hash}_B \implies \mathbf{CURRENT}$$
2. **Document Revision Increment ($N \to N+1$)**:
   $$\text{docId}_A = \text{docId}_B \land \text{rev}_A \neq \text{rev}_B \implies \mathbf{STALE}$$
3. **Cross-Document Mismatch or Hash Corruption**:
   $$\text{docId}_A \neq \text{docId}_B \lor (\text{rev}_A = \text{rev}_B \land \text{hash}_A \neq \text{hash}_B) \implies \mathbf{INVALID}$$
4. **Persistent Topology Re-resolution**:
   $$\mathbf{STALE} \xrightarrow{\text{revalidateSelection}} \begin{cases} \mathbf{REVALIDATED} \to \mathbf{CURRENT} & \text{if persistentId found in new topologyMap} \\ \mathbf{INVALID} & \text{if persistentId deleted / unresolvable} \end{cases}$$

---

## 3. Lifecycle State Matrix

| State | Definition | Visual Overlay (`shouldDisplayHighlight`) | Consumer Behavior |
| :--- | :--- | :--- | :--- |
| **`CURRENT`** | Selection matches document ID, revision, and geometry hashes exactly. | **PERMITTED** (Active amber overlay) | Consumed by inspectors, parameter panels, and sketch tools. |
| **`STALE`** | Selection belongs to the same document, but document revision has incremented. | **SUSPENDED** (No overlay) | Automatic background re-resolution triggered via persistent topological ID. |
| **`REVALIDATED`** | Successfully resolved into the new revision via persistent ID; updated to `CURRENT`. | **PERMITTED** (Overlay restored on new geometry) | Transferred seamlessly into new revision with updated provenance. |
| **`INVALID`** | Document mismatch, hash divergence, or entity destroyed in new revision. | **SUSPENDED / CLEARED** | Selection reset to `null`; user alerted if relevant. |

---

## 4. Revalidation & Persistent Topology Re-resolution Mechanism

The module `/src/engine/viewport/RevisionLifecycle.ts` implements `revalidateSelection(oldPick, newRenderData)` with zero kernel mutation:

1. **Document Match Check**: Verifies `oldPick.documentId === newRenderData.documentId`.
2. **Topology Map Inspection**: Accesses `newRenderData.topologyMap.faceTriangleMap`.
3. **Identity Resolution Priority**:
   - **Priority 1 (Exact Persistent ID)**: Matches `entry.persistentId === targetPersistentId` or `key === targetPersistentId` (e.g. `F_EXTRUDE_1:FACE:Top`).
   - **Priority 2 (Face ID)**: Matches `entry.faceId === targetFaceId` if persistent ID mapping evolved.
   - **Priority 3 (Lineage Persistent Tag)**: Matches `entry.lineage?.persistentTag === oldPick.lineage?.persistentTag`.
4. **Zero Index-Based Fallbacks**: Strictly forbids matching based on vertex indices, normal proximity, or arbitrary face ordering.
5. **Fresh Provenance Output**: If resolved, generates a frozen `CanonicalPickResult` carrying `targetRevision`, new `brepHash`, new `meshHash`, and new triangle index ranges.

---

## 5. UI / Presentation Suspension Guarantees

In `/src/components/CadViewport3D.tsx`, visual highlight rendering is guarded by `shouldDisplayHighlight(selectedCanonicalFace, canonicalRenderData)`:
```typescript
const isPermitted = shouldDisplayHighlight(selectedCanonicalFace, canonicalRenderData);
if (!isPermitted) {
  if (highlightMeshRef.current) {
    highlightMeshRef.current.visible = false;
  }
  return;
}
```
In `/src/App.tsx`:
- Automatic reconciliation effect monitors `[canonicalRenderData, selectedCanonicalFace]`.
- If `STALE`, attempts `revalidateSelection`. If revalidation succeeds, updates state to the revalidated pick. If it fails, resets selection to `null`.
- Status bar displays real-time lifecycle tracking:
  `Canonical Face: {id} [Rev: {N} | {LIFECYCLE_STATUS}]`.

---

## 6. Verification & Test Results (Tests A through J)

A dedicated, comprehensive test suite `/src/engine/viewport/__tests__/RevisionLifecycle.test.ts` executes the 10 mandatory test scenarios:

| Test ID | Scenario | Expected Outcome | Actual Result | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Test A** | Same Revision (`docId`, `rev`, `brepHash`, `meshHash` match) | Classifies as `CURRENT` | `status: CURRENT`, 4/4 match booleans `true` | **PASS** |
| **Test B** | Revision Changed ($N \to N+1$) | Classifies as `STALE` | `status: STALE`, `revisionMatch: false` | **PASS** |
| **Test C** | Different Document (`DOC-A` vs `DOC-B`) | Classifies as `INVALID` | `status: INVALID`, `documentIdMatch: false` | **PASS** |
| **Test D** | Persistent Re-resolution Success | Resolves face into Rev 2 | `status: REVALIDATED`, new pick `CURRENT` in Rev 2 | **PASS** |
| **Test E** | Persistent Re-resolution Failure | Deleted/non-existent face | `success: false`, `status: INVALID`, `resolvedPick: null` | **PASS** |
| **Test F** | Hash Mismatch (Mesh hash tampered) | Classifies as `INVALID` | `status: INVALID`, `meshHashMatch: false` | **PASS** |
| **Test G** | Highlight Suspension Lifecycle | STALE/INVALID suppress highlight | `shouldDisplayHighlight` returns `false` on STALE/INVALID, `true` on CURRENT | **PASS** |
| **Test H** | No Parallel Geometry | Zero B-Rep tessellation or kernel mutations | `BRepTessellator.tessellate` call count: 0 | **PASS** |
| **Test I** | Deterministic Invariance | Identical inputs yield identical states | 100% invariant comparisons and captures | **PASS** |
| **Test J** | Tab Switching / Multi-Workbench | Consistent state across workbenches | Selection valid if rev unchanged; STALE if mutated | **PASS** |

**Test Execution Output:**
```bash
npx vitest run src/engine/viewport/__tests__/RevisionLifecycle.test.ts
 ✓ src/engine/viewport/__tests__/RevisionLifecycle.test.ts (10 tests) 105ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

---

## 7. Full Repository Test Results & Breakdown

### Target Test Suites
1. **Viewport Canonical Suite:**
   - `RevisionLifecycle.test.ts`: 10/10 PASS
   - `CanonicalPickingContract.test.ts`: 10/10 PASS
   - `CanonicalRenderContract.test.ts`: 8/8 PASS
   - **Combined Canonical Viewport Tests: 28/28 PASS (100%)**
2. **CAD Kernel History Regression Suite:**
   - `FeatureHistoryAdversarial.test.ts`: 8/8 PASS
   - `FeatureHistory.test.ts`: 16/16 PASS
   - `FeatureHistoryCanonical.test.ts`: 2/2 PASS
   - `FeatureHistoryGate.test.ts`: 1/1 PASS
   - `RealExtrude.test.ts`: 2/2 PASS
   - `PersistentTopology.test.ts`: 2/2 PASS
   - **History Suite Total: 31/31 PASS (100%)**

### Full Repository Vitest Run (`npx vitest run`)
- **Total Test Files Evaluated:** 379
- **Passed Test Files:** 286
- **Failed Test Files:** 93
- **Total Individual Tests:** 2540
- **Passed Tests:** 2243 (+11 compared to pre-patch 2232)
- **Failed Tests:** 297 (-1 compared to pre-patch 298)

### Failure Classification Breakdown
- **PATCH-RELATED:** 0
- **PRE-EXISTING / UNRELATED (CFD Solvers, AP242 PMI, FEM):** 294
  - e.g., `ThermalStateValidator.validate is not a function`, `STEP_PARSE_ERROR: Invalid ISO-10303-21 header`
- **LEGACY / UNWIRED (`TopologyPickingEngine.test.ts`):** 3
  - Legacy edge-picking and mock raycaster tests acknowledged in Closure Audit 002.
- **UNKNOWN:** 0

---

## 8. Zero-Parallel-Reality Audit

| Checkpoint | Verified Compliance | Evidence |
| :--- | :--- | :--- |
| **No `LOCAL_SHADOW_DOC`** | **COMPLIANT** | Zero local document instances created; all derivations consume `EngineeringDocument`. |
| **No UI-Owned Geometry as SOT** | **COMPLIANT** | Viewport selection and highlights are pure readers of `CanonicalRenderData`. |
| **No Re-Tessellation in Lifecycle** | **COMPLIANT** | Vitest spy verified `BRepTessellator.tessellate` is never called by lifecycle functions. |
| **No Synthetic/Random IDs** | **COMPLIANT** | Re-resolution matches strictly against kernel-generated persistent IDs and tags. |
| **Immutable Provenance** | **COMPLIANT** | Every lifecycle artifact is frozen (`Object.freeze`) with provenance tracking. |

---

## 9. Residual Risks & Next Steps

1. **Multi-Entity Selection Lifecycle**: Current implementation primarily governs single-face canonical selection (`selectedCanonicalFace`). A multi-selection array should adopt the same `classifyDerivedState` array mapper.
2. **Edge and Vertex Picking Contracts**: When Edge Picking is migrated from legacy to the Canonical Contract (following SECP-3D-TOPOLOGY-PICKING-CONTRACT-002), it will plug directly into `RevisionLifecycle.ts` without requiring new lifecycle abstractions.
3. **Production Build Confirmation**: Full production build (`vite build && esbuild server.ts`) passed cleanly in 32.34s with zero bundle errors.
