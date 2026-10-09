# 3D Topology Picking Engine Report (PROMPT-008)

## 1. Viewport Picking Architecture
The 3D Topology Picking Engine establishes a strict pipeline ensuring that a user's click in the 3D viewport translates exclusively to a **Canonical B-Rep Entity** rather than just a visual artifact.
The required pipeline implemented is:
`User -> 3D Viewport -> Screen Coordinates -> Ray Generation -> Geometry Intersection -> B-Rep / Render Mapping -> Topology Entity -> Canonical Reference -> EngineeringDocument`

## 2. Ray Generation
Screen coordinates are successfully mapped to Normalized Device Coordinates (NDC).
Using `THREE.Raycaster.setFromCamera()`, we apply the Inverse Projection/View Transform to generate an accurate World-Space Ray.

## 3. Intersection Algorithm
Intersection checks occur against `THREE.Mesh`, `THREE.Line`, and `THREE.Points` structures embedded within the scene. Distance sorting ensures the nearest visible hit is prioritized.
Tolerances for lines and points are explicitly configured (0.2 and 0.5 respectively) to ensure deterministic edge and vertex selection without over-expanding limits arbitrarily.

## 4. Render-to-B-Rep Mapping
The engine categorically rejects mapping a mere triangle index to a B-Rep face.
Instead, it demands explicit `userData.persistentId` metadata injected by the tessellation process. This provides a guaranteed map from a tessellated triangle back to its parent Canonical Face, Edge, or Vertex. 

## 5. Face Resolution
When Selection Mode is `FACE`, only meshes with persistent ID mapping are evaluated. The persistent ID queries the Document's `TopologyMap` or Lineage record to retrieve a validated `TopologyReference`.

## 6. Edge Resolution
When Selection Mode is `EDGE`, the engine restricts hit testing to `THREE.Line` or `THREE.LineSegments`. The associated `persistentId` resolves the original canonical Boundary Edge, rather than a visual tessellated line segment.

## 7. Vertex Resolution
When Selection Mode is `VERTEX`, only `THREE.Points` are tested. The engine resolves the canonical Point coordinates tied to the B-Rep boundary vertices.

## 8. Canonical Reference Format
A resolved hit produces a strictly defined `CanonicalHit` containing:
- `documentId`: Tied to the specific document.
- `revision`: The revision during which the hit occurred.
- `bodyId`: The specific Solid/Body.
- `topologyType`: 'FACE' | 'EDGE' | 'VERTEX'
- `topologyId`: The persistent, traceable identifier.
- `canonicalReference`: The full Lineage metadata object.

## 9. Reference Resolution
References are resolved against the `EngineeringDocument.topologyMap` at runtime. A resolved hit is proven to exist within the active engineering lineage, mitigating the risk of operating on orphaned display objects.

## 10. Topological Naming / Lineage Integration
The picking engine leverages `PersistentTopologyNaming` principles. A `persistentId` generated via geometric signatures, source entities, and creation feature lineage guarantees that a resolved face is topologically stable across regenerations.

## 11. Selection Modes
Explicit `SelectionType` gating (`FACE`, `EDGE`, `VERTEX`, `BODY`, `PART`) guarantees that a user cannot accidentally resolve a Line segment when they are explicitly looking to pick a Face, preventing tool failure downstream.

## 12. Tolerance
Defined geometrically and visually. 
- Line threshold: `0.2`
- Points threshold: `0.5`
Tolerances are fixed and not dynamically expanded to fake selection success.

## 13. Multi-Body Behavior
`CanonicalHit` stores `bodyId` explicitly. Same topology ID patterns in different bodies will not collide due to `bodyId` scoping mapped during tessellation.

## 14. Assembly Behavior
The engine inherently supports instances by mapping intersection data (including potential parent part IDs stored in UserData) when traversing the assembly's scene graph nodes. 

## 15. Revision Handling
The returned `CanonicalHit` locks in the `revision`. Stale references are avoided because the engine requires the current `EngineeringDocument` for resolution. If the document revision advances, stored references can be audited.

## 16. Cache Strategy
Acceleration structures like BVH are restricted to the rendering layer. The actual identity resolution ignores caching in favor of deterministic mapping back to the Document Lineage.

## 17. Failure Behavior
If no object is hit, or if the hit object lacks a valid mapped `persistentId`, the engine correctly returns `null`. Visual-only items (grids, gizmos) are bypassed.

## 18. Fake Selection Audit
Audited the engine to verify:
- No `Math.random()` used for identity.
- No raw index `[0]` used for identity.
- No `CSS / DOM` based pseudo-selection.
- No acceptance of raw `triangleId` as Face.

## 19. Tests
A test suite `TopologyPickingEngine.test.ts` validates the engine against Face, Edge, Vertex, Miss, Wrong Entity mode, and multi-body behavior.

## 20. Evidence
The implemented `TopologyPickingEngine.ts` code serves as direct evidence of this architectural transition, ensuring PROMPT-008's criteria are fundamentally met.
