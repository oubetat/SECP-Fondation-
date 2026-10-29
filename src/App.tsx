import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Cpu,
  Layers,
  Settings,
  Compass,
  Activity,
  Box,
  Sliders,
  Database,
  Terminal,
  FileCheck2,
  Sparkles,
  Award,
  CircleDot,
  Wrench,
  RotateCw,
  Gauge,
  Search,
  Grid,
  Zap,
  FolderOpen,
  FolderPlus,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Wind,
  Radio,
  Lock,
  GitBranch,
  FileCode,
  HardDrive,
  User as UserIcon,
  LogOut,
  LogIn,
  Cloud,
  Check,
  ArrowLeft,
  Menu,
  X,
  ChevronUp,
  Folder,
  UserPlus
} from 'lucide-react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import { useProject } from './contexts/ProjectContext';

// 1. Core & Start Center
import { StartCenter } from './components/StartCenter';
import { ProjectWorkspacePanel } from './components/ProjectWorkspacePanel';
import { NewProjectWorkspace } from './components/NewProjectWorkspace';
import { IndustrialOsV3Panel } from './components/IndustrialOsV3Panel';

// 2. Collision Authority & Multi-Axis Twin
import { CollisionAuthorityMultiAxisWorkbench } from './components/cam/CollisionAuthorityMultiAxisWorkbench';

// 3. CAD & Parametric Modeling
import { CadViewport3D } from './components/CadViewport3D';
import { Professional3DViewportPanel } from './components/Professional3DViewportPanel';
import { ParametricModelingPanel } from './components/ParametricModelingPanel';
import { CadKernelInspector } from './components/CadKernelInspector';
import { DirectModelingInspector } from './components/DirectModelingInspector';
import { SketchEditorPanel } from './components/SketchEditorPanel';
import { SketcherPanel } from './components/SketcherPanel';
import { FeatureTreePanel } from './components/FeatureTreePanel';
import { HybridModelingInspector } from './components/HybridModelingInspector';
import { PatternEngineInspector } from './components/PatternEngineInspector';
import { GeometryKernelPanel } from './components/GeometryKernelPanel';
import { NaturalLanguageCADWorkbenchPanel } from './components/NaturalLanguageCADWorkbenchPanel';
import { WaterFaucetWizard } from './components/WaterFaucetWizard';
import { TechnicalDrawingPanel } from './components/TechnicalDrawingPanel';

// 4. Assembly & Kinematics
import { AssemblyWorkspace } from './components/AssemblyWorkspace';
import { AssemblyEnginePanel } from './components/AssemblyEnginePanel';
import { MassiveAssemblyPanel } from './components/MassiveAssemblyPanel';
import { KinematicsPanel } from './components/KinematicsPanel';
import { AdvancedKinematicsPanel } from './components/AdvancedKinematicsPanel';
import { KinematicSolverWorkspace } from './components/assembly/KinematicSolverWorkspace';
import { MechanismSimulationWorkspace } from './components/assembly/MechanismSimulationWorkspace';
import { MechanicalJointsWorkspace } from './components/assembly/MechanicalJointsWorkspace';
import { MotionLinksWorkspace } from './components/assembly/MotionLinksWorkspace';

// 5. Standard Machine Elements
import { GearEngineeringWorkspace } from './components/GearEngineeringWorkspace';
import { SpringEngineeringWorkspace } from './components/SpringEngineeringWorkspace';
import { BearingEngineeringWorkspace } from './components/BearingEngineeringWorkspace';
import { ShaftEngineeringWorkspace } from './components/ShaftEngineeringWorkspace';
import { FastenerEngineeringWorkspace } from './components/FastenerEngineeringWorkspace';

// 6. CAM & Manufacturing
import { ToolpathSimulationPanel } from './components/ToolpathSimulationPanel';
import { FiveAxisSimulationPanel } from './components/FiveAxisSimulationPanel';
import { FiveAxisKinematicsWorkspace } from './components/cam/FiveAxisKinematicsWorkspace';
import { FourAxisCamWorkspace } from './components/cam/FourAxisCamWorkspace';
import { ThreeAxisCamWorkspace } from './components/cam/ThreeAxisCamWorkspace';
import { ToolLibraryWorkspace } from './components/cam/ToolLibraryWorkspace';
import { StockSimulationWorkspace } from './components/cam/StockSimulationWorkspace';
import { ManufacturingFeatureWorkspace } from './components/cam/ManufacturingFeatureWorkspace';
import { GCodeVerificationPanel } from './components/GCodeVerificationPanel';
import { CamPanel } from './components/CamPanel';

// 7. CAE & Structural FEM
import { SimulationCaePanel } from './components/SimulationCaePanel';
import { GPUFEMWorkbenchPanel } from './components/GPUFEMWorkbenchPanel';
import { GPUMeshingWorkbenchPanel } from './components/GPUMeshingWorkbenchPanel';
import { GPULinearAlgebraWorkbenchPanel } from './components/GPULinearAlgebraWorkbenchPanel';
import { GlobalStiffnessAssemblyWorkspace } from './components/assembly/GlobalStiffnessAssemblyWorkspace';
import { SparseMatrixWorkspace } from './components/assembly/SparseMatrixWorkspace';
import { LinearSolverWorkspace } from './components/assembly/LinearSolverWorkspace';
import { NonlinearSolverWorkspace } from './components/assembly/NonlinearSolverWorkspace';
import { FEMElementsWorkspace } from './components/assembly/FEMElementsWorkspace';
import { FEMMeshWorkspace } from './components/assembly/FEMMeshWorkspace';
import { MaterialConstitutiveWorkspace } from './components/assembly/MaterialConstitutiveWorkspace';
import { MaterialsPanel } from './components/MaterialsPanel';
import { CloudSimulationPanel } from './components/CloudSimulationPanel';

// 8. CFD & Thermal Fluid Power
import { CaeCfdPanel } from './components/CaeCfdPanel';
import { GPUCFDWorkbenchPanel } from './components/GPUCFDWorkbenchPanel';
import { FluidPowerPanel } from './components/FluidPowerPanel';
import { NavierStokesWorkspace } from './components/cfd/NavierStokesWorkspace';
import { TurbulenceWorkspace } from './components/cfd/TurbulenceWorkspace';
import { PressureVelocityWorkspace } from './components/cfd/PressureVelocityWorkspace';
import { ResidualEngineWorkspace } from './components/cfd/ResidualEngineWorkspace';
import { FvmDiscretizationWorkspace } from './components/cfd/FvmDiscretizationWorkspace';
import { HeatTransferWorkspace } from './components/cfd/HeatTransferWorkspace';
import { CompressibleWorkspace } from './components/cfd/CompressibleWorkspace';
import { MultiphaseWorkspace } from './components/cfd/MultiphaseWorkspace';
import { FsiWorkspace } from './components/cfd/FsiWorkspace';

// 9. Reverse Engineering & Metrology
import { PointCloudImportWorkbenchPanel } from './components/PointCloudImportWorkbenchPanel';
import { ScanToMeshWorkbenchPanel } from './components/ScanToMeshWorkbenchPanel';
import { SurfaceReconstructionWorkbenchPanel } from './components/SurfaceReconstructionWorkbenchPanel';
import { NURBSReconstructionWorkbenchPanel } from './components/NURBSReconstructionWorkbenchPanel';
import { MeshHealingWorkbenchPanel } from './components/MeshHealingWorkbenchPanel';
import { NoiseFilteringWorkbenchPanel } from './components/NoiseFilteringWorkbenchPanel';
import { RegistrationAlignmentWorkbenchPanel } from './components/RegistrationAlignmentWorkbenchPanel';
import { PMIPanel } from './components/PMIPanel';

// 10. AI Engineering & Generative Design
import { AIDesignAssistantWorkbenchPanel } from './components/AIDesignAssistantWorkbenchPanel';
import { AIDesignReviewWorkbenchPanel } from './components/AIDesignReviewWorkbenchPanel';
import { AIFailureDetectionWorkbenchPanel } from './components/AIFailureDetectionWorkbenchPanel';
import { AISimulationSetupWorkbenchPanel } from './components/AISimulationSetupWorkbenchPanel';
import { AIOptimizationWorkbenchPanel } from './components/AIOptimizationWorkbenchPanel';
import { EngineeringCopilotWorkbenchPanel } from './components/EngineeringCopilotWorkbenchPanel';
import { GenerativeDesignPanel } from './components/GenerativeDesignPanel';
import { GenerativeEngineeringWorkbenchPanel } from './components/GenerativeEngineeringWorkbenchPanel';

// 11. Enterprise PLM, BOM & Provenance
import { EnterprisePLMPanel } from './components/EnterprisePLMPanel';
import { BomPanel } from './components/BomPanel';
import { EcoManagementPanel } from './components/EcoManagementPanel';
import { RevisionManagementPanel } from './components/RevisionManagementPanel';
import { ChangeManagementPanel } from './components/ChangeManagementPanel';
import { ApprovalWorkflowPanel } from './components/ApprovalWorkflowPanel';
import { DigitalThreadPanel } from './components/DigitalThreadPanel';
import { DigitalTwinPanel } from './components/DigitalTwinPanel';
import { MachineTwinPanel } from './components/MachineTwinPanel';
import { ProcessTwinPanel } from './components/ProcessTwinPanel';
import { ProvenanceLedger } from './components/ProvenanceLedger';
import { ProvenancePanel } from './components/ProvenancePanel';

// 12. Industrial Drone Mission & Assemblies
import { DroneProjectHome } from './components/drone/DroneProjectHome';
import { DroneAeroCfdPanel } from './components/drone/DroneAeroCfdPanel';
import { DroneCAMWorkbench } from './components/drone/DroneCAMWorkbench';
import { DroneElectricalPanel } from './components/drone/DroneElectricalPanel';
import { DronePcbPanel } from './components/drone/DronePcbPanel';
import { DroneFastenersPanel } from './components/drone/DroneFastenersPanel';
import { DroneEvidenceWorkbench } from './components/drone/DroneEvidenceWorkbench';
import { DroneBomPanel } from './components/drone/DroneBomPanel';
import { DroneInspector } from './components/drone/DroneInspector';
import { IndustrialDroneAssemblyTreePanel } from './components/IndustrialDroneAssemblyTreePanel';

// 13. Electronics & Multiphysics
import { PcbWorkbenchPanel } from './components/PcbWorkbenchPanel';
import { ElectricalWorkbenchPanel } from './components/ElectricalWorkbenchPanel';
import { SensorIntegrationPanel } from './components/SensorIntegrationPanel';
import { InteractiveEngineeringWorkbench } from './components/InteractiveEngineeringWorkbench';

// 14. Hardware Acceleration & Compute
import { WebGPUWorkbenchPanel } from './components/WebGPUWorkbenchPanel';
import { DistributedComputeWorkbenchPanel } from './components/DistributedComputeWorkbenchPanel';
import { HPCSchedulerWorkbenchPanel } from './components/HPCSchedulerWorkbenchPanel';
import { WasmComputeWorkbenchPanel } from './components/WasmComputeWorkbenchPanel';
import { HardwareAccelerationWorkbenchPanel } from './components/HardwareAccelerationWorkbenchPanel';
import { WorkerParallelismWorkbenchPanel } from './components/WorkerParallelismWorkbenchPanel';

// 15. Certification, Forensic Dashboards & Hard Gates
import { AcceptanceMatrix } from './components/AcceptanceMatrix';
import { ProductionCertificationDashboard } from './components/ProductionCertificationDashboard';
import { FullIndustrialOSAuditDashboard } from './components/FullIndustrialOSAuditDashboard';
import { FinalEngineeringClosureForensicDashboard } from './components/FinalEngineeringClosureForensicDashboard';
import { DeterministicReproductionDashboard } from './components/DeterministicReproductionDashboard';
import { ProductionSecurityAuditDashboard } from './components/ProductionSecurityAuditDashboard';
import { ProductionProofDashboard } from './components/ProductionProofDashboard';
import { CADBenchmarkPanel } from './components/benchmark/CADBenchmarkPanel';
import { True5AxisCAMPanel } from './components/benchmark/True5AxisCAMPanel';
import { MassiveAssemblyBenchmarkPanel } from './components/benchmark/MassiveAssemblyBenchmarkPanel';
import { CFDBenchmarkPanel } from './components/benchmark/CFDBenchmarkPanel';
import { NonlinearFEMBenchmarkPanel } from './components/benchmark/NonlinearFEMBenchmarkPanel';
import { BooleanAdversarialPanel } from './components/benchmark/BooleanAdversarialPanel';
import { TurbulenceBenchmarkPanel } from './components/benchmark/TurbulenceBenchmarkPanel';
import { VerificationPortal } from './components/verification/VerificationPortal';
import { MonorepoExplorer } from './components/MonorepoExplorer';
import { SketchConvergenceMatrix } from './components/SketchConvergenceMatrix';
import { PMEStudio } from './components/pme/PMEStudio';
import { AdvancedPhysicsDashboard007 } from './components/physics/AdvancedPhysicsDashboard007';

interface ProjectModel {
  id: string;
  name: string;
  projectNumber: string;
  units: string;
  type: string;
  description: string;
  isDemo?: boolean;
}

interface StudioDefinition {
  id: string;
  name: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  workbenches: {
    id: string;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    badge?: string;
    component: React.ReactNode;
  }[];
}

export default function App() {
  const { user, customUser, signInWithGoogle, signInWithEmail, signUpWithEmail, loginAsAnyEmail, signOut } = useAuth();
  const { 
    activeProject, 
    loadDemoProject, 
    createNewProject, 
    openSavedProject, 
    closeProject,
    activeSolid,
    assemblyComponents,
    canonicalDocument,
    importProjectFile,
    updateActiveSolid,
    updateAssembly,
    updateCanonicalDocument,
    droneCamResult
  } = useProject();

  // Studio and Workbench selection state (Hoisted before studios useMemo)
  const [activeStudioId, setActiveStudioId] = useState<string>('cad_studio');
  const [activeWorkbenchId, setActiveWorkbenchId] = useState<string>('cad_viewport_3d');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSketchCanonicalUpdate = (updatedDoc: any) => {
    if (updateCanonicalDocument) {
      updateCanonicalDocument(updatedDoc);
    }
  };

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authTab, setAuthEmailTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState<string>('oubetat.1@gmail.com');
  const [authPass, setAuthPass] = useState<string>('password123');
  const [authName, setAuthName] = useState<string>('Engineering Lead');

  // Sidebar States
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [expandedStudioIds, setExpandedStudioIds] = useState<string[]>([
    'collision_studio', 'cad_studio', 'assembly_studio', 'elements_studio', 
    'cam_studio', 'cae_studio', 'cfd_studio', 'reverse_studio', 'ai_studio', 
    'plm_studio', 'drone_studio', 'ecad_studio', 'hpc_studio', 'cert_studio', 'pme_studio'
  ]);

  // Custom Projects Persistence (localStorage fallback since Firebase was declined)
  const [customProjects, setCustomProjects] = useState<ProjectModel[]>(() => {
    try {
      const saved = localStorage.getItem('secp_user_projects');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('secp_user_projects', JSON.stringify(customProjects));
  }, [customProjects]);

  // Persist the active project's ID to restore on page reload
  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('secp_active_project_id', activeProject.projectId);
    } else {
      localStorage.removeItem('secp_active_project_id');
    }
  }, [activeProject]);

  // Restore the active project on mount
  useEffect(() => {
    const savedActiveId = localStorage.getItem('secp_active_project_id');
    if (savedActiveId) {
      if (savedActiveId === 'demo-industrial-drone' || savedActiveId === 'demo-ball-valve') {
        loadDemoProject(savedActiveId);
        if (savedActiveId === 'demo-industrial-drone') {
          setActiveStudioId('drone_studio');
          setActiveWorkbenchId('drone_viewport_3d');
        } else {
          setActiveStudioId('cad_studio');
          setActiveWorkbenchId('cad_parametric');
        }
      } else {
        const match = customProjects.find(p => p.id === savedActiveId);
        if (match) {
          openSavedProject(savedActiveId, customProjects);
          const isDrone = match.type === 'INDUSTRIAL_DRONE' || match.type === 'AEROSPACE_DRONE';
          setActiveStudioId(isDrone ? 'drone_studio' : 'cad_studio');
          setActiveWorkbenchId(isDrone ? 'drone_viewport_3d' : 'cad_viewport_3d');
        }
      }
    }
  }, []);

  const handleDeleteProject = (projectId: string) => {
    setCustomProjects(prev => prev.filter(p => p.id !== projectId));
    if (activeProject?.projectId === projectId) {
      closeProject();
    }
  };

  // All 15 Specialized Studios
  const studios: StudioDefinition[] = useMemo(() => [
    // 1. Collision Safety Twin Studio
    {
      id: 'collision_studio',
      name: 'Collision Safety Twin Studio',
      shortLabel: '🛡️ Collision Safety',
      icon: ShieldCheck,
      badge: 'Safety',
      workbenches: [
        { id: 'collision_authority', name: 'Collision Authority & Multi-Axis Twin', icon: ShieldCheck, description: 'Fail-closed kinematic evaluation, truth thread ledger, exact GJK/MPR narrow phase & continuous swept CCD', badge: 'Flagship Authority', component: <CollisionAuthorityMultiAxisWorkbench /> }
      ]
    },

    // 2. Part Design & B-Rep CAD Studio
    {
      id: 'cad_studio',
      name: 'Part Design & CAD Studio',
      shortLabel: '⚙️ CAD & B-Rep',
      icon: Cpu,
      badge: 'B-Rep',
      workbenches: [
        { id: 'cad_viewport_3d', name: 'Interactive 3D WebGL Canvas Viewport', icon: Box, description: 'Interactive Three.js WebGL CAD Viewport with Orbit, Pan, Zoom, Section Cutting & Measuring', badge: '3D Viewport', component: <CadViewport3D activeProjectType={activeProject?.type as any || 'BLANK'} /> },
        { id: 'professional_3d_viewport', name: 'Professional Industrial 3D Engine', icon: Layers, description: 'Industrial 3D Engineering Viewport with Shading Modes, PMI, GD&T, and Section Planes', badge: 'Pro 3D', component: <Professional3DViewportPanel /> },
        { id: 'cad_parametric', name: 'Parametric CAD Engine', icon: Cpu, description: 'Parameter-to-geometry propagation loop with B-Rep kernel and STEP export', badge: 'CAD Core', component: <ParametricModelingPanel activeUnit="mm" /> },
        { id: 'cad_kernel_inspector', name: 'B-Rep Kernel Inspector', icon: Box, description: 'Exact topology analysis, Euler-Poincaré invariants & manifold validation', component: <CadKernelInspector /> },
        { id: 'direct_modeling', name: 'Direct Modeling Inspector', icon: Sliders, description: 'Push-pull face deformation and direct boundary editing', component: <DirectModelingInspector /> },
        { id: 'sketch_editor', name: '2D Geometric Sketch Editor', icon: CircleDot, description: 'Parametric 2D solver with geometric constraints and profile extraction', component: <SketchEditorPanel /> },
        { id: 'sketcher_standalone', name: 'Advanced GCS Sketcher', icon: Gauge, description: 'Nonlinear spatial constraint solver and degree-of-freedom analyzer', component: <SketcherPanel /> },
        { id: 'feature_tree', name: 'Feature History Tree DAG', icon: Layers, description: 'Dependency graph, rollback cursor, and feature regeneration engine', component: <FeatureTreePanel /> },
        { id: 'hybrid_modeling', name: 'Hybrid Surface/Solid Modeling', icon: Box, description: 'Mixed B-Rep, NURBS freeform patches, and boundary sewing', component: <HybridModelingInspector /> },
        { id: 'pattern_engine', name: 'Linear & Circular Pattern Engine', icon: Grid, description: 'Parametric feature arrays, polar patterns & matrix distribution', component: <PatternEngineInspector /> },
        { id: 'geometry_kernel', name: 'Geometry Core Algorithms', icon: Cpu, description: 'NURBS curve/surface evaluation, intersection curves & offsets', component: <GeometryKernelPanel /> },
        { id: 'natural_language_cad', name: 'Natural Language CAD Modeling', icon: Sparkles, description: 'Generate CAD geometry directly from engineering text specifications', component: <NaturalLanguageCADWorkbenchPanel /> },
        { id: 'water_faucet_wizard', name: 'Complex B-Rep Part Wizard', icon: Wrench, description: 'Multi-feature casting geometry with fillets, chamfers & sweeps', component: <WaterFaucetWizard /> },
        { id: 'sketch_convergence', name: 'Sketch Parity Matrix (v3)', icon: ShieldCheck, description: 'Comparison between SECP Industrial OS v3 and SOLIDWORKS 2026 feature set', badge: '34 Tools', component: <SketchConvergenceMatrix /> },
        { id: 'technical_drawing', name: '2D Technical Drawing (MBD/GD&T)', icon: FileCode, description: 'ISO/ASME drafting projections, dimensioning & GD&T callouts', component: <TechnicalDrawingPanel /> }
      ]
    },

    // 3. Assembly & Mechanism Studio
    {
      id: 'assembly_studio',
      name: 'Assembly & Mechanism Studio',
      shortLabel: '🔩 Assembly Studio',
      icon: Layers,
      workbenches: [
        { id: 'assembly_workspace', name: 'Massive Assembly Workspace', icon: Layers, description: 'Full assembly constraints, clearance analysis, exploded views & BOM', badge: 'Assembly Core', component: <AssemblyWorkspace /> },
        { id: 'assembly_engine', name: 'Assembly Constraint Solver', icon: Settings, description: 'Kinematic mate solver with redundant constraint resolution', component: <AssemblyEnginePanel /> },
        { id: 'massive_assembly_sim', name: '10,000+ Occurrence Hierarchy', icon: Grid, description: 'Spatial indexing, BVH acceleration & high-performance occlusion culling', component: <MassiveAssemblyPanel /> },
        { id: 'kinematics_panel', name: 'Forward & Inverse Kinematics', icon: Compass, description: 'Multi-body linkage solver with velocity and acceleration simulation', component: <KinematicsPanel /> },
        { id: 'advanced_kinematics', name: 'Advanced Robotic Kinematics', icon: Compass, description: '6-DOF robot arms, DH parameters, Jacobian & trajectory planning', component: <AdvancedKinematicsPanel /> },
        { id: 'kinematic_solver_ws', name: 'Rigid Body Mechanism Solver', icon: Activity, description: 'Dynamic time-stepping with collision contact mechanics', component: <KinematicSolverWorkspace /> },
        { id: 'mechanism_simulation', name: 'Mechanism Dynamics Simulator', icon: Play, description: 'Coupled kinematic mechanisms with motor drives and cam tracks', component: <MechanismSimulationWorkspace /> },
        { id: 'mechanical_joints', name: 'Mechanical Joints & Freedom Matrix', icon: Wrench, description: 'Revolute, prismatic, spherical, cylindrical, and planar joints', component: <MechanicalJointsWorkspace /> },
        { id: 'motion_links', name: 'Kinematic Motion Transmission Links', icon: RotateCw, description: 'Gear pairs, rack-and-pinion, screw drives & belt transmission', component: <MotionLinksWorkspace /> }
      ]
    },

    // 4. Standard Machine Elements Studio
    {
      id: 'elements_studio',
      name: 'Standard Machine Elements Studio',
      shortLabel: '⚙️ Machine Elements',
      icon: Settings,
      workbenches: [
        { id: 'machine_gears', name: 'Involute Gears (ISO 6336 / AGMA)', icon: RotateCw, description: 'Spur, helical, internal, rack & pinion gears with 2D meshing simulation', badge: 'Gear Builder', component: <GearEngineeringWorkspace /> },
        { id: 'machine_springs', name: 'Helical Springs (DIN EN 13906)', icon: Activity, description: 'Compression, extension, torsion, conical & wave springs with force-deflection curve', badge: 'Spring Builder', component: <SpringEngineeringWorkspace /> },
        { id: 'machine_bearings', name: 'Rolling Bearings & Fits (ISO 281)', icon: CircleDot, description: 'Deep groove, angular contact, roller bearings with ISO fits & L10h life', badge: 'Bearing Builder', component: <BearingEngineeringWorkspace /> },
        { id: 'machine_shafts', name: 'Stepped Shafts & Keyways (DIN 6885)', icon: Gauge, description: 'Torsional/bending stress, stress concentration, and keyway seats', badge: 'Shaft Builder', component: <ShaftEngineeringWorkspace /> },
        { id: 'machine_fasteners', name: 'Standard Fasteners & Hardware (ISO/DIN)', icon: Wrench, description: 'Bolts, nuts, socket screws, washers & thread engagement analysis', badge: 'Hardware', component: <FastenerEngineeringWorkspace /> }
      ]
    },

    // 5. CAM & CNC Manufacturing Studio
    {
      id: 'cam_studio',
      name: '5-Axis CAM & CNC Manufacturing Studio',
      shortLabel: '🎯 5-Axis CAM',
      icon: Compass,
      badge: 'CNC',
      workbenches: [
        { id: 'cam_simulation_master', name: '5-Axis CNC Toolpath Simulation', icon: Compass, description: 'Real-time voxel material removal, continuous 5-axis gouge checking & verification', badge: '5-Axis CAM', component: <ToolpathSimulationPanel /> },
        { id: 'five_axis_sim_panel', name: '5-Axis Continuous Post-Processor', icon: Compass, description: 'RTCP / TCPM vector transformation and kinematics verification', component: <FiveAxisSimulationPanel /> },
        { id: 'five_axis_kinematics_ws', name: '5-Axis Machine Kinematics Studio', icon: Compass, description: 'Trunnion table, swivel head, and dual rotary kinematics setups', component: <FiveAxisKinematicsWorkspace /> },
        { id: 'four_axis_cam_ws', name: '4-Axis Rotary Indexing & Milling', icon: RotateCw, description: 'Cylindrical wrapping, continuous 4-axis profiling & live tooling', component: <FourAxisCamWorkspace /> },
        { id: 'three_axis_cam_ws', name: '3-Axis High-Speed Machining (HSM)', icon: Compass, description: 'Adaptive clearing, constant-Z roughing, scallop finishing & rest milling', component: <ThreeAxisCamWorkspace /> },
        { id: 'tool_library_ws', name: 'Industrial Tool & Holder Library', icon: Wrench, description: 'Endmills, ballnose, bullnose, drills, taps & CAT40/HSK63 holders', component: <ToolLibraryWorkspace /> },
        { id: 'stock_simulation_ws', name: 'Stock In-Process State (IPW)', icon: Box, description: 'Multi-operation in-process raw stock updating and remaining material tracking', component: <StockSimulationWorkspace /> },
        { id: 'manufacturing_features_ws', name: 'Manufacturing Feature Recognition', icon: Grid, description: 'Automated hole, pocket, slot, and boss extraction for CNC programming', component: <ManufacturingFeatureWorkspace /> },
        { id: 'gcode_verification', name: 'G-Code Dialect Parser & Validator', icon: Terminal, description: 'Fanuc, Heidenhain, Siemens 840D, Haas & ISO G-code execution engine', component: <GCodeVerificationPanel /> },
        { id: 'cam_panel_general', name: 'CAM Operations Master Manager', icon: Settings, description: 'Setup definitions, work coordinates (G54-G59) & operation sequencing', component: <CamPanel /> }
      ]
    },

    // 6. Structural FEM Studio
    {
      id: 'cae_studio',
      name: 'Structural FEM & CAE Studio',
      shortLabel: '🔬 Structural FEM',
      icon: Activity,
      badge: 'FEM',
      workbenches: [
        { id: 'physics_expansion_007', name: 'Advanced Physics Expansion 007', icon: Zap, description: 'Independent qualification of Domain A-E: Damage, CFD, EM, Multiscale & Unified Coupling', badge: 'New 007', component: <AdvancedPhysicsDashboard007 /> },
        { id: 'cae_structural_master', name: 'Primary Structural FEM Workbench', icon: Activity, description: 'Sparse direct solver, von Mises stress contours, displacement fields & safety factors', badge: 'FEM Solver', component: <SimulationCaePanel /> },
        { id: 'gpu_fem_workbench', name: 'GPU-Accelerated FEM Matrix Solver', icon: Zap, description: 'CUDA/WebGPU conjugate gradient and direct solver with 1M+ DOFs', component: <GPUFEMWorkbenchPanel /> },
        { id: 'gpu_meshing_workbench', name: 'GPU Parallel Mesh Generator', icon: Grid, description: 'Delaunay tetrahedralization, Advancing Front, and quad/hex meshing', component: <GPUMeshingWorkbenchPanel /> },
        { id: 'gpu_linear_algebra', name: 'GPU Linear Algebra Accelerators', icon: Cpu, description: 'Sparse BLAS, matrix multiplication, Cholesky factorization & Eigen solver', component: <GPULinearAlgebraWorkbenchPanel /> },
        { id: 'global_stiffness_ws', name: 'Global Stiffness Assembly Studio', icon: Layers, description: 'Element stiffness assembly, master coordinate transformation & DOF elimination', component: <GlobalStiffnessAssemblyWorkspace /> },
        { id: 'sparse_matrix_ws', name: 'Sparse Matrix Compression & CRS', icon: Grid, description: 'Compressed Row Storage (CRS), fill-in reordering (RCM) & bandwidth reduction', component: <SparseMatrixWorkspace /> },
        { id: 'linear_solver_ws', name: 'High-Precision Linear Equation Solver', icon: Activity, description: 'Direct LU decomposition, iterative GMRES & Preconditioned Conjugate Gradient', component: <LinearSolverWorkspace /> },
        { id: 'nonlinear_solver_ws', name: 'Nonlinear Newton-Raphson Solver', icon: Activity, description: 'Geometric nonlinearity, large deformations, plasticity & contact nonlinearity', component: <NonlinearSolverWorkspace /> },
        { id: 'fem_elements_ws', name: 'Finite Element Types & Formulations', icon: Box, description: 'Tet4, Tet10, Hex8, Hex20, Shell3/4, and beam elements', component: <FEMElementsWorkspace /> },
        { id: 'fem_mesh_ws', name: 'FEM Mesh Quality & Aspect Ratio Auditor', icon: CheckCircle2, description: 'Jacobian determinant, aspect ratio, skewness & mesh convergence study', component: <FEMMeshWorkspace /> },
        { id: 'material_constitutive_ws', name: 'Material Constitutive Laws & Yield Criteria', icon: Layers, description: 'Isotropic elasticity, orthotropic composites, Johnson-Cook & plasticity curves', component: <MaterialConstitutiveWorkspace /> },
        { id: 'materials_database', name: 'Engineering Materials Database', icon: Database, description: 'Metals, polymers, ceramics, composites with temperature-dependent properties', component: <MaterialsPanel /> },
        { id: 'cloud_simulation', name: 'HPC Cloud Simulation Cluster', icon: HardDrive, description: 'Remote cloud job dispatch, distributed cluster compute & result streaming', component: <CloudSimulationPanel /> }
      ]
    },

    // 7. CFD Fluid Dynamics Studio
    {
      id: 'cfd_studio',
      name: 'CFD Fluid Dynamics Studio',
      shortLabel: '🌊 CFD Fluids',
      icon: Wind,
      badge: 'CFD',
      workbenches: [
        { id: 'cfd_master_panel', name: 'Primary CFD Fluid Dynamics Studio', icon: Wind, description: 'Finite Volume Method (FVM), pressure-velocity coupling & aerodynamic flow', badge: 'CFD Engine', component: <CaeCfdPanel /> },
        { id: 'gpu_cfd_workbench', name: 'GPU-Accelerated FVM Flow Solver', icon: Zap, description: 'Parallel GPU Navier-Stokes flow equations with turbulence models', component: <GPUCFDWorkbenchPanel /> },
        { id: 'fluid_power_panel', name: 'Hydraulic & Pneumatic Circuit Solver', icon: Flame, description: 'Pumps, valves, cylinders, pressure drops & fluid network dynamics', component: <FluidPowerPanel /> },
        { id: 'navier_stokes_ws', name: 'Incompressible Navier-Stokes Equations', icon: Wind, description: 'Mass and momentum conservation equations with convection-diffusion operators', component: <NavierStokesWorkspace /> },
        { id: 'turbulence_ws', name: 'Turbulence Modeling (k-omega SST)', icon: Wind, description: 'RANS turbulence models, wall functions, eddy viscosity & y+ resolution', component: <TurbulenceWorkspace /> },
        { id: 'pressure_velocity_ws', name: 'SIMPLE / PISO Pressure-Velocity Coupling', icon: Wind, description: 'Semi-Implicit Method for Pressure-Linked Equations and Rhie-Chow interpolation', component: <PressureVelocityWorkspace /> },
        { id: 'residual_engine_ws', name: 'CFD Residuals & Convergence Monitor', icon: Activity, description: 'Real-time RMS momentum, continuity, and energy residual tracking', component: <ResidualEngineWorkspace /> },
        { id: 'fvm_discretization_ws', name: 'Polyhedral & Hex FVM Discretization', icon: Grid, description: 'Upwind differencing, central differencing, QUICK scheme & flux limiters', component: <FvmDiscretizationWorkspace /> },
        { id: 'heat_transfer_ws', name: 'Conjugate Heat Transfer & Thermal Flow', icon: Flame, description: 'Coupled conduction in solids and forced/natural convection in fluids', component: <HeatTransferWorkspace /> },
        { id: 'compressible_ws', name: 'Compressible High-Speed Aerodynamics', icon: Wind, description: 'Transonic/supersonic flow, shock waves, Mach number contours & expansion fans', component: <CompressibleWorkspace /> },
        { id: 'multiphase_ws', name: 'Multiphase Volume of Fluid (VOF)', icon: Wind, description: 'Free surface liquid-gas tracking, sloshing, and surface tension effects', component: <MultiphaseWorkspace /> },
        { id: 'fsi_ws', name: 'Fluid-Structure Interaction (FSI)', icon: Activity, description: 'Coupled 2-way CFD fluid forces and FEM structural deflections', component: <FsiWorkspace /> }
      ]
    },

    // 8. Reverse Engineering Studio
    {
      id: 'reverse_studio',
      name: 'Reverse Engineering & Scan-to-CAD Studio',
      shortLabel: '📐 Scan-to-CAD',
      icon: Box,
      workbenches: [
        { id: 'point_cloud_import', name: 'Point Cloud Ingestion & Parser', icon: Box, description: 'High-density LiDAR/optical scan point cloud loader with billion-point capacity', badge: 'Scan-to-CAD', component: <PointCloudImportWorkbenchPanel /> },
        { id: 'scan_to_mesh', name: 'Scan-to-Mesh Triangulation (Poisson)', icon: Grid, description: 'Screened Poisson surface reconstruction, Ball-Pivoting & watertight meshing', component: <ScanToMeshWorkbenchPanel /> },
        { id: 'surface_reconstruction', name: 'B-Rep Surface Patch Fitting', icon: Layers, description: 'Segment mesh into analytical planes, cylinders, cones, tori & freeform NURBS', component: <SurfaceReconstructionWorkbenchPanel /> },
        { id: 'nurbs_reconstruction', name: 'NURBS Loft & Boundary Reconstructor', icon: Box, description: 'Extract section curves and construct G1/G2 continuous smooth parametric surfaces', component: <NURBSReconstructionWorkbenchPanel /> },
        { id: 'mesh_healing', name: 'Mesh Healing & Non-Manifold Repair', icon: Wrench, description: 'Fill holes, fix self-intersections, stitch open seams & manifold topology validation', component: <MeshHealingWorkbenchPanel /> },
        { id: 'noise_filtering', name: 'Statistical Outlier & Bilateral Filtering', icon: Sliders, description: 'KD-tree neighborhood distance filtering and feature-preserving denoising', component: <NoiseFilteringWorkbenchPanel /> },
        { id: 'registration_alignment', name: 'Scan Registration & ICP Alignment', icon: Compass, description: 'Iterative Closest Point (ICP), feature matching & global scan alignment', component: <RegistrationAlignmentWorkbenchPanel /> },
        { id: 'pmi_metrology', name: 'PMI Inspection & Optical Comparison', icon: Gauge, description: 'Nominal CAD vs. manufactured scan deviation color heatmaps and CMM points', component: <PMIPanel /> }
      ]
    },

    // 9. AI Engineering Copilot Studio
    {
      id: 'ai_studio',
      name: 'AI Engineering Copilot Studio',
      shortLabel: '🤖 AI Copilot',
      icon: Sparkles,
      badge: 'AI',
      workbenches: [
        { id: 'ai_design_assistant', name: 'AI Design Assistant & Intent Resolver', icon: Sparkles, description: 'Natural language engineering intent parser, tool call console & design candidate generator', badge: 'AI Copilot', component: <AIDesignAssistantWorkbenchPanel /> },
        { id: 'ai_design_review', name: 'Automated AI Design Review & DFM', icon: FileCheck2, description: 'Rule-based and semantic design for manufacturing (DFM) rule validation', component: <AIDesignReviewWorkbenchPanel /> },
        { id: 'ai_failure_detection', name: 'AI Failure Mode Detection & FMEA', icon: ShieldCheck, description: 'Predictive stress concentrations, fatigue hotspots & assembly interferences', component: <AIFailureDetectionWorkbenchPanel /> },
        { id: 'ai_simulation_setup', name: 'AI Autonomous Simulation Configurator', icon: Zap, description: 'Auto-detect boundary conditions, contact pairs & recommended mesh refinement', component: <AISimulationSetupWorkbenchPanel /> },
        { id: 'ai_optimization', name: 'AI Multi-Objective Topology Optimizer', icon: Sliders, description: 'Pareto-optimal mass vs. stiffness multi-physics optimization algorithms', component: <AIOptimizationWorkbenchPanel /> },
        { id: 'engineering_copilot', name: 'Engineering Chat & Knowledge Copilot', icon: Sparkles, description: 'Interactive AI assistant with CAD kernel API and engineering standard query tools', component: <EngineeringCopilotWorkbenchPanel /> },
        { id: 'generative_design', name: 'Generative Design Synthesis (SIMP)', icon: Box, description: 'Solid Isotropic Material with Penalization (SIMP) material distribution', component: <GenerativeDesignPanel /> },
        { id: 'generative_engineering', name: 'Generative Structural Optimization', icon: Activity, description: 'Stress-constrained generative geometry generation for additive manufacturing', component: <GenerativeEngineeringWorkbenchPanel /> }
      ]
    },

    // 10. Enterprise PLM Studio
    {
      id: 'plm_studio',
      name: 'Enterprise PLM & Provenance Studio',
      shortLabel: '📦 Enterprise PLM',
      icon: Database,
      workbenches: [
        { id: 'enterprise_plm', name: 'Enterprise PLM & Lifecycle Hub', icon: Database, description: 'Master product data management, release status & engineering change control', badge: 'PLM Core', component: <EnterprisePLMPanel /> },
        { id: 'bom_manager', name: 'Multi-Level Bill of Materials (BOM)', icon: Layers, description: 'Hierarchical indented BOM, item part numbering, cost rollup & supplier tracking', component: <BomPanel /> },
        { id: 'eco_management', name: 'Engineering Change Order (ECO) Pipeline', icon: GitBranch, description: 'Redline drawings, approval signatures, impact analysis & change propagation', component: <EcoManagementPanel /> },
        { id: 'revision_management', name: 'Revision Management & Branch Variants', icon: GitBranch, description: 'Immutable revision history, branch merging & design variant exploration', component: <RevisionManagementPanel /> },
        { id: 'change_management', name: 'Enterprise Change Governance', icon: ShieldCheck, description: 'Automated gatekeeper preventing unauthorized release of uncertified designs', component: <ChangeManagementPanel /> },
        { id: 'approval_workflow', name: 'Multi-Role Sign-off & Approval Workflows', icon: CheckCircle2, description: 'Cryptographic multi-signature sign-off gates for engineering directors and QA', component: <ApprovalWorkflowPanel /> },
        { id: 'digital_thread', name: 'Digital Thread Continuity Monitor', icon: Activity, description: 'Requirements -> CAD -> CAM -> CAE -> Physical Asset end-to-end traceability', component: <DigitalThreadPanel /> },
        { id: 'digital_twin', name: 'Digital Twin Operational Telemetry', icon: Radio, description: 'IoT sensor ingestion, real-time stress monitoring & remaining useful life', component: <DigitalTwinPanel /> },
        { id: 'machine_twin', name: 'CNC Machine Digital Twin & Spindle Health', icon: HardDrive, description: 'Vibration monitoring, thermal expansion compensation & tool wear prediction', component: <MachineTwinPanel /> },
        { id: 'process_twin', name: 'Manufacturing Process Digital Twin', icon: Activity, description: 'Factory floor production rate, takt time & energy consumption analytics', component: <ProcessTwinPanel /> },
        { id: 'provenance_ledger', name: 'Cryptographic Provenance Hash Ledger', icon: Lock, description: 'SHA-256 blockchain-style immutable engineering evidence ledger', component: <ProvenanceLedger /> },
        { id: 'provenance_panel', name: 'Artifact Provenance Certificate Inspector', icon: FileCheck2, description: 'Cryptographic certificate verification for ISO 9001 / AS9100 regulatory audits', component: <ProvenancePanel /> }
      ]
    },

    // 11. Aerospace Drone Studio
    {
      id: 'drone_studio',
      name: 'Aerospace Drone Assembly Studio',
      shortLabel: '🚁 Aerospace Drone',
      icon: Box,
      badge: '1,200+ Parts',
      workbenches: [
        { id: 'drone_project_home', name: 'Hexacopter Industrial Drone Project', icon: Box, description: 'Full aerospace reference project integrating all CAD, CAM, CFD, FEA & electronics', badge: 'Flagship Assembly', component: <DroneProjectHome /> },
        { id: 'drone_viewport_3d', name: 'Interactive 3D Drone Assembly View', icon: Box, description: 'Interactive Three.js WebGL CAD Viewport with piece-by-piece disassembly and cross-section analysis', badge: '3D View', component: <CadViewport3D activeProjectType="INDUSTRIAL_DRONE" /> },
        { id: 'drone_assembly_tree', name: 'Drone Master Assembly Tree', icon: Layers, description: '1,200+ parts hierarchy including carbon frame, arms, motors, ESCs & payload gimbal', component: <IndustrialDroneAssemblyTreePanel /> },
        { id: 'drone_aero_cfd', name: 'Drone Aerodynamic CFD & Rotor Thrust', icon: Wind, description: 'Rotor blade flow velocity, wake turbulence, downwash & frame drag analysis', component: <DroneAeroCfdPanel /> },
        { id: 'drone_cam_workbench', name: 'Drone CNC Machining Programs', icon: Compass, description: '5-Axis billet motor mounts, carbon fiber routing & aluminum plate milling', component: <DroneCAMWorkbench /> },
        { id: 'drone_electrical', name: 'Drone Power Distribution & Harness', icon: Zap, description: '6S LiPo power distribution, wire gauges, voltage drop & current limits', component: <DroneElectricalPanel /> },
        { id: 'drone_pcb', name: 'Drone Flight Controller PCB Layout', icon: Cpu, description: 'STM32 H7 flight controller, IMU sensors, barometer & CAN bus layout', component: <DronePcbPanel /> },
        { id: 'drone_fasteners', name: 'Drone Fastener & Torque Schedule', icon: Wrench, description: 'Titanium M3/M4 fasteners, threadlock specifications & tightening torque', component: <DroneFastenersPanel /> },
        { id: 'drone_evidence', name: 'Drone Forensic Evidence Package', icon: ShieldCheck, description: 'FAA/EASA airworthiness certification package with cryptographic proof chain', component: <DroneEvidenceWorkbench /> },
        { id: 'drone_bom', name: 'Drone Bill of Materials & Cost Rollup', icon: Database, description: 'Complete drone procurement schedule, mass budget & unit manufacturing cost', component: <DroneBomPanel /> },
        { id: 'drone_inspector', name: 'Drone Physical Model Inspection', icon: Box, description: 'Center of gravity, moment of inertia tensor & payload capacity calculator', component: <DroneInspector /> }
      ]
    },

    // 12. ECAD & Electronics Studio
    {
      id: 'ecad_studio',
      name: 'ECAD & Hardware Electronics Studio',
      shortLabel: '⚡ ECAD & PCB',
      icon: Zap,
      workbenches: [
        { id: 'interactive_multidomain', name: 'SECP Multi-Domain Co-Simulation Workstation', icon: Cpu, description: 'Live interactive Picard electrothermal, thermal-structural FEA, CFD 1-way FSI & SECP-003 qualification center', badge: 'Interactive Co-Sim', component: <InteractiveEngineeringWorkbench /> },
        { id: 'pcb_workbench', name: 'ECAD PCB 3D Geometric Layout', icon: Cpu, description: 'Import IPC-2581/ODB++, 3D trace geometry, component clearances & keepouts', component: <PcbWorkbenchPanel /> },
        { id: 'electrical_workbench', name: 'Electrical Schematic & Harness Design', icon: Zap, description: 'Wiring harness routing, connector pinouts & circuit simulation', component: <ElectricalWorkbenchPanel /> },
        { id: 'sensor_integration', name: 'Sensor Integration & Signal Processing', icon: Radio, description: 'Strain gauges, thermocouples, accelerometers & DAQ calibration', component: <SensorIntegrationPanel /> }
      ]
    },

    // 13. High-Performance Compute Studio
    {
      id: 'hpc_studio',
      name: 'High-Performance Compute Studio',
      shortLabel: '💻 HPC & WebGPU',
      icon: Zap,
      workbenches: [
        { id: 'webgpu_workbench', name: 'WebGPU Native Graphics & Compute', icon: Zap, description: 'Direct hardware shader pipelines, compute passes & high-framerate rendering', component: <WebGPUWorkbenchPanel /> },
        { id: 'distributed_compute', name: 'Distributed Mesh & Solve Cluster', icon: HardDrive, description: 'Multi-node MPI distributed memory domain decomposition', component: <DistributedComputeWorkbenchPanel /> },
        { id: 'hpc_scheduler', name: 'HPC Job Scheduler & Load Balancer', icon: Sliders, description: 'Job queue, GPU resource allocation, priority scheduling & SLA monitors', component: <HPCSchedulerWorkbenchPanel /> },
        { id: 'wasm_compute', name: 'WASM Multi-Threaded C++ Engine', icon: Cpu, description: 'SIMD-accelerated WebAssembly CAD kernel with SharedArrayBuffer', component: <WasmComputeWorkbenchPanel /> },
        { id: 'hardware_acceleration', name: 'Hardware Acceleration Diagnostics', icon: Zap, description: 'GPU memory bandwidth, VRAM utilization & hardware capabilities detection', component: <HardwareAccelerationWorkbenchPanel /> },
        { id: 'worker_parallelism', name: 'Web Worker Thread Pool Manager', icon: Layers, description: 'Multi-core background workers for geometry slicing, meshing & file I/O', component: <WorkerParallelismWorkbenchPanel /> }
      ]
    },

    // 14. Certification & Hard Gates Studio
    {
      id: 'cert_studio',
      name: 'Certification & Hard Acceptance Gates Studio',
      shortLabel: '🏆 Certification',
      icon: Award,
      badge: '100% Pass',
      workbenches: [
        { id: 'acceptance_matrix', name: 'SECP Master Acceptance Matrix', icon: ShieldCheck, description: 'All Phase 0 through Phase 8 mathematical and system acceptance criteria', badge: 'Master Matrix', component: <AcceptanceMatrix criteria={[]} onRunAllChecks={() => {}} isRunning={false} onNavigateTab={() => {}} /> },
        { id: 'production_certification', name: 'Production Certification Dashboard', icon: Award, description: 'End-to-end multi-disciplinary qualification certifying 100% mathematical correctness', badge: '100% Certified', component: <ProductionCertificationDashboard /> },
        { id: 'full_industrial_audit', name: 'Full Industrial OS Forensic Audit', icon: FileCheck2, description: 'Zero false-negative assertion runner and regression integrity suite', component: <FullIndustrialOSAuditDashboard /> },
        { id: 'final_closure_dashboard', name: 'Final Engineering Closure Dashboard', icon: ShieldCheck, description: 'Complete system invariants verification across all CAD/CAM/CAE layers', component: <FinalEngineeringClosureForensicDashboard /> },
        { id: 'deterministic_reproduction', name: 'Deterministic Reproduction Center', icon: RotateCw, description: 'Byte-for-byte exact replay validation across heterogeneous CPU architectures', component: <DeterministicReproductionDashboard /> },
        { id: 'security_audit', name: 'Security & Access Control Audit', icon: Lock, description: 'Role-based permissions, cryptographic key validation & audit trail logs', component: <ProductionSecurityAuditDashboard /> },
        { id: 'production_proof', name: 'Production Proof Certificate Generator', icon: FileCheck2, description: 'Formal mathematical proofs and verifiable certificates for aerospace compliance', component: <ProductionProofDashboard /> },
        { id: 'cad_benchmark', name: 'CAD Kernel Standard Benchmarks', icon: Cpu, description: 'Performance and geometric accuracy benchmarks against industry baselines', component: <CADBenchmarkPanel /> },
        { id: 'true_5axis_benchmark', name: '5-Axis CAM Collision Benchmark', icon: Compass, description: 'Extreme kinematic toolpath collision stress test battery', component: <True5AxisCAMPanel /> },
        { id: 'massive_assembly_benchmark', name: 'Massive Assembly Benchmark (100K Parts)', icon: Grid, description: 'Memory consumption and frame rate performance under extreme assembly loads', component: <MassiveAssemblyBenchmarkPanel /> },
        { id: 'cfd_benchmark', name: 'CFD Fluid Flow Analytical Benchmark', icon: Wind, description: 'Poiseuille, Couette, Lid-Driven Cavity & NACA 0012 validation benchmarks', component: <CFDBenchmarkPanel /> },
        { id: 'turbulence_benchmark', name: 'CFD Turbulence Framework & Gate 176', icon: Flame, description: 'PATCH-176 Independent Turbulence Benchmark Closure & Hard Acceptance Gate', component: <TurbulenceBenchmarkPanel /> },
        { id: 'fem_benchmark', name: 'Nonlinear FEM Standard Benchmark', icon: Activity, description: 'Cantilever beam, spherical shell snap-through & plastic necking benchmarks', component: <NonlinearFEMBenchmarkPanel /> },
        { id: 'boolean_adversarial', name: 'B-Rep Boolean Adversarial Suite', icon: Box, description: 'Near-tangent, coplanar, vertex-on-edge & micro-feature boolean torture tests', component: <BooleanAdversarialPanel /> },
        { id: 'verification_portal', name: 'Verification & Independent Audit Portal', icon: CheckCircle2, description: 'Third-party auditor package export and verification portal', component: <VerificationPortal /> }
      ]
    },

    // 15. Programmable Material Engineering Studio (PME)
    {
      id: 'pme_studio',
      name: 'Programmable Material Engineering Studio',
      shortLabel: '🧪 PME Studio',
      icon: Database,
      badge: 'V1-V12',
      workbenches: [
        { id: 'pme_main', name: 'PME Master Workspace', icon: Database, description: 'Unified workspace for Material Intelligence, Spatial Design, Simulation & Industrial Qualification', badge: 'PME Hub', component: <PMEStudio /> }
      ]
    }
  ], [activeProject, activeSolid, assemblyComponents, canonicalDocument, droneCamResult]);

  // Show all 15 specialized studios without project type restrictions so users can access PCB, CFD, HPC, etc. anytime
  const filteredStudios = useMemo(() => {
    return studios;
  }, [studios]);

  // Active Studio
  const activeStudio = useMemo(() => {
    return filteredStudios.find(s => s.id === activeStudioId) || filteredStudios[0];
  }, [filteredStudios, activeStudioId]);

  // Active Workbench within Active Studio or global
  const activeWorkbench = useMemo(() => {
    for (const s of studios) {
      const found = s.workbenches.find(w => w.id === activeWorkbenchId);
      if (found) return found;
    }
    return activeStudio.workbenches[0] || studios[0].workbenches[0];
  }, [studios, activeStudio, activeWorkbenchId]);

  // Toggle studio expansion in sidebar
  const toggleStudioExpand = (studioId: string) => {
    setExpandedStudioIds(prev =>
      prev.includes(studioId) ? prev.filter(id => id !== studioId) : [...prev, studioId]
    );
  };

  // Mission Control: Auto-switch studio/workbench when project changes to respect Project Isolation
  useEffect(() => {
    if (activeProject) {
      // Ensure we are in a studio that actually exists for this project type
      const isValidStudio = filteredStudios.some(s => s.id === activeStudioId);
      if (!isValidStudio && filteredStudios.length > 0) {
        setActiveStudioId(filteredStudios[0].id);
        setActiveWorkbenchId(filteredStudios[0].workbenches[0].id);
      }
    }
  }, [activeProject, filteredStudios]);

  // Handle Demo Project Selection from Start Center
  const handleLoadDemoProject = (demoId: string) => {
    loadDemoProject(demoId);
    if (demoId === 'demo-industrial-drone') {
      setActiveStudioId('drone_studio');
      setActiveWorkbenchId('drone_viewport_3d');
    } else if (demoId === 'demo-ball-valve') {
      setActiveStudioId('cad_studio');
      setActiveWorkbenchId('cad_parametric');
    } else {
      setActiveStudioId('collision_studio');
      setActiveWorkbenchId('collision_authority');
    }
  };

  // Handle Creating / Initializing a New Custom Project
  const handleCreateNewProject = (input: { name: string; projectNumber: string; type?: string; description?: string }) => {
    // REQUIRED LIFECYCLE ORDER:
    // 1. Create New Project via ProjectSessionManager
    // 2. Persist Project
    // 3. Set as Active Project
    // 4. FULL RUNTIME RESET
    // 5. Open

    // Pre-step: Clear existing state to ensure clean transition
    closeProject();

    const newProjId = `PRJ-CUSTOM-${Date.now()}`;
    const targetType = input.type || 'PART';

    // 1. Create via ProjectSessionManager (Source of Truth)
    const newProjInput: NewProjectInput = {
      name: input.name || 'Untitled Engineering Project',
      projectNumber: input.projectNumber || 'PRJ-CUSTOM-001',
      type: targetType,
      unit: 'mm',
      description: input.description || 'Custom user engineering project',
      projectId: newProjId
    };
    
    // We leverage the context version which handles the SessionManager internally
    createNewProject(newProjInput);
    
    // 2. Persist Project immediately
    const newProj: ProjectModel = {
      id: newProjId,
      name: newProjInput.name,
      projectNumber: newProjInput.projectNumber,
      units: 'MILLIMETERS (mm)',
      type: targetType,
      description: newProjInput.description
    };
    
    setCustomProjects(prev => {
      const updated = [newProj, ...prev];
      localStorage.setItem('secp_user_projects', JSON.stringify(updated));
      return updated;
    });

    // 3. Set as Active Project is already done by createNewProject() in step 1

    // 4. FULL RUNTIME RESET of all states
    setSearchQuery('');
    setExpandedStudioIds(['collision_studio', 'cad_studio']);
    // Reset workbench and studio to defaults for the new project type
    
    // 5. Open in clean state (Select defaults)
    const isDrone = targetType === 'INDUSTRIAL_DRONE' || targetType === 'AEROSPACE_DRONE';
    const isAssembly = targetType === 'ASSEMBLY';
    
    // Explicitly set IDs to trigger the correct workbench on the first render of the new project
    if (isDrone) {
      setActiveStudioId('drone_studio');
      setActiveWorkbenchId('drone_viewport_3d');
    } else if (isAssembly) {
      setActiveStudioId('assembly_studio');
      setActiveWorkbenchId('assembly_workspace');
    } else {
      setActiveStudioId('cad_studio');
      setActiveWorkbenchId('cad_viewport_3d');
    }
    
    console.log(`[PROJECT_LIFECYCLE_RESET] New project created: ${newProjId} (${targetType})`);
  };

  const handleOpenSavedProject = (projectId: string) => {
    openSavedProject(projectId, customProjects);
    const proj = customProjects.find(p => p.id === projectId);
    const isDrone = proj?.type === 'INDUSTRIAL_DRONE' || proj?.type === 'AEROSPACE_DRONE';
    setActiveStudioId(isDrone ? 'drone_studio' : 'cad_studio');
    setActiveWorkbenchId(isDrone ? 'drone_viewport_3d' : 'cad_viewport_3d');
  };

  const currentUser = user ? { email: user.email || 'user@company.com', displayName: user.displayName || 'Engineer User' } : customUser;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white overflow-hidden">
      <div className="flex flex-1 h-screen overflow-hidden">
        
        {/* ========================================================= */}
        {/* SIDEBAR NAVIGATION (القائمة الجانبية الموحدة) */}
        {/* ========================================================= */}
        <aside
          className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-40 shrink-0 ${
            sidebarCollapsed ? 'w-16' : 'w-72 sm:w-80'
          }`}
        >
          {/* Sidebar Top Logo Branding */}
          <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
            <div
              onClick={() => closeProject()}
              className="flex items-center space-x-3 cursor-pointer group truncate"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-cyan-500/25 border border-cyan-400/30 group-hover:scale-105 transition-transform shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm text-white tracking-tight">SECP Platform</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                      v3
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">Industrial OS & 15 Studios</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar Project State & Mission Control Button */}
          {!sidebarCollapsed && (
            <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 space-y-2">
              <button
                onClick={() => closeProject()}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                  !activeProject
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-cyan-300" />
                  <span>Start Center (الرئيسية)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {activeProject && (
                <>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="uppercase font-mono tracking-wider font-bold">Active Project:</span>
                      <span className="text-cyan-400 font-mono">{activeProject.projectNumber}</span>
                    </div>
                    <div className="font-bold text-white truncate">{activeProject.name}</div>
                    <p className="text-[10px] text-slate-400 truncate">{activeProject.unit || 'mm'}</p>
                  </div>

                  {/* Sidebar Quick Filter Search */}
                  <div className="relative pt-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter studios & tools..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Studios Tree & Accordion List in Sidebar */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {!activeProject ? (
              <div className="p-4 text-center space-y-3 bg-slate-950/40 rounded-xl m-2 border border-slate-800/50">
                <Sparkles className="w-5 h-5 text-cyan-400 mx-auto animate-pulse" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  No active project. Launch a reference design or create a custom project in the Start Center to activate the specialized Engineering Studios & Workbenches.
                </p>
              </div>
            ) : (
              filteredStudios.map((studio) => {
                const StudioIcon = studio.icon;
                const isExpanded = expandedStudioIds.includes(studio.id) || !!searchQuery;
                const isStudioActive = activeStudioId === studio.id && !!activeProject;

                // Filter workbenches if search query typed
                const filteredWorkbenches = searchQuery
                  ? studio.workbenches.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  : studio.workbenches;

                if (searchQuery && filteredWorkbenches.length === 0) return null;

                return (
                  <div key={studio.id} className="rounded-xl overflow-hidden">
                    {/* Studio Accordion Header */}
                    <button
                      onClick={() => {
                        if (sidebarCollapsed) setSidebarCollapsed(false);
                        toggleStudioExpand(studio.id);
                        if (activeProject) {
                          setActiveStudioId(studio.id);
                          setActiveWorkbenchId(studio.workbenches[0].id);
                        }
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        isStudioActive
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <StudioIcon className={`w-4 h-4 shrink-0 ${isStudioActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                        {!sidebarCollapsed && <span className="truncate">{studio.shortLabel}</span>}
                      </div>

                      {!sidebarCollapsed && (
                        <div className="flex items-center space-x-1 shrink-0">
                          {studio.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-cyan-400 border border-slate-700">
                              {studio.badge}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </div>
                      )}
                    </button>

                    {/* Studio Workbenches / Sub-tabs */}
                    {!sidebarCollapsed && isExpanded && (
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-slate-800 ml-3 mt-0.5">
                        {filteredWorkbenches.map((wb) => {
                          const WbIcon = wb.icon;
                          const isWbActive = activeWorkbenchId === wb.id && isStudioActive;
                          return (
                            <button
                              key={wb.id}
                              onClick={() => {
                                if (!activeProject) {
                                  // Default project if opened directly from Start Center
                                  handleLoadDemoProject('demo-industrial-drone');
                                }
                                setActiveStudioId(studio.id);
                                setActiveWorkbenchId(wb.id);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-between ${
                                isWbActive
                                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/50'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <WbIcon className={`w-3.5 h-3.5 shrink-0 ${isWbActive ? 'text-white' : 'text-slate-500'}`} />
                                <span className="truncate">{wb.name}</span>
                              </div>
                              {wb.badge && (
                                <span className={`text-[9px] px-1 rounded font-mono shrink-0 ml-1 ${
                                  isWbActive ? 'bg-cyan-800 text-cyan-100' : 'bg-slate-800/90 text-slate-400'
                                }`}>
                                  {wb.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Bottom Cloud User Profile Card */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
            {currentUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
                    {currentUser.displayName.charAt(0)}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                        <span>{currentUser.displayName}</span>
                        <Cloud className="w-3 h-3 text-emerald-400 shrink-0" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                    </div>
                  )}
                </div>

                {!sidebarCollapsed && (
                  <button
                    onClick={() => signOut()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {!sidebarCollapsed && <span>Register / Login Email</span>}
              </button>
            )}
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN VIEWPORT AREA (المنطقة الرئيسية) */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto no-scrollbar bg-slate-950">
          
          {/* Main Top Breadcrumb Header Bar */}
          <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/90 backdrop-blur sticky top-0 z-30 shadow-md shrink-0">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                <span
                  onClick={() => closeProject()}
                  className="hover:text-cyan-400 cursor-pointer transition-colors font-bold text-white flex items-center gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                  SECP Industrial OS
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                {activeProject ? (
                  <>
                    <span className="text-cyan-300 font-semibold">{activeProject.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-white font-bold">{activeStudio.shortLabel}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-cyan-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {activeWorkbench.name}
                    </span>
                  </>
                ) : (
                  <span className="text-cyan-400 font-bold">Start Center & Reference Projects</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {activeProject ? (
                <button
                  onClick={() => closeProject()}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center space-x-1.5 transition-colors border border-slate-700 shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Return to Start Center</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded-lg flex items-center space-x-1.5 transition-colors border border-cyan-800"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{currentUser ? currentUser.email : 'Cloud Login'}</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Content Router */}
          {!activeProject ? (
            /* LANDING VIEW: Start Center with Official Demonstrations & Projects */
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto overflow-y-auto no-scrollbar">
              <StartCenter
                onLoadDemo={handleLoadDemoProject}
                onOpenProject={handleOpenSavedProject}
                onCreateNewProject={handleCreateNewProject}
                existingProjects={customProjects as any}
                onDeleteProduct={handleDeleteProject}
                onImportFile={importProjectFile}
              />
            </main>
          ) : (
            /* ACTIVE WORKSPACE VIEWPORT: Integrated Controls + Persistent 3D Visualization */
            <main key={activeProject.projectId} className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden h-[calc(100vh-64px-32px)]">
              {/* Left Panel: Workbench Controls & Info */}
              <div className={`flex flex-col gap-4 overflow-y-auto no-scrollbar pr-1 custom-scrollbar shrink-0 transition-all duration-300 ${
                activeWorkbench.id.includes('viewport') || activeWorkbench.id === 'collision_authority' 
                  ? 'w-full lg:w-[320px]' 
                  : 'w-full lg:w-[380px] xl:w-[450px]'
              }`}>
                {/* Active Workbench Header Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md shrink-0">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                      {React.createElement(activeWorkbench.icon, { className: 'w-5 h-5' })}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-sm font-bold text-white tracking-tight truncate">{activeWorkbench.name}</h1>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider truncate">{activeStudio.name}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{activeWorkbench.description}</p>
                  
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500 pt-3 border-t border-slate-800">
                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      ID: <span className="text-cyan-400">{activeProject.projectNumber}</span>
                    </span>
                    <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Units: <span className="text-cyan-400">{activeProject.unit || 'mm'}</span>
                    </span>
                  </div>
                </div>

                {/* Workbench Specific Component Panel */}
                <ErrorBoundary key={activeWorkbench.id} fallbackTitle={`${activeWorkbench.name} Error Recovery`}>
                  <div className="flex-1 min-h-0">
                    {/* Pass context updaters to workbench if needed */}
                    {React.isValidElement(activeWorkbench.component) 
                      ? React.cloneElement(activeWorkbench.component as React.ReactElement, { 
                          onParametricChange: (params: any) => console.log('Params updated:', params),
                          activeUnit: activeProject.unit
                        }) 
                      : activeWorkbench.component
                    }
                  </div>
                </ErrorBoundary>
              </div>

              {/* Right Panel: Authoritative 3D Engineering Viewport (The 'Disappearing' Display Fix) */}
              {/* Only show if studio is engineering-focused and workbench is not already a duplicate viewport */}
              {['collision_studio', 'cad_studio', 'assembly_studio', 'elements_studio', 'cam_studio', 'cae_studio', 'cfd_studio', 'reverse_studio', 'drone_studio', 'ecad_studio'].includes(activeStudio.id) && (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative min-h-[400px]">
                  <ErrorBoundary fallbackTitle="3D Engine Recovery">
                    <CadViewport3D 
                      activeProjectType={activeProject.type as any} 
                      activeUnit={activeProject.unit}
                      activeSolid={activeSolid}
                      assemblyComponents={assemblyComponents}
                      canonicalRenderData={canonicalDocument?.derived?.renderData}
                      droneCamResult={droneCamResult}
                    />
                  </ErrorBoundary>
                </div>
              )}
            </main>
          )}

          {/* Footer */}
          <footer className="border-t border-slate-800/80 py-3 px-6 text-center text-xs font-mono text-slate-500 bg-slate-950 mt-auto shrink-0">
            SECP Industrial OS Platform — Multi-Disciplinary CAD / CAM / CAE / PLM Engine with Sidebar Studio Navigation
          </footer>
        </div>
      </div>

      {/* Cloud Account Registration & Login Modal for ALL Emails */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white text-sm font-bold"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">SECP Platform Cloud Registration</h2>
                <p className="text-xs text-slate-400">Register or log in with any email address</p>
              </div>
            </div>

            {/* Auth Tab Switcher */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setAuthEmailTab('login')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  authTab === 'login' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Login Existing Account
              </button>
              <button
                onClick={() => setAuthEmailTab('register')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  authTab === 'register' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register New Email
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (authTab === 'register') {
                  signUpWithEmail(authEmail, authPass, authName);
                } else {
                  signInWithEmail(authEmail, authPass);
                }
                setShowAuthModal(false);
              }}
              className="space-y-4"
            >
              {authTab === 'register' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name / Engineer Name</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="e.g. Lead Designer"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email Address (Any Email)</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="oubetat.1@gmail.com"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
                <input
                  type="password"
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{authTab === 'register' ? 'Register Account & Enter' : 'Login & Sync Cloud'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    signInWithGoogle();
                    setShowAuthModal(false);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Sign In with Google Cloud</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
