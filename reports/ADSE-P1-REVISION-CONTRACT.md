# ADSE-P1-REVISION-CONTRACT.md
# SECP — ADSE-P1: Revision Authority Contract

---

## 1. Single Revision Authority
All ADSE-P1 entities (Requirements, Systems) are governed by the established SECP Core **RevisionEngine**.

## 2. Rules of Revision
- **No Direct Mutation**: Requirement versions cannot be incremented without a corresponding Revision creation.
- **Lineage Integrity**: Parent-child revision links are mandatory for requirement updates.
- **Cryptographic Stamping**: Requirement content is hashed into the SECP Revision `contentHash`.
- **Status Alignment**: Baselining an ADSE requirement forces a `RELEASED` transition in the SECP Revision lifecycle.
- **Immutability**: Revisions in `RELEASED`, `SUPERSEDED`, or `OBSOLETE` states are immutable.
