# ADSE-P0-CORE-BINDING-MAP.md
# SECP — ADSE-P0: Core Binding Map

---

## 1. Mapping ADSE Capabilities to SECP Core Services

| ADSE Capability Area | SECP Core Binding Mechanism | Core Service |
| :--- | :--- | :--- |
| **System Execution** | `CoreExecutionAuthority.execute()` | Core Execution Engine |
| **Revision Binding** | `RevisionEngine.createRevision()` | SECP Revision Engine |
| **Geometry Binding** | `CanonicalDerivedArtifactBinding` | CAD Topology / Geometry |
| **Evidence Generation** | `EvidenceMerkleTree.computeLeafHash()` | Cryptographic Evidence Ledger |
| **Provenance Wiring** | `CoreExecutionAuthority.rebuildProvenanceForEnvelope()` | Provenance DAG Graph |
| **Persistence** | `GenericExecutionRegistry` & `IndexedDbEngine` | Durable State Storage |

---

## 2. Binding Verification
All ADSE capabilities pass through `CoreExecutionAuthority.execute()`, securing a sealed envelope with a cryptographic signature and Merkle evidence leaf.
