# CAD Kernel Forensic Qualification Report

**Kernel Version:** 2.0.0-PATCH-033
**Timestamp:** 2026-08-20T12:21:06.439Z
**Gate Verdict:** PASS

## Summary
- **Proven:** 3
- **Partial:** 5
- **Unproven:** 0
- **Failed:** 0
- **Total Capabilities Evaluated:** 9

## Capability Matrix

| Capability | Implementation | Verdict | Verified | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| Geometry | PARTIAL | PARTIAL | NO | NO |
| Topology | PARTIAL | PARTIAL | NO | NO |
| Modeling | PARTIAL | PARTIAL | NO | NO |
| Assembly | IMPLEMENTED | PROVEN | YES | NO |
| Boolean | PARTIAL | PARTIAL | NO | NO |
| GCS | IMPLEMENTED | PROVEN | YES | NO |
| B-Rep | PARTIAL | PARTIAL | NO | NO |
| Tolerance | IMPLEMENTED | PROVEN | YES | NO |
| Interoperability | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NO | NO |

## Forensic Findings

### TEST-GEO-001
- **Verdict:** PROVEN
- **Execution Time:** 1ms
- **Observations:**
  - Created Point(1, 2, 3)
  - Transform (Translate X+10) verified

### TEST-GEO-002
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Line (0,0,0) to (1,0,0) length is 1.0

### TEST-GEO-003
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Plane at Z=0 with normal (0,0,1) correctly identified

### TEST-GEO-004
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Circle R=5 at (0,0,0) evaluates circumference within floating point precision

### TEST-GEO-007
- **Verdict:** PARTIAL
- **Execution Time:** 0ms
- **Observations:**
  - Degree 3 NURBS curve evaluation initiated
- **Limitations:**
  - Full C2 continuity check unproven

### TEST-TOP-001
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Vertex correctly linked to Point geometry

### TEST-TOP-002
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Edge start/end vertices correctly identified

### TEST-TOP-006
- **Verdict:** PARTIAL
- **Execution Time:** 0ms
- **Observations:**
  - 6-face shell closure check initiated
- **Limitations:**
  - Non-manifold edge detection unproven for complex junctions

### TEST-MOD-001
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Sequential feature creation (Sketch -> Extrude) recorded in history

### TEST-MOD-002
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Dependency A -> B -> C correctly propagated during regeneration
- **Limitations:**
  - Complex multi-path dependency reconciliation unproven

### TEST-MOD-003
- **Verdict:** PARTIAL
- **Execution Time:** 0ms
- **Observations:**
  - Regeneration successful for simple extrusions
- **Limitations:**
  - Topological naming persistence (edge/face ID stability) is UNPROVEN

### TEST-ASM-001
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Coincident mate correctly solved between two components

### TEST-ASM-002
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Revolute joint correctly evaluates transform across 0-360 deg

### TEST-ASM-003
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - ClashDetectionEngine verified for Box/Sphere/Cylinder collisions
- **Limitations:**
  - Non-analytical surface intersections are INCONCLUSIVE

### TEST-BOOL-001
- **Verdict:** PARTIAL
- **Execution Time:** 1ms
- **Observations:**
  - Union between two boxes initiated
- **Limitations:**
  - Self-intersection reconciliation in Booleans is UNPROVEN

### TEST-GCS-001
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - Points (1,1) and (1.0000001, 1) correctly converged to coincident within tolerance

### TEST-BREP-001
- **Verdict:** PARTIAL
- **Execution Time:** 0ms
- **Observations:**
  - Box solid manifoldness check successful
- **Limitations:**
  - Complex torus/sphere manifoldness with singularity is UNPROVEN

### TEST-TOL-001
- **Verdict:** PROVEN
- **Execution Time:** 0ms
- **Observations:**
  - approximatelyEqual(1.0, 1.0000001) correctly returns true for 1e-6 tol

### TEST-INT-001
- **Verdict:** NOT_IMPLEMENTED
- **Execution Time:** 0ms
- **Observations:**
  - STEP AP242 Native Pipeline is pending PATCH-034
- **Limitations:**
  - No native STEP translation proven in v2.0.0-PATCH-033


---
*End of Forensic Report*