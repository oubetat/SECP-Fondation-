# SECP Industrial OS v2 — Canonical Engineering Identity Architecture

## 1. Executive Overview & Purpose
In industrial engineering workflows (CAD, FEA, CFD, CAM, PLM, and Digital Twin), artifacts undergo continuous lifecycle transformations: geometric design $\rightarrow$ discretized mesh $\rightarrow$ solver execution $\rightarrow$ field results $\rightarrow$ forensic evidence $\rightarrow$ physical manufacture.

Without a formal **Canonical Engineering Identity**, software systems suffer from:
- Identifier collisions across disparate CAD/PLM vendors (CATIA, NX, SolidWorks).
- Transient session IDs corrupting permanent engineering lineage.
- Confusion between artifact revision updates and base artifact definitions.
- Fragile reliance on filesystem paths or non-deterministic in-memory pointer addresses.

`PATCH-008` establishes a standardized, immutable, and deterministic identity model across all SECP subsystems.

> **CRITICAL ARCHITECTURAL PRINCIPLE**:  
> `PATCH-008 does not prove artifact integrity.`  
> Identity names the engineering artifact. Integrity, cryptographic provenance, and verification are strictly separate concerns addressed in subsequent patches.

---

## 2. Core Concepts: Identity vs. Integrity vs. Provenance vs. Verification

| Concept | Question Answered | Mechanism in SECP |
| :--- | :--- | :--- |
| **Identity** | *What is this artifact?* | `CanonicalEngineeringIdentity` (`SECP:<TYPE>:<ID>`) |
| **Integrity** | *Has the content been altered?* | Canonical serialization + Cryptographic digest (PATCH-009) |
| **Provenance** | *Where did it come from and who produced it?* | Execution lineage & ledger chain of custody |
| **Verification** | *Does it satisfy physical and engineering criteria?* | Forensic verification kernels & acceptance gates |

`sameIdentity(A, B) === true` does **NOT** imply that artifact content is identical.

---

## 3. Taxonomy of Identifiers

### A. Canonical Engineering Identity
- **Namespace**: `SECP`
- **Schema Version**: `1.0.0`
- **Artifact Types**: `GEOMETRY`, `MATERIAL`, `MESH`, `SIMULATION`, `TOOLPATH`, `RESULT`, `EVIDENCE`, `REVISION`
- **Characteristics**: Immutable (`Object.freeze`), deterministic, semantic, free of timestamps and random tokens.
- **URI Format**: `SECP:<TYPE>:<ID>` (e.g. `SECP:GEOMETRY:impeller-volute-01`)

### B. Runtime Artifact Reference
- **Purpose**: Tracks transient in-memory buffers, active UI handles, or WebWorker execution IDs.
- **Interface**: `RuntimeArtifactReference { runtimeId: string; canonicalIdentity?: CanonicalEngineeringIdentity }`
- **Rule**: `runtimeId` must never overwrite or substitute the canonical `artifactId`.

### C. External Identifiers
- **Purpose**: Maps identifiers imported from external enterprise software (e.g. `sourceSystem: 'NX'`, `externalId: 'NX-PRT-9982'`).
- **Rule**: External IDs provide correlation metadata but do not alter SECP canonical identity.

---

## 4. Parent-Child Relationship Semantics
Artifacts form explicit directed lineage relationships:
```
[GEOMETRY: part-001]
       ↓ (parentId: "part-001")
[MESH: mesh-tetra-001]
       ↓ (parentId: "mesh-tetra-001")
[SIMULATION: cfd-rans-001]
       ↓ (parentId: "cfd-rans-001")
[RESULT: velocity-field-001]
       ↓ (parentId: "velocity-field-001")
[EVIDENCE: convergence-norm-001]
```
Child identities record their `parentId` without embedding complex graph traversal state inside the identity model.

---

## 5. Revision Semantics
Creating a revision (e.g. `r001`, `r002`) identifies a new version state of an artifact without mutating the base artifact's identity:
- Base: `SECP:GEOMETRY:pump-housing`
- Revision 1: `createRevisionIdentity(base, "r001")` $\rightarrow$ `SECP:REVISION:pump-housing;rev=r001`
- Revision 2: `createRevisionIdentity(base, "r002")` $\rightarrow$ `SECP:REVISION:pump-housing;rev=r002`

`sameIdentity(rev1, rev2) === false`, while both retain `artifactId === "pump-housing"`.

---

## 6. Scope & Limitations of PATCH-008
- **In Scope**:
  - Strongly typed `CanonicalEngineeringIdentity` interface and freeze immutability.
  - Reversible URI formatting and parsing (`formatCanonicalIdentity` / `parseCanonicalIdentity`).
  - Strict semantic identity comparison (`sameIdentity`).
  - Validation rules against empty IDs, control characters, and unsupported types.
  - Legacy adapter (`LegacyEngineeringIdentityAdapter`).
- **Out of Scope (Forbidden in PATCH-008)**:
  - Cryptographic hashing (SHA-256, BLAKE3).
  - Canonical binary / JSON serialization.
  - Merkle DAG graph persistence.
  - Cryptographic signatures and result certification.

---

## 7. Roadmap: Next Steps in PATCH-009
PATCH-009 will build directly on this foundation by implementing:
1. Deterministic Canonical Serialization of artifact payloads.
2. Cryptographic Content Hashing linked to `CanonicalEngineeringIdentity`.
3. Merkle Graph and Evidence Lineage chains.
