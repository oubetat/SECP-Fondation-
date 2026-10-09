# SECP POST-DETERMINISM-002
## IDENTITY SEMANTICS & REPAIR ARCHITECTURE AUDIT

---

### 1. Executive Summary

This audit establishes the definitive architectural semantics of execution identity, result identity, execution occurrence identity, and Truth Thread binding across the SECP platform.

Conducted strictly as a **Read-Only Forensic Architecture Audit**:
- **Zero production or test files modified**.
- **No solver, hashing, digest, or registry logic altered**.
- All conclusions derived from direct source code inspection of definitions, call sites, and consumers.

**Primary Audit Discovery**:
The SECP platform possesses a fundamental architectural conflation between **Execution Scenario Identity** (`executionId`, which is purely deterministic and functions as a request-level identity) and **Execution Occurrence Identity** (which captures a specific runtime invocation event). Because domain solvers inject a wall-clock timestamp (`solvedAt`) into `rawResults`, and `resultDigest` is computed directly over `rawResults`, `resultDigest` ceases to be an **Engineering Result Identity** and instead becomes an **Execution Occurrence Digest**. When identical requests are re-executed, `GenericExecutionRegistry` expects `executionId` to have immutable envelope content; encountering a new `solvedAt` timestamp triggers an `IMMUTABLE_IDENTITY_CONFLICT`.

---

### 2. Current Identity Model

The platform currently employs four layered representations:
1. **Engineering Request Identity (`executionId`)**: Derived from `{ engineeringObjectId, executionKind, geometryHash, inputDigest, pluginId, pluginVersion, revisionHash, solverIdentity }`. Excludes all timestamps and output state.
2. **Computational / Output Payload (`rawResults`)**: Contains both physical scalar outputs (`scalarOutputs`) and runtime invocation metadata (`solvedAt`).
3. **Artifact / Result Digest (`resultDigest`)**: SHA-256 hash of normalized `rawResults`. Conflates physical output with runtime invocation time.
4. **Execution Envelope (`GenericExecutionEnvelope`)**: Sealed data record containing `executionId`, `resultDigest`, `derivationBinding`, and `evidenceLeaf`.

---

### 3. Authoritative Identity Matrix

| Identity / Hash | Inputs | Contains Runtime Metadata? | Stable Under Replay? | Stable Under Rehydration? | Mutable? | Authoritative Consumer | Intended Semantic |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **`executionId`** | 8-field canonical preimage (Entity, Rev, Geom, Input, Plugin, Ver, Kind, Solver) | **NO** | **YES** | **YES** | **NO** | `GenericExecutionRegistry`, `CoreExecutionAuthority` | **Execution Scenario Identity** (Deterministic Request Key) |
| **`computedExecId`** | Same 8-field preimage | **NO** | **YES** | **YES** | **NO** | `GenericExecutionRegistry.registerExecution` | **Integrity Check** (Tamper-evident verification of `executionId`) |
| **`resultDigest`** | `AttestationCanonicalizer.normalizeValue(rawResults)` | **YES** (`solvedAt`) | **NO** | **YES** | **NO** | `derivationBinding`, `EvidenceLeafRecord`, `GenericExecutionRegistry` | **Ambiguous**: Intended as Engineering Result Identity, implemented as Occurrence Hash |
| **`contentDigest`** | 13-field payload (`executionId`, `inputDigest`, `resultDigest`, `rawResults`, etc.) | **YES** (`rawResults.solvedAt`, `resultDigest`) | **NO** | **YES** | **NO** | `GenericExecutionRegistry` (Overwrite Prevention) | **Execution Envelope Immutability Digest** |
| **`artifactContentHash`** | `solverResult.artifactContentHash \|\| resultDigest` | **YES** | **NO** | **YES** | **NO** | `CanonicalDerivedArtifactBinding`, `EvidenceLeafRecord` | **Derived Output Artifact Hash** |
| **`artifactDigest`** | Canonical binding payload (`cadRevisionHash`, `canonicalGeometryHash`, `artifactContentHash`, `scenarioId`) | **YES** (via `artifactContentHash`) | **NO** | **YES** | **NO** | `EvidenceLeafRecord.artifactContentHash`, Lineage Rebinding | **Canonical Derived Artifact Binding Digest** |
| **`leafHash`** | Canonical core evidence (`entityId`, `cadRevisionHash`, `canonicalGeometryHash`, `artifactContentHash`, `executionIdentity`, etc.) | **YES** (via `artifactContentHash`) | **NO** | **YES** | **NO** | `EvidenceMerkleTree` | **Atomic Truth Thread Evidence Leaf Hash** |
| **`Merkle root`** | Pairwise leaf hashes | **YES** (if any leaf has runtime metadata) | **NO** | **YES** | **NO** | Attestation Engine, Certification Authority | **Aggregated Truth Thread Evidence Root** |
| **`provenance hash`** | `RES-NODE-` (`resultDigest`), `EVI-NODE-` (`leafHash`), Edge `relationHash` | **YES** | **NO** | **YES** | **NO** | `ProvenanceGraph` | **Lineage DAG State Hash** |

---

### 4. `resultDigest` Semantic Analysis

**Implemented Meaning**: **`E. MIXED / AMBIGUOUS`**

The current implementation conflates three distinct semantic layers:
1. **Engineering Result Identity Layer**: The physical, mathematical outputs of the solver (`scalarOutputs`, e.g., torque, Mach, drag force, stress).
2. **Execution Occurrence Layer**: The temporal instance of invocation (`solvedAt = new Date().toISOString()`, `executionDurationMs`).
3. **Execution Artifact Identity Layer**: The concrete derived payload used as evidence in the Truth Thread.

Because `resultDigest` directly hashes `rawResults` (which includes `solvedAt`), it cannot function as an immutable engineering result identity under re-execution.

---

### 5. `solvedAt` Analysis

- **Source Trace**: Created inside domain solvers in `CoreExecutionAuthority.ts` (lines 69, 116, 160, 204, 248, 291).
- **Classification**: **`RUNTIME / AUDIT METADATA`**.
- **Engineering Truth Impact**: **ZERO**. Changing `solvedAt` does not alter any physical or mathematical property of the simulated system.
- **Accidental Contaminant vs. Intentional Immutability**:
  - `solvedAt` was intentionally added as informational audit metadata.
  - Its inclusion inside `rawResults` (and thus inside `resultDigest`) was an **architectural accident of convenience**, conflating the solver's audit record with its mathematical output.

---

### 6. Registry Semantics: Replay vs. Rehydration

- **`GenericExecutionRegistry` Contract**:
  - `executionId` is treated as a unique primary key in `authenticExecutions`.
  - When an existing `executionId` is registered again, the registry checks:
    $$\text{existingDigest} === \text{incomingDigest}$$
  - If equal: **Idempotent no-op (Rehydration Success)**.
  - If unequal: **Throws `IMMUTABLE_IDENTITY_CONFLICT`**.
- **Rehydration**:
  - Semantic: *"Restore the exact previously recorded execution occurrence from durable storage."*
  - Status: **SUPPORTED**. Envelopes loaded from IndexedDB preserve their original `solvedAt` and `resultDigest`, matching `existingDigest`.
- **Re-Execution**:
  - Semantic: *"Execute the same engineering request again to reproduce and verify the result."*
  - Status: **BLOCKED**. Re-execution recomputes the same `executionId` but generates a new `solvedAt` timestamp, causing a digest mismatch and triggering `IMMUTABLE_IDENTITY_CONFLICT`.

---

### 7. Truth Thread Impact

- **Propagation Chain**:
  $$\text{solvedAt} \longrightarrow \text{rawResults} \longrightarrow \text{resultDigest} \longrightarrow \text{artifactContentHash} \longrightarrow \text{artifactDigest} \longrightarrow \text{leafHash} \longrightarrow \text{Merkle Root} \longrightarrow \text{Provenance Graph}$$
- **Architectural Reality**:
  - The Truth Thread currently binds to **both** engineering truth and execution occurrence simultaneously.
  - A change in `solvedAt` propagates entirely through the Truth Thread, altering the Merkle root and provenance graph even when the engineering truth is 100% invariant.
  - This is classified as **`SEMANTIC CONFLICT`** because the Truth Thread was designed to attest to engineering integrity, but is currently bound to wall-clock invocation moments.

---

### 8. Security vs. Determinism Analysis

1. **Security Property of Timestamp in Hash**:
   - Binds the cryptographic seal to a specific temporal invocation event.
   - Proves *when* an execution occurred relative to other events.
2. **Determinism Conflict**:
   - Destroys pure mathematical replayability under the same execution identifier.
3. **Core Conclusion**:
   - Excluding `solvedAt` from the engineering result digest does **not** weaken tamper evidence.
   - Tamper evidence of the execution event can be fully preserved by binding timestamps to an **Execution Occurrence Record** / envelope header, while allowing the **Engineering Result Digest** to remain pure and deterministic.

---

### 9. M7 Benchmark Reconciliation

- **M7 Class F Cases (`M7-ROB-06`, `M7-AER-06`, `M7-AUT-06`, `M7-ENE-06`, `M7-MAR-06`, `M7-OIL-06`)**:
  - **Shared Root Cause**: All 6 cases represent exact duplications of Class A inputs. They fail exclusively because `GenericExecutionRegistry` throws `IMMUTABLE_IDENTITY_CONFLICT` due to `solvedAt` timestamp variance altering `resultDigest`.
- **M7-OIL-03 Case**:
  - **Independent Root Cause**: Input `internalPressureMPa: 0` leads to $\sigma_h = 0 \implies \text{Safety Factor} = 450/0 = \infty$. `AttestationCanonicalizer.normalizeValue` throws `Non-finite number (Infinity) cannot be canonicalized`. This is a numerical boundary handling defect, completely separate from the determinism/identity mechanism.
- **M7 Benchmark Accounting Preserved**:
  - `INDEPENDENTLY_PROVEN = 23`
  - `VALID_CASE_FAILURE = 7`
  - `CORRECTLY_REJECTED = 1`
  - `PHYSICAL_CONSTRAINT_UNENFORCED = 5`
  - `TOTAL = 36`

---

### 10. Candidate Future Identity Models (Architecture Only — No Selection)

- **Model A: Pure Engineering Result Digest**:
  - `resultDigest` computed strictly over deterministic engineering outputs; `solvedAt` moved to envelope metadata.
  - *Replay*: Deterministic re-execution supported.
  - *Registry*: Re-execution succeeds idempotently.
  - *Risk*: Envelope header must carry occurrence attestations.
- **Model B: Timestamp-Bound Digest (Status Quo)**:
  - Preserves current behavior.
  - *Replay*: Re-execution remains permanently blocked under identical `executionId`.
  - *Registry*: Requires distinct `executionId` per occurrence (breaking scenario determinism).
- **Model C: Dual Digest (Engineering Result Digest + Occurrence Digest)**:
  - Distinguishes `engineeringResultDigest` (pure physics) from `occurrenceDigest` (runtime event).
  - *Replay*: Supported via `engineeringResultDigest`.
  - *Audit*: Supported via `occurrenceDigest`.
  - *Truth Thread*: Binds both layers with explicit semantic separation.
- **Model D: Triple Identity Separation (Result, Execution, Evidence)**:
  - Completely decouples Request Scenario ID, Physical Result ID, and Evidence Occurrence ID.

---

### 11. Required Architecture Diagram

```
ENGINEERING INPUT (parameters + environmentalSeed)
│
▼
CANONICAL PREIMAGE (Entity + Revision + Geometry + InputDigest + Plugin + Ver + Solver)
│
├──────────────────────────────► EXECUTION SCENARIO IDENTITY (executionId) [DETERMINISTIC]
│
▼
DOMAIN SOLVER EXECUTION
│
├──────────────────────────────► PURE ENGINEERING OUTPUT (scalarOutputs)
│                                       │
│                                       ▼
│                               ENGINEERING RESULT DIGEST [DETERMINISTIC INVARIANT]
│
└──────────────────────────────► RUNTIME / AUDIT METADATA (solvedAt, duration)
                                        │
                                        ▼
                                EXECUTION OCCURRENCE ENVELOPE [TEMPORAL INSTANCE]
                                        │
                                        ▼
                                DERIVED ARTIFACT BINDING & EVIDENCE LEAF
                                        │
                                        ▼
                                TRUTH THREAD / MERKLE TREE / PROVENANCE
```

---

### 12. Required Findings (F-201 through F-216)

- **F-201 — Engineering Result Identity Definition**: `AMBIGUOUS`. Currently lacks a dedicated pure hash; conflated with `resultDigest`.
- **F-202 — Execution Occurrence Identity Definition**: `AMBIGUOUS`. Implicitly represented by `contentDigest` and `sealedEnvelope.timestamp`, but collides with `executionId`.
- **F-203 — Evidence Identity Definition**: `PROVEN`. `leafHash` rigorously binds canonical evidence fields, but inherits timestamp instability from `artifactContentHash`.
- **F-204 — ResultDigest Semantic Definition**: `AMBIGUOUS`. Conflates engineering outputs with invocation metadata.
- **F-205 — solvedAt Semantic Definition**: `PROVEN`. Runtime audit metadata; 0% engineering truth value.
- **F-206 — ExecutionId Semantic Definition**: `PROVEN`. Deterministic execution scenario key based on canonical request preimage.
- **F-207 — Registry Immutability Semantic**: `PROVEN`. Protects registered envelopes from conflicting overwrites, but incorrectly treats `solvedAt` variance as conflicting content.
- **F-208 — Replay Semantic**: `PROVEN BLOCKED`. Re-executing identical requests under the same `executionId` is blocked by the registry.
- **F-209 — Rehydration Semantic**: `PROVEN SUPPORTED`. Historical envelopes reload from durable storage idempotently.
- **F-210 — Truth Thread Binding Semantic**: `SEMANTIC CONFLICT`. Designed to attest to engineering truth, but dynamically alters hashes based on invocation time.
- **F-211 — Evidence/Merkle Binding Semantic**: `SEMANTIC CONFLICT`. Merkle roots vary on re-execution despite identical engineering inputs and outputs.
- **F-212 — Provenance Binding Semantic**: `PROVEN`. Provenance graph structure is sound, but result and evidence node hashes are time-variant.
- **F-213 — Security vs Determinism Separation**: `PROVEN`. Temporal binding and deterministic output hashing are orthogonal properties that must not share a single digest.
- **F-214 — M7 Class F Architectural Reconciliation**: `PROVEN`. All 6 Class F failures are caused by registry rejection of `solvedAt` variance across duplicate scenario requests.
- **F-215 — OIL-03 Separation**: `PROVEN`. Caused by $P=0$ division singularity producing `Infinity`, rejected by `AttestationCanonicalizer`.
- **F-216 — Future Repair Boundary**: `PROVEN`. Future repair must separate physical result hashing from invocation occurrence metadata without weakening tamper evidence or breaking rehydration.

---

### 13. Required Future Repair Boundaries

Any future repair mission (e.g., M8) MUST preserve the following invariants:
1. **Scenario Determinism**: `executionId` must remain strictly deterministic based on canonical request inputs.
2. **Computational Truth**: Physical simulation formulas and `scalarOutputs` must remain untouched.
3. **Audit Trail Integrity**: Wall-clock timestamps (`solvedAt`, `timestamp`) must remain visible and tamper-evident in audit records.
4. **Storage Rehydration Compatibility**: Existing persisted envelopes in IndexedDB must continue to rehydrate idempotently.
5. **Fail-Visible Semantics**: Benchmark acceptance must never pass silently when engineering or boundary failures occur.

---

### 14. Explicit Non-Changes

During this mission:
- `CoreExecutionAuthority.ts`: **0 lines modified**.
- `GenericExecutionRegistry.ts`: **0 lines modified**.
- `AttestationCanonicalizer.ts`: **0 lines modified**.
- Domain Solvers: **0 lines modified**.
- `M7BenchmarkProven.test.ts`: **0 lines modified**.
- Vitest Test Results: **Maintained at 2 passed / 1 failed (7 valid failures caught)**.

---

### 15. Final Verdicts

```
ENGINEERING RESULT IDENTITY: AMBIGUOUS

EXECUTION OCCURRENCE IDENTITY: AMBIGUOUS

EVIDENCE IDENTITY: PROVEN

RESULT DIGEST SEMANTICS: AMBIGUOUS

SOLVEDAT SEMANTICS: PROVEN

REGISTRY SEMANTICS: PROVEN

REPLAY SEMANTICS: BLOCKED

REHYDRATION SEMANTICS: SUPPORTED

TRUTH THREAD BINDING: CONFLICT

EVIDENCE BINDING: CONFLICT

SECURITY PROPERTY: PROVEN

M7 CLASS F: CONFIRMED

M7-OIL-03: SEPARATE

REPAIR MODEL: NOT SELECTED

IMPLEMENTATION: NOT PERFORMED

MISSION: IDENTITY SEMANTICS ESTABLISHED
```
