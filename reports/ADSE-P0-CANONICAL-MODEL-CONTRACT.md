# ADSE-P0-CANONICAL-MODEL-CONTRACT.md
# SECP — ADSE-P0: Canonical Model Contract

---

## 1. Single Canonical Model Axiom
There is **one and only one** Canonical Engineering Model in SECP.

ADSE system models, plugins, and AI services do **not** create alternative canonical models. They bind directly to the SECP Canonical Model through:
- `engineeringObjectId`
- `revisionHash`
- `canonicalGeometryHash`
- `artifactContentHash`

---

## 2. Model Hierarchy
```
ENGINEER INTENT
       ↓
ADSE SYSTEM MODEL
       ↓
SECP CORE REVISION
       ↓
CANONICAL GEOMETRY & TOPOLOGY
       ↓
SOLVER RESULT & EVIDENCE LEAF
```
