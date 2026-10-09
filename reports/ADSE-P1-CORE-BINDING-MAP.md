# ADSE-P1-CORE-BINDING-MAP.md
# SECP — ADSE-P1: Core Binding Map

---

## 1. Mapping ADSE-P1 Entities to SECP Core

| ADSE Entity | Core Mechanism | SECP Service |
| :--- | :--- | :--- |
| **Requirement** | `RevisionEngine.createRevision()` | Revision Engine |
| **System Model** | `RevisionEngine.createRevision()` | Revision Engine |
| **Component Reference** | `engineeringObjectId` | CAD Topology |
| **Verification Intent** | `GenericExecutionRegistry.getExecution()` | Evidence Registry |
| **Baseline** | `RevisionLifecycleState.RELEASED` | Core Lifecycle Engine |
| **Traceability Event** | `DigitalThreadService` / `ProvenanceGraph` | Provenance DAG |

---

## 2. Binding Rules
1. Every ADSE object creation must generate a corresponding Core event or state change.
2. ADSE entities must be rehydratable from Core state.
