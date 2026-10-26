# CFD Dependency & Call Graph Architecture

## 1. Executive Overview
This document traces the call sites, dependency linkages, and architectural overlap for the 9 audited CFD infrastructure components within the SECP platform.

## 2. Consumer Architecture Map

```
AdaptiveIndustrialCFDEngine.ts (Orchestrator)
 │
 ├── 1. PreFlightValidator.validateCase()                     [STUB -> Returns {isReadyForSolve: true}]
 ├── 2. MeshDiagnosticsEngine.evaluateMeshQuality()           [STUB -> Returns {isValid: true}]
 ├── 3. BoundaryConditionValidator.validate()                 [STUB -> Returns {isValid: true}]
 ├── 4. cflController = new AdaptiveCFLTimeController()        [STUB -> Returns fixed 0.1s]
 ├── 5. relaxationController = new DynamicRelaxationController()[STUB -> Fixed 0.3/0.7]
 ├── 6. monitor = new PhysicalResidualMonitor()               [STUB -> Returns maxResidual: 0, converged: true]
 ├── 7. recoveryEngine = new DivergenceRecoveryEngine()       [STUB -> Hollow no-op]
 ├── 8. conservationEngine = new ConservationEnforcementEngine()[STUB -> Mock 10 accepted iters]
 └── 9. CompressibleShockSensor.detectShocks()                [STUB -> Returns {}]
```

## 3. Duplicate & Parallel Production Implementations

A key finding of this forensic audit is that several of these capabilities **already exist in mature, audited form elsewhere in the SECP codebase**:

| Target Stub Component | Duplicate Production Component | Status of Production Component |
| :--- | :--- | :--- |
| `src/engine/cfd3d/adaptive/AdaptiveCFLTimeController.ts` | `src/engine/cfd3d/solvers/adaptive/AdaptiveTimeStepController.ts` | **Fully Functional & Tested** (100% vitest pass) |
| `src/engine/cfd3d/adaptive/BoundaryConditionValidator.ts` | `src/engine/cfd3d/boundary/BoundaryConditionValidator.ts` | **117 Lines Implemented** (Checks face IDs, patch overlaps) |
| `src/engine/cfd3d/adaptive/MeshDiagnosticsEngine.ts` | `src/engine/cfd3d/Fvm3DMeshGenerator.auditMeshQuality` | **Fully Functional** (Computes non-ortho, volume, skewness) |
| `src/engine/cfd3d/conservation/enforcement/ConservationEnforcementEngine.ts` | `src/engine/cfd3d/conservation/GlobalMassBalance.ts` | **Fully Functional** (Computes net mass imbalance & flux) |

## 4. Test Failure Reproducibility
- Executing `AdaptiveCFDBenchmarkSuite.runAll()` directly reproduces the stub failure at Case 1:
  `TypeError: Cannot read properties of undefined (reading 'every') at AdaptiveCFDBenchmarkSuite.ts:89:76`
  caused directly by `PreFlightValidator.validateCase` failing to provide `checkedItems`.
