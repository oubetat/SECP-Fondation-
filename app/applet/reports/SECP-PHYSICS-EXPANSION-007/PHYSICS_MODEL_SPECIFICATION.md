# SECP-PHYSICS-EXPANSION-007: Physics Model Specification

## 1. Governing Equations: Progressive Damage & Fatigue

The material point evolution combines J2 von Mises elastoplasticity with isotropic scalar damage $D$.

### 1.1 Stress-Strain Coupling (Softening)
The effective Cauchy stress $\boldsymbol{\sigma}$ is related to the effective stiffness $\mathbf{C}_{eff}$:
$$\boldsymbol{\sigma} = (1 - D) \mathbf{C} : (\boldsymbol{\varepsilon} - \boldsymbol{\varepsilon}_p)$$
Where:
- $D \in [0, 1]$ is the damage variable.
- $\mathbf{C}$ is the undamaged elastic stiffness tensor.
- $\boldsymbol{\varepsilon}_p$ is the plastic strain tensor.

### 1.2 Damage Evolution (Fatigue Driven)
Damage increases based on the applied fatigue cycles per FEM increment:
$$\Delta D = \frac{\Delta n}{N_f(\sigma_a)}$$
Where:
- $\Delta n$ is the number of cycles represented by the current time step.
- $N_f$ is the cycles to failure at the current stress amplitude $\sigma_a$.

### 1.3 Cycles to Failure (Basquin's Law)
For Stress-Life (S-N) regimes:
$$\sigma_a = \sigma'_f (2 N_f)^b$$
Rearranged for $N_f$:
$$N_f = \frac{1}{2} \left( \frac{\sigma_a}{\sigma'_f} \right)^{1/b}$$

## 2. Numerical Integration

The model uses a standard **Radial Return** algorithm for the plasticity update, followed by an explicit forward Euler update for the damage variable $D$.

1. **Undamaged Trial Stress**: $\boldsymbol{\sigma}_{trial} = (1 - D_n) \mathbf{C} : (\boldsymbol{\varepsilon}_{n+1} - \boldsymbol{\varepsilon}_{p,n})$
2. **Radial Return**: Perform von Mises yield check and return mapping.
3. **Damage Update**:
   - Compute von Mises equivalent stress $\bar{\sigma}$.
   - Calculate $N_f(\bar{\sigma})$.
   - $D_{n+1} = D_n + \frac{\Delta n}{N_f}$.
4. **Admissibility**: $D_{n+1}$ is capped at a failure threshold $D_{crit} = 0.99$.

## 3. Remaining Useful Life (RUL)

Remaining useful cycles $N_{rem}$ is estimated assuming the current stress amplitude persists:
$$N_{rem} = N_f(\sigma_{current}) \times (1 - D_{current})$$

## 4. Limitations
- **Linear Damage**: Assumes Palmgren-Miner linear accumulation (load sequence independent).
- **Isotropic Damage**: Damage is a scalar and affects all stiffness components equally.
- **Small Strain**: Primarily intended for small deformation unless used with the Large Deformation TET4 formulation.
