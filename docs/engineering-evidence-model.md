# SECP Industrial OS v2 — Unified Engineering Evidence Object Model

## 1. Executive Summary
`PATCH-011` defines the `Engineering Evidence Object Model`, the core container for all engineering proof within the SECP ecosystem. It provides a strongly-typed, cryptographically-linked structure that connects engineering subjects, artifacts, provenance, computations, and lineage.

---

## 2. Evidence Architecture

The Evidence object is designed to be a "wrapper" of truth around an engineering event:

```json
{
  "evidenceId": "EV-SIM-12345",
  "evidenceType": "SIMULATION",
  "schemaVersion": "1.0.0",
  "subject": { "identityId": "SHAFT-01", "identityType": "GEOMETRY" },
  "artifact": { "artifactId": "SIM-RES-01", "artifactType": "RESULT", "canonicalHash": "..." },
  "provenance": { "producer": { "type": "SOLVER", "id": "FEA-ENGINE-v2" } },
  "canonicalization": { "serializer": "PATCH-009", "version": "1.0.0", "canonicalHash": "..." },
  "integrity": { "hashAlgorithm": "SHA-256", "canonicalHash": "...", "integrityStatus": "INTACT" },
  "verification": { "verdict": "PASS", "checks": [...] },
  "claims": [...]
}
```

---

## 3. Core Guarantees

### 3.1. Cryptographic Self-Integrity
Every `EngineeringEvidence` object contains an `integrity.canonicalHash` derived from its own canonical representation (excluding the integrity/canonicalization fields to avoid circularity). Any modification to any field (claims, subject, provenance, etc.) results in a hash mismatch.

### 3.2. Linkage Stability
Evidence objects link to artifacts via `PATCH-008` identities and `PATCH-009` canonical hashes. They link to lineage via `PATCH-010` chain hashes.

### 3.3. Separation of Truth from Correctness
- **Integrity**: Proven by `canonicalHash` matching.
- **Lineage**: Proven by `chainHash` matching.
- **Engineering Correctness**: Expressed in `verification.verdict`, which must be supported by explicit `verification.checks`.

### 3.4. Unknown vs. PASS
The model strictly distinguishes between "computation completed" and "engineering verified". If no verification checks exist, the verdict remains `UNPROVEN` even if the computation was successful.

---

## 4. Verification Primitive
The `verifyEngineeringEvidence(evidence)` primitive performs:
1. **Structural Validation**: Ensures all required fields and correct schema versions.
2. **Identity Resolution**: Ensures the artifact identity is valid according to `PATCH-008`.
3. **Cryptographic Integrity**: Recomputes the evidence hash using `PATCH-009` and compares it to the stored hash.
4. **Lineage Sync**: Ensures the internal lineage hashes match the integrity chain hashes.
