# SECP-PROGRAMMABLE-MATERIAL-V4-001: Known Limitations & Scope Boundaries
**Phase**: V4 — Integration Between Geometry and Material  
**Classification**: Scope Boundaries & Explicit Non-Claims  

---

## 1. Explicit Scope Boundaries (What V4 Does NOT Claim)

1. **CAD B-Rep Modeling Kernel**:
   - SECP V4 binds spatial material fields to canonical geometry IDs (`canonicalGeometryId`) and revision identifiers (`geometryRevisionId`), and checks node bounding boxes against spatial domains.
   - It does **not** embed an internal NURBS, Parasolid, or OpenCASCADE B-Rep kernel. Trimming curves, Brep topological stitching, and Boolean CAD operations remain external to this structural core.

2. **Formulations Qualified for Spatial Fields**:
   - Only `Bar1DFormulation` (1D uniaxial bar) and `TET43DFormulation` (3D 4-node tetrahedral continuum) are qualified to evaluate spatial material fields in V4.
   - Other formulations (`CST_2D`, `T6_2D`, `Q4_2D`, `BEAM_2D`, `FRAME_2D`, `TRUSS_2D_NL`, `TET4_PLASTIC`) reject spatial assignments fail-closed with `[UNSUPPORTED_FORMULATION_SPATIAL_FIELD]`. Extension to 2D continuum and plate/shell elements is scheduled for future phases.

3. **Sub-Element Continuous Integration (Gauss Point Integration)**:
   - For constant strain tetrahedra (`TET4_3D`), the element centroid evaluation is exact for linear strain. Higher-order elements (e.g. 10-node TET10 or 8-node HEX8) with multi-point Gauss numerical quadrature are reserved for subsequent phases.

4. **Multi-Physics and Physical Manufacturing (V5 - V12)**:
   - Phase V4 represents the formal *geometric-material coupling*. It makes **no claims** regarding thermomechanical coupling, multi-scale homogenization, or additive manufacturing toolpath generation (which belong to V5–V12).

---

## 2. Operational Recommendations
- Always declare `coordinateFrame` with `transform.position` and `transform.rotationMatrix` when parts are modeled in their own local manufacturing coordinates but assembled globally.
- Use `FULL_COVERAGE_MANDATORY` for flight-critical and safety-critical components to guarantee that no element falls outside the qualified material domain.
