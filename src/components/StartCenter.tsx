import React, { useState } from 'react';
import {
  FolderPlus,
  FolderOpen,
  Box,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Wrench,
  Gauge,
  Activity,
  FileCode,
  Clock,
  Trash2,
  Copy,
  CheckCircle2,
  Plus,
  AlertTriangle
} from 'lucide-react';
import {
  OFFICIAL_DEMONSTRATIONS,
  DemonstrationProjectSpec,
  NewProjectInput,
  EngineeringProjectType,
  ProjectMetadata
} from '../engine/session/ProjectSession';
import { ProductRecord } from '../engine/projectStorage';

interface StartCenterProps {
  onNewProject?: (input: NewProjectInput) => void;
  onCreateNewProject?: (input: NewProjectInput) => void;
  onLoadDemo?: (demoId: string) => void;
  onOpenProject?: (demoId: string) => void;
  onForkDemo?: (demoId: string, input: { name: string; projectNumber: string; description?: string }) => void;
  onOpenProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  existingProducts?: ProductRecord[];
  activeProjectMetadata?: ProjectMetadata | null;
  onImportFile?: (file: File) => void;
}

export const StartCenter: React.FC<StartCenterProps> = ({
  onNewProject,
  onCreateNewProject,
  onLoadDemo,
  onOpenProject,
  onForkDemo,
  onOpenProduct,
  onDeleteProduct,
  existingProducts = [],
  activeProjectMetadata,
  onImportFile
}) => {
  const safeProducts = existingProducts || [];
  const [showNewModal, setShowNewModal] = useState(false);
  
  // New Project Form State
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [newType, setNewType] = useState<EngineeringProjectType>('PART');
  const [newUnit, setNewUnit] = useState<string>('mm');
  const [newDesc, setNewDesc] = useState('');

  // Fork Modal State
  const [showForkModal, setShowForkModal] = useState<string | null>(null);
  const [forkName, setForkName] = useState('');
  const [forkNumber, setForkNumber] = useState('');

  // Deletion Confirmation state
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const projectTypes: { type: EngineeringProjectType; label: string; desc: string; icon: React.FC<any> }[] = [
    { type: 'PART', label: 'Single Solid Part', desc: 'Precision B-Rep feature modeling & 2D sketching', icon: Box },
    { type: 'ASSEMBLY', label: 'Mechanical Assembly', desc: 'Multi-body constraints, kinematic mates & BOM', icon: Layers },
    { type: 'GENERAL_MECHANICAL', label: 'General Mechanical', desc: 'Full engineering workbench with multi-discipline tools', icon: Cpu },
    { type: 'SHEET_METAL', label: 'Sheet Metal Enclosure', desc: 'Bending parameters, K-factor & flat pattern export', icon: Wrench },
    { type: 'FLUID_SYSTEM', label: 'Fluid & Pressure Systems', desc: 'Valves, manifolds, pressure vessels & sealing', icon: Activity },
    { type: 'MANUFACTURING', label: 'CAM & CNC Machining', desc: 'Multi-axis toolpath generation, G-code & provenance', icon: Gauge },
    { type: 'BLANK', label: 'Blank Slate (Clean 3D)', desc: 'Unconstrained clean coordinate system with zero geometry', icon: FileCode }
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const payload: NewProjectInput = {
      name: newName.trim(),
      projectNumber: newNumber.trim() || 'PRJ-001',
      type: newType,
      unit: newUnit,
      description: newDesc.trim()
    };
    if (onNewProject) {
      onNewProject(payload);
    } else if (onCreateNewProject) {
      onCreateNewProject(payload);
    }
    setShowNewModal(false);
  };

  const handleLoadDemo = (demoId: string) => {
    if (onLoadDemo) {
      onLoadDemo(demoId);
    } else if (onOpenProject) {
      onOpenProject(demoId);
    }
  };

  const handleForkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showForkModal || !forkName.trim()) return;
    if (onForkDemo) {
      onForkDemo(showForkModal, {
        name: forkName.trim(),
        projectNumber: forkNumber.trim() || `FORK-${Math.floor(100 + Math.random() * 900)}`,
        description: `Derived user project from reference template.`
      });
    }
    setShowForkModal(null);
  };

  const confirmDelete = () => {
    if (deleteConfirmationId && onDeleteProduct) {
      onDeleteProduct(deleteConfirmationId);
    }
    setDeleteConfirmationId(null);
  };

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col items-center justify-start overflow-y-auto">
      <div className="w-full max-w-6xl flex flex-col gap-8">
        
        {/* Header Hero */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-400">
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-wider uppercase font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                  SECP CAD OS v2.0
                </span>
                <span className="text-[10px] tracking-wider uppercase font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Zero-Leakage Clean Session
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
                Project Start Center
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Select an engineering discipline to begin an isolated project, open a saved workspace, or inspect official industrial benchmark demonstrations.
              </p>
            </div>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setNewName('');
                setNewNumber(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                setShowNewModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-medium text-sm transition cursor-pointer active:scale-[0.98]">
              <FolderOpen className="w-4 h-4 text-slate-400" />
              Import File
              <input
                type="file"
                accept=".json,.secp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onImportFile) onImportFile(file);
                }}
              />
            </label>
          </div>
        </div>

        {/* Current Active Project Banner (if open) */}
        {activeProjectMetadata && (
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold">
                {activeProjectMetadata.type.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-blue-400 font-bold">{activeProjectMetadata.projectNumber}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                    activeProjectMetadata.kind === 'DEMONSTRATION'
                      ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  }`}>
                    {activeProjectMetadata.kind === 'DEMONSTRATION' ? 'Reference Demo' : 'User Project'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">{activeProjectMetadata.name}</h3>
                <p className="text-xs text-slate-400">{activeProjectMetadata.description || 'Active workspace session loaded.'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
                Unit: {activeProjectMetadata.unit}
              </span>
            </div>
          </div>
        )}

        {/* SECTION 1: Registered Official Reference Project (Drone Highlight) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Primary Reference Assembly
            </h2>
          </div>
          
          <div 
            onClick={() => handleLoadDemo('demo-industrial-drone')}
            className="group relative bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/20 hover:border-amber-500/40 p-6 rounded-3xl cursor-pointer transition-all duration-300 shadow-xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Box className="w-40 h-40 text-amber-400 -rotate-12 translate-x-10 -translate-y-10" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50 uppercase tracking-widest">
                    Production Reference
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    1,200+ PARTS
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">Industrial Hexacopter Drone Assembly</h3>
                <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                  Full aerospace reference project integrating CAD, CAM, CFD, and FEA. This is a registered benchmark assembly for structural and kinematic validation.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {['Aerospace B-Rep', '5-Axis CAM', 'CFD Rotor', 'BOM Master'].map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-1 bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700/50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <button className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-all shadow-lg shadow-amber-600/20">
                  Open Reference Project
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Saved User Projects (Registered Projects) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Registered User Projects ({safeProducts.length})
            </h2>
          </div>

          {safeProducts.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/60 border-dashed rounded-3xl p-10 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div className="text-sm text-slate-400">No registered custom projects found in this session.</div>
              <button 
                onClick={() => setShowNewModal(true)}
                className="text-blue-400 text-xs font-bold hover:underline"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeProducts.map((p) => (
                <div
                  key={p.id}
                  className="group flex flex-col p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition duration-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 group-hover:bg-blue-600/10 transition font-bold">
                      {p.type?.charAt(0) || 'P'}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenProduct && onOpenProduct(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white text-[11px] font-bold transition"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteConfirmationId(p.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate mb-1">{p.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate mb-3">
                    ID: {p.projectNumber || 'PRJ-UNK'} • {p.unit || 'mm'}
                  </p>
                  <div className="mt-auto pt-3 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-600">
                    <span className="font-mono">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Active'}</span>
                    <span className="uppercase tracking-tighter font-bold">{p.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: Create by Discipline (Quick Starters) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-blue-400" />
              Quick Workspace Templates
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectTypes.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    setNewType(item.type);
                    setNewName(`Untitled ${item.label}`);
                    setNewNumber(`PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
                    setShowNewModal(true);
                  }}
                  className="group flex flex-col text-left p-4 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-blue-600/10 text-slate-400 group-hover:text-blue-400 transition">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white group-hover:text-blue-300 transition">{item.label}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{item.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODAL: Create New Project */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                Create New Engineering Project
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Precision Planetary Gearbox"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Project Number / Code</label>
                  <input
                    type="text"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Base Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="mm">Millimeters (mm)</option>
                    <option value="m">Meters (m)</option>
                    <option value="in">Inches (in)</option>
                    <option value="ft">Feet (ft)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Engineering Discipline</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EngineeringProjectType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {projectTypes.map((pt) => (
                    <option key={pt.type} value={pt.type}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Design objectives, tolerances, and design constraints..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20"
                >
                  Initialize Clean Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmation Deletion (Confirmation Modal) */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-3xl w-full max-w-sm p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Confirm Project Deletion</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to permanently delete this project? All associated engineering data will be removed from this session.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmationId(null)}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Fork Reference Project */}
      {showForkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-400" />
              Fork Reference Project as New
            </h3>
            <p className="text-xs text-slate-400">
              This will generate an independent, user-owned project with unique document identifiers and full editing permissions.
            </p>

            <form onSubmit={handleForkSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">New Project Name *</label>
                <input
                  type="text"
                  required
                  value={forkName}
                  onChange={(e) => setForkName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">New Project Number</label>
                <input
                  type="text"
                  value={forkNumber}
                  onChange={(e) => setForkNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForkModal(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
                >
                  Create Fork
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
