# ADSE-P1-CONFIGURATION-CONTRACT.md
# SECP — ADSE-P1: System Configuration Contract

---

## 1. Configuration Awareness
Engineering requirements and system model entities are configuration-aware. A requirement may exist in multiple configurations with different parameters or statuses.

## 2. Configuration Binding
- `configurationId`: Mandatory attribute for all P1 entities.
- **Cross-Configuration Contamination Check**: Entities from Configuration A cannot be bound to entities in Configuration B without an explicit cross-config bridge.
- **Baseline Scope**: A system baseline includes a specific configuration of requirements and system architecture.
