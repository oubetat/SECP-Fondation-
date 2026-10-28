# SECP Physics Engines: Production Execution Paths
**Audit ID:** SECP-PHYSICS-ENGINE-FORENSIC-001  
**Focus:** Complete trace from UI / API request to numerical computation and evidence recording.

## Path 1: Structural FEM Analysis
```
User Action (Run FEA)
  │
  ▼
FemVerificationWorkspace.tsx (src/components/fem/)
  │
  ▼
HardAcceptanceGate240.runVerificationSuite()
  │
  ▼
FemVerificationPipeline.execute(solid, elementSize, material)
  │
  ▼
CadToFemModelBuilder.build(solid, elementSize) ──> Meshing & Node Mapping
  │
  ▼
BoundaryConditionEngine.executeBCPipeline() ──> [K]{u} = {F}
  │
  ▼
SparsePCGSolver.solve() ──> Displacements {u}
  │
  ▼
FactorOfSafetyCalculator & ResultProvenanceTracker ──> SHA-256 Provenance Hash
```

## Path 2: Two-Way Fluid-Structure Interaction (FSI)
```
User Action (Run Coupled Simulation)
  │
  ▼
FsiWorkspace.tsx (src/components/cfd/)
  │
  ▼
TwoWayFSICouplingEngine.solveTwoWayFSI(fluidMesh, fluidPressure, E)
  │
  ▼
Interface Face Extraction (WALL boundaries)
  │
  ▼
Partitioned Gauss-Seidel Iteration Loop:
  ├── 1. Boundary Normal Forces: F_n = p * Area * normal
  ├── 2. Station-Based Spatial Mapping to 2D FEA Mesh
  ├── 3. StructuralAnalysisEngine.runFEA() (Elastic Displacement)
  ├── 4. FSIRelaxationManager (Aitken Dynamic Acceleration)
  └── 5. DynamicMeshManager (Laplacian Mesh Morphing & Inversion Check)
  │
  ▼
Convergence Check: ||delta_u|| < tol && ||delta_F|| < tol
  │
  ▼
FSICouplingResult Generated (Displacements, Forces, Relaxation History)
```

## Path 3: Electrothermal Multiphysics Co-Simulation
```
User Action (Simulate Board Electrothermal Response)
  │
  ▼
InteractiveEngineeringWorkbench.tsx (src/components/)
  │
  ▼
ElectrothermalSolver.solve(circuit, thermalBoard, contract)
  │
  ▼
Bi-directional Picard Fixed-Point Iteration:
  ├── 1. NodalCircuitSolver.solve(circuit(T)) ──> Voltages, Currents, Component Power P_i
  ├── 2. Power Dissipation Mapping to Spatial Heat Flux Q_eff(P_i)
  ├── 3. SpatialThermalSolver.solve(thermalBoard, Q_eff) ──> Temperature Field T(x,y)
  ├── 4. Temperature Feedback: R_i(T) = R_0 * [1 + alpha * (T_i - T_ref)]
  └── 5. Energy Conservation Audit: |sum P_elec - sum Q_thermal| / sum P_elec <= 0.1%
  │
  ▼
Output: Converged Thermal Map, Resistance Shifts, Margin Checks
```
