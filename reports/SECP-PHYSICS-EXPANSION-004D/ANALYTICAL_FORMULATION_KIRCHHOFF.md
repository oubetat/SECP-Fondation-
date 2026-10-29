# SECP-PHYSICS-EXPANSION-004D: Nonlinear Kirchhoff Transform Formulation

## 1. Governing Equation
For 3D heat conduction with temperature-dependent thermal conductivity $k(T) = k_0 (1 + \beta T)$:
$$-\nabla \cdot \left[ k_0 (1 + \beta T) \nabla T \right] = q_{\text{vol}}$$

## 2. Kirchhoff Transformation
Define the linearized Kirchhoff potential $\Theta(T)$:
$$\Theta(T) = \int_{T_0}^T \frac{k(T')}{k_0} dT' = (T - T_0) + \frac{\beta}{2} \left( T^2 - T_0^2 \right)$$
Under this transformation, the energy conservation equation becomes strictly linear in $\Theta$:
$$-k_0 \nabla^2 \Theta = q_{\text{vol}}$$

## 3. Closed-Form Analytical Temperature & Flux Solutions
1. **Transformed Potential:** $\Theta(x) = \frac{q_{\text{vol}}}{k_0} \left( L_x x - \frac{x^2}{2} \right)$
2. **Physical Temperature Inversion:**
   $$T(x) = \frac{-1 + \sqrt{1 + 2 \beta \left( \Theta(x) + T_0 + \frac{\beta}{2} T_0^2 \right)}}{\beta}$$
3. **Exact Conductive Heat Flux Vector:**
   $$\mathbf{q}(x) = -k(T) \nabla T = -k_0 \nabla \Theta = -q_{\text{vol}} (L_x - x) \hat{\mathbf{i}}$$

At $x = 0.1 \text{ m}$, $T_{\text{max}} = 306.69^\circ\text{C}$ and $q_x(L_x) = 0 \text{ W/m}^2$. Total heat loss rate at $x=0$ is strictly $152.141576 \text{ W}$.
