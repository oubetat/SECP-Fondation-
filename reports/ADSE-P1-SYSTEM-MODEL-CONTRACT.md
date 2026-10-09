# ADSE-P1-SYSTEM-MODEL-CONTRACT.md
# SECP — ADSE-P1: System Model Contract

---

## 1. System Decomposition Authority
ADSE-P1 establishes the functional and physical decomposition of the engineering system.

## 2. Model Entities
- **System**: The root engineering entity.
- **Subsystem**: Functional partition of the system.
- **ComponentReference**: Link to a canonical SECP Core engineering object (e.g. CAD Part).
- **Function**: Operational behavior driving the design.
- **Interface**: Mechanical, Electrical, Thermal, Data, or Fluid connection.
- **Allocation**: Assignment of requirements or functions to physical entities.

## 3. Canonical Binding Rule
System models in ADSE-P1 do not duplicate geometry or physics state. They link to SECP Core objects via `engineeringObjectId` and `revisionHash`.
