# PATCH-006 — Determinism Contract Report

## 1. Scope
This patch establishes a formal, mathematically verified **Determinism Contract** for SECP Industrial OS v2.
The core objective is to define measurable boundaries, formal taxonomy, and adversarial evaluation protocols for:
1. **DETERMINISTIC**
2. **REPRODUCIBLE**
3. **REPLAYABLE**
4. **NON_DETERMINISTIC**
5. **ENVIRONMENT_DEPENDENT**
6. **UNPROVEN**

> **Fundamental Principle**: The platform does **not** claim full-system determinism simply because clock abstractions or hashing exist. Determinism and reproducibility are evaluated strictly at declared component boundaries.

---

## 2. Definitions

### DETERMINISTIC
Given identical:
- Canonical inputs
- Configuration
- Software version and dependencies
- Seed
- Clock state
- Execution environment

The component produces **byte-for-byte identical** observable outputs (`exactMatch === true`).

### REPRODUCIBLE
An execution can be independently repeated from a recorded input/configuration package and produces equivalent results within **explicitly defined engineering tolerances** (`tolerance >= maxAbsoluteDifference`). Exact byte equality is not required for floating-point continuum calculations.

### REPLAYABLE
An execution trace can be reconstructed from captured events and replayed in the exact same logical order.

### NON_DETERMINISTIC
The component intentionally or inherently permits varying results between executions (e.g. unseeded RNG, asynchronous race conditions, external network streams).

### ENVIRONMENT_DEPENDENT
Results depend on environmental characteristics that are not normalized or parameterized (e.g. GPU compute architecture, SIMD width, OS thread scheduling).

### UNPROVEN
Insufficient evidence exists to verify or certify the component's determinism level.

---

## 3. Implemented Components

1. **`src/engine/core/DeterminismContract.ts`**:
   - `DeterminismLevel`: Formal union type (`'DETERMINISTIC' | 'REPRODUCIBLE' | 'REPLAYABLE' | 'NON_DETERMINISTIC' | 'ENVIRONMENT_DEPENDENT' | 'UNPROVEN'`).
   - `DeterminismContract`: Contract specification containing declared component ID, version, level, input/configuration hashes, seed, clock mode, and dependencies.
   - `DeterminismBoundary`: Lifecycle boundary interface capturing inputs, config, environment, execution, canonicalization, and comparison.
   - `DeterminismComparison`: Precise comparison output distinguishing `exactMatch` from `equivalent` with max absolute/relative errors.
   - `DeterminismEvaluation`: Structured result with cryptographic hashes, execution fingerprint, differences, and limitations.

2. **`src/engine/core/DeterminismEvaluator.ts`**:
   - **Canonicalization Engine**: Lexicographical object key sorting, strict array order preservation, type disambiguation (handling `-0`, `NaN`, `Infinity`, `BigInt`, `null`, `undefined`), and cyclic reference rejection.
   - **SHA-256 Hashing**: Consistent Node.js `crypto` SHA-256 computation over canonicalized strings.
   - **Execution Fingerprint Generator**: Cryptographic hash encompassing component ID, software version, config hash, inputs hash, seed, clock mode, precision, solver mode, and dependencies.
   - **Numerical Comparator**: Evaluates absolute error $|a - b|$ and relative error $\frac{|a - b|}{\max(|a|, |b|, 10^{-12})}$ against explicit tolerances.
   - **Multi-pass Boundary Evaluator**: Executes boundary multiple times, detecting discrepancies and verifying contract compliance.

3. **`src/engine/validation/DeterminismGate.ts`**:
   - Evaluates determinism evidence without hardcoded shortcuts.
   - Strictly returns `PASS`, `FAIL`, `UNPROVEN`, or `INCONCLUSIVE` based on actual evidence.

---

## 4. Determinism Boundary & Lifecycle
```
[Inputs] -------> captureInputs() -------> canonicalize() ---> inputsHash (SHA-256)
[Config] -------> captureConfiguration() -> canonicalize() ---> configurationHash (SHA-256)
[Environment] --> captureEnvironment() --> Execution Fingerprint (SHA-256)
                        ↓
                 execute() [Pass 1..N]
                        ↓
             canonicalizeOutput()
                        ↓
             compare(RunA, RunB, tol)
                        ↓
            [exactMatch vs equivalent]
```

---

## 5. Clock Integration
Integrates seamlessly with the `EngineeringClock` architecture established in PATCH-005:
- **`WallClock`**: Classified as `NON-DETERMINISTIC`.
- **`DeterministicClock`**: Classified as `DETERMINISTIC` with explicit initial timestamp and `advanceMs()` steps.
- **`SimulationClock`**: Classified as `DETERMINISTIC with explicit state progression`.

---

## 6. Canonicalization & Hashing Rules
- Object keys are sorted lexicographically before hashing.
- Array element ordering is strictly preserved.
- Primitive types are explicitly disambiguated.
- Volatile host timestamps (e.g. `Date.now()`, PID, hostname) are excluded from deterministic payload hashing unless explicitly part of the contract.

---

## 7. Randomness Audit
Across `src/engine`:
- **`Math.random()`**: 39 occurrences
  - *Controlled/Test fixtures*: Telemetry duplicate storm simulators, synthetic benchmark jitter generators.
  - *Uncontrolled/Production*: Temporary unique ID generators (e.g. `hold-${Date.now()}-${Math.random()}`).
  - *Classification*: Components using `Math.random()` for stateful computation are classified as **`NON_DETERMINISTIC`** or **`UNPROVEN`** until parameterized with seeded PRNG.
- **`crypto.randomUUID()`**: 14 occurrences (primarily audit event IDs).

---

## 8. Environment Dependency Audit
- **`process.env`**: 2 occurrences (dev/prod mode toggles).
- **`setTimeout` / `setInterval`**: 70 occurrences (telemetry pollers, UI bridges, stream dispatchers).
- **`performance.now()`**: 7 occurrences (rendering benchmark timers).
- **`Promise.race`**: 0 occurrences.
- **Classification**: Async timers and performance timers in UI/rendering layers are classified as **`ENVIRONMENT_DEPENDENT`** / **`NON_DETERMINISTIC`**.

---

## 9. Exact Reproduction & Numerical Equivalence Results

### Unit Test Suite: `src/engine/core/__tests__/DeterminismContract.test.ts`
- Key sorting canonicalization: **VERIFIED**
- Array order preservation: **VERIFIED**
- Type disambiguation (`null`, `undefined`, `-0`, `NaN`, `Infinity`, `BigInt`): **VERIFIED**
- Cyclic structure detection: **VERIFIED**
- Cryptographic hash consistency: **VERIFIED**
- Distinguishing `exactMatch` vs `equivalent`: **VERIFIED**

---

## 10. Adversarial Test Results (`src/engine/core/__tests__/DeterminismEvaluator.test.ts`)
- **TEST A**: Identical deterministic inputs produce identical hashes: **PASS**
- **TEST B**: Changing one input changes input hash: **PASS**
- **TEST C**: Changing object key insertion order preserves canonical hash: **PASS**
- **TEST D**: Changing array order changes canonical hash: **PASS**
- **TEST E**: Changing seed changes execution fingerprint: **PASS**
- **TEST F**: Changing initial clock time changes execution fingerprint: **PASS**
- **TEST G**: Wall-clock ticks do not pollute deterministic output hashes: **PASS**
- **TEST H**: Exact equality is strictly distinguished from numerical equivalence: **PASS**
- **TEST I**: Numerical result outside tolerance classified as non-equivalent: **PASS**
- **TEST J**: Numerical result within tolerance classified as `REPRODUCIBLE`: **PASS**
- **TEST K**: Uncontrolled random dependency prevents `DETERMINISTIC` classification: **PASS**
- **TEST L**: Environment dependency classified as `ENVIRONMENT_DEPENDENT`: **PASS**

---

## 11. Negative / Sabotage Test Results
- **SABOTAGE 1**: Removing timestamps from semantically required data is detected: **PASS**
- **SABOTAGE 2**: Replacing random outputs with constants fails seed variation test: **PASS**
- **SABOTAGE 3**: Ignoring meaningful output fields is caught by recursive comparator: **PASS**
- **SABOTAGE 4**: Extreme tolerance does not falsely claim `exactMatch`: **PASS**
- **SABOTAGE 5**: Partial vs full object hashing produces distinct hashes: **PASS**
- **SABOTAGE 6**: Hardcoded expected hash mismatch is detected: **PASS**
- **SABOTAGE 7**: Undeclared environment dependency handling: **PASS**
- **SABOTAGE 8**: Solver configuration difference changes fingerprint: **PASS**
- **SABOTAGE 9**: Numerical precision difference changes fingerprint: **PASS**
- **SABOTAGE 10**: Execution mode difference changes fingerprint: **PASS**
- **DeterminismGate Evaluation**:
  - Violated contract returns `FAIL`: **PASS**
  - Empty evaluations return `UNPROVEN`: **PASS**
  - Legitimate evidence returns `PASS`: **PASS**

---

## 12. Compilation & Test Verification
- **Applet Compilation (`compile_applet`)**: Build succeeded (0 errors).
- **Determinism Tests**: 32/32 tests passed (100%).
- **Full Engine Core & Validation Suites**: 115/115 tests passed across 11 test suites.

---

## 13. Gate Acceptance Criteria Checklist
1. Determinism definitions implemented and documented: **PASS**
2. `DeterminismContract` exists: **PASS**
3. `DeterminismEvaluator` exists: **PASS**
4. Exact equality distinguished from numerical equivalence: **PASS**
5. Canonical hashing used for determinism evidence: **PASS**
6. `EngineeringClock` integration is explicit: **PASS**
7. Randomness is not globally neutralized: **PASS**
8. Wall-clock time is not globally replaced: **PASS**
9. Environment dependencies are not hidden: **PASS**
10. Adversarial tests pass (12/12): **PASS**
11. Negative/sabotage tests pass (10/10): **PASS**
12. `DeterminismGate` evaluates actual evidence: **PASS**
13. No hardcoded `return "PASS"` exists in the new Gate: **PASS**
14. Existing tests were not disabled: **PASS**
15. Compilation succeeds: **PASS**
16. Evidence report generated: **PASS**

### Gate Verdict: **PASS** (for Determinism Contract Subsystem) / **UNPROVEN** (for unverified legacy solvers)

---

## 14. Limitations & Scope Notice
- Only components explicitly bound and evaluated through `DeterminismBoundary` carry a determinism or reproducibility certification.
- SECP Industrial OS v2 as a holistic platform remains **UNPROVEN** for global determinism until domain solvers (CFD, FEA, CAD, CAM) implement individual contracts.

---

## 15. Remaining UNPROVEN Areas & Legacy Test Status
1. **CFD Solvers (`SECP082IndependentCFDVerifier.test.ts`)**: 2 tests in legacy test files failed due to physical boundary flux discrepancies (`PREMATURE_CONVERGENCE_DETECTED`). Classification: **`UNPROVEN`**.
2. **HPC Cross-Runtime / Wasm Suite (`SECP085*.test.ts`)**: Legacy tests expect native wasm pre-compilation. Classification: **`ENVIRONMENT_DEPENDENT` / `UNPROVEN`**.
3. **5-Axis Kinematics Simulation (`SECP087KinematicsAndSimulation.test.ts`)**: Legacy kinematic joint limits. Classification: **`UNPROVEN`**.
4. **Telemetry Adversarial Suite (`SECP086Adversarial.test.ts`)**: Uncontrolled duplicate storm test expectations. Classification: **`NON_DETERMINISTIC` / `UNPROVEN`**.

*Per strict guidelines, none of these legacy tests were altered, suppressed, or disabled.*
