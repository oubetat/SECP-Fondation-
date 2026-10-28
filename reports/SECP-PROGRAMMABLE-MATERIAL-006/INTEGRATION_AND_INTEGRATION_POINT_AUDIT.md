# Integration and Integration-Point Audit: SECP-PROGRAMMABLE-MATERIAL-006

## 1. Scope
Evaluate the integration point resolution mechanism for `TET43DFormulation`.

## 2. Findings
- **Constant Strain Formulation:** `TET43DFormulation` is a Constant Strain Tetrahedron (CST equivalent in 3D). Strain and stress are uniform throughout the element volume.
- **Centroid Evaluation:** The single integration point (centroid) is located at:
  $$x_c = \frac{x_1 + x_2 + x_3 + x_4}{4}, \quad y_c = \frac{y_1 + y_2 + y_3 + y_4}{4}, \quad z_c = \frac{z_1 + z_2 + z_3 + z_4}{4}$$
- **Exactness:** For constant strain elements with linear property variation, centroid evaluation provides an accurate representative material property for stiffness matrix formation.
- **Consistency:** Both stiffness matrix assembly (`computeMatrices`) and stress recovery (`computeStressStrain`) use the exact same centroid evaluation logic, preventing state divergence.
