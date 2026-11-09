# SECP — TypeScript Integrity Recovery: Repair Batches

## Batch 1: Shared Canonical Contracts (Foundation)
**Objective:** Eliminate cascading diagnostics by aligning base interfaces with their implementation and usage patterns.

- **Scope:** 
  - `src/engine/assembly/AssemblyConstraintTypes.ts`
  - `src/engine/assembly/KinematicTypes.ts`
  - `src/engine/engineering_webgpu/ComputeBackend.ts`
  - `src/engine/cfd3d/Fvm3DTypes.ts`
- **Root Causes:** TS2339, TS2322 (Contract/API mismatches).
- **Verification:** `npx tsc --noEmit -p tsconfig.json` (Expected reduction: ~500+ diagnostics).

## Batch 2: Engine & Service API Integrity
**Objective:** Fix callers and implementations within the engine core to ensure strict type safety for simulation logic.

- **Scope:**
  - `src/engine/assembly/AssemblyConstraintSolver.ts`
  - `src/engine/engineering_webgpu/HardAcceptanceGate296.ts`
  - `src/engine/cam/production-gate/CAMProductionGateWorkspace.tsx`
- **Root Causes:** TS2339, TS2551, TS2554.
- **Verification:** Vitest CAD Kernel & CFD Ladder tests.

## Batch 3: Nullability & Data Flow
**Objective:** Resolve `possibly undefined` errors in high-impact modules using explicit guards and refined optional types.

- **Scope:**
  - `src/engine/cad-kernel/document/AssemblyMateSolver.ts`
  - `src/engine/forensic/LiveForensicAuditor.ts`
- **Root Causes:** TS18048, TS2532.

## Batch 4: UI Adapters & Workbenches
**Objective:** Align UI state management with engine contracts.

- **Scope:** `src/components/*`
- **Root Causes:** TS2322, TS2367.

## Batch 5: Verification & Test Contracts
**Objective:** Ensure test harnesses reflect production contracts without lowering safety standards.

- **Scope:** `src/verification/*`, `tests/*`
- **Root Causes:** All remaining.
