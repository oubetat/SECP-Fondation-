# SECP Industrial OS v2 — Phase 1: Engineering Truth Core
## PATCH-014 Architecture Document: Tamper-Evidence Core & Evidence Trust Model

### 1. Overview
The **Tamper-Evidence Gate (PATCH-014)** provides deterministic, cryptographic verification of engineering artifact integrity across the SECP Engineering Truth Core. It orchestrates the verification primitives established in PATCH-008 through PATCH-013 to prove whether any engineering artifact has been modified, tampered with, or corrupted.

---

### 2. Verification Architecture

```
Artifact (Mutable JS Object)
   ↓
Canonical Serialization (PATCH-009 — CanonicalSerializer)
   ↓
Canonical SHA-256 Hash Recomputation
   ↓
Trusted Evidence Object (PATCH-011) / Hash Chain (PATCH-010)
   ↓
Evidence Verification Engine (PATCH-012 — EvidenceVerificationEngine)
   ↓
Provenance Graph Linkage (PATCH-013 — ProvenanceGraphVerifier)
   ↓
Tamper-Evidence Verifier (PATCH-014 — TamperEvidenceVerifier)
   ↓
Verdict: PASS / FAIL / UNPROVEN / INCONCLUSIVE / INVALID
```

---

### 3. Evidence Trust Model

#### What Constitutes Trusted Expected Evidence?
Expected hashes MUST originate from one of the following authenticated evidence sources:
1. **Verified Evidence Objects (`EngineeringEvidence`)**: Signed and structurally valid evidence records created by the SECP Evidence Engine that pass `EvidenceVerificationEngine.verifyEvidence()`.
2. **Protected Engineering Hash Chains**: Cryptographically linked hash chain nodes from `EngineeringHashChain`.
3. **Cryptographically Authenticated Evidence Sources**: Sources with `isTrustedSourceVerified = true` supplied through an authenticated trust store.

#### What CANNOT Be Trusted as Expected Evidence?
- The mutable artifact itself (e.g., `artifact.hash` or `artifact.canonicalHash`).
- Unauthenticated caller-supplied hashes (`trustedExpectedHash` without `isTrustedSourceVerified = true`).
- UI state, local browser storage, or unverified request parameters.

---

### 4. Tamper Detection & Verdict Rules

#### Tampering Definition
**Tampering** is defined strictly as an explicit contradiction between an independently recomputed artifact canonical hash and a trusted expected evidence hash.

- **`tamperDetected = true`**: ONLY set when `actualHash !== expectedHash` against a valid, trusted expected evidence record.
- **`tamperDetected = false`**: Set when the hashes match OR when trusted evidence is unavailable/invalid.

#### Verdict Taxonomy

| Verdict | Condition | Tamper Detected |
|---|---|---|
| **PASS** | Artifact exists, canonical serialization succeeds, recomputed `actualHash === expectedHash`, trusted evidence is valid, and required provenance linkage is intact. | `false` |
| **FAIL** | Artifact exists, valid trusted evidence exists, but recomputed `actualHash !== expectedHash`. | **`true`** |
| **UNPROVEN** | Artifact exists, but trusted expected evidence is unavailable/missing OR supplied hash is unauthenticated. | `false` |
| **INCONCLUSIVE** | Verification cannot be completed due to unresolved verification dependencies or conflicting evidence. | `false` |
| **INVALID** | The artifact structure or evidence object itself is malformed (e.g., fails canonical normalization, schema validation, or cryptographic checks). | `false` |

> **CRITICAL RULE**: Missing Evidence ≠ Tampering (`UNPROVEN`). Missing evidence indicates absence of proof, whereas tampering indicates proof of contradiction.

---

### 5. Architectural Dependencies

1. **Canonicalization Dependency (PATCH-009)**: Ensures identical representations regardless of key order, number formatting (-0), string NFC normalization, or property insertion order.
2. **Identity Dependency (PATCH-008)**: Binds artifacts to deterministic engineering identity IDs (`SECP:DESIGN:...`, `SECP:GEOMETRY:...`).
3. **Hash Chain Dependency (PATCH-010)**: Provides historical state immutability via hash chains (`EngineeringHashChain`).
4. **Evidence Dependency (PATCH-011 & PATCH-012)**: Validates evidence schema, payload integrity, timestamps, versioning, and origin.
5. **Provenance Dependency (PATCH-013)**: Validates directed acyclic lineage graphs connecting design to geometry, simulation, and manufacturing nodes.

---

### 6. Known Limitations
- **Verification Scope**: Detects integrity violations within the SECP canonicalization and evidence trust model.
- **Non-Canonical Properties**: Properties omitted by the canonical serialization contract (such as JS `undefined` values or transient runtime memory addresses) do not alter the canonical hash and thus do not trigger tamper detection. Unsupported types (e.g., functions, DOM elements) throw `UnsupportedTypeError` resulting in `INVALID`.
- **Physical Hardware Attestation**: Full physical site attestation (P6-B) requires hardware TPM/HSM attestation which is reported as `UNPROVEN` in synthetic runtimes as per Anti-Fabrication rules.
