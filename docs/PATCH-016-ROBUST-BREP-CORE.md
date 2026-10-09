# SECP CAD Kernel — Robust B-Rep Core

## 1. Topology Model
The kernel establishes strict hierarchical validation mapping from `Compound -> Solid -> Shell -> Face -> Loop -> Edge -> Vertex`.

## 2. Geometry References
Topological entities strictly refer to defined Mathematical models from `GeometryContracts`. A Vertex owns a Point. An Edge owns a Curve. Validation demands that a topology shape not exist independently of its geometric constraint.

## 3. Incidence Model
BRepValidator constructs an explicit incidence map bridging topological layers. Validation actively answers "which faces share this edge" rather than merely traversing tree structures.

## 4. Orientation Model
Explicit orientation tracking occurs at component intersections. `OrientedEdge` wraps an Edge within a Loop. `OrientedFace` wraps a Face within a Shell. Orientation is checked for correctness dynamically across face-loop boundaries.

## 5. Manifold Semantics
Boundary connectivity validates manifolds against open shells:
- **MANIFOLD**: Edge shared by exactly two faces.
- **NON_MANIFOLD**: Edge shared by >2 faces.
- **OPEN**: Edge bound by exactly 1 face (boundary edge).
The validator enforces these boundaries algorithmically without rewriting topological relationships.

## 6. Open vs Closed Shells
Open shells are legal topological constructs internally tracking `manifoldStatus = 'OPEN'`. However, `Solid` bodies aggressively reject Open Shells, safeguarding volumetric closure guarantees.

## 7. Solid Validity Semantics
A `Solid` inherently asserts 3D domain closure. Without explicitly proving a `MANIFOLD` status at the shell level, the Solid is declared structurally invalid. Geometric non-penetration logic remains `UNPROVEN` natively but structurally sound.

## 8. Diagnostic Taxonomy
Invalid structures yield precise semantic codes:
- `DANGLING_TOPOLOGY`: Missing topological references (e.g., an Edge without endpoints).
- `INVALID_GEOMETRY_REFERENCE`: Null or structurally undefined mathematical references.
- `BROKEN_LOOP_CLOSURE`: Topologically disconnected loops.
- `DEGENERATE_ENTITY`: Zero-edge loops or zero-face shells.
- `NON_MANIFOLD`: Edge adjacency exceeds 2 faces.
- `DUPLICATE_ID`: Vertex collision tracking detects duplicate keys mapping to distinct coordinates.

## 9. Validation vs Repair
Validation remains an explicitly observational tool. `BRepValidator` prevents side effects on the topological DOM (No edge flipping, zero reference trimming, and zero ID regeneration).

## 10. OCCT Adapter Boundary
SECP validates backend topology against its foundational structure rules (reporting `BACKEND_DELEGATED` where features span the `CadGeometryKernel`). STEP topology parsing boundaries cleanly split from validation.

## 11. Identity Integration
B-Rep validation heavily adheres to canonical representation (from PATCH-008). Vertex identifiers drive duplication tracking cleanly preventing array-index mutation errors.

## 12. Serialization Integration
Loop validation integrates seamlessly with `CanonicalSerializer` determinism constraints (PATCH-009). Ordering within loops asserts structural intent and cascades up into varying hash outputs.

## 13. Hash/Evidence Integration
Topological checks naturally tie back to the `Evidence Model` ensuring that downstream `PASS` claims correlate directly to an explicit `BRepValidationResult`.

## 14. Known Limitations
- Geometric enclosure operations await true point-in-solid Boolean operations (PATCH-021).
- Non-manifold mesh-based repair systems are deferred to PATCH-020 (Topology Healing).
