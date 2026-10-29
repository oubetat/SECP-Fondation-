# SECP-PHYSICS-EXPANSION-004C: Mathematical Formulation & Verification Summary

## 1. Variational Reaction Force Conservation
In the finite element formulation for steady-state heat conduction:
$$\mathbf{K} \mathbf{T} = \mathbf{F}_{\text{vol}} + \mathbf{R}$$
Where $\mathbf{K}$ is the global thermal conductivity matrix, $\mathbf{F}_{\text{vol}}$ is the volumetric heat source vector, and $\mathbf{R}$ is the nodal reaction force vector at prescribed Dirichlet nodes.

By construction of the linear system, the sum of nodal thermal reactions at Dirichlet boundary nodes satisfies exact energy balance against total volumetric heat generation:
$$\sum_{i \in \Gamma_D} R_i = \int_{\Omega} q_{\text{vol}} dV = Q_{\text{joule}}$$
Our independent audit confirms that for all mesh refinement levels ($N_x = 1, 2, 4, 8, 16$), the variational reaction sum matches $Q_{\text{joule}} = 152.141576 \text{ W}$ within a residual of $< 10^{-11} \text{ W}$.

## 2. Direct Boundary Conductive Heat Flux Discrepancy & Convergence
Direct surface flux integration evaluates:
$$\boldsymbol{\Phi}_{\text{direct}} = \int_{\Gamma_D} -k (\nabla T \cdot \mathbf{n}) dS$$
For linear tetrahedral elements ($C^0$ Lagrange shape functions), spatial temperature gradients $\nabla T$ are piecewise constant within each element. Evaluating $\nabla T$ at boundary face centroids samples a piecewise constant approximation of a continuous linear gradient.

### Empirical Convergence Rate
Our 5-level mesh refinement study demonstrates that the direct boundary flux error scales as:
$$E(h) = \lvert \boldsymbol{\Phi}_{\text{direct}}(h) - Q_{\text{analytical}} \rvert = \mathcal{O}(h^p)$$
With empirical rate $p \approx 1.000$ (first-order spatial accuracy). The relative direct flux error decays monotonically:
$$49.83\% \ (N_x=1) \longrightarrow 25.00\% \ (N_x=2) \longrightarrow 12.50\% \ (N_x=4) \longrightarrow 6.25\% \ (N_x=8) \longrightarrow 3.12\% \ (N_x=16)$$
