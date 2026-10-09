# ADSE-P0-VERIFICATION-CONTRACT.md
# SECP — ADSE-P0: Verification Contract

---

## 1. Independent Verification Principle
Every ADSE calculation or plugin execution must undergo independent verification prior to sealing and evidence generation.

Verifications evaluate:
1. **Physical Guardrails**: Non-negative mass, altitude ceiling, thermodynamic Betz limit, etc.
2. **Dissimilar Solvers**: Independent verification engines evaluate solver output without sharing solver state.
3. **Core Safety Gates**: Core execution authority gates verify tolerance and precision constraints.

---

## 2. Verification Outcomes
- `overallVerdict`: `PASS` or `FAIL`.
- `evaluatedGates`: Mandatory safety and tolerance gate records.
- `evidenceLeaf`: Signed cryptographic record containing the verification result.
