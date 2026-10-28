# Analytical Reference Derivation: SECP-PROGRAMMABLE-MATERIAL-004

## 1. Problem Definition
- **Element Type:** 1D Axial Bar
- **Length ($L$):** $100\text{ mm}$
- **Cross-Sectional Area ($A$):** $1.0\text{ mm}^2$
- **Applied Axial Load ($F$):** $1,000\text{ N}$ at tip ($x = L$)
- **Boundary Condition:** Fixed at $x = 0$ ($u(0) = 0$)
- **Modulus Distribution:** $E(x) = E_0 (1 + \alpha x)$ where $E_0 = 100,000\text{ MPa}$ and $\alpha = 0.01\text{ mm}^{-1}$.

## 2. Derivation
Governing differential equation for axial deformation:
$$\frac{d}{dx} \left( A E(x) \frac{du}{dx} \right) = 0$$

Integration yields constant axial force $P(x) = F$:
$$A E(x) \frac{du}{dx} = F \implies \frac{du}{dx} = \frac{F}{A E_0 (1 + \alpha x)}$$

Integrating from $x = 0$ to $x = L$:
$$u(L) - u(0) = \int_0^L \frac{F}{A E_0 (1 + \alpha x)} dx = \frac{F}{A E_0 \alpha} \ln(1 + \alpha L)$$

## 3. Numerical Calculation
- $F = 1,000\text{ N}$
- $A = 1.0\text{ mm}^2$
- $E_0 = 100,000\text{ MPa}$
- $\alpha = 0.01\text{ mm}^{-1}$
- $L = 100\text{ mm}$

$$\Delta L = \frac{1000}{1 \cdot 100000 \cdot 0.01} \ln(1 + 0.01 \cdot 100) = \frac{1000}{1000} \ln(2) = \ln(2) \approx 0.693147\text{ mm}$$
