# ADSE-P1-TRACEABILITY-CONTRACT.md
# SECP — ADSE-P1: Multi-Domain Traceability Contract

---

## 1. Traceability Axiom
Traceability links must be bidirectional and survive system configuration changes.

## 2. Trace Types
- **Forward Trace**: `Requirement -> Function -> Subsystem -> Component -> Verification`.
- **Backward Trace**: `Component -> Subsystem -> Function -> Requirement`.
- **Impact Trace**: Recursive discovery of all entities affected by a requirement change.

## 3. Supported Relationships
- `IMPLEMENTS`: Link from Function/Component to Requirement.
- `ALLOCATED_TO`: Link from Function to physical entity.
- `VERIFIES`: Link from Verification Intent to Requirement.
- `DEPENDS_ON`: Functional or physical dependency.
- `PARENT_OF`: Hierarchical decomposition.
