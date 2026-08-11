import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Cpu,
  Layers,
  Box,
  Plus,
  Save,
  FolderOpen,
  Download,
  Upload,
  Play,
  CheckCircle2,
  Activity,
  HardDrive,
  Globe,
  Radio,
  Sliders,
  FileCode2,
  Terminal,
  Clock,
  Sparkles,
  GitBranch,
  Wrench,
  Check,
} from 'lucide-react';
import {
  MvpArchitectureEngine,
  SecpProject,
  SecpPart,
  ComputeJob,
  InfrastructureHealth,
} from '../engine/mvpArchitectureEngine';
import { CadGeometryKernel, CadSolidEntity } from '../engine/cadKernel';
import { AssemblyEngine, AssemblyComponentItem } from '../engine/assembly';

export const MvpArchitecturePanel: React.FC = () => {
  const [infraStatus, setInfraStatus] = useState<InfrastructureHealth>(() =>
    MvpArchitectureEngine.getInfrastructureStatus()
  );

  const [projects, setProjects] = useState<SecpProject[]>(() => MvpArchitectureEngine.listProjects());
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || 'PRJ-SECP-001');

  const [parts, setParts] = useState<SecpPart[]>(() =>
    MvpArchitectureEngine.getPartsForProject(activeProjectId)
  );

  const [activePartId, setActivePartId] = useState<string>(parts[0]?.id || '');

  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [newPartType, setNewPartType] = useState<'BOX' | 'CYLINDER' | 'FLANGE'>('FLANGE');
  const [partRadius, setPartRadius] = useState<number>(120);
  const [partHeight, setPartHeight] = useState<number>(30);

  // 3D Viewport Controls State
  const [viewMode, setViewMode] = useState<'SHADED' | 'WIREFRAME' | 'NODES'>('SHADED');
  const [explodedOffset, setExplodedOffset] = useState<number>(0);

  // STEP File State
  const [stepDataString, setStepDataString] = useState<string>('');
  const [stepNotification, setStepNotification] = useState<string>('');

  // C++ CAD Kernel Execution State
  const [cppLog, setCppLog] = useState<string[]>([]);
  const [cppExecutionTime, setCppExecutionTime] = useState<number | null>(null);

  // Compute Jobs State
  const [jobs, setJobs] = useState<ComputeJob[]>(() => MvpArchitectureEngine.listComputeJobs());

  useEffect(() => {
    setParts(MvpArchitectureEngine.getPartsForProject(activeProjectId));
  }, [activeProjectId]);

  const activePart = parts.find(p => p.id === activePartId) || parts[0];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const prj = MvpArchitectureEngine.createProject(newProjectName, 'New SECP Assembly Project', 'mm');
    setProjects(MvpArchitectureEngine.listProjects());
    setActiveProjectId(prj.id);
    setNewProjectName('');
  };

  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;

    const newPart = MvpArchitectureEngine.createPart(
      activeProjectId,
      newPartName,
      newPartType,
      'Titanium Ti-6Al-4V',
      { radiusMm: partRadius, heightMm: partHeight, widthMm: 200, depthMm: 150 }
    );

    const updatedParts = MvpArchitectureEngine.getPartsForProject(activeProjectId);
    setParts(updatedParts);
    setActivePartId(newPart.id);
    setNewPartName('');
  };

  const handleRunCppKernel = () => {
    if (!activePart) return;
    const boxTool = CadGeometryKernel.createBox(80, 80, 80, 'CutoutTool');
    const res = MvpArchitectureEngine.executeCppCadKernelBoolean(activePart.solidEntity, boxTool, 'CUT');

    setCppExecutionTime(res.executionTimeMs);
    setCppLog(res.cppLog);
  };

  const handleExportStep = () => {
    if (!activePart) return;
    const stepStr = MvpArchitectureEngine.generateStepFileString(activePart.solidEntity);
    setStepDataString(stepStr);
    setStepNotification(`Exported ${activePart.name} to ISO 10303 STEP format!`);
    setTimeout(() => setStepNotification(''), 4000);
  };

  const handleSubmitComputeJob = () => {
    const job = MvpArchitectureEngine.submitComputeJob(
      `FEA Multiphysics Mesh Simulation on ${activePart?.name || 'Assembly'}`,
      'FEA_STRUCTURAL',
      'GPU_NVIDIA_H100'
    );
    setJobs([...MvpArchitectureEngine.listComputeJobs()]);
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold tracking-tight">SECP Architecture Infrastructure & Phase 1 MVP Test Suite</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
              ENTERPRISE PLATFORM ARCHITECTURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-End Infrastructure Validation: Web/Desktop UI → REST API → Core C++ CAD Kernel → PostgreSQL / Object Store → GPU Compute Job Queue → Digital Twin Edge.
          </p>
        </div>

        {/* Infrastructure Live Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" /> API & Kernel Online
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/80 text-sky-400 border border-sky-800 rounded-lg">
            <Database className="w-3.5 h-3.5" /> PostgreSQL Connected
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/80 text-purple-400 border border-purple-800 rounded-lg">
            <Cpu className="w-3.5 h-3.5" /> 2x GPU Workers
          </div>
        </div>
      </div>

      {/* SECP Architectural Topology Map */}
      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-sky-400" /> Distributed System Architecture Topology
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center font-mono text-xs">
          <div className="bg-slate-900 p-3 rounded border border-sky-800/80 flex flex-col items-center gap-1">
            <Globe className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-slate-200">Web / Desktop UI</span>
            <span className="text-[10px] text-slate-400">React + WebGL</span>
          </div>

          <div className="bg-slate-900 p-3 rounded border border-indigo-800/80 flex flex-col items-center gap-1">
            <Server className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-slate-200">SECP REST API</span>
            <span className="text-[10px] text-slate-400">Node/Express Gateway</span>
          </div>

          <div className="bg-slate-900 p-3 rounded border border-emerald-800/80 flex flex-col items-center gap-1">
            <Wrench className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-slate-200">C++ CAD Kernel</span>
            <span className="text-[10px] text-slate-400">WASM OpenCASCADE</span>
          </div>

          <div className="bg-slate-900 p-3 rounded border border-purple-800/80 flex flex-col items-center gap-1">
            <Database className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-slate-200">PostgreSQL + S3</span>
            <span className="text-[10px] text-slate-400">Projects / STEP Blobs</span>
          </div>

          <div className="bg-slate-900 p-3 rounded border border-amber-800/80 flex flex-col items-center gap-1">
            <Cpu className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-slate-200">GPU Job Queue</span>
            <span className="text-[10px] text-slate-400">NVIDIA H100 FEA/CFD</span>
          </div>

          <div className="bg-slate-900 p-3 rounded border border-rose-800/80 flex flex-col items-center gap-1">
            <Radio className="w-5 h-5 text-rose-400" />
            <span className="font-bold text-slate-200">Digital Twin Edge</span>
            <span className="text-[10px] text-slate-400">Telemetry Stream</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects, Parts & 3D Viewport Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Projects & Parts Management */}
        <div className="flex flex-col gap-6">
          {/* Projects List & Create */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-sky-400" /> Projects Store
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{projects.length} Projects</span>
            </div>

            {/* Project Selector List */}
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {projects.map(prj => (
                <div
                  key={prj.id}
                  onClick={() => setActiveProjectId(prj.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    prj.id === activeProjectId
                      ? 'bg-sky-950/60 border-sky-500 text-sky-300'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{prj.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{prj.id} • {prj.unitSystem}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-sky-400 border border-slate-800 rounded">
                    {prj.partsCount} Parts
                  </span>
                </div>
              ))}
            </div>

            {/* Create Project Form */}
            <form onSubmit={handleCreateProject} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="New project name..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </form>
          </div>

          {/* Parts List & Create */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Box className="w-4 h-4 text-emerald-400" /> Parametric Parts ({parts.length})
              </h3>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {parts.map(part => (
                <div
                  key={part.id}
                  onClick={() => setActivePartId(part.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    part.id === activePartId
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{part.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{part.material}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Vol: {part.solidEntity.volumeM3.toFixed(5)} m³
                  </span>
                </div>
              ))}
            </div>

            {/* Create Part Form */}
            <form onSubmit={handleCreatePart} className="flex flex-col gap-2 pt-2 border-t border-slate-800 text-xs">
              <input
                type="text"
                value={newPartName}
                onChange={e => setNewPartName(e.target.value)}
                placeholder="New Part Name (e.g. Shaft, Bracket)..."
                className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newPartType}
                  onChange={e => setNewPartType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-300"
                >
                  <option value="FLANGE">Hydraulic Flange</option>
                  <option value="CYLINDER">Cylinder Solid</option>
                  <option value="BOX">Box Casing</option>
                </select>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Part
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Column 2 & 3: 3D Viewport Controls, Feature Tree & C++ Kernel Execution */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active Part Viewport & Feature Tree Inspector */}
          {activePart ? (
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400">{activePart.id}</span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-800 rounded">
                      Material: {activePart.material}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-1">{activePart.name}</h3>
                </div>

                {/* Viewport Shading Toggles */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-500">Render Mode:</span>
                  <button
                    onClick={() => setViewMode('SHADED')}
                    className={`px-2.5 py-1 rounded ${viewMode === 'SHADED' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                  >
                    Shaded B-Rep
                  </button>
                  <button
                    onClick={() => setViewMode('WIREFRAME')}
                    className={`px-2.5 py-1 rounded ${viewMode === 'WIREFRAME' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                  >
                    Wireframe
                  </button>
                  <button
                    onClick={() => setViewMode('NODES')}
                    className={`px-2.5 py-1 rounded ${viewMode === 'NODES' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                  >
                    Mesh FEA
                  </button>
                </div>
              </div>

              {/* 3D Simulated Viewport Canvas Box */}
              <div className="bg-slate-900/90 h-52 rounded-lg border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden p-4">
                <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-500 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                  SECP 3D Viewport Kernel | Mode: {viewMode} | Facets: {activePart.solidEntity.mesh.indices.length / 3}
                </div>

                {/* Simulated 3D Graphic */}
                <div className="flex flex-col items-center justify-center gap-2 my-auto text-sky-400">
                  <Box className="w-16 h-16 animate-pulse text-sky-400" />
                  <span className="text-xs font-mono text-slate-300 font-bold">
                    3D Parametric Solid B-Rep Mesh Rendered
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 text-[10px] font-mono text-emerald-400 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                  Volume = {activePart.solidEntity.volumeM3.toFixed(6)} m³
                </div>
              </div>

              {/* Feature Tree Operations */}
              <div className="bg-slate-900 p-3.5 rounded border border-slate-800 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Parametric Feature History Tree
                </span>

                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  {activePart.featureHistory.map((feat, idx) => (
                    <div
                      key={feat.id}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-sky-300 rounded flex items-center gap-2"
                    >
                      <span className="text-slate-500">#{idx + 1}</span>
                      <span className="font-bold">{feat.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Toolbar: C++ Kernel Execution, STEP Export, GPU Job Dispatch */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleRunCppKernel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Play className="w-3.5 h-3.5" /> Execute C++ CSG Boolean Operation
                </button>

                <button
                  onClick={handleExportStep}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-sky-600/20"
                >
                  <Download className="w-3.5 h-3.5" /> Export ISO 10303 STEP File
                </button>

                <button
                  onClick={handleSubmitComputeJob}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-purple-600/20"
                >
                  <Cpu className="w-3.5 h-3.5" /> Dispatch FEA Mesh to GPU Queue
                </button>
              </div>

              {/* C++ Kernel Execution Log */}
              {cppLog.length > 0 && (
                <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-[11px] text-slate-300 flex flex-col gap-1">
                  <div className="flex items-center justify-between pb-1 text-emerald-400 font-bold border-b border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> C++ OpenCASCADE Kernel Native Execution Console
                    </span>
                    <span>Elapsed: {cppExecutionTime} ms</span>
                  </div>
                  {cppLog.map((line, i) => (
                    <div key={i} className="text-slate-400">{line}</div>
                  ))}
                </div>
              )}

              {/* STEP Notification */}
              {stepNotification && (
                <div className="p-3 bg-sky-950/80 border border-sky-800 text-sky-300 rounded text-xs font-mono flex items-center justify-between">
                  <span>{stepNotification}</span>
                  <span className="text-[10px] text-slate-400">ISO 10303-21 Compliant</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950 p-8 rounded-lg border border-slate-800 text-center text-slate-500 text-xs">
              Select or create a part to inspect 3D geometry & execute CAD kernel operations.
            </div>
          )}

          {/* Compute Jobs Queue Table */}
          <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> High-Performance Compute Job Queue ({jobs.length})
            </h3>

            <div className="flex flex-col gap-2">
              {jobs.map(j => (
                <div
                  key={j.jobId}
                  className="bg-slate-900 p-3.5 rounded border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-400">{j.jobId}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-300 border border-slate-800 rounded">
                        Worker: {j.assignedWorker}
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 mt-0.5">{j.title}</span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">{j.status}</span>
                      <span className="text-[10px] font-mono text-slate-500">Submitted: {j.submittedAt}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
