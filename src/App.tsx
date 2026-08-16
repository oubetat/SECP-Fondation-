import React, { useState, useRef } from 'react';
import { CadViewport3D } from './components/CadViewport3D';
import { UnitEnginePanel } from './components/UnitEnginePanel';
import { GeometryKernelPanel } from './components/GeometryKernelPanel';
import { ParametricModelingPanel } from './components/ParametricModelingPanel';
import { SketcherPanel } from './components/SketcherPanel';
import { FeatureTreePanel } from './components/FeatureTreePanel';
import { AssemblyEnginePanel } from './components/AssemblyEnginePanel';
import { MaterialsPanel } from './components/MaterialsPanel';
import { EngineeringCorePanel } from './components/EngineeringCorePanel';
import { KinematicsPanel } from './components/KinematicsPanel';
import { ElectricalWorkbenchPanel } from './components/ElectricalWorkbenchPanel';
import { PcbWorkbenchPanel } from './components/PcbWorkbenchPanel';
import { FluidPowerPanel } from './components/FluidPowerPanel';
import { SimulationCaePanel } from './components/SimulationCaePanel';
import { CaeCfdPanel } from './components/CaeCfdPanel';
import { BomPanel } from './components/BomPanel';
import { CamPanel } from './components/CamPanel';
import { TechnicalDrawingPanel } from './components/TechnicalDrawingPanel';
import { ProvenancePanel } from './components/ProvenancePanel';
import { DigitalTwinPanel } from './components/DigitalTwinPanel';
import { AiCopilotPanel } from './components/AiCopilotPanel';
import { GenerativeDesignPanel } from './components/GenerativeDesignPanel';
import { PluginSdkPanel } from './components/PluginSdkPanel';
import { CloudCollaborationPanel } from './components/CloudCollaborationPanel';
import { MarketplacePanel } from './components/MarketplacePanel';
import { CertificationPanel } from './components/CertificationPanel';
import { IndustrialOsPanel } from './components/IndustrialOsPanel';
import { MvpArchitecturePanel } from './components/MvpArchitecturePanel';
import { TestRunnerPanel } from './components/TestRunnerPanel';
import { CadKernelInspector } from './components/CadKernelInspector';
import { NextGen3dEnginePanel } from './components/NextGen3dEnginePanel';
import { AdvancedKinematicsPanel } from './components/AdvancedKinematicsPanel';
import { InteractiveEngineeringWorkbench } from './components/InteractiveEngineeringWorkbench';
import { EnterprisePLMPanel } from './components/EnterprisePLMPanel';
import { CadGeometryKernel, CadSolidEntity } from './engine/cadKernel';
import { AssemblyEngine, AssemblyComponentItem } from './engine/assembly';
import { ProjectStorageEngine, SecpCadProjectData } from './engine/projectStorage';
import { ParametricEngine } from './engine/parametric';
import { FeatureTreeEngine } from './engine/featureTree';
import { GeometryKernelManager } from './engine/geometry/GeometryKernelManager';
import { motion, AnimatePresence } from 'motion/react';
import {
  Box,
  Ruler,
  Cpu,
  Sliders,
  Edit3,
  GitMerge,
  Layers3,
  CheckCircle2,
  Database,
  Activity,
  Terminal,
  Layers,
  ChevronRight,
  ShieldCheck,
  Save,
  FolderOpen,
  Download,
  Upload,
  RefreshCw,
  Server
} from 'lucide-react';

export function App() {
  const [activePatchTab, setActivePatchTab] = useState<
    | 'PATCH-001'
    | 'PATCH-002'
    | 'PATCH-003'
    | 'PATCH-004'
    | 'PATCH-005'
    | 'PATCH-006'
    | 'PATCH-007'
    | 'PATCH-008'
    | 'PATCH-009'
    | 'PATCH-010'
    | 'PATCH-011'
    | 'PATCH-012'
    | 'PATCH-013'
    | 'PATCH-014'
    | 'PATCH-015'
    | 'PATCH-018'
    | 'PATCH-019'
    | 'PATCH-020'
    | 'PATCH-021'
    | 'PATCH-022'
    | 'PATCH-023'
    | 'PATCH-024'
    | 'PATCH-025'
    | 'PATCH-026'
    | 'PATCH-027'
    | 'PATCH-028'
    | 'PATCH-029'
    | 'PATCH-030'
    | 'PATCH-031'
    | 'PATCH-043'
    | 'PATCH-044'
    | 'PATCH-045'
    | 'PATCH-084'
    | 'PATCH-088'
    | 'MVP-ARCH'
    | 'TEST-RUNNER'
  >('PATCH-084');

  const [activeUnit, setActiveUnit] = useState<string>('mm');
  const [activeSolid, setActiveSolid] = useState<CadSolidEntity>(() => CadGeometryKernel.createBox(250, 150, 100));
  const [assemblyData, setAssemblyData] = useState(() => AssemblyEngine.createDefaultEngineAssembly());
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [selectedEntityName, setSelectedEntityName] = useState<string>('Main Base Solid');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  React.useEffect(() => {
    GeometryKernelManager.getKernel().catch(err => {
      console.error('Initial CAD Kernel load failed:', err);
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const patches = [
    { id: 'PATCH-001', name: 'Domain Model', icon: Database, color: 'text-blue-400' },
    { id: 'PATCH-002', name: 'Unit Engine', icon: Ruler, color: 'text-emerald-400' },
    { id: 'PATCH-003', name: 'Geometry Kernel', icon: Cpu, color: 'text-cyan-400' },
    { id: 'PATCH-004', name: '3D Viewport', icon: Layers, color: 'text-amber-400' },
    { id: 'PATCH-005', name: 'Parametric', icon: Sliders, color: 'text-indigo-400' },
    { id: 'PATCH-006', name: '2D Sketcher', icon: Edit3, color: 'text-emerald-400' },
    { id: 'PATCH-007', name: 'Feature Tree', icon: GitMerge, color: 'text-purple-400' },
    { id: 'PATCH-008', name: 'Assembly Engine', icon: Layers3, color: 'text-amber-400' },
    { id: 'PATCH-009', name: 'Materials', icon: Layers, color: 'text-indigo-400' },
    { id: 'PATCH-010', name: 'Eng Calculations', icon: Activity, color: 'text-cyan-400' },
    { id: 'PATCH-011', name: 'Kinematics', icon: RefreshCw, color: 'text-emerald-400' },
    { id: 'PATCH-012', name: 'Electrical', icon: Terminal, color: 'text-amber-400' },
    { id: 'PATCH-013', name: 'Electronics / PCB', icon: Cpu, color: 'text-indigo-400' },
    { id: 'PATCH-014', name: 'Hydraulics', icon: Activity, color: 'text-cyan-400' },
    { id: 'PATCH-015', name: 'Simulation FEA', icon: Layers, color: 'text-purple-400' },
    { id: 'PATCH-018', name: 'CFD Fluid Flow', icon: Activity, color: 'text-cyan-400' },
    { id: 'PATCH-019', name: 'BOM Engine', icon: Database, color: 'text-amber-400' },
    { id: 'PATCH-020', name: 'Manufacturing / CAM', icon: Cpu, color: 'text-rose-400' },
    { id: 'PATCH-021', name: '2D Technical Drawing', icon: Edit3, color: 'text-sky-400' },
    { id: 'PATCH-022', name: 'Versioning Provenance', icon: GitMerge, color: 'text-emerald-400' },
    { id: 'PATCH-023', name: 'Digital Twin', icon: Activity, color: 'text-cyan-400' },
    { id: 'PATCH-024', name: 'AI Copilot', icon: Cpu, color: 'text-indigo-400' },
    { id: 'PATCH-025', name: 'Generative Design', icon: Sliders, color: 'text-amber-400' },
    { id: 'PATCH-026', name: 'Plugin SDK', icon: Layers, color: 'text-emerald-400' },
    { id: 'PATCH-027', name: 'Cloud Collab', icon: CheckCircle2, color: 'text-sky-400' },
    { id: 'PATCH-028', name: 'Marketplace', icon: Database, color: 'text-purple-400' },
    { id: 'PATCH-029', name: 'Certification', icon: ShieldCheck, color: 'text-emerald-400' },
    { id: 'PATCH-030', name: 'Industrial OS', icon: Layers, color: 'text-cyan-400' },
    { id: 'PATCH-031', name: 'Next-Gen 3D Engine', icon: Layers, color: 'text-violet-400' },
    { id: 'PATCH-043', name: 'Assembly Constraints & Kinematics', icon: Layers3, color: 'text-amber-400' },
    { id: 'PATCH-044', name: '2D Technical Drawing Engine', icon: Edit3, color: 'text-sky-400' },
    { id: 'PATCH-045', name: 'Advanced Assembly & Kinematics', icon: Activity, color: 'text-amber-400' },
    { id: 'PATCH-084', name: 'Production Integration Workbench', icon: Cpu, color: 'text-cyan-400' },
    { id: 'PATCH-088', name: 'Enterprise PLM & ECO System', icon: ShieldCheck, color: 'text-emerald-400' },
    { id: 'MVP-ARCH', name: 'MVP Infrastructure', icon: Server, color: 'text-sky-400' },
    { id: 'TEST-RUNNER', name: 'Tests & Regression', icon: ShieldCheck, color: 'text-emerald-400' },
  ];

  const handleSaveProject = () => {
    const project: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-secp-v01',
      projectName: 'SECP CAD Engine v0.1 Machine',
      unit: activeUnit,
      updatedAt: new Date().toISOString(),
      parameters: ParametricEngine.getInitialMachineParameters(),
      constraints: ParametricEngine.getInitialConstraints(),
      featureTree: FeatureTreeEngine.getInitialTree(),
      activeSolid,
      assemblyComponents: assemblyData.components,
      assemblyMates: assemblyData.mates,
    };
    ProjectStorageEngine.saveToLocalStorage(project);
    setSaveMessage('Project saved to LocalStorage!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleLoadProject = () => {
    const loaded = ProjectStorageEngine.loadFromLocalStorage();
    if (loaded) {
      if (loaded.activeSolid) setActiveSolid(loaded.activeSolid);
      if (loaded.unit) setActiveUnit(loaded.unit);
      if (loaded.assemblyComponents) {
        setAssemblyData(prev => ({ ...prev, components: loaded.assemblyComponents }));
      }
      setSaveMessage('Project restored from LocalStorage!');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage('No saved project found in LocalStorage');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleExportJson = () => {
    const project: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-secp-v01',
      projectName: 'SECP CAD Engine v0.1 Machine',
      unit: activeUnit,
      updatedAt: new Date().toISOString(),
      parameters: ParametricEngine.getInitialMachineParameters(),
      constraints: ParametricEngine.getInitialConstraints(),
      featureTree: FeatureTreeEngine.getInitialTree(),
      activeSolid,
      assemblyComponents: assemblyData.components,
      assemblyMates: assemblyData.mates,
    };
    const json = ProjectStorageEngine.exportProjectJson(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secp_cad_project_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = ProjectStorageEngine.importProjectJson(text);
        if (imported.activeSolid) setActiveSolid(imported.activeSolid);
        if (imported.unit) setActiveUnit(imported.unit);
        if (imported.assemblyComponents) {
          setAssemblyData(prev => ({ ...prev, components: imported.assemblyComponents }));
        }
        setSaveMessage('Project JSON imported successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (err: any) {
        alert('Failed to import project file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Platform Header */}
      <header className="h-14 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              SECP — Spatial Engineering CAD
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                v0.1-CORE
              </span>
            </h1>
          </div>
        </div>

        {/* Project Actions */}
        <div className="flex items-center gap-2">
          {saveMessage && (
            <motion.span 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-emerald-400 font-mono text-[10px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded"
            >
              {saveMessage}
            </motion.span>
          )}

          <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              onClick={handleSaveProject}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors rounded-md"
              title="Save Project"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleLoadProject}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors rounded-md"
              title="Load Project"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1" />
            <button
              onClick={handleExportJson}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors rounded-md"
              title="Export JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors rounded-md"
              title="Import JSON"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Professional Sidebar Navigation */}
        <aside className="w-64 bg-slate-900/30 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engineering Patches</span>
          </div>
          <nav className="p-2 space-y-0.5">
            {patches.map(p => {
              const Icon = p.icon;
              const isActive = activePatchTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePatchTab(p.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? p.color : 'text-slate-500'}`} />
                  <div className="flex flex-col items-start truncate">
                    <span className="font-bold">{p.id}</span>
                    <span className="text-[10px] opacity-60 truncate">{p.name}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

          {/* Top 3D WebGL Viewport */}
          <div className="h-2/3 border-b border-slate-800 relative z-10">
            <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
              <div className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-tight">Active Viewport</span>
              </div>
            </div>
            
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded text-[10px] text-slate-400 font-mono">
                FPS: 60 | Tris: 14.2k
              </div>
            </div>

            <CadViewport3D
              activeSolid={activeSolid}
              assemblyComponents={activePatchTab === 'PATCH-008' ? assemblyData.components : undefined}
              explodedFactor={explodedFactor}
              activeUnit={activeUnit}
              onSelectComponent={name => setSelectedEntityName(name)}
            />
          </div>

          {/* Interactive Control Panel */}
          <div className="flex-1 overflow-y-auto p-6 relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePatchTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activePatchTab === 'PATCH-001' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
                    <div className="border-b border-slate-800 pb-4">
                      <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                        <Database className="w-5 h-5" /> PATCH-SECP-001 — Engineering Domain Model
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        PostgreSQL Metadata Storage + S3 Object Vault 3D Geometry reference separation rule.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <span className="text-blue-400 font-bold uppercase">PostgreSQL Database</span>
                        <p className="text-slate-400 font-sans text-xs">
                          Stores Project, Product, Assembly, Part Metadata, Parameters, Features, Constraints, Materials & Revisions.
                        </p>
                        <span className="text-emerald-400 font-bold text-[11px]">✓ No Geometry BLOBs in SQL</span>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <span className="text-amber-400 font-bold uppercase">Object Storage Vault</span>
                        <p className="text-slate-400 font-sans text-xs">
                          Stores heavy STEP files, B-Rep topology streams, STL meshes & G-Code binaries via <code className="text-slate-200">geometryRef</code> URIs.
                        </p>
                        <span className="text-amber-300 font-bold text-[11px]">s3://secp-vault/part-001.step</span>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <span className="text-indigo-400 font-bold uppercase">Domain Entities</span>
                        <p className="text-slate-400 font-sans text-xs">
                          Project, Product, Assembly, Part, Feature, Parameter, Constraint, Material, Revision, Simulation, ManufacturingProcess.
                        </p>
                        <span className="text-indigo-300 font-bold text-[11px]">13 Core Domain Types Verified</span>
                      </div>
                    </div>
                  </div>
                )}

          {activePatchTab === 'PATCH-002' && (
            <UnitEnginePanel activeUnit={activeUnit} onActiveUnitChange={u => setActiveUnit(u)} />
          )}

          {activePatchTab === 'PATCH-003' && (
            <GeometryKernelPanel activeSolid={activeSolid} onSolidChange={s => setActiveSolid(s)} activeUnit={activeUnit} />
          )}

          {activePatchTab === 'PATCH-004' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Layers className="w-5 h-5" /> PATCH-SECP-004 — 3D Visualization Engine
              </h2>
              <p className="text-xs text-slate-400">
                Full 3D WebGL Viewport with Orbit, Pan, Zoom, Section Cutting Plane & Euclidean Distance Measurement Tool active above.
              </p>
            </div>
          )}

          {activePatchTab === 'PATCH-005' && (
            <ParametricModelingPanel onSolidUpdate={s => setActiveSolid(s)} activeUnit={activeUnit} />
          )}

          {activePatchTab === 'PATCH-006' && (
            <SketcherPanel onExtrudeSolid={s => setActiveSolid(s)} activeUnit={activeUnit} />
          )}

          {activePatchTab === 'PATCH-007' && (
            <FeatureTreePanel onSelectFeatureSolid={s => setActiveSolid(s)} />
          )}

          {activePatchTab === 'PATCH-008' && (
            <AssemblyEnginePanel
              onAssemblyComponentsChange={comps => setAssemblyData({ ...assemblyData, components: comps })}
              explodedFactor={explodedFactor}
              onExplodedFactorChange={f => setExplodedFactor(f)}
              activeUnit={activeUnit}
            />
          )}

          {activePatchTab === 'PATCH-009' && (
            <MaterialsPanel />
          )}

          {activePatchTab === 'PATCH-010' && (
            <EngineeringCorePanel />
          )}

          {activePatchTab === 'PATCH-011' && (
            <KinematicsPanel />
          )}

          {activePatchTab === 'PATCH-012' && (
            <ElectricalWorkbenchPanel />
          )}

          {activePatchTab === 'PATCH-013' && (
            <PcbWorkbenchPanel />
          )}

          {activePatchTab === 'PATCH-014' && (
            <FluidPowerPanel />
          )}

          {activePatchTab === 'PATCH-015' && (
            <SimulationCaePanel />
          )}

          {activePatchTab === 'PATCH-018' && (
            <CaeCfdPanel />
          )}

          {activePatchTab === 'PATCH-019' && (
            <BomPanel />
          )}

          {activePatchTab === 'PATCH-020' && (
            <CamPanel />
          )}

          {activePatchTab === 'PATCH-021' && (
            <TechnicalDrawingPanel />
          )}

          {activePatchTab === 'PATCH-022' && (
            <ProvenancePanel />
          )}

          {activePatchTab === 'PATCH-023' && (
            <DigitalTwinPanel />
          )}

          {activePatchTab === 'PATCH-024' && (
            <AiCopilotPanel onApplySolidToViewport={(solid) => setActiveSolid(solid)} />
          )}

          {activePatchTab === 'PATCH-025' && (
            <GenerativeDesignPanel />
          )}

          {activePatchTab === 'PATCH-026' && (
            <PluginSdkPanel />
          )}

          {activePatchTab === 'PATCH-027' && (
            <CloudCollaborationPanel />
          )}

          {activePatchTab === 'PATCH-028' && (
            <MarketplacePanel />
          )}

          {activePatchTab === 'PATCH-029' && (
            <CertificationPanel />
          )}

          {activePatchTab === 'PATCH-030' && (
            <IndustrialOsPanel />
          )}

          {activePatchTab === 'PATCH-031' && (
            <NextGen3dEnginePanel />
          )}

          {activePatchTab === 'PATCH-043' && (
            <AssemblyEnginePanel
              onAssemblyComponentsChange={comps => setAssemblyData({ ...assemblyData, components: comps })}
              explodedFactor={explodedFactor}
              onExplodedFactorChange={f => setExplodedFactor(f)}
              activeUnit={activeUnit}
            />
          )}

          {activePatchTab === 'PATCH-044' && (
            <TechnicalDrawingPanel />
          )}

          {activePatchTab === 'PATCH-045' && (
            <AdvancedKinematicsPanel activeUnit={activeUnit} />
          )}

          {activePatchTab === 'PATCH-084' && (
            <InteractiveEngineeringWorkbench />
          )}

          {activePatchTab === 'PATCH-088' && (
            <div className="space-y-6">
              <EnterprisePLMPanel />
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400 text-xs italic">
                The Enterprise PLM system provides the orchestration layer for the entire engineering thread. 
                Use the buttons above to initialize the environment and execute a full ECO (Engineering Change Order) scenario 
                that ripples through CAD, Assembly, BOM, CAM, and Simulation.
              </div>
            </div>
          )}

          {activePatchTab === 'MVP-ARCH' && (
            <MvpArchitecturePanel />
          )}

          {activePatchTab === 'TEST-RUNNER' && (
            <div className="space-y-6">
              <TestRunnerPanel />
              <CadKernelInspector />
            </div>
          )}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Footer Status */}
      <footer className="h-8 border-t border-slate-800 bg-slate-900 px-6 text-[10px] text-slate-500 flex items-center justify-between font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Kernel: SECP_CORE_V1</span>
          <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-blue-500" /> GPU: ACCELERATED</span>
        </div>
        <span className="text-slate-400">Selection: {selectedEntityName || 'None'}</span>
      </footer>
    </div>
  );
}

export default App;

