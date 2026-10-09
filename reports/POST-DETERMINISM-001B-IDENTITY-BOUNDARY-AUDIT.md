# SECP POST-DETERMINISM-001B
## EXECUTION IDENTITY BOUNDARY & TRUTH THREAD IMPACT AUDIT

---

### 1. Executive Summary

This report establishes the precise semantic and cryptographic boundaries of the SECP engineering platform across execution identity, result identity, execution artifact identity, evidence identity, provenance identity, and audit metadata.

This architectural audit was conducted under a strict **Forensic-First / Read-Only** mandate:
- **No code changes** were made to domain solvers, `CoreExecutionAuthority`, `GenericExecutionRegistry`, `AttestationCanonicalizer`, `EvidenceMerkleTree`, `ProvenanceGraph`, or test suites.
- **No assertions were weakened**, and **no hashing/digest semantics were altered**.

**Key Architectural Audit Findings**:
1. **Computational Determinism**: **PROVEN**. Given identical parameters, domain solvers produce 100% identical physical scalar outputs.
2. **Replay Identity Stability**: **FAILED**. Re-executing an identical engineering request generates a fresh wall-clock timestamp (`solvedAt`), altering `resultDigest` and triggering an `IMMUTABLE_IDENTITY_CONFLICT` inside `GenericExecutionRegistry`.
3. **Rehydration vs. Re-execution**: **DISTINGUISHED**. Rehydrating a persisted execution envelope from IndexedDB succeeds idempotently. Re-executing a solver for the same request fails due to runtime metadata variance.
4. **M7 Class F vs. OIL-03 Root Causes**: **SEPARATED**. Class F cases (`M7-xxx-06`) fail due to result digest instability (`solvedAt` timestamp variance). `M7-OIL-03` fails due to an unchecked zero-division ($P=0 \implies \text{Safety Factor} = \infty$), which triggers a non-finite canonicalization rejection in `AttestationCanonicalizer`.

---

### 2. Semantic Identity Map (Representations A through K)

| Map Symbol | Representation Name | Identifies | Data Hashed | Created By | Verified By | Persisted In | Can Change After Creation? | Authority Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **A** | `engineeringObjectId` | Physical CAD object or assembly | N/A (String ID) | Authoring Engineer | `RevisionEngine` / Core | Revision Engine, Ledger | NO | **AUTHORITATIVE** |
| **B** | `revisionId` | Version code & iteration of object | Revision metadata & BREP | `RevisionEngine` | `CoreExecutionAuthority` | Revision Store | NO | **AUTHORITATIVE** |
| **C** | `executionId` | Computation request scenario identity | Canonical Preimage String (Inputs + Entity + Revision + Geometry + Plugin + Solver IDs) | `CoreExecutionAuthority` | `GenericExecutionRegistry` | Execution Ledger, IndexedDB | NO | **AUTHORITATIVE** |
| **D** | `computedExecId` | Header verification copy of execution ID | Canonical Preimage String | `GenericExecutionRegistry` | `GenericExecutionRegistry` | Envelope Header | NO | **DERIVED** |
| **E** | `resultDigest` | Output artifact hash | Normalized `solverResult.rawResults` (including outputs + `solvedAt`) | `CoreExecutionAuthority` | `GenericExecutionRegistry` | Execution Envelope | NO | **DERIVED** |
| **F** | `contentDigest` | Complete execution envelope hash | Envelope payload fields (`executionId`, `inputDigest`, `resultDigest`, `rawResults`, etc.) | `GenericExecutionRegistry` | `GenericExecutionRegistry` | Execution Ledger Map | NO | **DERIVED** |
| **G** | `artifactContentHash` | Raw output payload hash | Normalized `rawResults` | Domain Solver / Core | `CanonicalDerivedArtifactBinding` | Derived Binding Payload | NO | **DERIVED** |
| **H** | `derivationBinding.artifactDigest` | Derived artifact binding hash | Canonicalized binding payload (Revision + Geometry + Content Hash + Scenario ID) | `CanonicalDerivedArtifactBinding` | `CoreExecutionAuthority` | Execution Envelope | NO | **DERIVED** |
| **I** | `EvidenceLeafRecord.leafHash` | Evidence leaf record | Canonical Core Evidence fields (Entity, Revision, Geometry, Artifact, Execution IDs) | `EvidenceMerkleTree` | `EvidenceMerkleTree` | Evidence Merkle Tree | NO | **DERIVED** |
| **J** | Merkle root | Aggregated evidence tree root | Pairwise leaf hash tree | `EvidenceMerkleTree` | Attestation Engine | Certificate / Ledger | NO | **DERIVED** |
| **K** | Provenance Node / Edge Hash | Lineage DAG node / relationship edge | Node identity & relation type | `ProvenanceGraph` | `ProvenanceGraph` | Provenance Graph | NO | **DERIVED** |

---

### 3. `resultDigest` Semantic Role

Current Architecture Finding: **`RESULT_DIGEST_SEMANTICS = AMBIGUOUS`**

- **Source Evidence**:
  - In `CoreExecutionAuthority.ts` (lines 452-454), `resultDigest` is computed as:
    ```typescript
    const resultDigest = createHash('sha256')
      .update(JSON.stringify(AttestationCanonicalizer.normalizeValue(solverResult.rawResults || {})))
      .digest('hex');
    ```
  - `solverResult.rawResults` contains **both**:
    1. Pure engineering scalar outputs (`gravityTorqueNm`, `machNumber`, `dragForceN`, etc.)
    2. Dynamic wall-clock runtime metadata (`solvedAt: new Date().toISOString()`)
- **Semantic Ambiguity**:
  - The name `resultDigest` implies **Engineering Result Identity** (pure computational output hash).
  - Its implementation hashes `rawResults`, which embeds a runtime timestamp, making it act as a **Complete Execution Event Identity Hash**.
  - This ambiguity causes `resultDigest` to change across re-executions of the same logical request, conflicting with deterministic replay.

---

### 4. `solvedAt` Semantic Role

- **Semantic Role**: **`AUDIT / RUNTIME METADATA`**.
- **Consumers**:
  - Embedded in `solverResult.rawResults`.
  - Hashed inside `resultDigest`.
  - Hashed inside `contentDigest`.
  - Hashed inside `EvidenceLeafRecord.leafHash` (via `artifactContentHash`).
  - Stored in `ProvenanceGraph` node timestamp.
- **Architectural Trace Answer**:
  - **Does changing `solvedAt` change the engineering truth?**
  - **NO.** Changing `solvedAt` changes only the wall-clock execution moment. The underlying physical equations, parameters, and scalar outputs (`scalarOutputs`) remain 100% identical.

---

### 5. Truth Thread Trace

The complete data and hash flow across the SECP engineering thread is traced below:

$$\begin{aligned}
\text{Domain Solver Execution} &\longrightarrow \text{rawResults } (\text{includes } \texttt{solvedAt}) \\
&\longrightarrow \text{resultDigest } (\text{SHA-256 of normalized } \text{rawResults}) \quad \mathbf{[\text{\textbf{Timestamp Entry Point}}]}\\
&\longrightarrow \text{artifactContentHash } (= \text{resultDigest}) \\
&\longrightarrow \text{CanonicalDerivedArtifactBinding.createBinding()} \longrightarrow \text{derivationBinding.artifactDigest} \\
&\longrightarrow \text{EvidenceLeafRecord } (\text{binds } \text{artifactContentHash} \text{ and } \text{executionIdentity}) \\
&\longrightarrow \text{EvidenceMerkleTree.computeLeafHash()} \longrightarrow \text{leafHash} \\
&\longrightarrow \text{EvidenceMerkleTree.buildTree()} \longrightarrow \text{Merkle Root Hash} \\
&\longrightarrow \text{ProvenanceGraph.rebuildProvenanceForEnvelope()} \longrightarrow \text{RES-NODE- and EVI-NODE- Relation Hashes} \\
&\longrightarrow \text{Truth Thread Persistence}
\end{aligned}$$

**Entry Point**: `solvedAt`-derived digest instability enters the Truth Thread at Step 2 (`resultDigest`), propagating downstream to artifact bindings, evidence leaves, Merkle roots, and provenance nodes.

---

### 6. Computational Determinism vs. Replay Identity Stability

The audit confirms that two statements are simultaneously true:

- **Statement A**: *"Same engineering state produces the same engineering result."* (**TRUE**)
- **Statement B**: *"Same engineering state cannot be re-executed under the same execution identity because runtime metadata changes the digest."* (**TRUE**)

**Architectural Classification**:
$$\mathbf{\text{COMPUTATIONAL DETERMINISM}} = \mathbf{\text{PROVEN}}$$
$$\mathbf{\text{REPLAY IDENTITY STABILITY}} = \mathbf{\text{FAILED}}$$

---

### 7. Persistence vs. Re-execution

The experiment established why persisting and rehydrating an envelope succeeds while re-executing fails:

- **REHYDRATION**:
  - Operation: Reads the original sealed envelope from storage (`IndexedDbEngine`) and registers it in `GenericExecutionRegistry`.
  - Behavior: The rehydrated envelope retains its original `solvedAt` timestamp and `resultDigest`.
  - Registry Check: `computeContentDigest(existing) === computeContentDigest(incoming)` evaluates to **TRUE**.
  - Result: **SUCCEEDS IDEMPOTENTLY**.
- **RE-EXECUTION**:
  - Operation: Dispatches a new solver calculation for an identical request.
  - Behavior: The solver generates a new `solvedAt` wall-clock timestamp, changing `resultDigest` and `contentDigest`.
  - Registry Check: Existing `executionId` is found, but `computeContentDigest(existing) !== computeContentDigest(incoming)` evaluates to **TRUE**.
  - Result: **THROWS `IMMUTABLE_IDENTITY_CONFLICT`**.

---

### 8. Evidence Integrity Analysis

- **Truth Thread Integrity Status**: **`SEMANTIC CONFLICT`** (Supported Outcome B/C).
- **Source Analysis**: The Truth Thread treats each execution as an immutable, time-stamped evidence artifact. However, `CoreExecutionAuthority` assigns a deterministic `executionId` based solely on inputs. Conflating deterministic scenario identity (`executionId`) with time-variant invocation content (`resultDigest`) creates an architectural conflict when duplicate requests are executed.

---

### 9. Platform Replay Semantics

The SECP platform currently supports:
- **Meaning A**: Rehydrate exact previous execution (**SUPPORTED**).
- **Meaning C**: Reproduce same engineering computational result (**SUPPORTED**).
- **Meaning B**: Re-execute same engineering request under same execution identity (**BLOCKED** by `IMMUTABLE_IDENTITY_CONFLICT`).

---

### 10. Security vs. Determinism Analysis

- **Security / Integrity Benefit**: Including `solvedAt` in `resultDigest` provides **Event Attestation Security** (binding the cryptographic seal to a specific wall-clock execution moment, preventing silent substitution of old results).
- **Determinism Conflict**: Prevents pure computational replay under the same `executionId`.
- **Architectural Trade-off**: Strong temporal event attestation vs. deterministic execution replayability.

---

### 11. M7 Failure Reconciliation

1. **M7 Class F Cases (`M7-xxx-06`)**:
   - Cause: **Execution identity & resultDigest instability** (`solvedAt` timestamp variance causing `IMMUTABLE_IDENTITY_CONFLICT`). **CONFIRMED**.
2. **M7-OIL-03 Case**:
   - Cause: **Unchecked zero-division numerical singularity** ($P=0 \implies \text{Safety Factor} = \infty \implies$ `AttestationCanonicalizer` finite-value rejection). **CONFIRMED SEPARATE FINDING**.

---

### 12. Required Findings (F-101 through F-114)

#### **F-101: Engineering Identity**
- **STATUS**: `PROVEN`
- **PROOF**: Defined by `engineeringObjectId` and `revisionHash`.
- **SOURCE**: `src/engine/revision/RevisionEngine.ts`.
- **IMPACT**: Uniquely identifies physical object version.

#### **F-102: Execution Identity**
- **STATUS**: `PROVEN`
- **PROOF**: `executionId` is computed deterministically from preimage `{ engineeringObjectId, executionKind, geometryHash, inputDigest, pluginId, pluginVersion, revisionHash, solverIdentity }`.
- **SOURCE**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 338-363).
- **IMPACT**: Deterministic across identical requests.

#### **F-103: Result Identity**
- **STATUS**: `AMBIGUOUS`
- **PROOF**: `resultDigest` hashes both physical scalar outputs and wall-clock `solvedAt` timestamp.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 452-454).
- **IMPACT**: Changes across time for identical computational results.

#### **F-104: Execution Artifact Identity**
- **STATUS**: `PROVEN`
- **PROOF**: Captured by `derivationBinding.artifactDigest` in `CanonicalDerivedArtifactBinding.ts`.
- **SOURCE**: `src/engine/topology/CanonicalDerivedArtifactBinding.ts` (lines 92-94).
- **IMPACT**: Binds derived output to specific revision and scenario.

#### **F-105: solvedAt Semantic Role**
- **STATUS**: `PROVEN`
- **PROOF**: `solvedAt` is created via `new Date().toISOString()` inside solver functions as runtime audit metadata.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 69, 116, 160, 204, 248, 291).
- **IMPACT**: Audit metadata currently alters result identity.

#### **F-106: resultDigest Semantic Role**
- **STATUS**: `AMBIGUOUS`
- **PROOF**: Blends computational result identity with runtime invocation occurrence.
- **SOURCE**: `CoreExecutionAuthority.ts` & `GenericExecutionRegistry.ts`.
- **IMPACT**: Destroys replay identity stability.

#### **F-107: contentDigest Semantic Role**
- **STATUS**: `PROVEN`
- **PROOF**: `contentDigest` hashes complete envelope payload in `GenericExecutionRegistry.computeContentDigest`.
- **SOURCE**: `src/engine/execution/GenericExecutionRegistry.ts` (lines 31-51).
- **IMPACT**: Enforces overwrite prevention for immutable envelopes.

#### **F-108: Evidence Identity**
- **STATUS**: `PROVEN`
- **PROOF**: `EvidenceLeafRecord.leafHash` is computed via `EvidenceMerkleTree.computeLeafHash`.
- **SOURCE**: `src/engine/certification/truth/EvidenceMerkleTree.ts` (lines 34-58).
- **IMPACT**: Provides Merkle-verifiable evidence binding.

#### **F-109: Truth Thread Dependency**
- **STATUS**: `PROVEN`
- **PROOF**: Truth Thread dependencies link Revision -> Execution -> Result -> Evidence -> Provenance.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 527-640).
- **IMPACT**: Lineage DAG structure is intact; result node hashes vary on re-execution.

#### **F-110: Persistence/Rehydration Semantics**
- **STATUS**: `PROVEN`
- **PROOF**: Rehydration reads original sealed envelope and re-registers idempotently.
- **SOURCE**: `GenericExecutionRegistry.ts` (lines 220-254) & Experiment B.
- **IMPACT**: Storage rehydration is 100% sound.

#### **F-111: Re-execution Semantics**
- **STATUS**: `PROVEN`
- **PROOF**: Re-executing identical request throws `IMMUTABLE_IDENTITY_CONFLICT`.
- **SOURCE**: `GenericExecutionRegistry.ts` (lines 125-135) & Experiment A.
- **IMPACT**: Direct re-execution of identical requests is currently blocked.

#### **F-112: Computational Determinism**
- **STATUS**: `PROVEN`
- **PROOF**: `scalarOutputs` are 100% identical across independent runs.
- **SOURCE**: Controlled Experiments.
- **IMPACT**: Engineering physics calculation is sound.

#### **F-113: Replay Identity Stability**
- **STATUS**: `PROVEN_DEFECTIVE`
- **PROOF**: `resultDigest` changes across runs due to `solvedAt`.
- **SOURCE**: Controlled Experiments.
- **IMPACT**: Re-execution violates registry identity immutability.

#### **F-114: Security/Integrity Implication**
- **STATUS**: `PROVEN`
- **PROOF**: `solvedAt` provides event temporal uniqueness but breaks replay determinism.
- **SOURCE**: `CoreExecutionAuthorityInternal.ts`.
- **IMPACT**: Architectural trade-off between event uniqueness and computational determinism.

---

### 13. Architectural Boundary Diagram

```
Engineering State [AUTHORITATIVE]
       │
       ▼
Canonical Revision (revisionHash) [AUTHORITATIVE] [PERSISTED]
       │
       ▼
Execution Request (parameters + seed) [AUTHORITATIVE]
       │
       ▼
Execution Identity (executionId) [AUTHORITATIVE] [PERSISTED]
       │
       ▼
Domain Solver Execution [RUNTIME]
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
Engineering Result (scalarOutputs)       solvedAt Timestamp
 [AUTHORITATIVE]                          [RUNTIME] [AUDIT]
       │                                         │
       └───────────────────┬─────────────────────┘
                           │
                           ▼
               Result Identity (resultDigest) [DERIVED] [AMBIGUOUS]
                           │
                           ▼
               Execution Artifact (derivationBinding) [DERIVED]
                           │
                           ▼
               Evidence Leaf (leafHash) [DERIVED] [PERSISTED]
                           │
                           ▼
               Provenance Node & DAG [DERIVED] [PERSISTED]
                           │
                           ▼
               Truth Thread Ledger [PERSISTED]
```

---

### 14. Repair Requirements (For Future Mission M8)

A future repair mission must preserve the following architectural invariants without prescribing specific code implementations:

1. **Must Preserve**:
   - `executionId` determinism based on canonical inputs and revision/geometry hashes.
   - Engineering result computational accuracy (`scalarOutputs`).
   - Audit trail visibility (preserving invocation timestamps in metadata).
   - Cryptographic tamper-evidence of sealed envelopes (`coreSeal`).
   - Idempotent storage rehydration from IndexedDB.
   - Truth Thread Merkle tree verification.
   - Fail-visible benchmark acceptance semantics.
2. **Must Resolve**:
   - Eliminate `solvedAt` variance from engineering result digest calculations.
   - Prevent `IMMUTABLE_IDENTITY_CONFLICT` on legitimate re-execution of identical requests.
   - Handle zero-pressure boundary conditions ($P=0$) without non-finite canonicalization errors.

---

### 15. Final Verdicts

```
========================================================================
SECP POST-DETERMINISM-001B FINAL VERDICTS:
========================================================================
ENGINEERING DETERMINISM:     PROVEN
EXECUTION IDENTITY:          PROVEN
RESULT DIGEST SEMANTICS:     AMBIGUOUS
RE-EXECUTION:                BLOCKED (IMMUTABLE_IDENTITY_CONFLICT)
REHYDRATION:                 SUPPORTED
TRUTH THREAD:                SEMANTIC CONFLICT
M7 CLASS F:                  CONFIRMED (TIMESTAMP VARIANCE → REGISTRY CONFLICT)
M7-OIL-03:                   SEPARATE NUMERICAL BOUNDARY FINDING (INFINITY CANONICALIZATION)

REPAIR:                      NOT PERFORMED
MISSION:                     IDENTITY BOUNDARY ESTABLISHED
========================================================================
```
