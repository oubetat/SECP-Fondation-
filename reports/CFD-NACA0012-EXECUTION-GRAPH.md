# SECP CFD — FORENSIC EXECUTION GRAPH (NACA 0012 SST)

**Case Reference:** SECP-CFD-BENCHMARK-NACA0012-001  
**Target Configuration:** NACA 0012 / AoA = 10.0° / Re = 6.0×10⁶ / SST k-ω  

---

## 1. Top-Level Orchestration

| Stage | Source File | Function | Inputs | Outputs | Evidence Generated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Benchmark Runner** | `run_benchmark.ts` | (Script) | Benchmark Options | Console Log, JSON Report | Execution log, strict GCI status |
| **Benchmark Suite** | `Naca0012SstBenchmark.ts` | `run()` | `options` (AoA, Re, Mesh density) | `report` (StrictGciReport) | Multi-grid comparison, forensic verdict |
| **Grid Level Solver** | `Naca0012SstBenchmark.ts` | `solveGridLevel()` | `levelName`, `nx`, `ny`, `options` | `GridSolutionEvidence` | Mesh hash, solution state hash, $C_L$ |

---

## 2. Geometry & Mesh Generation

| Stage | Source File | Function | Inputs | Outputs | Evidence Generated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geometry Generation** | `AirfoilGeometryEngine.ts` | `generateNaca4()` | `designation` ("0012"), `chord`, `numPoints` | `AirfoilGeometry` | `geometryHash`, coordinates, surface normals |
| **Mesh Generation** | `AirfoilMeshGenerator.ts` | `generateOGrid()` | `OGridConfig` | `FvmMesh3D` | `meshId`, cell/face counts, volumes, centroids |
| **Boundary Classification** | `Naca0012SstBenchmark.ts` | `solveGridLevel()` | `fvmMesh`, `aoaRad` | (Mutated) `fvmMesh.faces` | `boundaryType` (INLET/OUTLET/WALL) |

---

## 3. Solver Iteration (FVM 3D)

| Stage | Source File | Function | Inputs | Outputs | Evidence Generated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Solver Main Loop** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `mesh`, `fluid`, `config`, `Lref`, `Uref` | `FvmSolution3D` | `totalIterations`, `converged`, `monitors` |
| **Turbulence Setup** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `config.turbulenceScheme` | `SstKomegaModel` | Model initialization hash |
| **Iteration State** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `u, v, w, p, k, omega` | (Mutated) Fields | `iterationHistory`, residuals |
| **Turbulence Evaluation** | `SstKomegaModel.ts` | `evaluate()` | `turbState`, `ransState` | `TurbulenceEvaluation` | `nut`, source terms, field updates |
| **Pressure Correction** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `continuityError` | `pPrime` | `pressureCorrection` (Linf delta) |
| **Velocity Update** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `pPrime`, `gradP` | `u, v, w` | `velocityCorrection` (Linf delta) |
| **Outlet Treatment** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `inletFlux`, `outletFlux` | `outletScaleFactor` | `globalMassImbalanceNorm`, scaling invariant |

---

## 4. Diagnostics & Forensics

| Stage | Source File | Function | Inputs | Outputs | Evidence Generated |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Wall Solution** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `WALL` faces, `u, v, w, nut` | `yPlus` | `yPlusMean`, `yPlusMax`, `wallTreatmentEvidence` |
| **Force Integration** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `WALL` faces, `p, mu, nut, gradU` | `forces` | `Fx`, `Fy`, `Lift`, `Drag`, `Cl`, `Cd` |
| **Moment Integration** | `Fvm3DNavierStokesSolver.ts` | `solve()` | `WALL` faces, reference point | `moment` | `pitchingMomentNm`, `Cm` |
| **GCI Calculation** | `GciEngine.ts` | `evaluateStrictContract()` | `GridSolutionEvidence` (3x) | `StrictGciReport` | `observedOrder`, `gciFine`, `asymptoticRange` |

---

## 5. State Ownership & Provenance

*   **Geometry State:** Owned by `AirfoilGeometryEngine`. Provenance via `geometryHash`.
*   **Mesh State:** Owned by `AirfoilMeshGenerator`. Provenance via `meshHash`.
*   **Solver State:** Owned by `Fvm3DNavierStokesSolver`. Provenance via `solutionStateHash`.
*   **Force State:** Owned by `Fvm3DNavierStokesSolver` post-iteration. Provenance via `forceStateHash`.
*   **GCI State:** Owned by `GciEngine`. Provenance via `StrictGciReport`.
