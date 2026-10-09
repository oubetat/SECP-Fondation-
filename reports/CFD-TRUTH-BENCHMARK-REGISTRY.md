# SECP — CFD TRUTH BENCHMARK REGISTRY REPORT

**Status:** `OPERATIONAL`  
**Total Registered Benchmarks:** 5  
**Truth Ladder Levels Active:** L0, L1, L2, L3, L4  

## 1. Executive Summary

The SECP CFD verification and validation framework has been transitioned from a single-case approach (NACA0012) to a systematic **CFD Truth Ladder**. This architecture allows for graded, orthogonal testing of the CFD stack, ensuring that fundamental numerical schemes and physical models are verified before moving to complex aerodynamics.

The framework follows NASA TMR (Turbulence Modeling Resource) standards and provides a rigorous contract for every benchmark, including governing equations, mesh specifications, convergence criteria, and physical validation targets.

## 2. CFD Truth Ladder (Current Implementation)

| Level | Benchmark ID | Name | Target Verification |
| :--- | :--- | :--- | :--- |
| **L0 — Analytical** | `L0-MMS-SCALAR` | Method of Manufactured Solutions | Discretization Order of Accuracy |
| **L0 — Analytical** | `L0-POISEUILLE-3D` | 3D Plane Poiseuille Flow | Viscous/Pressure Terms & Conservation |
| **L1 — Fundamental** | `L1-LID-CAVITY-3D` | 3D Lid-Driven Cavity | Pressure-Velocity Coupling |
| **L2 — Boundary Layer** | `L2-FLAT-PLATE-3D` | ZPG Flat Plate | SST k-omega BL Growth & Wall Treatment |
| **L3 — Separation** | `L3-BFS-3D` | 3D Backward-Facing Step | Shear Layer Separation & Reattachment |
| **L4 — External Aero** | `L4-NACA0012-SST` | NACA 0012 SST k-omega | Airfoil Aerodynamics & Lift/Drag Validation |

## 3. Benchmark Contract Specification

Every entry in the `CFDTruthBenchmarkRegistry` adheres to a strict contract:

*   **Governing Equations:** e.g., Steady-state RANS (SST k-omega).
*   **Mesh Specification:** Formal grid resolution and topology (O-Grid, Cartesian Hex).
*   **Convergence Contract:** Residual tolerances and iteration limits.
*   **Verification Targets:** Quantitative metrics (Order of Accuracy, CL, Cf).
*   **Validation Targets:** Comparison against experimental data (NASA TMR).
*   **Reproducibility:** Bit-exact or hash-stability requirements.

## 4. Systematic Verification (Ladder Execution)

The `CFDTruthBenchmarkRegistry.runLadder()` method enables automated, fail-closed execution of the truth sequence. If an L0 benchmark fails (e.g., discretization error too high), the system identifies a fundamental stack failure, preventing false passes at higher aerodynamic levels.

## 5. Implementation Artifacts

*   **Registry Engine:** `src/engine/cfd3d/truth/CFDTruthBenchmarkRegistry.ts`
*   **Truth Types:** `src/engine/cfd3d/truth/CFDTruthTypes.ts`
*   **Bootstrap:** `src/engine/cfd3d/truth/CFDTruthBootstrap.ts`
*   **Systematic Tests:** `tests/CFDTruthLadder.test.ts`
