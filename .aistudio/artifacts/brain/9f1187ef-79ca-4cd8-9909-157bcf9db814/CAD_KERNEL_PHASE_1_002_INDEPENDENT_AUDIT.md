# SECP CAD Kernel Phase 1-002 Independent Forensic Audit Report
**Campaign Identifier:** `SECP-CAD-KERNEL-PHASE-1-002`  
**Mission Type:** Read-Only Adversarial Geometric Qualification Challenge  
**Standard Authority:** SECP Canonical Engineering Core  
**External Kernel Policy:** NO REPLACEMENT / NO NEW EXTERNAL KERNEL DEPENDENCY  
**Revision Identity:** `REVISION_IDENTITY_UNAVAILABLE`  
**Audit Standard:** Fail-Closed / Evidence-Backed Engineering Truth  
**Final Verdict:** `PARTIALLY_QUALIFIED_WITH_DECLARED_LIMITATIONS`  

---

## 1. Executive Summary & Audit Mandate

An independent, read-only forensic qualification challenge was performed on the Phase 1 native CAD kernel implementation (`SECP-CAD-KERNEL-PHASE-1-001`). The mission strictly adhered to the constraint that **no production code, tests, or thresholds were modified** during this audit.

The investigation probed beyond passing test counts and build indicators to examine actual B-Rep topology, face boundary continuity, raw divergence theorem volumetric behavior, STEP Part 21 schema fidelity, and production execution paths.

### Core Verdict: `PARTIALLY_QUALIFIED_WITH_DECLARED_LIMITATIONS`

While Phase 1 introduced genuine mathematical equations (e.g. true spherical/toroidal vertex parameterization, inward normal offset equations, and Piegl & Tiller Cox-de Boor algorithms), rigorous forensic probing revealed **critical topological and architectural limitations** that prevent a verdict of `FULLY_QUALIFIED`:

1. **Fillet & Chamfer Topology Disconnect**: In `FeatureExecution.ts`, only a single directional face (`bevel_east` or `blend_east`) is appended to the solid's outer shell. Adjacent side faces are **not trimmed**; the original top face is **duplicated**, leaving overlapping faces and open boundary seams.
2. **Divergence Theorem vs Analytical Volume Override**: In `BRepKernel.ts`, `computeVolume` short-circuits to `(solid as any).analyticVolume`. When this property is bypassed, raw divergence theorem on the shelled solid yields $4341.33\,\text{m}^3$ instead of the theoretical $1952.0\,\text{m}^3$ because `computeVolume` does not invert the divergence sign for inner cavity faces (`Orientation.REVERSED`).
3. **STEP AP242 Comment Dependency**: In `STEPAP242Translator.ts`, round-trip model reconstruction relies on a base64-encoded JSON comment (`SECP_AP242_SEMANTIC_METADATA`). When imported as a pure ISO 10303-21 file without this comment, 0 solids and 0 dimensions are reconstructed.
4. **NURBS Constructor Parameter Incompatibility**: `BRepNURBSSurface` constructor in `BRepGeometry.ts` expects `(degU, degV, knotsU, knotsV, controlPoints)`, whereas surface workbench builders pass `(degU, degV, controlNet, weights, knotsU, knotsV)`.
5. **Mutation Gate EMPTY Hashes**: Investigated and traced: `EMPTY` hashes in `BRepMutationGate277` originate when `doc.evaluatedShape` is null before an initial feature or when an operation fails during negative adversarial tests.

---

## 2. Capability-by-Capability Forensic Audit

### 2.1 Sphere & Torus Primitives
- **Sphere Findings**:
  - `createSphere` generates a 288-face B-Rep solid ($12 \times 24$ quad/triangle mesh).
  - All vertices strictly obey $x^2 + y^2 + z^2 = R^2$ to within $10^{-6}$.
  - Normal vectors point radially outward ($\vec{n} \cdot \vec{r} > 0$).
  - Discrete faceted divergence volume: $63.602\,\text{m}^3$ (inscribed polyhedral discretization error of $\approx 2.82\%$ relative to analytical $65.450\,\text{m}^3$).
  - Euler characteristic $\chi = V - E + F = 2$, genus $g = 0$.
  - Fail-closed validation for $R \le 0$ and `NaN` verified.
- **Torus Findings**:
  - `createTorus` generates a 384-face B-Rep solid ($24 \times 16$ quad mesh).
  - Central cavity verified: minimum distance to Z-axis is $R - r = 3.5 > 0$.
  - Discrete faceted divergence volume: $213.939\,\text{m}^3$ (inscribed error $\approx 3.66\%$ relative to analytical $222.066\,\text{m}^3$).
  - Euler characteristic $\chi = 0$, genus $g = 1$.
  - Fail-closed rejection of $R \le r$, $R \le 0$, and $r \le 0$ verified.

### 2.2 Fillet & Chamfer
- **Chamfer Findings**:
  - `executeChamfer` generates 1 bevel face (`ch1_chamfer_face_bevel_east`).
  - Total shell faces: 8 (1 new top, 1 bevel, 1 bottom, 1 original top, 4 original sides).
  - **Critical Defect**: The original `'box-face-top'` is retained alongside `'ch1_chamfer_face_top'`. The four side faces remain untrimmed at height $Z = 10$.
  - The shell is **non-manifold and topologically open**.
  - Volume reduction is injected as a scalar formula on `analyticVolume`, not derived from the faceted geometry.
- **Fillet Findings**:
  - `executeFillet` exhibits the identical defect: 1 blend face (`f1_fillet_face_blend_east`), 8 total faces, duplicate top face, untrimmed side faces.

### 2.3 Shell Evaluator
- **Normal Offset Distance**:
  - Measured perpendicular distances on a $20 \times 20 \times 10$ box with $t = 2.0$:
    - $X$-walls: $\Delta X = 2.000\,\text{mm}$ (verified).
    - $Y$-walls: $\Delta Y = 2.000\,\text{mm}$ (verified).
    - Bottom floor: $\Delta Z = 2.000\,\text{mm}$ (verified).
- **Geometric Divergence Failure**:
  - `allShellFaces` contains 14 faces (5 outer, 5 inner, 4 rim).
  - Raw divergence theorem evaluates to $4341.33\,\text{m}^3$ because `BRepKernel.computeVolume` sums absolute face integrals without orienting inner faces negatively.
- **Orientation Limitation**:
  - Offset calculation relies on bounding-box alignment (`minX`, `maxX`, `minY`, `maxY`, `minZ`, `maxZ`); non-axis-aligned solids are unsupported.

### 2.4 STEP AP242 Part 21 Interoperability
- **Envelope Compliance**:
  - Generates valid ISO 10303-21 text containing `HEADER;`, `FILE_DESCRIPTION`, `FILE_SCHEMA`, `DATA;`, `MANIFOLD_SOLID_BREP`, and `END-ISO-10303-21;`.
- **Semantic Data Dependency**:
  - Lossless round-trip operates via `/* SECP_AP242_SEMANTIC_METADATA: <base64> */`.
  - When the comment is removed, `STEPAP242Translator.importFromStepPart21` parses entity count but leaves `solids: []` and `dimensions: []`.
  - True ISO 10303-21 entity mapping remains isolated in `src/engine/interop/step-ap242/` and is not fully wired into `STEPAP242Translator`.

### 2.5 NURBS Surface Evaluation
- **Algorithm Verification**:
  - `RationalSurfaceSynthesisEngine.evaluatePoint` implements Piegl & Tiller Algorithm A4.3.
  - Bilinear midpoint $(0.5, 0.5)$ evaluates to exact $(5.0, 5.0, 5.0)$.
- **Production Integration Defect**:
  - Inverted constructor arguments in `BRepGeometry.ts` (`knotsU` vs `controlPoints`) prevent downstream surface workbench builders from invoking the evaluator correctly.

---

## 3. Forensic Verdict & Mandatory Next Steps

The platform cannot claim `FULLY_QUALIFIED` when:
1. Fillet/Chamfer produces non-manifold shells with duplicate faces.
2. Shell divergence volume contradicts the analytical oracle due to unoriented volume integration.
3. STEP Part 21 exchange depends on a proprietary comment header.

**Final Verdict:** `PARTIALLY_QUALIFIED_WITH_DECLARED_LIMITATIONS`

A targeted restorative campaign (`SECP-CAD-KERNEL-PHASE-1-003`) is required to:
- Reconstruct all 4 boundary loops and trim adjacent faces for Fillet/Chamfer.
- Correct `computeVolume` to respect `Orientation.REVERSED`.
- Unify `BRepNURBSSurface` constructor signatures.
- Wire `StepAp242Mapper` to reconstruct solids from raw STEP Part 21 entities without metadata comments.
