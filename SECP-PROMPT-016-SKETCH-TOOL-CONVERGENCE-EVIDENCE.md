# SECP-PROMPT-016-SKETCH-TOOL-CONVERGENCE-EVIDENCE

## 1. Goal
Close all sketch tools and fully integrate them into the Canonical Sketch pipeline. Every tool must follow the mandatory architectural path:
`Tool -> Intent -> Canonical Dispatcher -> Canonical Action -> EngineeringDocument -> Canonical Sketch -> Evaluation -> Verification`.

## 2. Trace Matrix

| Tool | Intent | Dispatcher | Action | Document SOT | GCS Solve | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Line | `SKETCH_LINE` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Circle | `SKETCH_CIRCLE` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Rectangle | `SKETCH_RECTANGLE` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Arc | `SKETCH_ARC` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Polyline | `SKETCH_POLYLINE` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Point | `SKETCH_POINT` | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Construction | `SKETCH_LINE` (isConst) | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |
| Centerline | `SKETCH_LINE` (isCenter) | `CanonicalIntentDispatcher277` | `SketchAction277` | `EngineeringDocument.sketches` | `solveCanonicalSketch` | `SKETCH_MUTATION_EVIDENCE` |

## 3. Implementation Details

### 3.1 Intent Definition (`EngineeringIntent277.ts`)
- Added `SKETCH_RECTANGLE`, `SKETCH_ARC`, `SKETCH_POLYLINE`, `SKETCH_POINT`, and `SKETCH_DELETE_ENTITY` to `EngineeringIntentType`.
- Defined specific interfaces for each intent with mandatory `sketchId` and geometric parameters.

### 3.2 Canonical Action (`SketchAction277.ts`)
- Implemented `SketchAction277` as the central mutator for all sketch operations.
- Uses revision-controlled mutation operators from `CanonicalSketchContract.ts`.
- Automatically triggers `solveCanonicalSketch` after every mutation to ensure GCS/Constraint consistency.
- Produces `SKETCH_MUTATION_EVIDENCE` for auditability.

### 3.3 Dispatcher Registration (`CanonicalIntentDispatcher277.ts`)
- Registered all sketch intents in the `actionRegistry` of `CanonicalIntentDispatcher277`.
- Removed legacy switch-case manual routing for sketch tools.

### 3.4 UI Convergence (`SketcherPanel.tsx`)
- Refactored `SketcherPanel` to use `dispatchIntent` instead of local state mutations.
- Removed direct calls to `SketchCreationTools` for the target tools.
- Ensured `onCanonicalUpdate` is triggered by the dispatcher's result, maintaining the `EngineeringDocument` as the Single Source of Truth.

## 4. Verification Results
- **Line/Circle/Rectangle**: Confirmed to produce canonical entities in `EngineeringDocument`.
- **Construction/Centerline**: Correctly mapped to `isConstruction` and `isCenterline` flags in the canonical line entity.
- **Delete**: Selection-based delete correctly dispatches `SKETCH_DELETE_ENTITY`.
- **GCS Integration**: Every creation/deletion triggers a solver pass via the action.

## 5. Architectural Compliance
- **No UI-only Truth**: React state no longer acts as the source of truth for canonical entities.
- **Evidence-First**: Every successful tool execution produces verifiable evidence in the action result.
- **Closure**: All listed sketch tools are now fully integrated into the canonical engineering pipeline.
