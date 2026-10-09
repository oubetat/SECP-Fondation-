# SECP POST-DETERMINISM-001
## IMMUTABLE EXECUTION IDENTITY & RESULT DIGEST FORENSIC REPORT

---

### 1. Executive Summary

This document presents the authoritative forensic audit of execution determinism, execution identity, result digest construction, and replay semantics in the SECP platform.

The audit was conducted under strict **Forensic-First / Read-Only** constraints:
- **Zero code changes** were made to domain solvers, `CoreExecutionAuthority`, `GenericExecutionRegistry`, `AttestationCanonicalizer`, or test suites.
- **Zero test assertions were weakened or altered**.
- All causal chains were verified through source-level dependency tracing and controlled node execution experiments.

**Core Findings**:
1. **Computational Determinism**: **PROVEN (100%)**. Given identical inputs, domain solvers produce identical scalar engineering outputs.
2. **Execution Identity Determinism**: **PROVEN (100%)**. `executionId` is computed strictly from canonical inputs and system metadata, excluding timestamps.
3. **Result Digest Instability**: **PROVEN (DEFECT CONFMED)**. `resultDigest` hashes `rawResults`, which embeds dynamic wall-clock timestamps (`solvedAt: new Date().toISOString()`). Re-running a solver with identical inputs produces a different `resultDigest`.
4. **M7 Class F Root Cause**: **PROVEN**. All 6 Class F reproducibility cases (`M7-ROB-06`, `M7-AER-06`, `M7-AUT-06`, `M7-ENE-06`, `M7-MAR-06`, `M7-OIL-06`) failed because duplicate inputs produced the same `executionId` as Class A cases, but differing `solvedAt` timestamps changed `resultDigest`, causing `GenericExecutionRegistry` to reject registration with `IMMUTABLE_IDENTITY_CONFLICT`.
5. **M7-OIL-03 Separate Root Cause**: **PROVEN**. `M7-OIL-03` ($P=0$) failed due to an unchecked zero-division ($450/0 = \infty$) in pipeline safety factor calculation, which caused `AttestationCanonicalizer.normalizeValue` to throw `Error: [AttestationCanonicalizer] Non-finite number (Infinity) cannot be canonicalized`. This is a domain numerical singularity error, completely independent of the timestamp issue.

---

### 2. Execution Identity Model

Execution identity (`executionId` / `computedExecId`) represents the deterministic identifier for a specific engineering computation scenario.

- **Formula**:
  $$\texttt{executionId} = \texttt{"EXEC-" + Substring(SHA-256(PreimageString), 0, 24).ToUpper()}$$
- **Preimage String Format**:
  Sorted key-value pairs concatenated with `&`:
  $$\texttt{engineeringObjectId=...&executionKind=...&geometryHash=...&inputDigest=...&pluginId=...&pluginVersion=...&revisionHash=...&solverIdentity=...}$$
- **Inputs**:
  1. `engineeringObjectId`
  2. `executionKind`
  3. `geometryHash`
  4. `inputDigest` (SHA-256 of canonical parameters + seed)
  5. `pluginId`
  6. `pluginVersion`
  7. `revisionHash`
  8. `solverIdentity`
- **Exclusions**:
  - `solvedAt` (Timestamp): **EXCLUDED**
  - `timestamp` (Envelope timestamp): **EXCLUDED**
  - `solverResult` / `rawResults`: **EXCLUDED**
- **Source Location**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 338-363) and `GenericExecutionRegistry.ts` (lines 94-110).

---

### 3. Computed Execution ID Model

`GenericExecutionRegistry.registerExecution` recomputes `computedExecId` from the envelope metadata upon registration and verifies that `computedExecId === envelope.executionId`.

- **Source Location**: `src/engine/execution/GenericExecutionRegistry.ts` (lines 94-110).
- **Function**: Guarantees tamper-evidence of execution envelope header fields.

---

### 4. Result Digest Model

`resultDigest` represents the cryptographic hash of the solver's execution outputs.

- **Formula**:
  $$\texttt{resultDigest} = \text{SHA-256}(\text{JSON.stringify}(\text{AttestationCanonicalizer.normalizeValue}(\text{solverResult.rawResults})))$$
- **Source Location**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 452-454) and `GenericExecutionRegistry.ts` (lines 78-80).
- **Defect Mechanism**:
  Domain solvers construct `rawResults` as follows:
  ```typescript
  const rawResults = {
    gravityTorqueNm: 95.2,
    totalShoulderTorqueNm: 114.9,
    motorCurrentAmp: 135.1,
    verificationVerdict: 'PASS',
    solvedAt: new Date().toISOString() // DYNAMIC TIMESTAMP
  };
  ```
  Because `rawResults` includes `solvedAt`, calling `execute()` at $t_1$ vs $t_2$ produces different strings, generating different `resultDigest` hashes for identical physical inputs.

---

### 5. `solvedAt` Trace

- **Creation**: Generated inside domain solvers (`CoreExecutionAuthority.ts` lines 69, 116, 160, 204, 248, 291) via `new Date().toISOString()`.
- **Type**: ISO 8601 UTC string (millisecond precision).
- **Inclusions**:
  - Included in `solverResult.rawResults`: **YES**
  - Included in `resultDigest`: **YES**
  - Included in `executionId`: **NO**
  - Included in `contentDigest`: **YES**
  - Included in `EvidenceLeafRecord`: **INDIRECTLY** (via `derivationBinding.artifactDigest`)
  - Included in `ProvenanceGraph`: **INDIRECTLY** (via `RES-NODE-` hash)

---

### 6. GenericExecutionRegistry Semantics

`GenericExecutionRegistry` enforces strict immutability and overwrite prevention:

1. **Map Storage**: Keyed by `executionId`.
2. **Re-Registration Check**:
   If `this.authenticExecutions.has(executionId)` is true:
   - Computes `existingDigest = computeContentDigest(existing)`
   - Computes `contentDigest = computeContentDigest(incomingEnvelope)`
   - If `existingDigest === contentDigest`: **Passes idempotently** (re-registration of exact match).
   - If `existingDigest !== contentDigest`: **Throws `IMMUTABLE_IDENTITY_CONFLICT`**.
3. **The Conflict**:
   Because duplicate requests generate the exact same `executionId` (since inputs haven't changed), but a new `solvedAt` timestamp produces a different `contentDigest`, the registry rejects the second execution as a conflicting overwrite attempt.

---

### 7. Replay Experiments Summary

- **EXPERIMENT A (Immediate Double Execution)**:
  - Run 1: `executionId` = `EXEC-AF089942BCEE56675CC4C775`, `resultDigest` = `6f2cb16b...`, `solvedAt` = `2026-09-25T13:57:59.711Z`. Succeeded.
  - Run 2 (20ms later): Same inputs. `executionId` = `EXEC-AF089942BCEE56675CC4C775`. Threw `IMMUTABLE_IDENTITY_CONFLICT`.
- **EXPERIMENT B (Replay Persisted Execution)**:
  - Rehydrated stored envelope from storage. `rehydrateFromStorage()` succeeded idempotently because stored envelope retained its original `solvedAt` and `resultDigest`.
- **EXPERIMENT C (Execution Identity vs Timestamp)**:
  - Confirmed: `executionId` is 100% independent of `solvedAt`.
- **EXPERIMENT D (Engineering Result vs solvedAt in resultDigest)**:
  - Confirmed: Physical outputs (`scalarOutputs`) are identical across runs, but `resultDigest` changes solely due to `solvedAt`.

---

### 8. Determinism Analysis

| Category | Definition | Status | Forensic Observation |
| :--- | :--- | :---: | :--- |
| **A. Computational Determinism** | Same inputs produce same engineering output | **PROVEN** | `scalarOutputs` match 100% across runs. |
| **B. Execution Identity Determinism** | Same inputs produce same `executionId` | **PROVEN** | `executionId` is completely deterministic. |
| **C. Result Digest Determinism** | Same output produces same `resultDigest` | **DEFECTIVE** | `solvedAt` in `rawResults` alters `resultDigest`. |
| **D. Replay Determinism** | Logically identical execution can be re-run | **DEFECTIVE** | Re-execution throws `IMMUTABLE_IDENTITY_CONFLICT`. |
| **E. Audit Metadata Variance** | Timestamps vary without breaking identity | **UNHANDLED** | Timestamp is currently treated as content identity. |

---

### 9. M7 Class F Reconciliation

All 6 Class F cases (`M7-ROB-06`, `M7-AER-06`, `M7-AUT-06`, `M7-ENE-06`, `M7-MAR-06`, `M7-OIL-06`) have identical input parameters to Class A cases (`M7-ROB-01`, `M7-AER-01`, etc.).

When the benchmark loop executes Class A, `CoreExecutionAuthority` registers the sealed envelope under `executionId` $E_1$.
When the benchmark loop executes Class F, `CoreExecutionAuthority` generates the same `executionId` $E_1$. However, the solver execution generates a new `solvedAt` timestamp $T_2 \ne T_1$, changing `resultDigest` to $R_2 \ne R_1$. `GenericExecutionRegistry` catches $E_1$ already present with $R_2 \ne R_1$ and throws `IMMUTABLE_IDENTITY_CONFLICT`.

---

### 10. `M7-OIL-03` Separate Forensic Analysis

- **Input**: `internalPressureMPa: 0`, `outerDiameterMm: 508`, `wallThicknessMm: 15.8`, `materialYieldStrengthMPa: 450`.
- **Numerical Execution Path**:
  $$\text{hoopStressMPa} = \frac{0 \times 508}{2 \times 15.8} = 0$$
  $$\text{actualSafetyFactor} = \frac{\text{yieldMPa}}{\text{hoopStressMPa}} = \frac{450}{0} = \infty \quad (\text{Infinity})$$
- **Exception Trigger**:
  `oilGasSolver` constructs `rawResults` containing `{ actualSafetyFactor: Infinity }` and calls `AttestationCanonicalizer.normalizeValue(rawResults)`.
  `AttestationCanonicalizer.normalizeValue` evaluates `!Number.isFinite(Infinity)` and throws:
  `Error: [AttestationCanonicalizer] Non-finite number (Infinity) cannot be canonicalized`
- **Classification**: **NUMERICAL SINGULARITY / UNCHECKED ZERO-DIVISION**. Completely distinct root cause from Class F timestamp instability.

---

### 11. Cross-Layer Authority Impact

1. **Truth Thread**: Evidence leaf records (`EvidenceLeafRecord`) store `artifactContentHash` derived from `resultDigest`. Unstable `resultDigest` causes evidence leaf hashes to change across re-executions.
2. **Persistence**: `IndexedDbEngine` persists envelopes stored in `GenericExecutionRegistry`. Storage rehydration works correctly for historical records.
3. **Evidence & Provenance**: `ProvenanceGraph` nodes (`RES-NODE-`, `EVI-NODE-`) depend on `resultDigest`.

---

### 12. Security vs Integrity Analysis

- **Event Attestation Security**: Embedding wall-clock `solvedAt` inside `rawResults` and `resultDigest` binds the execution envelope to a specific temporal invocation event, making every execution attempt unique in time.
- **Computational Replay Determinism**: A pure functional engineering platform expects identical physical inputs to produce identical output digests so executions can be replayed and verified deterministically.
- **Architectural Trade-off**: The current implementation attempts to enforce both event temporal uniqueness AND deterministic scenario identity (`executionId`), creating a contradiction when duplicate requests are executed.

---

### 13. Required Forensic Findings (F-001 through F-014)

#### **F-001: Execution Identity Definition**
- **STATUS**: `PROVEN`
- **PROOF**: `executionId` is computed deterministically from preimage `{ engineeringObjectId, executionKind, geometryHash, inputDigest, pluginId, pluginVersion, revisionHash, solverIdentity }`.
- **SOURCE**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 338-363).
- **IMPACT**: Identity is independent of runtime timestamps.

#### **F-002: Computed Execution ID Definition**
- **STATUS**: `PROVEN`
- **PROOF**: `GenericExecutionRegistry` recomputes `computedExecId` from preimage upon registration.
- **SOURCE**: `src/engine/execution/GenericExecutionRegistry.ts` (lines 94-110).
- **IMPACT**: Prevents envelope header tampering.

#### **F-003: Result Digest Definition**
- **STATUS**: `PROVEN`
- **PROOF**: `resultDigest` is SHA-256 of `AttestationCanonicalizer.normalizeValue(solverResult.rawResults)`.
- **SOURCE**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 452-454).
- **IMPACT**: Hashes all properties inside `rawResults`, including runtime metadata.

#### **F-004: solvedAt Dependency**
- **STATUS**: `PROVEN`
- **PROOF**: `solvedAt = new Date().toISOString()` is embedded inside `rawResults` across all 6 domain solvers.
- **SOURCE**: `src/engine/execution/CoreExecutionAuthority.ts` (lines 69, 116, 160, 204, 248, 291).
- **IMPACT**: Destroys result digest stability across re-executions.

#### **F-005: Generic Registry Comparison Semantics**
- **STATUS**: `PROVEN`
- **PROOF**: `GenericExecutionRegistry` throws `IMMUTABLE_IDENTITY_CONFLICT` when re-registering an existing `executionId` with non-matching `contentDigest`.
- **SOURCE**: `src/engine/execution/GenericExecutionRegistry.ts` (lines 125-135).
- **IMPACT**: Re-running a solver with identical inputs triggers an identity conflict error.

#### **F-006: Replay Semantics**
- **STATUS**: `PARTIALLY_PROVEN`
- **PROOF**: Ledger rehydration from IndexedDB succeeds idempotently, but re-executing identical requests fails.
- **SOURCE**: `src/engine/execution/GenericExecutionRegistry.ts` (lines 132-133, 220-239).
- **IMPACT**: Persistence replay works; execution replay fails.

#### **F-007: Determinism Status**
- **STATUS**: `PARTIALLY_PROVEN`
- **PROOF**: Computational physics is deterministic; result digests and execution registry entries are non-deterministic across time.
- **SOURCE**: Experiments A, B, C, D.
- **IMPACT**: Platform physics is sound, but execution layer artifacts vary.

#### **F-008: Result Digest Stability**
- **STATUS**: `PROVEN`
- **PROOF**: `resultDigest` changes on every invocation for identical inputs.
- **SOURCE**: Experiments A & D.
- **IMPACT**: Result digest is unstable across time.

#### **F-009: M7 Class F Root Cause**
- **STATUS**: `PROVEN`
- **PROOF**: All 6 Class F cases failed because duplicate inputs generated the same `executionId` as Class A cases, but `solvedAt` timestamp variance triggered `IMMUTABLE_IDENTITY_CONFLICT`.
- **SOURCE**: Experiments A & M7 test trace.
- **IMPACT**: Class F failures are execution-layer registry conflicts, not domain physics failures.

#### **F-010: OIL-03 Root Cause**
- **STATUS**: `PROVEN`
- **PROOF**: `M7-OIL-03` ($P=0$) caused $\text{Safety Factor} = 450/0 = \infty$. `AttestationCanonicalizer.normalizeValue` threw `Non-finite number (Infinity) cannot be canonicalized`.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 281-283) and `AttestationCanonicalizer.ts` (lines 23-25).
- **IMPACT**: Unchecked zero-division numerical singularity.

#### **F-011: Truth Thread Impact**
- **STATUS**: `PROVEN`
- **PROOF**: Evidence leaf records bind `artifactContentHash` to `resultDigest`.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 456-494).
- **IMPACT**: Evidence leaf hashes vary if computations are re-executed.

#### **F-012: Persistence Impact**
- **STATUS**: `PROVEN`
- **PROOF**: Storage persistence operates on sealed envelopes in `this.authenticExecutions`.
- **SOURCE**: `GenericExecutionRegistry.ts` (lines 220-254).
- **IMPACT**: Persistence layer is sound for registered envelopes.

#### **F-013: Evidence/Provenance Impact**
- **STATUS**: `PROVEN`
- **PROOF**: `ProvenanceGraph` nodes build relationships using `inputDigest` and `resultDigest`.
- **SOURCE**: `CoreExecutionAuthority.ts` (lines 531-640).
- **IMPACT**: Lineage DAG structure is valid, but result nodes carry time-varying digests.

#### **F-014: Security/Integrity Implication**
- **STATUS**: `PROVEN`
- **PROOF**: Including `solvedAt` in `resultDigest` binds envelopes to wall-clock invocation instances, but conflicts with computational replay determinism.
- **SOURCE**: `CoreExecutionAuthorityInternal.ts` (lines 35-40).
- **IMPACT**: Semantic conflict between invocation event uniqueness and deterministic replayability.

---

### 14. Proposed Follow-Up Repair Scope (For Future Mission)

The proposed repair scope for a future dedicated mission (M8) includes:

1. **Separation of Engineering Result Payload from Invocation Metadata**:
   - Extract `solvedAt` and `executionDurationMs` out of `solverResult.rawResults` into an explicit `invocationMetadata` block on `GenericExecutionEnvelope`.
   - Compute `resultDigest` exclusively over pure engineering physical outputs in `rawResults` (e.g. `scalarOutputs` and deterministic solver fields).
2. **Zero-Division Safeguards**:
   - Update `oilGasSolver` to guard against zero pressure: `actualSafetyFactor = hoopStressMPa > 0 ? yieldMPa / hoopStressMPa : 0`.
3. **Physical Domain Guardrails**:
   - Add domain constraint checks inside domain solvers to reject invalid physical inputs (negative lengths, sub-surface altitudes, negative drag coefficients, Betz limit violations).

---

### 15. Final Verdicts

```
========================================================================
SECP POST-DETERMINISM-001 FINAL VERDICTS:
========================================================================
EXECUTION IDENTITY:         PROVEN DETERMINISTIC
RESULT DIGEST:              DEFECTIVE (TIMESTAMPS INCLUDED IN DIGEST)
COMPUTATIONAL DETERMINISM:  PROVEN DETERMINISTIC
REPLAY DETERMINISM:         DEFECTIVE (IMMUTABLE_IDENTITY_CONFLICT ON RE-RUN)
M7 CLASS F ROOT CAUSE:      PROVEN (TIMESTAMP VARIANCE → REGISTRY CONFLICT)
OIL-03 ROOT CAUSE:          PROVEN (ZERO-DIVISION → INFINITY CANONICALIZATION ERROR)
TRUTH THREAD IMPACT:        PROVEN (EVIDENCE LEAF HASH VARIES ON RE-RUN)
PERSISTENCE IMPACT:         PROVEN (STORAGE REHYDRATION IS SOUND)
SECURITY / INTEGRITY IMPACT:PROVEN (INVOCATION EVENT BINDING VS REPLAY CONFLICT)

REPAIR STATUS:              NO REPAIR — FORENSIC ONLY
FOLLOW-UP REQUIRED:         YES (PROPOSED M8 REPAIR SCOPE)
========================================================================
```
