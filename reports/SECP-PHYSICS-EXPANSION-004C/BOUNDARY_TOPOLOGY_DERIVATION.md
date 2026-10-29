# SECP-PHYSICS-EXPANSION-004C: Boundary Mesh Topology Derivation

## 1. Geometric Derivation of Exterior Boundary Faces
For a 3D rectangular bar domain $[0, L_x] \times [0, L_y] \times [0, L_z]$ discretized into $N_x \times N_y \times N_z$ hexahedral blocks, where each hexahedron is partitioned into 6 linear tetrahedral elements (TET4):

1. **End Cap Faces ($x = 0$ and $x = L_x$):**
   - Grid resolution on end caps: $N_y \times N_z$ quadrilaterals.
   - Each quadrilateral face is split into 2 exterior triangles.
   - Exterior triangular faces on end caps = $2 \times 2 \times N_y N_z = 4 N_y N_z$.
   - For $N_x=2, N_y=1, N_z=1$: End cap faces = $4 \times 1 \times 1 = 4$ triangles.
   - End cap surface area = $2 \times (L_y L_z) = 2 \times (0.01 \times 0.01) = 0.0002 \text{ m}^2$.

2. **Longitudinal Side Faces ($y = 0, y = L_y, z = 0, z = L_z$):**
   - $y$-normal sides ($2$ faces): $N_x \times N_z$ quadrilaterals each $\times 2$ triangles = $4 N_x N_z$ triangles.
   - $z$-normal sides ($2$ faces): $N_x \times N_y$ quadrilaterals each $\times 2$ triangles = $4 N_x N_y$ triangles.
   - For $N_x=2, N_y=1, N_z=1$: $y$-sides = $4(2)(1) = 8$, $z$-sides = $4(2)(1) = 8$. Total side faces = $16$ triangles.
   - Longitudinal side area = $2(L_x L_z) + 2(L_x L_y) = 2(0.001) + 2(0.001) = 0.0040 \text{ m}^2$.

3. **Total Surface Topology Summary:**
   - **Total Exterior Triangular Faces:** $4 + 16 = 20$ faces.
   - **Total Exterior Surface Area:** $0.0002 + 0.0040 = 0.00420000 \text{ m}^2$.
   - **Exterior Face Normal Directions:** Aligned strictly with coordinate axes ($\pm \hat{\mathbf{i}}, \pm \hat{\mathbf{j}}, \pm \hat{\mathbf{k}}$).
   - **Interior Face Filtering:** All shared faces between neighboring tetrahedra appear exactly twice in the face registry and are excluded from exterior boundary surface integrations.
