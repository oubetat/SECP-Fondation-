# Adversarial & Invalidation Specification: SECP-PROGRAMMABLE-MATERIAL-003

## 1. Objective
Define fail-closed behaviors and adversarial tests to ensure that malformed spatial material fields, out-of-bounds parameters, or stale revisions are strictly rejected.

## 2. Adversarial Test Cases
1. **ADV-FIELD-001 (Negative Modulus):** Field generates $E(x) \le 0$. **Expected:** Immediate rejection with `[INVALID_MATERIAL_PROPERTY]` error.
2. **ADV-FIELD-002 (NaN / Inf Evaluation):** Field expression returns NaN or Infinity. **Expected:** Solver halts, state rollback triggered.
3. **ADV-FIELD-003 (Out-of-Domain Query):** Element nodes fall outside `domainBounds`. **Expected:** Trigger `missingDataBehavior` (Default: FAIL_CLOSED).
4. **ADV-FIELD-004 (Stale Revision):** Geometry or mesh is modified, but `canonicalRevisionId` of the spatial field is not updated. **Expected:** Dependency invalidation engine rejects solver execution.
5. **ADV-FIELD-005 (Unit Mismatch):** Field specifies kPa while model expects MPa. **Expected:** Unit validation schema rejection.

## 3. Fail-Closed Invalidation Policy
- **No Silent Fallback:** Under no circumstances shall a malformed or missing spatial field silently default to a homogeneous material.
- **State Invalidation:** Modifying a spatial field invalidates all associated solver results and evidence digests.
