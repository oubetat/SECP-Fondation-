TASK ID:
SECP-PROGRAMMABLE-MATERIAL-002

TITLE:
Spatial Material Mapping — Independent Feasibility Verification

CLASSIFICATION:
Engineering Capability Verification / Data-Flow Audit

STATUS:
ACTIVE_INVESTIGATION

MISSION:
Prove whether the existing SECP architecture can support a spatially varying material field (Programmable Material) and identify the exact implementation gaps in the data path from definition to solver.

============================================================
1. PHASE A — IMPLEMENTATION AUDIT (DATA PATH TRACE)
============================================================

Perform a read-only audit of the following files to trace the flow of material parameters:
- /src/engine/fem/core/FEMTypes.ts
- /src/engine/fem/core/MaterialStateManager.ts
- /src/engine/fem/core/ConstitutiveModel.ts
- /src/engine/fem/core/GlobalAssemblyEngine.ts
- /src/engine/fem/core/NonlinearEquilibriumSolver.ts

Establish whether the implementation supports:
1. Representation: Can a material property be defined as a function of (x, y, z)?
2. Mapping: How are property values assigned to integration points?
3. Physical Effect: Does the solver accept per-point property overrides?

Record every line of code that either supports or blocks the data flow.

============================================================
2. PHASE B — SMALL-SCALE NUMERICAL FEASIBILITY
============================================================

Define a 1D benchmark problem:
- Case 1: Homogeneous bar (E = constant).
- Case 2: Gradient bar (E = f(x)).

Required Verification:
- Compare Case 1 to an independent analytical reference.
- Attempt to execute Case 2 using existing hooks.
- If Case 2 fails, document exactly where the current architecture ignores the spatial variation.

============================================================
3. PHASE C — ADVERSARIAL INTEGRITY CHECKS
============================================================

Investigate failure modes for future mapping:
- Out-of-range parameters (e.g., E <= 0 at a specific point).
- Coordinate system mismatches between geometry and field.
- Stale material fields after mesh/geometry revisions.
- Inconsistent units in the field definition.

================ :===========================================
4. DELIVERABLES
============================================================

1. DATA_PATH_AUDIT_REPORT.md: Trace of material data from definition to assembly.
2. NUMERICAL_FEASIBILITY_RESULTS.json: Outcome of the 1D benchmark attempt.
3. CAPABILITY_GAP_VERDICT.md: One of [EXISTING_CAPABILITY_VERIFIED, EXISTING_CAPABILITY_WITH_LIMITATIONS, IMPLEMENTATION_GAP_CONFIRMED].

============================================================
GOVERNANCE:
- NO SOURCE CODE MODIFICATIONS.
- NO NEW ENGINE CREATION.
- FAIL-CLOSED EVIDENCE CLASSIFICATION.
