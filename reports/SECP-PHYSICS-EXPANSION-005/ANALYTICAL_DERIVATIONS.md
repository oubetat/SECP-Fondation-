# SECP-PHYSICS-EXPANSION-005: Analytical Derivations & Closed-Form Oracles

## 1. Governing Thermo-Mechanical Equations

The continuum thermo-mechanical model operates under small deformation kinematics:
$$\boldsymbol{\varepsilon} = \frac{1}{2} \left( \nabla \mathbf{u} + (\nabla \mathbf{u})^T \right)$$

Thermal strain is purely volumetric for isotropic materials:
$$\boldsymbol{\varepsilon}_{th} = \alpha (T - T_{\text{ref}}) \mathbf{I}$$

Hooke's Law for elastic stress with thermal pre-strain:
$$\boldsymbol{\sigma} = \mathbf{C} : (\boldsymbol{\varepsilon} - \boldsymbol{\varepsilon}_{th})$$

For isotropic materials:
$$\boldsymbol{\sigma} = 2\mu \boldsymbol{\varepsilon} + \lambda \text{tr}(\boldsymbol{\varepsilon}) \mathbf{I} - (3\lambda + 2\mu) \alpha (T - T_{\text{ref}}) \mathbf{I}$$

Where Bulk Modulus $K = \lambda + \frac{2}{3}\mu = \frac{E}{3(1-2\nu)}$. Thus:
$$\boldsymbol{\sigma}_{th} = - 3 K \alpha (T - T_{\text{ref}}) \mathbf{I} = - \frac{E \alpha (T - T_{\text{ref}})}{1 - 2\nu} \mathbf{I}$$

---

## 2. Derivation of 6 Analytical Oracles

### BM-1: Free Unconstrained Uniform Thermal Expansion
- **Domain**: Bar of length $L_x = 0.1\text{ m}$, free ends.
- **Thermal Load**: Uniform $\Delta T = 100\text{ K}$.
- **Analytical Solution**:
  $$u_x(L_x) = \alpha \Delta T L_x = (1.2 \times 10^{-5})(100)(0.1) = 1.200000 \times 10^{-4}\text{ m}$$
  $$\boldsymbol{\sigma} = 0\text{ Pa}$$

### BM-2: Fully Restrained Uniform Thermal Expansion
- **Domain**: Fixed box $u_x = u_y = u_z = 0$ on all boundaries, $A = 0.01\text{ m}^2$.
- **Thermal Load**: $\Delta T = 100\text{ K}$, $E = 200\text{ GPa}$, $\nu = 0.3$.
- **Analytical Solution**:
  $$\sigma_{\text{hydrostatic}} = - \frac{E \alpha \Delta T}{1 - 2\nu} = - \frac{(200 \times 10^9)(1.2 \times 10^{-5})(100)}{1 - 0.6} = -6.000000 \times 10^8\text{ Pa} = -600\text{ MPa}$$
  $$F_{\text{reaction}} = |\sigma_{\text{hydrostatic}}| \cdot A = (6.00 \times 10^8)(0.01) = 6.000000 \times 10^6\text{ N} = 6.00\text{ MN}$$

### BM-3: 1D Thermoelastic Bar with Linear Temperature Gradient
- **Domain**: Fixed at $x=0$, free at $x=L$.
- **Temperature Field**: $T(x) = T_0 + \Delta T \frac{x}{L}$.
- **Analytical Solution**:
  $$u(L) = \int_0^L \alpha (T(x) - T_0) dx = \alpha \Delta T \int_0^L \frac{x}{L} dx = \frac{1}{2} \alpha \Delta T L = 6.000000 \times 10^{-5}\text{ m}$$

### BM-4: Spatially Varying Temperature Field with Material Gradients
- **Temperature & Modulus**: $T(x) = T_{\text{ref}} + \Delta T \frac{x}{L}$, $E(T) = E_0 \left(1 - \beta \Delta T \frac{x}{L}\right)$.
- **Analytical Thermal Force Vector**:
  $$F_{th} = \int_0^L A E(x) \alpha \Delta T \frac{x}{L} dx = A E_0 \alpha \Delta T L \left( \frac{1}{2} - \frac{\beta \Delta T}{3} \right) = 1.160000 \times 10^5\text{ N}$$

### BM-5: 3D Continuum Tetrahedral Thermal Load Vector Integration
- **Tet Element**: Volume $V_e = 1.0 \times 10^{-6}\text{ m}^3$.
- **Analytical Nodal Thermal Load**:
  $$f_{th}^e = V_e (3 K \alpha \Delta T) = (1.0 \times 10^{-6})(6.0 \times 10^8) = 600.000000\text{ N}$$

### BM-6: Parameter Sensitivity Oracles
- **Sensitivity Derivatives**:
  $$\frac{\partial \sigma}{\partial E} = - \frac{\alpha \Delta T}{1 - 2\nu} = -3.000000 \times 10^{-3}$$
  $$\frac{\partial \sigma}{\partial \alpha} = - \frac{E \Delta T}{1 - 2\nu} = -5.000000 \times 10^{13}\text{ Pa}\cdot\text{K}$$
