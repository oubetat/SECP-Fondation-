# SECP-ENGINE-UPGRADE-001: Declared Scope & Validity Limits

## 1. Certified Capabilities (PASS_WITHIN_DECLARED_SCOPE)
- **Structural Physics**: 2D Planar Thin-Beam Bending ($L/h \ge 10$) with QUAD_2D Isoparametric Selective Reduced Integration (SRI), linear isotropic elasticity, 2D plane-stress recovery.
- **CFD-FSI Coupling**: Two-way partitioned Gauss-Seidel coupling with Aitken dynamic under-relaxation, ALE distance-decay morphing, and Newtonian conservation auditing.
- **Electrical Solver**: Linear DC resistive networks and nonlinear diode circuits via Modified Nodal Analysis (MNA) and damped Newton-Raphson.
- **Thermal Engine**: 2D finite-volume multilayer PCB heat conduction with conjugate convective boundary conditions.
- **Multidomain Integration**: Closed-loop iterative Picard electrothermal co-simulation with temperature-dependent resistance.

## 2. Explicitly Out-of-Scope Capabilities (UNSUPPORTED)
- Out-of-plane 3D shell bending with transverse shear warping through arbitrary geometry.
- Large-displacement geometric non-linearities ($P-\Delta$, finite rotations, post-buckling snap-through).
- Hyperelastic (Mooney-Rivlin, Ogden) and plastic non-linear material models.
- Active three-terminal switching semiconductor devices (BJT, MOSFET, IGBT) without certified SPICE models.
- Full compressible transonic/supersonic aerodynamic shock wave FSI.
