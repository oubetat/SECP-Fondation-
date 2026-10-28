# Material Truth Thread Contract

## SECP Programmable Material Engineering (PME) Phase V9

### 1. Overview
The `MaterialTruthThreadContract` defines the cryptographic and graph-theoretical interface for tracking the lineage, revision provenance, and evidence integrity of programmable materials across their entire lifecycle (from initial design intent through simulation, manufacturing, measurement, deviation analysis, and final engineering adjudication).

---

### 2. Core Provenance Categories (V9-ARCH-02)

Every node in the Material Truth Thread MUST belong to exactly one of the following strict provenance categories:

1. `INTENDED`: Design intent, nominal geometry, baseline material specifications.
2. `PREDICTED`: Analytical or FE simulation predictions (e.g. theoretical spatial material field distribution).
3. `MANUFACTURED`: Process parameters, additive manufacturing constraints, toolpaths.
4. `MEASURED`: Raw or preprocessed sensor datasets from physical CT scans, ultrasonic testing, or nanoindentation.
5. `AS_BUILT`: Spatially registered, reconstructed actual physical material state.
6. `DEVIATION_ANALYSIS`: Spatial delta maps comparing intended vs as-built fields.
7. `CONFORMANCE_DECISION`: Engineering acceptance/rejection decisions, safety factor evaluations, evidence packages.

---

### 3. Allowed Node Types

- `GEOMETRY`: Canonical CAD/FEM geometry revision.
- `MATERIAL_DEFINITION`: Base isotropic or anisotropic constitutive definition.
- `SPATIAL_FIELD`: Spatially varying field definition or evaluation engine.
- `MANUFACTURING_PROFILE`: Manufacturing process constraint configuration.
- `MEASUREMENT_DATASET`: Ingested physical measurement dataset.
- `AS_BUILT_STATE`: Reconstructed actual material field state.
- `DEVIATION_RESULT`: Spatial deviation analysis output.
- `CONFORMANCE_DECISION`: Adjudication decision record.
- `EVIDENCE_PACKAGE`: Complete cryptographic audit package.

---

### 4. Allowed Directed Edge Types & Rules

Directed edges (`sourceNodeId` -> `targetNodeId`) express dependency, derivation, or verification relationships:

| Edge Type | Allowed Source Categories | Allowed Target Categories | Semantics |
|---|---|---|---|
| `DERIVED_FROM` | `PREDICTED`, `MANUFACTURED`, `AS_BUILT`, `DEVIATION_ANALYSIS` | `INTENDED`, `PREDICTED`, `MEASURED` | Target was used to derive source. |
| `USES_REVISION` | Any | `INTENDED` | Source explicitly binds to target geometry/material revision. |
| `MATERIALIZED_AS` | `MANUFACTURED` | `INTENDED` | Manufacturing profile materializes design intent. |
| `MEASURED_FROM` | `MEASURED` | `MANUFACTURED`, `INTENDED` | Physical measurement collected from physical part instance. |
| `REGISTERED_TO` | `AS_BUILT` | `GEOMETRY` | Measurement registered to coordinate frame of canonical geometry. |
| `RECONSTRUCTED_FROM` | `AS_BUILT` | `MEASURED` | As-built field reconstructed from raw/processed measurements. |
| `COMPARED_AGAINST` | `DEVIATION_ANALYSIS` | `INTENDED`, `AS_BUILT` | Deviation engine compares intended vs as-built states. |
| `VERIFIED_BY` | `CONFORMANCE_DECISION` | `DEVIATION_ANALYSIS`, `EVIDENCE_PACKAGE` | Decision verified by analytical results or evidence packages. |
| `SUPPORTED_BY_EVIDENCE` | `CONFORMANCE_DECISION` | `EVIDENCE_PACKAGE` | Decision anchored by tamper-proof evidence hash. |
| `INVALIDATED_BY_CHANGE` | System-Generated | Any | Downstream node invalidated due to upstream mutation. |

---

### 5. Graph Invariants & Integrity Criteria

1. **Acyclicity (DAG)**: The graph MUST be a Directed Acyclic Graph. Cycles are explicitly forbidden (`CYCLE_DETECTED`).
2. **No Dangling References**: Every `sourceNodeId` and `targetNodeId` in an edge MUST exist in the graph's node map (`DANGLING_REFERENCE`).
3. **Content Hash Verification**: For every node, `node.contentHash` MUST match `FEMEvidenceEngine.hashData(node.payload)`. Any mismatch raises `HASH_MISMATCH`.
4. **Revision Invalidation Propagation**: Calling `propagateRevisionInvalidation(thread, mutatedNodeId)` MUST mark all reachable downstream nodes as `INVALIDATED`, set `valid: false`, and attach an invalidation record.
5. **Merkle Thread Hash**: `thread.threadHash` is calculated deterministically as SHA-256 over all sorted node hashes and edge signatures.
