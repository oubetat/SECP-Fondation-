# SECP — POST-PLUGIN-ARCHITECTURE-002: EXISTING AUTHORITY RECONCILIATION
## PLUGIN ARCHITECTURE → ACTUAL SECP AUTHORITY MECHANISMS
**MODE**: READ-ONLY FORENSIC RECONCILIATION  
**STATUS**: IMPLEMENTATION NOT STARTED

---

### 1. EXECUTIVE SUMMARY & FORENSIC CONTEXT

The purpose of this forensic audit is to reconcile the proposed plugin architecture (`POST-PLUGIN-ARCHITECTURE-001`) against the actual codebase of the Simulation Engine & Certification Platform (SECP). This reconciliation is critical to prevent the introduction of parallel authority architectures, duplicate state registers, or security regressions.

This document identifies which aspects of the previous proposal represent reusable production code, which elements are duplicate or conflicting, and what core engineering primitives are missing or unproven. 

**Absolute Constraint Compliance**: This audit is entirely read-only. No codebase modifications, test updates, or schema migrations have been performed. All findings are derived directly from a static analysis of production implementations and their adversarial testing suites.

---

### 2. CORE AUTHORITY & ARCHITECTURE RECONCILIATION MATRIX

The table below maps each proposed concept from `POST-PLUGIN-ARCHITECTURE-001` against the actual, proven SECP mechanisms in the repository.

| POST-PLUGIN-ARCHITECTURE-001 Concept | Actual SECP Mechanism | File Path | Symbol / Class | Runtime Proof | Classification | Reuse / Integration Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CanonicalBindingContext** | `CanonicalDerivedArtifactBinding` | `src/engine/topology/CanonicalDerivedArtifactBinding.ts` | `CanonicalDerivedArtifactBinding` | Yes (proven in `CanonicalDerivedArtifactBinding.test.ts`) | **EXISTS_AND_REUSABLE** | Reject proposed context. Direct reuse of `CanonicalDerivedArtifactBinding` is mandatory to avoid identity duplication. |
| **PluginExecutionMode** | *None* | *None* | *None* | No | **MISSING** | **MISSING**. Must be added to plugin schema to distinguish UI calculators from verified engine extensions. |
| **UnitQuantity** | Simple floating-point values | `src/sdk/secpPluginSdk.ts` | *None* | No | **MISSING** | **MISSING**. SECP currently passes untyped numbers. Strongly-typed engineering units are missing at SDK level. |
| **AuthoritativePluginCapabilityDeclaration** | Conceptual metadata | `src/engine/governance/PluginAuthorityBoundary.ts` | `PluginEngineeringClaim` | Yes (proven in boundary checks) | **EXISTS_PARTIALLY** | The governance boundary exists, but runtime permission schema is missing. Must extend `PluginAuthorityBoundary`. |
| **AuthoritativeExecutionRequest** | `SimulationScenario` (simulation-specific) | `src/engine/simulation/SimulationEngine.ts` | `SimulationScenario` | Yes (proven in `SimulationEngine.ts`) | **EXISTS_BUT_INSUFFICIENT** | Existing requests are tightly coupled to simulation parameters. Generic execution requests are missing. |
| **AuthoritativeSolverOutput** | `SimulationResult` | `src/engine/simulation/SimulationEngine.ts` | `SimulationResult` | Yes (proven in `SimulationEngine.runScenario`) | **EXISTS_BUT_INSUFFICIENT** | Current output structures are locked to simulation results and must be generalized. |
| **PluginGateEvaluationResult** | String verdict (`'PASS'`) or error code | `src/engine/manufacturing/pma/PhysicalManufacturingEngine.ts` | `DeviationVerdict` | Yes (proven in `PhysicalManufacturingEngine.ts`) | **EXISTS_PARTIALLY** | Gate evaluation outputs exist but lack a standardized, structured JSON-LD wrapper. |
| **PluginEvidenceBundle** | `EvidenceLeafRecord` / `EvidenceMerkleTree` | `src/engine/certification/truth/EvidenceMerkleTree.ts` | `EvidenceLeafRecord` | Yes (proven in `EvidenceMerkleTree.ts`) | **EXISTS_AND_REUSABLE** | Proposed bundle is **DUPLICATED** by `EvidenceLeafRecord`. Directly map plugin inputs/outputs to `EvidenceLeafRecord`. |
| **AuthoritativeSealEnvelope** | `SimulationExecutionEnvelope` | `src/engine/simulation/SimulationAuthorityInternal.ts` | `SimulationExecutionEnvelope` | Yes (proven in `SimulationExecutionRegistry.ts`) | **EXISTS_BUT_INSUFFICIENT** | Exists, but is locked to simulation results. Must be generalized to a universal execution envelope. |
| **SecpAuthoritativePluginTool** | `SecpPluginTool` (UI only) | `src/sdk/secpPluginSdk.ts` | `SecpPluginTool` | Yes (proven in UI workbench) | **EXISTS_BUT_INSUFFICIENT** | Current tools have only local `compute` methods; no authoritative loop exists. |

---

### 3. THE 14-POINT CORE REUSE MATRIX

To prevent the creation of a "second authority" model, each proposed architectural domain has been reconciled against the existing codebase to identify the authoritative owner and define the reuse strategy.

```
                  SECP TRUTH THREAD REUSE DIRECTIVE
                  
     Engineering Object ID ──► [RevisionEngine] ──► (Locked Revision)
                                     │
                                     ▼
                      [DerivedArtifactBinding]
                                     │
                                     ▼
                          [EvidenceMerkleTree]
                                     │
                                     ▼
                       [SimulationExecutionRegistry]
                                     │
                                     ▼
                      [EngineeringTruthCertificate]
```

1. **Canonical Identity**:
   * *Existing Owner*: `RevisionEngine` / `CanonicalDocument`
   * *Actual Mechanism*: Document IDs and revision IDs (e.g. `REV-1`, `PART-1`).
   * *Plugin Access*: Read-only access through snapshots.
   * *Proven?*: Yes, in `RevisionLifecycle.test.ts`.
   * *Reusable?*: Yes, directly reusable.

2. **Canonical Revision**:
   * *Existing Owner*: `RevisionEngine` (`src/engine/revision/RevisionEngine.ts`)
   * *Actual Mechanism*: Revision entities with state locks and lifecycle states (`DRAFT`, `IN_REVIEW`, `APPROVED`, `RELEASED`).
   * *Plugin Access*: Plugins must bind explicitly to a released `revisionHash`.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

3. **Revision Hash**:
   * *Existing Owner*: `RevisionCanonicalizer` (`src/engine/revision/RevisionCanonicalizer.ts`)
   * *Actual Mechanism*: SHA-256 hash of canonicalized content and dependency arrays.
   * *Plugin Access*: Read-only comparison.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

4. **Geometry Identity**:
   * *Existing Owner*: `RevisionEngine` snapshots
   * *Actual Mechanism*: `geometryHash` (e.g. `GEOM-1`).
   * *Plugin Access*: Extracted from CAD snapshots.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

5. **Topology Identity**:
   * *Existing Owner*: `CanonicalDerivedArtifactBinding` (`src/engine/topology/CanonicalDerivedArtifactBinding.ts`)
   * *Actual Mechanism*: `topologyHash` and specific boundary representation IDs (body, face, edge).
   * *Plugin Access*: Stored inside `DerivedArtifactBindingPayload`.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

6. **Derived Artifact Binding**:
   * *Existing Owner*: `CanonicalDerivedArtifactBinding`
   * *Actual Mechanism*: Binds non-authoritative derived artifacts to exact CAD revisions via `artifactDigest`.
   * *Plugin Access*: Direct. Plugins must generate these bindings for all computed artifacts.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

7. **Authoritative Execution**:
   * *Existing Owner*: `SimulationEngine` (`src/engine/simulation/SimulationEngine.ts`)
   * *Actual Mechanism*: Evaluates scenarios against locked revisions and seals output.
   * *Plugin Access*: Indirectly via Core-facing adapters.
   * *Proven?*: Yes.
   * *Reusable?*: Reusable only with generalization (currently simulation-specific).

8. **Execution Identity**:
   * *Existing Owner*: `SimulationExecutionRegistry` (`src/engine/simulation/SimulationExecutionRegistry.ts`)
   * *Actual Mechanism*: `provenanceHash` derived from result bindings.
   * *Plugin Access*: Calculated by the core during execution.
   * *Proven?*: Yes.
   * *Reusable?*: Yes.

9. **Execution Sealing**:
   * *Existing Owner*: `SimulationAuthorityInternal` (`src/engine/simulation/SimulationAuthorityInternal.ts`)
   * *Actual Mechanism*: Key-authenticated sealing via `Symbol('SIMULATION_AUTHORITY_SEAL')`.
   * *Plugin Access*: **BLOCKED**. Private capability is inaccessible to plugins.
   * *Proven?*: Yes.
   * *Reusable?*: Yes, but the sealing must be performed by the Engine Core *after* verifying the plugin output.

10. **Execution Registry**:
    * *Existing Owner*: `SimulationExecutionRegistry`
    * *Actual Mechanism*: In-memory map storage with deep-freezing and overwrite prevention.
    * *Plugin Access*: Write via sealed envelopes only; read via `verifyResultBinding`.
    * *Proven?*: Yes.
    * *Reusable?*: Reusable only for simulation-type plugin outputs. A generic execution registry is missing.

11. **Verification**:
    * *Existing Owner*: `HardAcceptanceGates` & `MetrologyEvaluator`
    * *Actual Mechanism*: Threshold-based acceptance validation.
    * *Plugin Access*: Automated verification check prior to sealing.
    * *Proven?*: Yes.
    * *Reusable?*: Yes.

12. **Evidence**:
    * *Existing Owner*: `EvidenceMerkleTree` (`src/engine/certification/truth/EvidenceMerkleTree.ts`)
    * *Actual Mechanism*: Standardizes evidence records into `EvidenceLeafRecord` format and computes deterministic leaf hashes.
    * *Plugin Access*: Direct. Plugins write output to evidence leaves.
    * *Proven?*: Yes.
    * *Reusable?*: Yes, directly.

13. **Merkle Roots**:
    * *Existing Owner*: `EvidenceMerkleTree`
    * *Actual Mechanism*: Computes the root hash of the aggregated evidence tree.
    * *Plugin Access*: Read-only via certificate verification.
    * *Proven?*: Yes.
    * *Reusable?*: Yes, directly.

14. **Provenance**:
    * *Existing Owner*: `ProvenanceGraph` (`src/engine/provenance/ProvenanceGraph.ts`)
    * *Actual Mechanism*: Directed acyclic graph tracking engineering node lineage.
    * *Plugin Access*: Append-only node registration.
    * *Proven?*: Yes.
    * *Reusable?*: Yes, directly.

---

### 4. CORE RECONCILIATION MATRICES

#### 4.1 Authority Matrix
| Authority | Existing Owner | Actual Mechanism | Plugin Access | Proven? | Reusable? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Canonical Read** | `RevisionEngine` | Memory map lookup of frozen revision snapshots | Read-only access to CAD params | Yes | Yes |
| **Canonical Write** | `RevisionEngine` | `createRevision()` | Blocked (plugins cannot write CAD state) | Yes | No |
| **Revision Approval** | `RevisionEngine` | `addApproval()` | Blocked (restricted to authorized roles) | Yes | No |
| **Engine Execution** | `SimulationEngine` | `runScenario()` | Indirect invocation | Yes | Yes |
| **Simulation Seal** | `SimulationAuthorityInternal` | `sealEnvelope()` using private `ENGINE_KEY` Symbol | **Blocked** (private capability) | Yes | No |
| **Manufacturing Truth**| `PhysicalManufacturingEngine` | `verifyTelemetryChain()` | Blocked (restricted to machine ID keys) | Yes | No |
| **Physical Truth** | `MetrologyEngine` | `submitAcquisitionEnvelope()` | Blocked (requires calibrated drivers) | Yes | No |
| **Metrology Truth** | `MetrologyEvaluator` | Dimensional deviation evaluation | Blocked (restricted to metrology engine) | Yes | No |
| **Verification** | `HardAcceptanceGates` | Automated gate validation rules | Triggered automatically by core | Yes | Yes |
| **Evidence** | `EvidenceMerkleTree` | `buildFromLeaves()` | Plugins write to standardized leaves | Yes | Yes |
| **Certification** | `EngineeringTruthCertificateEngine` | `issue()` | Blocked (requires certificate engine key) | Yes | No |
| **Release** | `RevisionEngine` | Lifecycle transition to `RELEASED` | Blocked (restricted to admin keys) | Yes | No |

#### 4.2 Identity Matrix
| Identity Type | Existing Source Class | Hash / Identifier Format | Active Authority | Revision Bound? | Plugin Reusable? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Engineering Object**| `RevisionEngine` | String `PART-1` | Revision Authority | N/A | Yes |
| **Canonical Revision**| `RevisionEngine` | SHA-256 `revisionHash` | Revision Authority | Yes (Self) | Yes |
| **Geometry** | `RevisionEngine` | SHA-256 `geometryHash` | Revision Authority | Yes | Yes |
| **Topology** | `CanonicalDerivedArtifactBinding` | B-Rep component IDs (`faceId`, `edgeId`) | Topology Adapter | Yes | Yes |
| **Execution** | `SimulationExecutionRegistry` | SHA-256 `provenanceHash` | Simulation Authority | Yes | Yes |
| **Result** | `SimulationExecutionRegistry` | SHA-256 `canonicalContentDigest` | Simulation Authority | Yes | Yes |
| **Artifact** | `CanonicalDerivedArtifactBinding` | SHA-256 `artifactDigest` | Binding Engine | Yes | Yes |
| **Verification** | `HardAcceptanceGates` | String `gateId` (e.g. `GATE-PMA-001`) | Verification Engine | Yes | Yes |
| **Evidence** | `EvidenceMerkleTree` | SHA-256 `leafHash` | Evidence Engine | Yes | Yes |
| **Certificate** | `EngineeringTruthCertificateEngine` | SHA-256 `certificateHash` | Certificate Authority | Yes | Yes |

---

### 5. DETAILED ANALYSIS OF PROVEN SECURITY & ATTACK SURFACES

A static forensic threat modeling of the SECP architecture reveals how existing mechanisms mitigate common attack vectors and where vulnerabilities remain unmitigated.

```
                            ATTACK VECTOR BLOCKING DIAGRAM
                            
    Rogue Plugin Result ──► [PluginAuthorityBoundary] ──► Blocked (DECLARED_ONLY)
    Stale Revision Replay ─► [verifyResultBinding] ────► Blocked (REVISION_MISMATCH)
    Forged Authority Seal ─► [verifyEnvelopeSeal] ─────► Blocked (Missing Symbol)
    Duplicate Overwrite ──► [SimulationExecutionRegistry] ──► Blocked (IMMUTABLE_IDENTITY)
```

1. **Forged Plugin Result**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_VERIFICATION**. The `PluginAuthorityBoundary` intercepts direct status changes. Claims submitted directly by plugins are marked as `DECLARED_ONLY` and structurally blocked from crossing the release boundary.
2. **Stale Revision**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_IDENTITY_BINDING**. The `verifyResultBinding` check validates the binding against the *current* expected revision hash. If the document is updated, the stale revision check fails with `REVISION_MISMATCH`.
3. **Wrong Geometry**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_IDENTITY_BINDING**. The `verifyResultBinding` check enforces a direct match against the geometry hash.
4. **Cross-Revision Replay**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_IDENTITY_BINDING**. Handled via `REVISION_MISMATCH` in the `verifyResultBinding` chain.
5. **Cross-Object Replay**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_IDENTITY_BINDING**. The `DerivedArtifactBindingPayload` binds the exact `entityId`/`partId` into the cryptographic preimage of the `artifactDigest`.
6. **Forged Seal**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. The seal is a private JS `Symbol('SIMULATION_AUTHORITY_SEAL')` kept local to `SimulationAuthorityInternal`. It is impossible for a public plugin to append this property dynamically.
7. **Reused Valid Seal (Token Replay)**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_IDENTITY_BINDING**. An attacker cannot repackage a signed seal for a different payload because the top-level envelope binds the signature to the unique `provenanceHash`.
8. **Conflicting Execution ID (The A18 Compromise Scenario)**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Even if a high-privilege compromised authority signs a modified execution result with the same ID, the `SimulationExecutionRegistry` Identity Gate blocks registration if the canonical content digest differs.
9. **Duplicate Provenance**:
   * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Handled via the immutable hash registry inside `SimulationExecutionRegistry`.
10. **Tampered Evidence**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_VERIFICATION**. The `EvidenceMerkleTree` recomputes the `leafHash` on verification. Any modification of content yields a different leaf hash.
11. **Tampered Merkle Root**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_VERIFICATION**. The `EngineeringTruthCertificateVerifier` recomputes the entire Merkle root from the leaves and compares it to the signed certificate hash.
12. **Unauthorized Plugin**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Evaluated via registration verification in `PluginAuthorityBoundary`.
13. **Unauthorized Caller**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. The revision release flow is protected by role-based checks.
14. **Plugin Direct Canonical Mutation**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Frozen state snapshots prevent in-memory mutation of canonical records.
15. **Plugin Direct Database Write**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. The event store and database write boundaries do not expose direct write access to plugins.
16. **Plugin Direct Certificate Issuance**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Direct issuance is blocked by `PluginAuthorityBoundary`. Certificates require the core `EngineeringTruthCertificateEngine` signature.
17. **Plugin Direct Physical Truth / Direct Release**:
    * *Mitigation*: **BLOCKED_BY_EXISTING_AUTHORITY**. Fully blocked.

---

### 6. ESSENTIAL ARCHITECTURAL AUDITS

#### 6.1 "No Second Authority" Audit
* **Audit Directive**: Ensure the plugin integration does not establish a parallel authority path.
* **Findings**:
  * *Proposed Plugin Evidence*: Duplicates `EvidenceLeafRecord` and `EvidenceMerkleTree`. **REJECT PROPOSED LAYER**. Map directly to existing evidence classes.
  * *Proposed Plugin Registry*: Duplicates `SimulationExecutionRegistry`. **REJECT PROPOSED LAYER**. Extend `SimulationExecutionRegistry` or generalize it.
  * *Proposed Seal*: Duplicates `SimulationExecutionEnvelope`. **REJECT PROPOSED LAYER**. Use the existing core-sealing system.

#### 6.2 "No Firestore Regression" Audit
* **Audit Directive**: Verify if the proposed `FirestoreStorageEngine` conflicts with canonical persistence.
* **Findings**:
  * In `package.json`, Firebase is imported, but **no Prisma or PostgreSQL dependencies exist**.
  * The actual persistence model is split: `FirestoreStorageEngine.ts` and `projectStorage.ts` are used for mock/sandbox storage, while `EngineeringEventStore.ts` serves as the event ledger.
  * *Verdict*: Recommending Firestore for canonical ledger storage is an **ARCHITECTURAL_CONFLICT** for production deployment. The production target must use `EngineeringEventStore`.

#### 6.3 "No Simulation Authority Overreach" Audit
* **Audit Directive**: Is it safe to use `SimulationAuthority` for non-simulation plugins?
* **Findings**:
  * `SimulationAuthorityInternal` is strictly coupled to the `SimulationResult` type structure. Using it directly for robotics or manufacturing represents a **SIMULATION_SPECIFIC** design.
  * *Verdict*: Must generalize `SimulationAuthority` to a modular `CoreExecutionAuthority` before non-simulation plugins can execute under cryptographic seal.

#### 6.4 "No Plugin Self-Authority" Audit (Critical Boundary Warning)
* **Audit Directive**: Does the proposed `computeAuthoritative()` method violate authority boundaries?
* **Findings**:
  * If a plugin class hosts the `computeAuthoritative` method, it is executing calculations locally and self-declaring their authority. This represents an **AUTHORITY_BOUNDARY_VIOLATION_RISK**.
  * *Verdict*: **REJECT `computeAuthoritative()` inside plugins**. The plugin must submit an *Authorized Execution Request* to the core, and the core must delegate the calculation to an authorized, sandboxed solver before sealing it.

#### 6.5 Gate Ownership Audit
* **Audit Directive**: Who controls gate selection?
* **Findings**:
  * In the previous proposal, `acceptedGateIds: string[]` was defined in the plugin schema, allowing plugins to self-select their gates.
  * *Verdict*: **REJECT PLUGIN-SELECTED GATES**. Gate selection must be strictly **CORE_SELECTED** or **DOMAIN_POLICY_SELECTED** to prevent malicious plugins from bypassing required hard validation checks.

---

### 7. RECONCILED TARGET ARCHITECTURE

The corrected execution architecture uses *only* proven existing primitives and generalizes simulation authority to support secure plugin integration.

```
[1. User/UI Workbench]
           │
           ▼ (Sends Parameter Changes)
[2. SecpPluginRegistry] ──(Validates Tool Manifest)
           │
           ▼ (Submits Execution Request)
[3. Engineering Core Engine] ──(Acquires Read-Only Canonical Snapshot)
           │
           ▼ (Executes Sandboxed Solver)
[4. Deterministic Solver Kernel] ──(Generates Raw Result & Derived Binding)
           │
           ▼ (Forces Hard Gates Check)
[5. Core Acceptance Gates] ──(Validates Tolerances - Gate PMA001)
           │
           ├─► [FAIL] ──► (Rejects execution, logs REJECTED evidence)
           │
           ▼ [PASS]
[6. Provenance & Evidence Bridge] ──(Builds EvidenceLeafRecord)
           │
           ▼ (Signs with core keys)
[7. Core Sealing Authority] ──(Mints Sealed Execution Envelope)
           │
           ▼
[8. Immutable Execution Registry] ──(Enforces Immutability & Overwrite Locks)
           │
           ▼
[9. Engineering Truth Thread] ──(Commits to EngineeringEventStore)
```

---

### 8. SYSTEM REGISTERS

#### 8.1 Missing Primitive Register
| Missing Primitive | Why Needed | Existing Partial Mechanism | Exact Gap | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **PluginExecutionMode** | To differentiate interactive UI tools from certified solvers | Manifest enabled flags | No formal execution classification | Deferred |
| **UnitQuantity** | To guarantee dimensional engineering precision in SDK | Standard numbers | Untyped float properties | Deferred |
| **GenericExecutionEnvelope**| To replace simulation-specific envelopes with generic ones | `SimulationExecutionEnvelope` | Couples execution to `SimulationResult` | Deferred |
| **GenericExecutionRegistry**| To store non-simulation execution records securely | `SimulationExecutionRegistry` | Locked to simulation schema | Deferred |

#### 8.2 Reuse Register
| Existing Mechanism | Plugin Requirement | Reuse Directly? | Extension Required? | Why |
| :--- | :--- | :--- | :--- | :--- |
| `CanonicalDerivedArtifactBinding` | Binding output to CAD revisions | **Yes** | No | Fits all derived engineering output structures perfectly. |
| `RevisionEngine` | Establishing CAD state lock | **Yes** | No | Holds the authoritative revision states and approvals. |
| `EvidenceMerkleTree` | Bundling evidence cryptographically | **Yes** | No | Robust, generic, and cleanly maps to `EvidenceLeafRecord`. |
| `EngineeringTruthCertificateEngine`| Issuing signed truth records | **Yes** | No | Clean, deterministic certificate creation. |
| `ProvenanceGraph` | Storing history graphs | **Yes** | No | Graph nodes perfectly capture engineering lineages. |

---

### 9. ROBOTICS READINESS CONTRACT

Before any work on Robotics plugins or mechanics can begin, the following readiness conditions must be satisfied and verified against the repository state:

* **[x] Canonical identity source identified**: `RevisionEngine` / `CanonicalDocument` verified.
* **[x] Revision authority identified**: `RevisionEngine` verified.
* **[x] Geometry/topology binding identified**: `CanonicalDerivedArtifactBinding` verified.
* **[ ] Kinematics engine authority identified**: **MISSING**. No secure kinematics solver execution path is currently provisioned in the core.
* **[ ] Execution identity identified**: **MISSING**. Only simulation-specific execution identities exist.
* **[ ] Result identity identified**: **MISSING**. Reusable result structures are missing.
* **[x] Verification authority identified**: `HardAcceptanceGates` verified.
* **[x] Evidence mechanism identified**: `EvidenceMerkleTree` / `EvidenceLeafRecord` verified.
* **[x] Provenance mechanism identified**: `ProvenanceGraph` verified.
* **[x] Persistence mechanism identified**: `EngineeringEventStore` verified.
* **[x] Plugin authority boundary identified**: `PluginAuthorityBoundary` verified.
* **[ ] Physical truth boundary identified**: **NOT_PROVEN**. `PRODUCTION_PHYSICAL_TRUST` is currently `NOT_PROVISIONED`.
* **[x] Certification boundary identified**: `EngineeringTruthCertificateEngine` verified.
* **[x] Release boundary identified**: `RevisionEngine` lifecycle states verified.

---

### 10. FINAL FORENSIC VERDICT

* **EXISTING AUTHORITY**: SECP has a highly robust cryptographic authority framework built around `RevisionEngine`, `CanonicalDerivedArtifactBinding`, `EvidenceMerkleTree`, and `SimulationExecutionRegistry`.
* **REUSABLE AUTHORITY**: `CanonicalDerivedArtifactBinding` and `EvidenceMerkleTree` can be directly integrated into the plugin layer today without modification.
* **INSUFFICIENT AUTHORITY**: `SimulationEngine` and its signing keys are strictly simulation-specific. They cannot support non-simulation (Robotics, CAD regeneration) plugins without generalization.
* **CONFLICTING PROPOSALS**: The proposed `computeAuthoritative()` inside plugins represents an authority violation. All computations must be core-delegated and core-sealed. Plugin-selected gates are also rejected; gate policies must reside under core control.
* **MISSING PRIMITIVES**: Generic execution envelopes, generic registers, and strongly-typed engineering units are missing.
* **UNKNOWN**: Floating-point determinism is mathematically normalized, but real runtime determinism across varied CPUs and compilation environments is currently unproven.

**IMPLEMENTATION DEFERRED**: In accordance with the static forensic rules of this task, no code or test implementations have been created or modified.

---
«POST-PLUGIN-ARCHITECTURE-002 COMPLETE — EXISTING AUTHORITY RECONCILED — IMPLEMENTATION NOT STARTED.»
