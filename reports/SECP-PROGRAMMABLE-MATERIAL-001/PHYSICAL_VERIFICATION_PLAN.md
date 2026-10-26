# Physical Verification Plan: SECP-PROGRAMMABLE-MATERIAL-001

## 1. Objective
Establish the metrology and physical testing strategy to qualify the **Functionally Graded Lattice (FGL)** manufacturing process. This plan ensures that the "programmed" material properties in the digital model are accurately reflected in the manufactured specimen.

## 2. Specimen Campaign
| Specimen ID | Description | Primary Goal |
|---|---|---|
| **PM-REF-001** | Homogeneous Lattice Baseline | Verify base lattice modulus and strength. |
| **PM-GRAD-001** | Linear Density Gradient Beam | Verify spatial controllability of lattice density. |
| **PM-GRAD-002** | Multi-Axial Gradient Block | Verify multi-dimensional grading stability. |

## 3. Metrology Strategy
### 3.1 Geometric Verification (As-Built)
- **Method:** X-ray Computed Tomography (XCT).
- **Metric:** Strut thickness distribution vs. spatial coordinates $(x, y, z)$.
- **Tolerance:** $\pm 50 \mu m$ or $10\%$ of nominal strut diameter.
- **Uncertainty:** XCT voxel resolution must be $\le 20 \mu m$.

### 3.2 Material Property Verification (Constitutive)
- **Method:** Digital Image Correlation (DIC) + Uniaxial Compression.
- **Metric:** Local strain field mapping vs. global load.
- **Verification:** Compare local stiffness $E(x, y, z)$ derived from DIC to the "programmed" gradient function.

## 4. Acceptance Criteria
1. **Geometric Fidelity:** Mean deviation between target and measured strut thickness $< 15\%$.
2. **Gradient Linearity:** Correlation coefficient $R^2 > 0.90$ for density vs. coordinate.
3. **Mechanical Correlation:** Measured global stiffness within $10\%$ of the homogenized FEM prediction.

## 5. Failure Handling
- **Out-of-Tolerance Geometry:** Invalidate simulation results; trigger "Manufacturing Variability" risk.
- **DIC/Model Mismatch:** Re-calibrate RVE homogenization models; investigate material feedstock variability.

## 6. Evidence Capture
All raw XCT slices, DIC displacement fields, and stress-strain curves must be hashed and bound to the `SpecimenID` in the SECP Evidence Pipeline.
