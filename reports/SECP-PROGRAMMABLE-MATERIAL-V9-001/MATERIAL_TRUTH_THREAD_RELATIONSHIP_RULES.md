# Material Truth Thread Relationship Rules

## SECP Programmable Material Engineering (PME) Phase V9

### 1. Directionality & Dependency Invariants
All edges in the Material Truth Thread are **directed** (`sourceNodeId` -> `targetNodeId`). Direction indicates dependency flow: the `sourceNodeId` depends on or was derived/verified from the `targetNodeId`.

---

### 2. Legal Directed Edge Specifications

#### Edge 1: `USES_REVISION`
- **Source Node**: `MATERIAL_DEFINITION`, `SPATIAL_FIELD`, `MANUFACTURING_PROFILE`, `AS_BUILT_STATE`, `DEVIATION_RESULT`
- **Target Node**: `GEOMETRY`
- **Invariant**: Ensures material fields and evaluations bind explicitly to a canonical geometry revision.

#### Edge 2: `DERIVED_FROM`
- **Source Node**: `SPATIAL_FIELD` (Predicted), `MANUFACTURING_PROFILE`, `AS_BUILT_STATE`, `DEVIATION_RESULT`
- **Target Node**: `MATERIAL_DEFINITION`, `GEOMETRY`, `SPATIAL_FIELD`, `MEASUREMENT_DATASET`
- **Invariant**: Establishes theoretical or analytical lineage.

#### Edge 3: `MATERIALIZED_AS`
- **Source Node**: `MANUFACTURING_PROFILE`
- **Target Node**: `SPATIAL_FIELD` (Intended)
- **Invariant**: Links manufacturing process constraints to the intended spatial material field.

#### Edge 4: `MEASURED_FROM`
- **Source Node**: `MEASUREMENT_DATASET`
- **Target Node**: `MANUFACTURING_PROFILE` or `GEOMETRY`
- **Invariant**: Binds sensor measurements to physical part production runs.

#### Edge 5: `REGISTERED_TO`
- **Source Node**: `AS_BUILT_STATE`
- **Target Node**: `GEOMETRY`
- **Invariant**: Confirms spatial registration of measurements into the canonical geometry coordinate frame.

#### Edge 6: `RECONSTRUCTED_FROM`
- **Source Node**: `AS_BUILT_STATE`
- **Target Node**: `MEASUREMENT_DATASET`
- **Invariant**: Tracks field reconstruction back to the ingested physical measurement dataset.

#### Edge 7: `COMPARED_AGAINST`
- **Source Node**: `DEVIATION_RESULT`
- **Target Node**: `SPATIAL_FIELD` (Intended) and `AS_BUILT_STATE`
- **Invariant**: Deviation engine requires both Intended spatial field and As-Built state.

#### Edge 8: `VERIFIED_BY`
- **Source Node**: `CONFORMANCE_DECISION`
- **Target Node**: `DEVIATION_RESULT`
- **Invariant**: Acceptance decision must be justified by an audited deviation result.

#### Edge 9: `SUPPORTED_BY_EVIDENCE`
- **Source Node**: `CONFORMANCE_DECISION`
- **Target Node**: `EVIDENCE_PACKAGE`
- **Invariant**: Links adjudication decision to the immutable cryptographic evidence package.

#### Edge 10: `INVALIDATED_BY_CHANGE`
- **Source Node**: Downstream Node (e.g. `DEVIATION_RESULT`, `CONFORMANCE_DECISION`, `AS_BUILT_STATE`)
- **Target Node**: Mutated Upstream Node (e.g. `GEOMETRY`, `MATERIAL_DEFINITION`, `SPATIAL_FIELD`)
- **Invariant**: Graph edge added automatically when `propagateRevisionInvalidation` is triggered.

---

### 3. Automatic Invalidation Propagation Logic
When a node $N_{mut}$ is mutated:
1. `N_mut.isValid` is set to `false`, and `N_mut.invalidationReason` is updated.
2. Find all directed paths from any node $N_x$ to $N_{mut}$ where $N_x$ depends on $N_{mut}$ directly or transitively.
3. For every downstream node $N_{down}$:
   - Mark `N_down.isValid = false`.
   - Set `N_down.invalidatedByNodeId = N_mut.nodeId`.
   - Set `N_down.invalidationReason = "Upstream dependency node " + N_mut.nodeId + " was mutated/invalidated."`.
   - Add edge `N_down -> N_mut` with `edgeType = INVALIDATED_BY_CHANGE`.
4. Recompute Merkle root `threadHash`.
