# POST-UX-006 — PARALLEL ENGINEERING STATE BASELINE REPORT

## 1. Audit Executive Summary
A comprehensive audit of 132 components in `src/components` identified **1545 findings** related to state initialization and engineering defaults. The audit reveals a systemic architectural pattern where UI components initialize their own "Local Engineering Truth" instead of deriving state strictly from the **Canonical Engineering Document (SOT)**.

### Classification Key
*   **A — UI-only default**: Search strings, UI toggles, non-engineering metadata.
*   **B — Engineering input default**: Hardcoded engineering values in `useState` (e.g., `150kg`).
*   **C — Canonical-derived**: Correct derivation from `canonicalDocument` or `activeSolid`.
*   **D — Explicit benchmark/reference**: Intentional demo/reference datasets (e.g., `samplePrograms`).
*   **E — Implicit engineering fallback**: Hidden defaults in logic (e.g., `?? 0.03`).
*   **F — Local parallel engineering state**: Entire models created locally (e.g., `createDefaultParametricBox`).

---

## 2. High-Risk Workbench Audit

| File | Primary Finding | Classification | Impact |
| :--- | :--- | :---: | :--- |
| `ParametricModelingPanel.tsx` | `ParametricEngine.createDefaultParametricBox()` in `useState` | **F** | Creates a shadow model on mount. |
| `EngineeringCorePanel.tsx` | `useState(150)`, `useState(9.81)`, `useState(2.5)` | **B** | Presents physics "truth" unrelated to project. |
| `ElectricalWorkbenchPanel.tsx` | `getDefaultCircuitComponents()` on mount | **F** | Populates circuit board with fake data. |
| `GCodeVerificationPanel.tsx` | `baselineToolpath` with hardcoded coordinates | **D/E** | Verification compares vs. mock truth. |
| `CaeCfdPanel.tsx` | Solve RANS with `18.0 m/s` hidden benchmark | **E/F** | Implicit CFD truth on mount. |
| `MaterialsPanel.tsx` | `volumeMm3 ?? 0`, `massKg ?? 0` | **E** | Zero-masking for missing data. |
| `FluidPowerPanel.tsx` | `getDefaultSystemComponents()` | **F** | Implicit hydraulic network. |
| `PcbWorkbenchPanel.tsx` | `getDefaultSchematic()` | **F** | Implicit PCB schematic. |
| `CamPanel.tsx` | `BENCHMARK` mode masquerading as active CAD | **D** | Ambiguous boundary between Project and Demo. |

---

## 3. Findings Catalog (Representative Samples)

### Category F: Local Parallel Engineering State
*   `ParametricModelingPanel.tsx:21`: `useState<ParametricModel>(() => ParametricEngine.createDefaultParametricBox())`
*   `ElectricalWorkbenchPanel.tsx:16`: `getDefaultCircuitComponents()`
*   `FluidPowerPanel.tsx:22`: `FluidPowerEngine.getDefaultSystemComponents()`
*   `PcbWorkbenchPanel.tsx:27`: `PcbEngine.getDefaultSchematic()`

### Category B: Engineering Input Defaults
*   `EngineeringCorePanel.tsx:70`: `setForceMass(150)`
*   `EngineeringCorePanel.tsx:71`: `setForceAccel(9.81)`
*   `EngineeringCorePanel.tsx:79`: `setFluidVel(2.5)`
*   `RobotRequirementsPanel.tsx:80`: `setSimulateNewVal('15')`

### Category E: Implicit Fallbacks
*   `ParametricModelingPanel.tsx:237`: `volumeM3 ?? 0.03`
*   `ParametricModelingPanel.tsx:241`: `surfaceAreaM2 ?? 0.62`
*   `KinematicSolverWorkspace.tsx:46`: `defaultConfig` containing hardcoded physics constraints.

---

## 4. Next Steps
1.  **Phase 2 Implementation**: Begin stripping Class B, E, and F findings from high-risk workbenches.
2.  **Enforce UNAVAILABLE Semantics**: Replace implicit `0` or `default` values with `null` or `UNAVAILABLE` UI states.
3.  **Strict Benchmark Separation**: Ensure all Class D data requires explicit user opt-in.
