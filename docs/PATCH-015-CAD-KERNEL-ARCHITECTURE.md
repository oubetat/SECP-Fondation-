# SECP CAD Kernel Architecture

## 1. Layer Responsibilities
The kernel is structured into independent layers to enforce rigorous engineering dependencies:
- **Core**: Numerical policy, absolute tolerances, kernel context, and capability registry.
- **Geometry**: Pure mathematical descriptions (Points, Vectors, Planes, Curves, Surfaces).
- **Topology**: Boundary representation elements (Vertices, Edges, Faces, Solids) referencing underlying Geometry.
- **B-Rep**: Manifold topology structures maintaining adjacency, incidence, and orientation metadata.
- **NURBS**: Specialized mathematical surfaces/curves supporting degree, control points, knots, and weights.
- **Modeler**: Boundary for constructing and modifying solids, equipped with capability reporting (IMPLEMENTED, PARTIAL, BACKEND_DELEGATED).
- **History**: Directed graphs representing feature inputs, outputs, and dependencies.
- **Constraints**: Declarative parameter/entity relationships (distance, coincident, parallel).

## 2. Geometry vs Topology
The architecture strictly delineates Geometry (mathematical evaluation) from Topology (boundary limits). A `Vertex` is a topological entity that references a geometric `Point`. They are distinct constructs that cannot be implicitly collapsed.

## 3. B-Rep Relationship Model
B-Rep structures are maintained through a hierarchy: Solid -> Shell -> Face -> Wire -> Edge -> Vertex. Each level preserves ownership and adjacency, establishing boundaries without immediately assuming manifold correctness (which will be tackled in subsequent patches).

## 4. NURBS Boundary
The NURBS contract specifies structures for `NurbsCurve` and `NurbsSurface` directly expressing parameter domain, knot vectors (multiplicities), control point weights, and degrees. The architecture refuses to silently normalize or truncate NURBS properties.

## 5. Modeler Boundary
Modeling operations (e.g., Boolean Cut, Union) are exposed through `IModelerCore` returning a strict `KernelOperationResult`. This result ensures that capability status (`IMPLEMENTED`, `BACKEND_DELEGATED`, `UNIMPLEMENTED`) and explicit diagnostics are reported rather than faking success.

## 6. History Boundary
Feature history is encapsulated within `FeatureGraph`. Features contain typed inputs, topological outputs, and dependencies to support downstream parametric evaluation without executing regeneration in this foundational layer.

## 7. Constraint Boundary
Constraints reference topology identities directly and define parametric limitations (e.g., Distance, Concentric). The solver is structurally deferred to PATCH-024+.

## 8. OCCT Backend Boundary
The adapter structure (`CADKernelBackend`) allows the kernel to delegate unimplemented geometric operations to external backends like OCCT. An operation such as `booleanUnion` is marked as `BACKEND_DELEGATED` rather than `NATIVE_SECP` until a native implementation is verified.

## 9. Capability Status Semantics
Capabilities strictly report their state via `CapabilityRegistry`:
- `IMPLEMENTED`: Native SECP robust implementation.
- `PARTIAL`: Limited or specialized coverage.
- `BACKEND_DELEGATED`: Bridged to external kernel (e.g., OCCT).
- `UNIMPLEMENTED`: Interface declared but no behavior established.
- `UNPROVEN`: Implementation exists but lacks gate verification.

## 10. Identity & Evidence Integration
Canonical Engineering Identity integrates deeply. All topologies and documents hold stable `id` representations (e.g., `SECP:TOPOLOGY:V1`). The Canonical Serializer safely digests topological constructs, stripping transient variables while maintaining deterministic hashes for Evidence.

## 11. Numerical Policy
A global `NumericalPolicy` eliminates scattered arbitrary constants. Standard tolerances are defined precisely (e.g., Absolute: 1e-7m, Relative: 1e-5), establishing the numerical bedrock for intersection and comparison logic.

## 12. Current Limitations
- GCS (Geometric Constraint Solver) is not yet implemented.
- B-Rep robust manifold verification is deferred to PATCH-016.
- Complex surface meshing (NURBS tessellation) is currently delegated or unimplemented natively.
- Parametric regeneration graph traversal remains static.

