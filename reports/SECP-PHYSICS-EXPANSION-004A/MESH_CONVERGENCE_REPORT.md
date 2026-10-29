# SECP-PHYSICS-EXPANSION-004A: MESH-CONVERGENCE REPORT

**CAMPAIGN:** SECP-PHYSICS-EXPANSION-004A  
**OBJECTIVE:** Determine whether direct surface-flux discrepancy decreases under mesh refinement.  

---

## 1. Systematic Mesh Refinement Table

The same physical bar ($0.1\text{ m} \times 0.01\text{ m} \times 0.01\text{ m}$, $\sigma_0 = 10^4\text{ S/m}$, $k = 200\text{ W/(m*K)}$, $V(0)=5\text{V}$, $V(L)=0\text{V}$, $T(0)=20^\circ\text{C}$, lateral/end adiabatic) was solved across 6 systematic mesh levels:

| Level | Mesh Name | Elements | Nodes | Faces | $h_x$ (m) | $P_{\text{elec}}$ (W) | $Q_{\text{vol}}$ (W) | $Q_{\text{sink}}$ (W) | $\Phi_{\text{Dirichlet}}$ (W) | Discrepancy (W) | Rel. Discrepancy | Empirical Order $\alpha$ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | Level 1 (1x1x1) | 6 | 8 | 12 | 0.1000 | 152.0806 | 152.0806 | 152.0806 | 71.0790 | 81.0016 | **53.26%** | Baseline |
| **2** | Level 2 (2x1x1) | 12 | 12 | 24 | 0.0500 | 144.8190 | 144.8190 | 144.8189 | 99.7545 | 45.0645 | **31.12%** | **0.846** |
| **3** | Level 3 (4x1x1) | 24 | 20 | 48 | 0.0250 | 143.4034 | 143.4034 | 143.4032 | 118.2320 | 25.1714 | **17.55%** | **0.840** |
| **4** | Level 4 (8x1x1) | 48 | 36 | 96 | 0.0125 | 143.1031 | 143.1031 | 143.1029 | 129.5434 | 13.5597 | **9.48%** | **0.892** |
| **5** | Level 5 (16x1x1) | 96 | 68 | 192 | 0.00625 | 143.0298 | 143.0298 | 143.0296 | 135.9934 | 7.0364 | **4.92%** | **0.946** |
| **6** | Level 6 (20x1x1) | 120 | 84 | 240 | 0.00500 | 143.0255 | 143.0255 | 143.0253 | 137.3555 | 5.6700 | **3.96%** | **0.963** |

---

## 2. Key Findings & Convergence Analysis

1. **Variational Nodal Reaction Conservation ($Q_{\text{sink}}$):**
   - At every single mesh level, the variational reaction heat $Q_{\text{sink}}$ matches $Q_{\text{vol}}$ within **microwatts** (residual $< 2.5 \times 10^{-4}\text{ W}$, relative imbalance $< 2 \times 10^{-6}$).
   - This proves that variational energy balance is mathematically exact and invariant to mesh resolution.

2. **Direct Surface Normal Flux ($Phi_{\text{Dirichlet}}$):**
   - At Level 1 ($h = 0.1\text{ m}$), the discrepancy is $81.00\text{ W}$ (53.26%).
   - At Level 6 ($h = 0.005\text{ m}$), the discrepancy drops to $5.67\text{ W}$ (3.96%).
   - The reduction is **strictly monotonic** across all refinement levels without oscillation.

3. **Asymptotic Convergence Order:**
   - The empirical convergence order $\alpha = \frac{\log(E_1 / E_2)}{\log(h_1 / h_2)}$ approaches **$\alpha \approx 0.96$** (asymptotically $\mathcal{O}(h^1)$).
   - This matches classical finite-element approximation theory: linear ($C^0$) elements approximate derivatives with first-order accuracy in $h$.

4. **Conclusion:**
   - The discrepancy reported in Expansion 004 is **conclusively proven to be a legitimate finite-element discretization effect** of linear tetrahedra, and NOT a defect in boundary orientation, normal calculation, or formulation.
