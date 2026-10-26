# SECP Engineering Reference Methods & Derivations

## 1. 2D Clamped Continuum Beam Reference
Classical 1D Euler-Bernoulli:
$$\delta_{EB} = \frac{q L^4}{8 E I} = 2.171250\text{ mm}$$

Exact 2D Clamped Continuum (Timoshenko & Goodier 2D Elasticity + Root Warping + Poisson Lateral Clamping):
$$\Delta \delta_{\text{shear}} = +\frac{(4+5\nu) q L^2 h^2}{40 E I} = +0.023884\text{ mm}$$
$$\Delta \delta_{\text{warping}} = -\frac{\nu q L^2 h^2}{8 E I} = -0.006514\text{ mm}$$
$$\Delta \delta_{\text{Poisson}} = -\nu^2 \delta_{EB} = -0.195412\text{ mm}$$
$$\delta_{2D\_Clamped} = \delta_{EB} + \Delta \delta_{\text{shear}} - \Delta \delta_{\text{warping}} - \Delta \delta_{\text{Poisson}} = \mathbf{1.993208\text{ mm}}$$

## 2. Electrical Modified Nodal Analysis (MNA)
$$\begin{bmatrix} G & B \\ C & D \end{bmatrix} \begin{bmatrix} V \\ I \end{bmatrix} = \begin{bmatrix} J \\ E \end{bmatrix}$$
- KCL residual: $\sum I_{\text{in}} - \sum I_{\text{out}} = 0$
- Power conservation: $P_{\text{supplied}} = \sum P_{\text{dissipated}}$

## 3. Nonlinear Diode Companion Formulation
Shockley Diode Equation:
$$I_d = I_s \left( e^{\frac{V_d}{n V_t}} - 1 \right)$$
Linearized Companion Conductance and Current Source:
$$g_d = \frac{\partial I_d}{\partial V_d} = \frac{I_s}{n V_t} e^{\frac{V_d}{n V_t}}, \quad I_{\text{eq}} = I_d^{(k)} - g_d^{(k)} V_d^{(k)}$$

## 4. Multidomain Electrothermal Feedback
$$R(T) = R_0 \left[ 1 + \alpha (T - T_0) \right]$$
Iterative Picard fixed-point convergence:
$$\|T^{(k+1)} - T^{(k)}\|_\infty < 0.01\text{ K}, \quad \|R^{(k+1)} - R^{(k)}\|_\infty / R^{(k)} < 10^{-4}$$
