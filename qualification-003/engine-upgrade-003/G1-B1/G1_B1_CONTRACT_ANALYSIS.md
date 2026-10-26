# G1-B1 Contract Analysis: Adaptive CFL Controller Binding

## 1. Interface Stub (`src/engine/cfd3d/adaptive/AdaptiveCFLTimeController.ts`)
- **Constructor**: `constructor(a, b, c, d)` (4 parameters, likely targetCFL, minDt, maxDt, initialDt)
- **Methods**:
  - `computeMaxCFL(mesh, u, v, w, fluid)`: Expected to return `{ maxCFL: number }`.
  - `adaptTimestep(maxCFL, errorRatio, forceAccept?)`: Expected to return `number` (new dt).
  - `getState()`: Expected to return `AdaptiveCFLState` (as per `AdaptiveCFDTypes.ts`).

## 2. Production Engine (`src/engine/cfd3d/solvers/adaptive/AdaptiveTimeStepController.ts`)
- **Constructor**: `constructor(config: ControllerConfig)` (8 parameters)
- **Methods**:
  - `estimateInitialDt(dx, u_mean, soundSpeed, alpha)`: Returns `{ dt, limiter }`.
  - `estimateNextDt(previousDt, measuredError, measuredCFL, limiter)`: Returns `{ dt, limiter }`.

## 3. Discrepancy & Bridging Strategy
- **Discrepancy**: The production engine operates on scalar cell-averaged values (`dx`, `u_mean`), while the stub is called with full mesh arrays.
- **Bridging**:
  1. `AdaptiveCFLTimeController` will encapsulate an instance of `AdaptiveTimeStepController`.
  2. `computeMaxCFL` will implement the reduction loop over all cells in the mesh to find the maximum local CFL.
  3. `adaptTimestep` will proxy to `estimateNextDt`.
  4. `getState` will be implemented to return a full `AdaptiveCFLState` including history.

## 4. Safety & Fail-Closed Behavior
- Production engine already throws `MIN_TIMESTEP_REACHED` on failure.
- Wrapping logic must handle NaN/Infinity if they escape the `PreFlightValidator`.
