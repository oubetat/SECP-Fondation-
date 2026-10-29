# SECP-PHYSICS-EXPANSION-004B: ANALYTICAL FORMULATION

## 1. Governing Partial Differential Equation

For a 3D bar of dimensions $L \times W \times H$ under steady-state thermal conduction with uniform volumetric heat generation $q_0$ [W/m$^3$] and constant thermal conductivity $k$ [W/(m*K)]:

$$-k \nabla^2 T(x, y, z) = q_0 \quad \text{in } \Omega = [0, L] \times [0, W] \times [0, H]$$

### Boundary Conditions:
1. Prescribed temperature at $x=0$: $T(0, y, z) = T_0 = 20^\circ\text{C}$ (Essential Dirichlet BC)
2. Adiabatic face at $x=L$: $-k \frac{\partial T}{\partial x}(L, y, z) = 0$ (Natural Neumann BC)
3. Adiabatic lateral faces ($y=0, y=W, z=0, z=H$): $\mathbf{q} \cdot \mathbf{n} = 0$

---

## 2. Closed-Form Analytical Solution

Integrating the 1D ODE $-k T''(x) = q_0$:

1. **Temperature Field:**
   $$T(x) = T_0 + \frac{q_0}{k} \left( L x - \frac{x^2}{2} \right)$$

2. **Temperature Gradient:**
   $$\frac{dT}{dx}(x) = \frac{q_0}{k} (L - x)$$

3. **Conductive Heat Flux Vector:**
   $$\mathbf{q}(x) = -k \nabla T = \left( -q_0 (L - x), \, 0, \, 0 \right) \quad [\text{W/m}^2]$$

4. **Outward Dirichlet Heat Flux Rate at $x=0$ ($mathbf{n} = (-1, 0, 0)$):**
   $$q_n(0) = \mathbf{q}(0) \cdot \mathbf{n} = (-q_0 L, 0, 0) \cdot (-1, 0, 0) = +q_0 L \quad [\text{W/m}^2]$$
   $$\Phi_{\text{ana}}(0) = q_n(0) \times (W H) = q_0 L W H = q_0 V \quad [\text{W}]$$

5. **Variational Nodal Reaction at $x=0$ Heat Sink:**
   $$R_{\text{ana}}(0) = -q_0 V \quad [\text{W}]$$
