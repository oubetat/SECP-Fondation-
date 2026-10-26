# G1-B1 Call Graph: Adaptive CFL Infrastructure

## 1. Interface Callers (Stub)
- **`AdaptiveIndustrialCFDEngine.ts`**:
  - Line 62: `new AdaptiveCFLTimeController(5.0, 1e-3, 1e-7, 0.1)`
  - Line 130: `computeMaxCFL(mesh, u, v, w, caseDef.fluid)`
  - Line 136: `getState().currentTimestepS`
  - Line 260: `adaptTimestep(maxCFL, 1.0, true)`
  - Line 281: `adaptTimestep(maxCFL, 1.0, true)`
  - Line 295: `adaptTimestep(maxCFL, errorRatio)`
- **`AdaptiveCFDBenchmarkSuite.ts`**:
  - Line 133: `new AdaptiveCFLTimeController(5.0, 1e-3, 1e-6, 0.1)`
  - Line 137: `computeMaxCFL(mesh1, u_mock, v_mock, w_mock, case1Def.fluid)`
  - Line 138: `adaptTimestep(maxCFL, 0.9)`

## 2. Production Consumers
- **`HardAcceptanceGate068.ts`**: Verification gate for time-stepping logic.
- **`AdaptiveFramework.test.ts`**: Unit tests for growth/shrink limits.
- **`AdaptiveAdversarial.test.ts`**: Unit tests for zero/negative handling.
