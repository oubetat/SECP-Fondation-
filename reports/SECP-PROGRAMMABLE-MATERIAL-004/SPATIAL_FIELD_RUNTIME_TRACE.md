# Spatial Field Runtime Trace: SECP-PROGRAMMABLE-MATERIAL-004

## 1. Trace Overview
This trace documents the execution path during assembly of a spatially graded FEM element:

1. **Solver Initiation:** `FEMCore.solve()` receives `FEMModel` containing `spatialMaterialFields` and `FEMElement` with `spatialFieldId`.
2. **Assembly Invocation:** `GlobalAssemblyEngine.assembleSparse()` iterates over elements.
3. **Formulation Dispatch:** `Bar1DFormulation.computeMatrices()` is invoked.
4. **Coordinate Evaluation:** Element calculates midpoint $(x_{mid}, y_{mid}, z_{mid}) = ((x_1+x_2)/2, 0, 0)$.
5. **Field Query:** Formulation queries `model.spatialMaterialFields.get(element.spatialFieldId).evaluate({x: midX, y: midY, z: midZ})`.
6. **Property Resolution:** `SpatialMaterialField` evaluates the analytic expression $E_0(1+\alpha x)$, checks property bounds, and returns evaluated properties.
7. **Stiffness Computation:** Local stiffness $k = (E_{local} \cdot A) / L$ is formed and assembled into the global sparse stiffness matrix.
8. **Solution:** Direct elimination and sparse PCG solve for nodal displacements.
