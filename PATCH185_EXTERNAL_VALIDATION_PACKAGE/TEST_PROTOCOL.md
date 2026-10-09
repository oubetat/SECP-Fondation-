# SECP External Independent Validation Protocol

## 1. Scope
This protocol defines steps to verify that SECP outputs conform to physically and mathematically correct reference models.

## 2. Test Execution
1. Read parameters from `INPUT_DATA/`.
2. Compute local closed-form equations in `EXPECTED_REFERENCE_DATA/`.
3. Compare absolute/relative difference against defined precision limits.
4. Sign result manifests under `EVIDENCE/`.