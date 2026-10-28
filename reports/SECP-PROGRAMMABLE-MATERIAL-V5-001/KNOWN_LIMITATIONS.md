# SECP-PROGRAMMABLE-MATERIAL-V5-001: Known Limitations

## Declared Capabilities & Non-Claims

### 1. Declared Supported Scope (V5)
- **Supported Formulations**: `Bar1DFormulation` (1D linear axial bar) and `TET43DFormulation` (4-node linear tetrahedral 3D solid continuum).
- **Supported Properties**: Young's Modulus $E(\mathbf{x})$ and Poisson Ratio $\nu(\mathbf{x})$ evaluated at element centroids.
- **Support Status**: Fully implemented, constitutive consistency verified, and numerically qualified against closed-form analytical solutions.

### 2. Explicit Non-Claims (Fail-Closed)
- **Plasticity & Material Nonlinearity**: `TET4PlasticFormulation` explicitly throws `[UNSUPPORTED_FORMULATION_SPATIAL_FIELD]` when assigned spatial fields.
- **Multiphysics (Thermal/Electrical)**: Non-supported physics fields (e.g. thermal conductivity or electrical conductivity) are non-claims for structural solvers and reject missing required elasticity properties.
- **High-Order Integrations**: Currently spatial property evaluation is centroid-based for 1D bar and linear 3D tetrahedron elements. High-order multi-gauss point spatial field quadrature will be introduced in subsequent roadmap phases.
