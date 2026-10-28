# Architecture Decision Record: SECP-PROGRAMMABLE-MATERIAL-003

## Title
Spatial Material Field Contract & Grading Architecture

## Status
PROPOSED (Design Only — Implementation Prohibited)

## Context
The prior forensic investigation (`SECP-PROGRAMMABLE-MATERIAL-001` and `SECP-PROGRAMMABLE-MATERIAL-002`) confirmed that the SECP FEM engine currently operates under a homogeneous material assumption. Specifically, `FEMMaterial` is static, `ConstitutiveModel.update` lacks spatial coordinate input, and `GlobalAssemblyEngine` does not evaluate spatial field functions at Gauss integration points.

To support Programmable Material Engineering (PME) without creating a parallel engineering platform or duplicated canonical authorities, we must design a minimal, robust architectural extension.

## Decision Drivers
1. **Preserve Canonical Authority:** The Canonical Model and Revision remain the single source of truth; spatial material fields are revision-bound dependent objects.
2. **Minimize Surface Area:** Avoid building a standalone "Grading Engine" if existing contracts in `ConstitutiveModel` or `FEMElementFormulation` can be cleanly extended.
3. **Fail-Closed Provenance:** Stale fields or mismatched revisions must invalidate computations immediately rather than falling back silently.
4. **Strict Separation:** Clear separation between target fields, predicted as-manufactured fields, and measured fields.

## Considered Options
1. **Option A: Global Constitutive Extension** — Pass $(x, y, z)$ directly into `ConstitutiveModel.update(strain, state, location)`.
2. **Option B: Element-Level Material Map Resolution** — Resolve properties inside `computeNonlinearMatrices` via an element-bound material field adapter.
3. **Option C: Separate Field-Evaluation Adapter Layer** — Introduce a dedicated pre-processing pass that evaluates field functions onto discrete integration point property caches before assembly.

## Decision
**Option B (Element-Level Material Map Resolution with Constitutive Extension)** is recommended. 
- The `ConstitutiveModel.update` contract will be extended to accept an optional `location?: {x, y, z}` and spatial property overrides.
- `FEMElementFormulation` (e.g., `TET4PlasticFormulation`) will query a revision-bound `SpatialMaterialField` using the physical coordinates of each integration point during assembly.
- This reuses existing assembly loops and material state managers without duplicating solver logic.

## Consequences
- **Positive:** Minimal code footprint; full reuse of `MaterialStateManager` and sparse assembly; exact Gauss-point property resolution.
- **Negative:** Requires updating all custom element formulations that participate in spatial grading.
