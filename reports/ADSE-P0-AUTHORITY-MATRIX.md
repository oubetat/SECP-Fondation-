# ADSE-P0-AUTHORITY-MATRIX.md
# SECP — ADSE-P0: Authority Matrix

---

## 1. Governance Authority Matrix

| Layer / Role | VIEW | ANALYZE | PROPOSE | EXECUTE | VERIFY | APPROVE | PUBLISH |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Human Engineer** | YES | YES | YES | YES | YES | YES | YES |
| **SECP Core Execution** | - | - | - | **AUTHORITATIVE** | - | - | - |
| **Independent Verifier** | - | - | - | - | **AUTHORITATIVE** | - | - |
| **ADSE Layer** | YES | YES | YES | REQUEST | REQUEST | - | - |
| **Plugin Layer** | YES | YES | PROPOSE | SOLVER ONLY | - | - | - |
| **Engineering AI** | YES | YES | YES | REQUEST | - | **NO** | **NO** |

---

## 2. Invariant Rules
1. **AI Non-Authority Axiom**: Engineering AI cannot approve revisions or publish canonical state.
2. **Core Execution Boundary**: Only `CoreExecutionAuthority` seals execution envelopes.
3. **Independent Dissimilarity**: Verifiers cannot evaluate their own solver outputs.
