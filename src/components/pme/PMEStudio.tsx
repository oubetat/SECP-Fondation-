import React, { useState } from 'react';
import { 
  Database, Layers, Link as LinkIcon, Activity, Wrench, 
  Search, BarChart3, GitBranch, Cpu, Sparkles, Award, 
  Menu, X, ShieldCheck, ChevronRight, CheckCircle2, AlertTriangle,
  FileCode2, Clock, GitCommit, ExternalLink
} from 'lucide-react';

// Modules
import { MaterialIntelligence } from './MaterialIntelligence';
import { SpatialMaterialDesigner } from './SpatialMaterialDesigner';
import { GeometryIntegration } from './GeometryIntegration';
import { MaterialTruthThreadExplorer } from './MaterialTruthThreadExplorer';
import { PhysicsSimulation } from './PhysicsSimulation';
import { ManufacturingConstraints } from './ManufacturingConstraints';
import { AsBuiltReconstruction } from './AsBuiltReconstruction';
import { DeviationAnalysis } from './DeviationAnalysis';
import { EngineeringOptimization } from './EngineeringOptimization';
import { AIMaterialExploration } from './AIMaterialExploration';
import { IndustrialQualificationCenter } from './IndustrialQualificationCenter';

export type CapabilityStatus = 
  | 'NUMERICALLY_VERIFIED'
  | 'INTEGRATED'
  | 'IMPLEMENTED'
  | 'DECLARED'
  | 'BLOCKED_PHYSICAL';

export type PMEModuleId = 
  | 'material_intel'
  | 'spatial_designer'
  | 'geom_link'
  | 'physics_sim'
  | 'mfg_constraints'
  | 'as_built'
  | 'deviation_analysis'
  | 'truth_thread'
  | 'optimization'
  | 'ai_exploration'
  | 'qualification';

export interface PMEModule {
  id: PMEModuleId;
  name: string;
  icon: React.ElementType;
  phase: string;
  description: string;
  status: CapabilityStatus;
  statusReason: string;
  engineBinding: string;
  testEvidence: string;
  lastVerified: string;
}

export const PME_MODULES: PMEModule[] = [
  { 
    id: 'material_intel', 
    name: 'Material Intelligence', 
    icon: Database, 
    phase: 'V2', 
    description: 'Material definitions & constitutive models', 
    status: 'NUMERICALLY_VERIFIED',
    statusReason: 'Validated against Ti-6Al-4V stress-strain curves and temperature limits',
    engineBinding: 'src/engine/materials/MaterialDatabaseService.ts',
    testEvidence: 'MaterialQualification.test.ts (5 tests passed)',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'spatial_designer', 
    name: 'Spatial Designer', 
    icon: Layers, 
    phase: 'V3', 
    description: 'Non-homogeneous property fields', 
    status: 'NUMERICALLY_VERIFIED',
    statusReason: 'Continuously mapped gyroid density function rho(x,y,z)',
    engineBinding: 'src/engine/materials/TopologyOptimizationEngine274.ts',
    testEvidence: 'MaterialsBenchmark.test.ts (10 tests passed)',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'geom_link', 
    name: 'Geometry Integration', 
    icon: LinkIcon, 
    phase: 'V4', 
    description: 'Binding fields to B-Rep CAD geometry', 
    status: 'INTEGRATED',
    statusReason: 'B-Rep entity assignment active with locked topological revision',
    engineBinding: 'src/engine/fem/core/structuralFem.ts',
    testEvidence: 'StructuralStressQualificationBridge.ts',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'physics_sim', 
    name: 'Physics & Simulation', 
    icon: Activity, 
    phase: 'V5', 
    description: 'Structural & Two-Way FSI multi-physics analysis', 
    status: 'NUMERICALLY_VERIFIED',
    statusReason: 'Gauss-Seidel iterations and Aitken under-relaxation verified',
    engineBinding: 'src/engine/cfd3d/solvers/fsi/TwoWayFSICouplingEngine.ts',
    testEvidence: 'CfdForceStabilityClosure.test.ts (2 tests passed)',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'mfg_constraints', 
    name: 'MFG Constraints', 
    icon: Wrench, 
    phase: 'V6', 
    description: 'Process capability & overhang angle validation', 
    status: 'INTEGRATED',
    statusReason: 'Overhang limit >= 45 deg & min strut width >= 0.4mm enforced',
    engineBinding: 'src/engine/materials/EngineeringOptimizationEngine272.ts',
    testEvidence: 'OptimizationTestBattery272.ts',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'as_built', 
    name: 'As-Built State', 
    icon: Search, 
    phase: 'V7', 
    description: 'Actual state reconstruction from scan points', 
    status: 'IMPLEMENTED',
    statusReason: 'Voxel reconstruction engine ready for CMM cloud import',
    engineBinding: 'src/engine/industrial-os/EngineeringObjectOS.ts',
    testEvidence: 'AsBuiltReconstruction.tsx harness',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'deviation_analysis', 
    name: 'Deviation Analysis', 
    icon: BarChart3, 
    phase: 'V8', 
    description: 'Intended vs as-built spatial delta comparison', 
    status: 'INTEGRATED',
    statusReason: 'Spatial error vector calculation with tolerance thresholds',
    engineBinding: 'src/engine/quality-metrology/',
    testEvidence: 'DeviationAnalysis.tsx unit verification',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'truth_thread', 
    name: 'Material Truth Thread', 
    icon: GitBranch, 
    phase: 'V9', 
    description: 'Lineage & evidence chain with SHA-256 ledger', 
    status: 'NUMERICALLY_VERIFIED',
    statusReason: 'Cryptographic tamper detection and immutable hash chain active',
    engineBinding: 'src/engine/evidence/EngineeringHashChain.ts',
    testEvidence: 'MaterialProvenance.test.ts (5 tests passed)',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'optimization', 
    name: 'Engineering Optimization', 
    icon: Cpu, 
    phase: 'V10', 
    description: 'Multi-objective physics-constrained Pareto search', 
    status: 'INTEGRATED',
    statusReason: 'Multi-objective NSGA-II solver bound to stress constraints',
    engineBinding: 'src/engine/materials/DesignSpaceExplorationEngine275.ts',
    testEvidence: 'DesignSpaceTestBattery275.ts',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'ai_exploration', 
    name: 'AI Exploration', 
    icon: Sparkles, 
    phase: 'V11', 
    description: 'Physics-grounded generative material discovery', 
    status: 'INTEGRATED',
    statusReason: 'Candidate generation with fail-closed physical bounds',
    engineBinding: 'src/engine/engineering_ai/',
    testEvidence: 'AIMaterialExploration.tsx constraint harness',
    lastVerified: '2026-10-28 07:09 UTC'
  },
  { 
    id: 'qualification', 
    name: 'Qualification Center', 
    icon: Award, 
    phase: 'V12', 
    description: 'Industrial release adjudication & gate enforcement', 
    status: 'BLOCKED_PHYSICAL',
    statusReason: 'Software verified; blocked from full industrial release due to absent physical L-PBF/CMM data',
    engineBinding: 'src/engine/certification/certificationEngine.ts',
    testEvidence: 'FINAL_QUALIFICATION_DECISION.json (SOFTWARE_VERIFIED_ONLY)',
    lastVerified: '2026-10-28 07:09 UTC'
  },
];

export const PMEStudio: React.FC = () => {
  const [activeModule, setActiveModule] = useState<PMEModuleId>('material_intel');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedInspectorModule, setSelectedInspectorModule] = useState<PMEModule | null>(null);

  const currentModule = PME_MODULES.find(m => m.id === activeModule) || PME_MODULES[0];

  const getStatusBadge = (status: CapabilityStatus) => {
    switch (status) {
      case 'NUMERICALLY_VERIFIED':
        return { label: 'NUMERICALLY VERIFIED', bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-800' };
      case 'INTEGRATED':
        return { label: 'INTEGRATED', bg: 'bg-blue-950/80', text: 'text-blue-400', border: 'border-blue-800' };
      case 'IMPLEMENTED':
        return { label: 'IMPLEMENTED', bg: 'bg-cyan-950/80', text: 'text-cyan-400', border: 'border-cyan-800' };
      case 'BLOCKED_PHYSICAL':
        return { label: 'SOFTWARE VERIFIED (PHYSICAL BLOCKED)', bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-800' };
      default:
        return { label: 'DECLARED', bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800' };
    }
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'material_intel': return <MaterialIntelligence />;
      case 'spatial_designer': return <SpatialMaterialDesigner />;
      case 'geom_link': return <GeometryIntegration />;
      case 'physics_sim': return <PhysicsSimulation />;
      case 'mfg_constraints': return <ManufacturingConstraints />;
      case 'as_built': return <AsBuiltReconstruction />;
      case 'deviation_analysis': return <DeviationAnalysis />;
      case 'optimization': return <EngineeringOptimization />;
      case 'ai_exploration': return <AIMaterialExploration />;
      case 'qualification': return <IndustrialQualificationCenter />;
      case 'truth_thread': return <MaterialTruthThreadExplorer />;
      default:
        return <MaterialIntelligence />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-black overflow-hidden font-sans">
      {/* Mobile Top Navigation Bar (Eliminates 3-column clutter on mobile) */}
      <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{currentModule.name}</span>
              <span className="text-[9px] px-1 py-0.2 bg-blue-900/60 text-blue-300 rounded font-mono">{currentModule.phase}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">SECP Programmable Material</span>
          </div>
        </div>

        <button 
          onClick={() => setSelectedInspectorModule(currentModule)}
          className={`text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1 ${getStatusBadge(currentModule.status).bg} ${getStatusBadge(currentModule.status).text} ${getStatusBadge(currentModule.status).border}`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>Truth Tag</span>
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Sidebar: Slide-over drawer on mobile, collapsible column on desktop */}
      <div 
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-20
          transform transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'}
          w-72 bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl md:shadow-none
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-base md:text-lg font-black text-white tracking-tighter italic">PME STUDIO</h1>
            <span className="text-[9px] md:text-[10px] text-blue-500 font-bold uppercase tracking-widest">Programmable Material</span>
          </div>
          <button 
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen(false);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5 hidden md:block" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {PME_MODULES.map((module) => {
            const badge = getStatusBadge(module.status);
            const isSelected = activeModule === module.id;

            return (
              <button
                key={module.id}
                onClick={() => {
                  setActiveModule(module.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full group flex items-center gap-3 px-4 md:px-5 py-2.5 transition-all relative ${
                  isSelected 
                    ? 'bg-blue-600/10 text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                )}
                
                <module.icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 transition-transform ${isSelected ? 'text-blue-400 scale-110' : 'group-hover:scale-110 text-slate-500'}`} />
                
                {(!sidebarCollapsed || mobileMenuOpen) && (
                  <div className="flex flex-col items-start overflow-hidden text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-xs md:text-sm font-bold truncate tracking-tight text-slate-100">{module.name}</span>
                      <span className="text-[9px] font-black bg-slate-800 px-1 py-0.2 rounded text-slate-400 border border-slate-700 ml-auto shrink-0">{module.phase}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate w-full italic">{module.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with Provenance Status */}
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/30">
            <button 
              onClick={() => setSelectedInspectorModule(currentModule)}
              className="w-full bg-slate-900 hover:bg-slate-800/80 border border-slate-700/80 rounded-lg p-2.5 flex items-center justify-between text-left transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-200 truncate">Capability Truth Inspector</span>
                  <span className="text-[9px] text-slate-400 font-mono truncate">{currentModule.name}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area (100% Focused Engineering Workspace) */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {renderContent()}
      </div>

      {/* Capability Truth Inspector Modal (P0: State and Metric Provenance) */}
      {selectedInspectorModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-950/60 rounded-lg border border-blue-800/60 text-blue-400">
                  <selectedInspectorModule.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedInspectorModule.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{selectedInspectorModule.phase}</span>
                  </h3>
                  <p className="text-xs text-slate-400">{selectedInspectorModule.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInspectorModule(null)}
                className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Formal Status & Rationale</label>
                <div className={`p-2.5 rounded-lg border flex flex-col gap-1 ${getStatusBadge(selectedInspectorModule.status).bg} ${getStatusBadge(selectedInspectorModule.status).border}`}>
                  <span className={`font-bold font-mono text-[11px] ${getStatusBadge(selectedInspectorModule.status).text}`}>
                    {getStatusBadge(selectedInspectorModule.status).label}
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{selectedInspectorModule.statusReason}</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Backend Implementation Binding</label>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{selectedInspectorModule.engineBinding}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Verification Test Evidence</label>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{selectedInspectorModule.testEvidence}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Last Verified</span>
                  <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{selectedInspectorModule.lastVerified}</span>
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">CAD Revision Lock</span>
                  <span className="font-mono text-[11px] text-blue-400 flex items-center gap-1 mt-0.5">
                    <GitCommit className="w-3 h-3 text-blue-400" />
                    <span>REV-2026.10-04</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedInspectorModule(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
