# AUTHORITY_BOUNDARY_DECISIONS.md
**Program**: `SECP-ENGINEERING-TRUTH-INTEGRATION-002`  
**Stage**: 2 — Architecture Decision & Domain Binding Specifications  
**Execution Mode**: READ-ONLY ARCHITECTURE SPECIFICATION  
**Specification Date**: 2026-10-31  

---

## 1. Governance Function Authority Matrix

To eliminate duplicate authorities, parallel registries, and unsealed execution, every domain operation is assigned strictly to a designated Core or Domain Authority across 5 governance functions:

| Governance Function | Primary Authoritative Engine | Source Code Module | Domain Engine Role |
| :--- | :--- | :--- | :--- |
| **1. State Creation & Mutation** | `EngineeringObjectOS` + `RevisionEngine` | `src/engine/industrial-os/` & `src/engine/revision/` | Specialized domain models register drafts and request revision code increments. |
| **2. Input Binding Validation** | `CanonicalDomainBindingEngine` | `src/engine/crossdomain/` | Validates domain-to-core binding rules and verifies active parent revision lineage. |
| **3. Execution Authorization** | `SimulationAuthorityInternal` | `src/engine/simulation/` | Issues sealed execution tokens (`SIMULATION_AUTHORITY_SEAL`) for executable runs. |
| **4. Evidence Minting** | `EvidenceHasher` + `EngineeringHashChain` | `src/engine/evidence/` | Computes immutable SHA-256 cryptographic hashes for outputs and manifests. |
| **5. Current State & Invalidation** | `InvalidationPipelineEngine` | `src/engine/workbench/` | Controls `CURRENT` vs `STALE` vs `INVALID` lifecycle states for render & derived state. |

---

## 2. Reused SECP Core Systems (Zero Duplication Policy)

1. **`EngineeringObjectOS`**: Sole authority for registering engineering objects, maintaining governance policies (`INITIAL_SECP_POLICIES`), and enforcing enterprise approval workflows.
2. **`RevisionEngine`**: Sole authority for revision codes (`REV-A`, `REV-B`), parent-child lineage verification, content hashing (`RevisionCanonicalizer.computeContentHash`), and dependency manifests.
3. **`SimulationAuthorityInternal`**: Sole authority for sealing simulation execution envelopes (`sealEnvelope`, `verifyEnvelopeSeal`). No domain solver may generate authoritative results without an active engine key seal.
4. **`EngineeringHashChain`**: Sole authority for canonical SHA-256 evidence chain roots.
5. **`InvalidationPipelineEngine`**: Sole authority for managing the 9-step invalidation pipeline sequence (`CANONICAL_MUTATION` $\rightarrow$ `REVISION_INCREMENT` $\rightarrow$ `BREP_REGENERATION` $\rightarrow \dots \rightarrow$ `CURRENT`).

---

## 3. Explicit Authority Decision Rationale

- **Why PCB and Harness do not have separate revision registries**: Creating an ECAD-specific or Harness-specific revision registry would fragment the PLM tree. By binding `PcbCanonicalModel` and `WiringHarnessCanonicalModel` directly to `canonicalRevisionId` in `RevisionEngine`, all engineering disciplines share a synchronized revision history.
- **Why FEM and CFD do not issue their own attestation seals**: If solvers minted unsealed attestation hashes independently, tampered mesh inputs could be presented as valid. Requiring `SimulationAuthorityInternal.sealEnvelope` guarantees that solver execution runs were produced under verified execution conditions.
