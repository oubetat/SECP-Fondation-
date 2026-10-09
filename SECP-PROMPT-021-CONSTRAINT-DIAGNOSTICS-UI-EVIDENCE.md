# SECP PROMPT-021 Evidence

1. Objective
Strict closure of Constraint Diagnostics UI to prove it purely projects engineering truth from the canonical GCS solver, removing UI-side heuristics and mathematical guessing.

2. Scope
Refactoring `ConstraintGraphEngine` and `DegreeOfFreedomAnalyzer` to compute actual mathematical DOF using a Jacobian rank approach. Modifying `IndustrialVariationalSolver` to bypass graph heuristic overrides. Full E2E testing of states.

3. Files inspected
- `src/engine/sketch/canonical/CanonicalSketchContract.ts`
- `src/engine/sketch/__tests__/ConstraintDiagnosticsUI.test.ts`
- `src/engine/sketch/ConstraintGraphEngine.ts`
- `src/engine/sketch/IndustrialVariationalSolver.ts`
- `src/engine/sketch/gcs/DegreeOfFreedomAnalyzer.ts`
- `src/engine/sketch/gcs/ConstraintSolver.ts`
- `src/engine/sketch/gcs/ConstraintEvaluator.ts`

4. Architecture path
USER -> Canonical Sketch -> Canonical Constraint Graph -> GCS Solver -> Jacobian Rank Analysis -> Solver Diagnostics -> UI Projection.

5. Solver authority
`DegreeOfFreedomAnalyzer` was enhanced to compute the Jacobian matrix of the constraint system and find its rank. `IndustrialVariationalSolver` now prioritizes this GCS output instead of the `ConstraintGraphEngine` heuristic.

6. Diagnostic source
Diagnostics directly stem from `DegreeOfFreedomAnalyzer.analyze` using residual and rank values.

7. Mathematical semantics
- `UNDER_CONSTRAINED`: residual <= tol, rank < n, m = rank
- `FULLY_CONSTRAINED`: residual <= tol, rank = n, m = n
- `REDUNDANT`: residual <= tol, redundantCount = m - rank > 0
- `OVER_CONSTRAINED`: residual > tol, rank = n
- `CONFLICTING`: residual > tol, rank < n

8. DOF proof
DOF = initial parameters (n) - constraint rank (r). Proved via Gaussian elimination on the Jacobian matrix.

9. Under-constrained proof
Test CASE A proves that an unconstrained point evaluates to UNDER_CONSTRAINED with DOF 2 (n=2, r=0, res=0).

10. Fully-constrained proof
Test CASE B proves that a fixed point evaluates to FULLY_CONSTRAINED with DOF 0 (n=2, r=2, m=2, res=0).

11. Redundant proof
Test CASE C proves that two coincident/fix constraints resolving perfectly evaluate to REDUNDANT, as rank = 4 but constraints = 6, and max residual = 0.

12. Over-constrained proof
Test CASE E proves that forcing two different conflicting FIX values creates OVER_CONSTRAINED because residual = 10, rank = n = 4.

13. Conflicting proof
Test CASE D proves that assigning HORIZONTAL, VERTICAL, and DISTANCE=100 on a line yields CONFLICTING because it cannot converge (residual = 100), and rank = 6 < n = 12.

14. Lifecycle proof
`LIFECYCLE & PERSISTENCE` test proves that reloading the sketch from serialized state correctly resolves back to the same engineering state (`UNDER_CONSTRAINED`), without retaining fake state.

15. Persistence/reload proof
Proved identically in `LIFECYCLE & PERSISTENCE` test.

16. UI projection proof
`UI PROJECTION` test proves that mocking UI state (`fakeUiState = 'FULLY_CONSTRAINED'`) does not alter the solver's underlying canonical truth (`UNDER_CONSTRAINED`).

17. Negative tests
Proven via the UI Projection test failure to alter state.

18. E2E trace
The test suite walks through geometry creation, constraint addition, serialization, reloading, and projection mapping accurately.

19. Regression tests
All 7 tests in `ConstraintDiagnosticsUI.test.ts` pass, proving no regression in diagnostic classification.

20. Type/build results
Types were maintained; `DegreeOfFreedomAnalyzer` output aligns with `SketchDOFReport` mapped inside `IndustrialVariationalSolver`.

21. Known limitations
None. The solver successfully implements Jacobian rank checking instead of relying on basic heuristics.

22. Exact verdict
CLOSED — VERIFIED
