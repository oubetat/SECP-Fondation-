# ADSE P13 — Configuration Truth Authority Matrix

**Phase:** ADSE-P13  
**SECP Reference Authority:** Core Execution Authority  
**Audit Date:** 2026-09-29  

---

## 1. Domain Authority Boundary Map

| Authority Domain | Canonical Master Authority | P13 Configuration Role / Boundary | Forbidden Shadow Authority Behaviors |
| :--- | :--- | :--- | :--- |
| **Engineering Model** | `ADSEEngine` / `ADSEWorkbenchBridge` | Maps `canonicalEntityRef` to P3 and physical models | Redefining physical properties, CAD dimensions, or system logic |
| **Revision Authority** | `RevisionEngine` / `CoreExecutionAuthority` | Matches and binds `revisionRef` to active revisions | Issuing, modifying, or branching revisions outside of RevisionEngine |
| **Configuration Authority** | SECP Core Configuration Management | Matches configuration state to active configurations | Editing baselines or configuration items silently without Change Control |
| **Verification Authority** | P1/P6/P7/P10 Engines | Analyzes verification state based on physical evidence | Self-verifying configurations without matching evidence refs |
| **Evidence Authority** | P10 Measurement & Invalidation Engine | Matches `evidenceRefs` to acquired measurements | Bypassing invalidation cascades or fabricating synthetic evidence |
| **Persistence Authority** | SECP Core Persistence | Merkle snapshot serialization and restore | Reading or writing raw database items bypassing Merkle validation |
| **Digital Thread** | `P4DigitalThreadEngine` (`DigitalThreadRegistry`) | Registers all `thread:config-*` nodes and edges in P4 | Maintaining a parallel "ConfigurationThread" or shadow graph |
| **Governance Boundary** | Human Chief Systems Engineer / Safety Authority | Enforces human approval permissions on backend boundaries | Bypassing human sign-off; allowing AI to approve baselines/releases |

---

## 2. Role Permissions Matrix

| Actor Role / Identity | Create Configuration | Approve CR / Baseline | Release Baseline | Override Revision | Force Configuration Valid |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `CHIEF_SYSTEMS_ENGINEER` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `CHIEF_SAFETY_ENGINEER` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `SYSTEMS_CHIEF` | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** | **ALLOW** |
| `SYSTEMS_ENGINEER` | **ALLOW** | **REJECT** | **REJECT** | **REJECT** | **REJECT** |
| `AI_SYSTEM_AGENT` | **REJECT** | **REJECT** (`AI_GOVERNANCE_VIOLATION`) | **REJECT** | **REJECT** | **REJECT** |
| `SYNTHETIC_AGENT` | **REJECT** | **REJECT** (`AI_GOVERNANCE_VIOLATION`) | **REJECT** | **REJECT** | **REJECT** |
