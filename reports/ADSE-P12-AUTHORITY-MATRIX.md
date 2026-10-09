# ADSE P12 — Authority Matrix Contract

**Phase:** ADSE-P12  
**Authority Boundary Reference:** SECP Core Execution Authority  
**Audit Date:** 2026-09-29  

---

## 1. Domain Authority Boundary Map

| Authority Domain | Canonical Master Authority | P12 Safety Role / Boundary | Forbidden Shadow Authority Behaviors |
| :--- | :--- | :--- | :--- |
| **Engineering Model** | `ADSEEngine` / `ADSEWorkbenchBridge` | Domain Registry (`SafetyRegistry`) stores P12 entities | Creating duplicate CAD, thermal, structural, or electrical models |
| **Revision Authority** | `RevisionEngine` / `CoreExecutionAuthority` | Stores inherited `revisionId` on safety objects | Minting, incrementing, or branching independent safety revisions |
| **Configuration Authority** | SECP Configuration Manager | Stores inherited `configurationId` on safety objects | Overriding configuration baselines or creating separate configuration IDs |
| **Verification Authority** | Physical & Analytical Engines (P6/P7/P9/P10) | Evaluates claim verification state based on physical evidence | Self-verifying physical metrics without underlying evidence |
| **Evidence Authority** | P10 Measurement & Calibration Registry | References `measurementId` in `evidenceRefs` | Synthesizing fake evidence or bypassing evidence invalidation cascades |
| **Persistence Authority** | SECP Persistence Engine | Generates Merkle-sealed `P12Snapshot` for SECP storage | Writing unvalidated raw JSON bypasses or parallel database instances |
| **Digital Thread** | `P4DigitalThreadEngine` (`DigitalThreadRegistry`) | Registers `thread:safety-*` nodes and edges in P4 | Creating a separate "SafetyThread" or parallel lineage graph |
| **Safety Governance** | Human Chief Safety Engineer / Safety Authority | Enforces human-only sign-offs via `assertHumanSafetyAuthority()` | Allowing AI agents or synthetic entities to approve safety claims or cases |

---

## 2. Role Governance Permissions Matrix

| Actor Role / Identity | Create Hazard from P11 FM | Register Control & Claim | Transition Claim to VERIFIED | Override Risk Level |
| :--- | :---: | :---: | :---: | :---: |
| `CHIEF_SAFETY_ENGINEER` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `SAFETY_AUTHORITY` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `SYSTEMS_CHIEF` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `SYSTEMS_ENGINEER` | **ALLOW** | **ALLOW** | **REJECT** (`UNAUTHORIZED_SAFETY_ROLE`) | **REJECT** |
| `AI_SYSTEM_AGENT` | **REJECT** | **REJECT** | **REJECT** (`AI_SAFETY_AUTHORIZATION_PROHIBITED`) | **REJECT** |
| `SYNTHETIC_AGENT_01` | **REJECT** | **REJECT** | **REJECT** (`AI_SAFETY_AUTHORIZATION_PROHIBITED`) | **REJECT** |

---

## 3. Cryptographic Merkle Authority & Verification

```
                      [ P12 SHA-256 Merkle Root Hash ]
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
  [ Hazards Hash ]            [ Controls Hash ]           [ Claims Hash ]
         |                           |                           |
  SHA-256(Hazards)            SHA-256(Controls)           SHA-256(Claims)
```

1. Merkle root hash is generated deterministically by sorting all domain collections by canonical IDs (`hazardId`, `controlId`, `claimId`, `caseId`).
2. Rehydration validates string match against snapshot root hash.
3. Any entity field mutation invalidates the hash and halts rehydration with `SAFETY_SNAPSHOT_TAMPER_DETECTED`.
