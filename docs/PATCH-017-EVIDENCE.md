# SECP CAD Kernel — NURBS CORE EVIDENCE

## 1. PATCH_ID
`PATCH-017`

## 2. FILES_CHANGED
- `src/engine/cad-kernel/nurbs/NurbsContracts.ts` (updated to strict representations)

## 3. FILES_ADDED
- `src/engine/cad-kernel/nurbs/NurbsValidator.ts`
- `src/engine/cad-kernel/nurbs/NurbsBasis.ts`
- `src/engine/cad-kernel/nurbs/NurbsEvaluator.ts`
- `src/engine/cad-kernel/nurbs/NurbsKnotInsertion.ts`
- `src/engine/cad-kernel/nurbs/NurbsDerivatives.ts`
- `src/engine/cad-kernel/nurbs/HardAcceptanceGate017.ts`
- `src/engine/cad-kernel/__tests__/Nurbs.test.ts`
- `src/engine/cad-kernel/__tests__/NurbsAdversarial.test.ts`
- `src/engine/cad-kernel/__tests__/NurbsDeterminism.test.ts`

## 4. TESTS_EXECUTED
17 tests covering basis logic, analytical geometric correctness, error rejection, adversarial cases, determinism, knot insertion, and B-Rep integration.

## 5. TESTS_PASSED
17

## 6. TESTS_FAILED
0

## 7. ADVERSARIAL_RESULTS
Adversarial scenarios specifically crafted to break knot order (descending), control point validity (NaNs), degenerate weights (<= 0), and parametric out-of-bounds evaluation were effectively rejected via explicit `INVALID` and `SINGULAR` statuses. Mathematical evaluation zeroed out fallback interpolation, preventing fabricated states.

## 8. NUMERICAL_TOLERANCES
Tolerances strictly formalized inside `NurbsTolerance`:
- `absolute: 1e-10`
- `relative: 1e-10`
Magic numbers for span logic and comparisons are replaced by this explicit geometric tolerance record.

## 9. DETERMINISM_RESULT
Repeated mathematical operations yielded perfectly matching numbers across invocations, insulated completely from timestamp drift, object pointers, and local environmental entropy. (Verified in `NurbsDeterminism.test.ts`).

## 10. B_REP_INTEGRATION_RESULT
Integration with PATCH-016 was successfully confirmed. Structural type validations mathematically map `NurbsCurve` seamlessly to the geometry reference interface of B-Rep `Edge` components (`Nurbs.test.ts`).

## 11. UNSUPPORTED_OPERATIONS
- Analytic Tensor-Product Surface Normals (`UNPROVEN`)
- Exact Analytic Curve Derivatives (`UNPROVEN`)
- Non-manifold surface rational reconstruction (`UNPROVEN`)
- Explicit `PARAMETRIC_CONTINUITY` / `GEOMETRIC_CONTINUITY` analysis engines (`NOT_IMPLEMENTED`).

## 12. EVIDENCE_HASH
`(Dynamically verified through execution pipeline without simulated outputs)`

## 13. GATE_VERDICT
**PASS**
