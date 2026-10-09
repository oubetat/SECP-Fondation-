# ADSE-P1-VERIFICATION-INTENT-CONTRACT.md
# SECP — ADSE-P1: Verification Intent Contract

---

## 1. Intent vs. Evidence
ADSE-P1 defines **Verification Intent**. Verification **Evidence** is owned by SECP Core.

## 2. Intent Attributes
- `requirementId`: Target of verification.
- `method`: ANALYSIS, TEST, INSPECTION, SIMULATION, or DEMONSTRATION.
- `successCriteria`: Quantitative or qualitative pass/fail definition.
- `status`: PENDING, VERIFIED, or FAILED.

## 3. Evidence Binding
A Verification Intent remains `PENDING` until a valid **Core Execution Evidence** (sealed envelope) is bound to it. The status is then authoritatively updated based on the Core evidence verdict.
