# Known Limitations — Phase V8

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V8-001  
**Phase**: V8 — Spatial Material Deviation Analysis & Engineering Conformance Verification  

---

## 1. Scope & Domain Boundaries

1. **Synthetic Data Verification Level**: In accordance with rule `V8-ARCH-05`, numerical qualification of the deviation engine was conducted using verified synthetic datasets. Hardware-level physical sensor streaming is out of scope for unit tests.
2. **Scalar & Isotropic Property Focus**: Primary deviation analysis is implemented for scalar spatial properties (Young's modulus $E$, Density $\rho$, Porosity $\phi$). Full 21-component 3D anisotropic elasticity tensor residual field subtraction ($D_{ijkl}(\mathbf{x}) = C_{ijkl}^{act}(\mathbf{x}) - C_{ijkl}^{int}(\mathbf{x})$) is deferred to future tensor modules.
3. **Point-wise & Voxel-based Correspondence**: Spatial deviation analysis is computed at common evaluation point coordinates $\mathbf{x} = (x, y, z)$. Element-by-element integration over non-conforming finite element meshes is deferred to V10.
