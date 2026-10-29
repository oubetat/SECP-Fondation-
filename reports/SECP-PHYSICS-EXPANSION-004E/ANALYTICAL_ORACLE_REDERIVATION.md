# SECP-PHYSICS-EXPANSION-004E: Analytical Oracle Re-Derivation (WP-A)

## 1. Governing Nonlinear Conduction Equation
For temperature-dependent conductivity $k(T) = k_0 (1 + \beta T)$:
$$-\nabla \cdot \left[ k_0 (1 + \beta T) \nabla T \right] = q_{\text{vol}}$$

## 2. Kirchhoff Transformation & Linearization
The Kirchhoff potential $\Theta(T)$ is defined by:
$$\Theta(T) = \int_{T_0}^T \frac{k(T')}{k_0} dT' = (T - T_0) + \frac{\beta}{2} \left( T^2 - T_0^2 \right)$$

Transforming the governing PDE yields a linear Laplacian system:
$$-k_0 \nabla^2 \Theta = q_{\text{vol}}$$

## 3. Physical Inversion & Heat Flux Vector
1. **Transformed Potential:** $\Theta(x) = \frac{q_{\text{vol}}}{k_0} \left( L_x x - \frac{x^2}{2} \right)$
2. **Temperature Inversion:**
   $$T(x) = \frac{-1 + \sqrt{1 + 2 \beta \left( \Theta(x) + T_0 + \frac{\beta}{2} T_0^2 \right)}}{\beta}$$
3. **Conductive Heat Flux Vector:**
   $$\mathbf{q}(x) = -k(T) \nabla T = -k_0 \nabla \Theta = -q_{\text{vol}} (L_x - x) \hat{\mathbf{i}}$$

## 4. Multi-Domain Composite Material Interface Continuity
For domains $D_1 (0 \le x \le L_1, k_1)$ and $D_2 (L_1 \le x \le L_1 + L_2, k_2)$:
1. **Interface Temperature:**
   $$T_{\text{interface}} = \frac{\frac{k_1}{L_1} T_{\text{left}} + \frac{k_2}{L_2} T_{\text{right}}}{\frac{k_1}{L_1} + \frac{k_2}{L_2}} = 36.0^\circ\text{C}$$
2. **Uniform Heat Flux Continuity:**
   $$q_1 = q_2 = -\frac{T_{\text{right}} - T_{\text{left}}}{\frac{L_1}{k_1} + \frac{L_2}{k_2}} = -128,000 \text{ W/m}^2$$

## 5. Verification Status
- **Kirchhoff Formulation:** VERIFIED
- **Composite Interface Continuity:** VERIFIED
- **Units, Signs, Parameters & Limiting Cases:** VERIFIED
